#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENVIRONMENTS_DIR="${REPOSITORY_ROOT}/environments"
readonly COMPOSE_FILE="${REPOSITORY_ROOT}/docker/compose.environment.yaml"

usage() {
    cat <<'USAGE'
Usage: ./scripts/env.sh <environment> <command>

Commands:
  up       Build and start the environment
  down     Stop and remove the environment containers and network
  reset    Remove the environment including volumes, then start it again
  status   Show the environment containers
  logs     Follow the environment logs
  setup    Run scripts/setup-wordpress.sh inside the WordPress container
  config   Render the resolved Compose configuration
USAGE
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

load_environment() {
    local environment_name="$1"
    local environment_file="${ENVIRONMENTS_DIR}/${environment_name}.env"

    [[ "$environment_name" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] \
        || fail "Invalid environment name: ${environment_name}"
    [[ -f "$environment_file" ]] \
        || fail "Environment definition not found: environments/${environment_name}.env"

    set -a
    # shellcheck disable=SC1090
    source "$environment_file"
    set +a

    readonly ENVIRONMENT_FILE="$environment_file"

    local required_variables=(
        ENVIRONMENT_NAME
        COMPOSE_PROJECT_NAME
        WORDPRESS_IMAGE_TAG
        WORDPRESS_PORT
        WORDPRESS_SITE_URL
    )
    local variable

    for variable in "${required_variables[@]}"; do
        [[ -n "${!variable:-}" ]] || fail "${variable} is required in ${environment_file}"
    done

    [[ "$ENVIRONMENT_NAME" == "$environment_name" ]] \
        || fail "ENVIRONMENT_NAME must match the file name: ${environment_name}"
    [[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]+$ ]] \
        || fail "Invalid COMPOSE_PROJECT_NAME: ${COMPOSE_PROJECT_NAME}"
    [[ "$WORDPRESS_PORT" =~ ^[0-9]+$ ]] \
        || fail "WORDPRESS_PORT must be numeric: ${WORDPRESS_PORT}"
    ((WORDPRESS_PORT >= 1 && WORDPRESS_PORT <= 65535)) \
        || fail "WORDPRESS_PORT must be between 1 and 65535: ${WORDPRESS_PORT}"
    [[ "$WORDPRESS_SITE_URL" == "http://127.0.0.1:${WORDPRESS_PORT}" \
        || "$WORDPRESS_SITE_URL" == "http://localhost:${WORDPRESS_PORT}" ]] \
        || fail "WORDPRESS_SITE_URL must use WORDPRESS_PORT (${WORDPRESS_PORT})"
}

check_duplicate_ports() {
    local candidate_file candidate_port candidate_name

    shopt -s nullglob
    for candidate_file in "${ENVIRONMENTS_DIR}"/*.env; do
        [[ "$candidate_file" == "$ENVIRONMENT_FILE" ]] && continue

        candidate_port="$(sed -n 's/^WORDPRESS_PORT=//p' "$candidate_file" | tail -n 1)"
        if [[ "$candidate_port" == "$WORDPRESS_PORT" ]]; then
            candidate_name="$(basename "$candidate_file" .env)"
            fail "WORDPRESS_PORT ${WORDPRESS_PORT} is also used by environment '${candidate_name}'"
        fi
    done
    shopt -u nullglob
}

compose() {
    docker compose \
        --env-file "$ENVIRONMENT_FILE" \
        --file "$COMPOSE_FILE" \
        "$@"
}

main() {
    [[ $# -eq 2 ]] || {
        usage >&2
        exit 2
    }

    local environment_name="$1"
    local command_name="$2"

    require_command docker
    docker compose version >/dev/null 2>&1 \
        || fail "Docker Compose v2 is required"

    load_environment "$environment_name"
    check_duplicate_ports

    case "$command_name" in
        up)
            compose up --detach --build
            printf 'Started %s at %s\n' "$ENVIRONMENT_NAME" "$WORDPRESS_SITE_URL"
            ;;
        down)
            compose down --remove-orphans
            ;;
        reset)
            compose down --volumes --remove-orphans
            compose up --detach --build
            printf 'Reset %s at %s\n' "$ENVIRONMENT_NAME" "$WORDPRESS_SITE_URL"
            ;;
        status)
            compose ps
            ;;
        logs)
            compose logs --follow
            ;;
        setup)
            [[ -f "${REPOSITORY_ROOT}/scripts/setup-wordpress.sh" ]] \
                || fail "scripts/setup-wordpress.sh will be added in Issue #1 step 7"
            compose exec --user www-data wordpress \
                bash /workspaces/yamabiko-blocks/scripts/setup-wordpress.sh \
                "/workspaces/yamabiko-blocks/environments/${environment_name}.env"
            ;;
        config)
            compose config
            ;;
        *)
            usage >&2
            fail "Unknown command: ${command_name}"
            ;;
    esac
}

main "$@"
