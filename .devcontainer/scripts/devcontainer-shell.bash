# Dev container shell customization

__DEVCONTAINER_SHELL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
__DEVCONTAINER_DEFAULT_WORKSPACE_DIR="$(cd -- "${__DEVCONTAINER_SHELL_DIR}/.." && pwd)"

devcontainer_workspace_dir() {
    printf '%s' "${DEVCONTAINER_WORKSPACE_DIR:-${__DEVCONTAINER_DEFAULT_WORKSPACE_DIR}}"
}

devcontainer_prompt_dir() {
    local workspace_dir
    workspace_dir="$(devcontainer_workspace_dir)"
    local current_dir="${PWD}"

    if [[ "${current_dir}" == "${workspace_dir}" ]]; then
        printf '~'
    elif [[ "${current_dir}" == "${workspace_dir}/"* ]]; then
        printf '~/%s' "${current_dir#"${workspace_dir}/"}"
    else
        printf '%s' "${current_dir}"
    fi
}

export CLICOLOR=1
export LANG="${LANG:-${LOCALE:-C.UTF-8}}"
export LC_ALL="${LC_ALL:-${LANG}}"

if command -v dircolors >/dev/null 2>&1; then
    eval "$(dircolors -b)"
fi

alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'
alias ..='cd ..'

cdw() {
    cd "$(devcontainer_workspace_dir)"
}

cdapp() {
    cd "$(devcontainer_workspace_dir)/app"
}

cdwp() {
    cd /var/www/html
}

cdplugins() {
    cd /var/www/html/wp-content/plugins
}

cdplugin() {
    local wordpress_plugin_dir="/var/www/html/wp-content/plugins/${COMPOSE_PROJECT_NAME:-}"
    local workspace_plugin_dir
    workspace_plugin_dir="$(devcontainer_workspace_dir)/app/plugin"

    if [[ -n "${COMPOSE_PROJECT_NAME:-}" && -d "${wordpress_plugin_dir}" ]]; then
        cd "${wordpress_plugin_dir}"
    elif [[ -d "${workspace_plugin_dir}" ]]; then
        cd "${workspace_plugin_dir}"
    else
        cd /var/www/html/wp-content/plugins
    fi
}

cdthemes() {
    cd /var/www/html/wp-content/themes
}

cduploads() {
    cd /var/www/html/wp-content/uploads
}

PS1='\u@\h:$(devcontainer_prompt_dir)\$ '
