#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
AI_TOOL_DATA_DIR="${AI_TOOL_DATA_DIR:-${HOME}/.codex}"
AI_TOOL_DATA_BACKUP_FILE="${AI_TOOL_DATA_BACKUP_FILE:-${SCRIPT_DIR}/ai-tool-data-backup.tar.gz}"
RESTORE_MARKER="${AI_TOOL_DATA_DIR}/.restore-complete"

TEMP_BACKUP=""
RESTORE_DIR=""

cleanup() {
    if [[ -n "${TEMP_BACKUP}" ]]; then
        rm -f -- "${TEMP_BACKUP}"
    fi

    if [[ -n "${RESTORE_DIR}" ]]; then
        rm -rf -- "${RESTORE_DIR}"
    fi
}

trap cleanup EXIT

has_ai_tool_data() {
    [[ -n "$(find "$1" -mindepth 1 \
        \( -type f -o -type l \) \
        ! -name '.restore-complete' \
        -print -quit)" ]]
}

backup_ai_tool_data() {
    if [[ -e "${AI_TOOL_DATA_BACKUP_FILE}" || -L "${AI_TOOL_DATA_BACKUP_FILE}" ]]; then
        echo "AI tool data backup already exists; refusing to overwrite: ${AI_TOOL_DATA_BACKUP_FILE}" >&2
        return 1
    fi

    if [[ ! -d "${AI_TOOL_DATA_DIR}" ]] || ! has_ai_tool_data "${AI_TOOL_DATA_DIR}"; then
        echo "No AI tool data found to back up: ${AI_TOOL_DATA_DIR}" >&2
        return 1
    fi

    umask 077
    TEMP_BACKUP="$(mktemp "${SCRIPT_DIR}/.ai-tool-data-backup.tar.gz.tmp.XXXXXX")"

    echo "Creating AI tool data backup..."
    tar \
        --exclude='./.restore-complete' \
        -C "${AI_TOOL_DATA_DIR}" \
        -czf "${TEMP_BACKUP}" \
        .

    if ! tar -tzf "${TEMP_BACKUP}" >/dev/null; then
        echo "AI tool data backup integrity check failed." >&2
        return 1
    fi

    mv -- "${TEMP_BACKUP}" "${AI_TOOL_DATA_BACKUP_FILE}"
    TEMP_BACKUP=""

    echo "AI tool data backup created successfully: ${AI_TOOL_DATA_BACKUP_FILE}"
}

check_ai_tool_data_directory_access() {
    local write_test="${AI_TOOL_DATA_DIR}/.write-test.$$"

    mkdir -p "${AI_TOOL_DATA_DIR}"

    if ! printf 'ok\n' >"${write_test}"; then
        echo "AI tool data directory is not writable by $(id -un): ${AI_TOOL_DATA_DIR}" >&2
        return 1
    fi

    if [[ "$(<"${write_test}")" != "ok" ]]; then
        rm -f -- "${write_test}"
        echo "AI tool data directory write check failed: ${AI_TOOL_DATA_DIR}" >&2
        return 1
    fi

    rm -f -- "${write_test}"
    echo "AI tool data directory is readable and writable by $(id -un): ${AI_TOOL_DATA_DIR}"
}

restore_ai_tool_data() {
    check_ai_tool_data_directory_access

    if [[ -f "${RESTORE_MARKER}" ]]; then
        echo "AI tool data backup has already been restored; skipping."
        return
    fi

    if has_ai_tool_data "${AI_TOOL_DATA_DIR}"; then
        echo "Existing AI tool data found; restore skipped to avoid overwriting."
        return
    fi

    if [[ ! -f "${AI_TOOL_DATA_BACKUP_FILE}" ]]; then
        echo "No AI tool data backup found; restore skipped."
        return
    fi

    if ! tar -tzf "${AI_TOOL_DATA_BACKUP_FILE}" >/dev/null; then
        echo "AI tool data backup integrity check failed; restore stopped." >&2
        return 1
    fi

    RESTORE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ai-tool-data-restore.XXXXXX")"
    tar -xzf "${AI_TOOL_DATA_BACKUP_FILE}" -C "${RESTORE_DIR}"
    rm -f -- "${RESTORE_DIR}/.restore-complete"

    if ! has_ai_tool_data "${RESTORE_DIR}"; then
        echo "AI tool data backup contains no data; restore stopped." >&2
        return 1
    fi

    echo "Restoring AI tool data backup..."
    cp -a "${RESTORE_DIR}/." "${AI_TOOL_DATA_DIR}/"
    touch "${RESTORE_MARKER}"

    echo "AI tool data backup restored successfully."
}

usage() {
    echo "Usage: $0 [--restore|--backup|--backup-codex]" >&2
}

case "${1:-}" in
    "" | "--restore")
        if [[ "$#" -gt 1 ]]; then
            usage
            exit 2
        fi

        restore_ai_tool_data
        ;;

    "--backup" | "--backup-codex")
        if [[ "$#" -ne 1 ]]; then
            usage
            exit 2
        fi

        backup_ai_tool_data
        ;;

    *)
        usage
        exit 2
        ;;
esac
