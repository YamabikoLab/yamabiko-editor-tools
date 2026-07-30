# Dev container shell customization

__DEVCONTAINER_SHELL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
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

cdthemes() {
    cd /var/www/html/wp-content/themes
}

cduploads() {
    cd /var/www/html/wp-content/uploads
}

PS1='\u@\h:$(devcontainer_prompt_dir)\$ '

# VS Code統合ターミナルのTTYをCodexフック用に記録する
if [[ $- == *i* ]] && tty -s; then
  tty > "${CODEX_HOME:-$HOME/.codex}/vscode-terminal"
fi

codex-dev() {
    if [[ -S /var/run/docker.sock ]]; then
        printf '%s\n' \
            'codex-dev: refusing to start because /var/run/docker.sock is mounted.' \
            >&2
        return 1
    fi

    command codex \
        --sandbox danger-full-access \
        --ask-for-approval on-request \
        "$@"
}