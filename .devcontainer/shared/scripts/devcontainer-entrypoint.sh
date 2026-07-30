#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-/var/www/.codex}"
GH_CONFIG_DIR="${GH_CONFIG_DIR:-/var/www/.config/gh}"

mkdir -p /var/www/html "${CODEX_HOME}" "${GH_CONFIG_DIR}"

if [[ -S /var/run/docker.sock ]]; then
    docker_gid="$(stat -c '%g' /var/run/docker.sock)"

    if ! id -G www-data | tr ' ' '\n' | grep -qx "${docker_gid}"; then
        docker_group="$(getent group "${docker_gid}" | cut -d: -f1 || true)"

        if [[ -z "${docker_group}" ]]; then
            docker_group="docker-host"
            groupadd --gid "${docker_gid}" "${docker_group}"
        fi

        usermod --append --groups "${docker_group}" www-data
    fi
fi

install -o www-data -g www-data -m 0644 \
    /usr/local/share/codex-hooks/hooks.json \
    "${CODEX_HOME}/hooks.json"

chown -R www-data:www-data \
    /var/www/html \
    "${CODEX_HOME}" \
    "${GH_CONFIG_DIR}"

exec docker-entrypoint.sh "$@"
