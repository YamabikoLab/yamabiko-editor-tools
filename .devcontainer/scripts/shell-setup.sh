#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BASHRC_FILE="${HOME}/.bashrc"
DEVCONTAINER_SHELL_BASHRC="${SCRIPT_DIR}/devcontainer-shell.bash"
SOURCE_LINE="source ${DEVCONTAINER_SHELL_BASHRC}"
LEGACY_BASHRC_BASENAME="bashrc.bak"
OLD_SOURCE_LINE="source ${SCRIPT_DIR}/${LEGACY_BASHRC_BASENAME}"

touch "${BASHRC_FILE}"

if grep -Fxq "${OLD_SOURCE_LINE}" "${BASHRC_FILE}"; then
    temp_bashrc="$(mktemp)"
    grep -Fxv "${OLD_SOURCE_LINE}" "${BASHRC_FILE}" >"${temp_bashrc}" || true
    cat "${temp_bashrc}" >"${BASHRC_FILE}"
    rm -f "${temp_bashrc}"
fi

if grep -Fxq "${SOURCE_LINE}" "${BASHRC_FILE}"; then
    echo "Dev container shell customization is already configured."
else
    {
        printf '\n'
        printf '# Dev container shell customization\n'
        printf '%s\n' "${SOURCE_LINE}"
    } >>"${BASHRC_FILE}"

    echo "Dev container shell customization configured."
fi
