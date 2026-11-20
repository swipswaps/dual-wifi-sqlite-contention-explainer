#!/usr/bin/env bash
umask 077

run_build() {
    local script_dir repo_root py_rc npm_rc build_rc check_rc
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    repo_root="$(cd "${script_dir}/.." && pwd)"

    python3 -m py_compile "${repo_root}/backend/main.py"
    py_rc=$?
    if [[ "$py_rc" -ne 0 ]]; then
        printf '[ERROR] backend/main.py syntax check failed (exit=%s)\n' "$py_rc"
        return "$py_rc"
    fi

    command -v npm
    npm_rc=$?
    if [[ "$npm_rc" -eq 0 ]]; then
        (
            cd "${repo_root}/explainer" || return 2
            npm install --no-audit --no-fund
            npm_rc=$?
            if [[ "$npm_rc" -ne 0 ]]; then
                return "$npm_rc"
            fi
            npm run build
            build_rc=$?
            if [[ "$build_rc" -ne 0 ]]; then
                return "$build_rc"
            fi
            test -s dist/index.html
            check_rc=$?
            return "$check_rc"
        )
        build_rc=$?
        if [[ "$build_rc" -ne 0 ]]; then
            printf '[ERROR] Frontend build failed (exit=%s)\n' "$build_rc"
            return "$build_rc"
        fi
    fi

    printf 'Verified backend syntax and frontend build.\n'
    return 0
}

run_build "$@"
