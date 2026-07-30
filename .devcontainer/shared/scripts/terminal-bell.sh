#!/usr/bin/env bash

# Codexから渡されるJSONを読み捨てる
cat >/dev/null

terminal_file="${CODEX_HOME:-$HOME/.codex}/vscode-terminal"

if [[ -r "$terminal_file" ]]; then
    terminal="$(<"$terminal_file")"

    if [[ "$terminal" == /dev/pts/* && -w "$terminal" ]]; then
        printf '\a' > "$terminal"
    fi
fi

printf '{}\n'