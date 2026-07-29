#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-/var/www/.codex}"
GH_CONFIG_DIR="${GH_CONFIG_DIR:-/var/www/.config/gh}"

mkdir -p /var/www/html "${CODEX_HOME}" "${GH_CONFIG_DIR}"

install -o www-data -g www-data -m 0644 \
    /usr/local/share/codex-hooks/hooks.json \
    "${CODEX_HOME}/hooks.json"

chown -R www-data:www-data \
    /var/www/html \
    "${CODEX_HOME}" \
    "${GH_CONFIG_DIR}"

exec docker-entrypoint.sh "$@"
