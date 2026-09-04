#!/usr/bin/env bash
# Git-specific common functions for the git extension.
# Extracted from scripts/bash/common.sh — contains only git-specific
# branch validation and detection logic.

# Check if we have git available at the repo root
has_git() {
    local repo_root="${1:-$(pwd)}"
    { [ -d "$repo_root/.git" ] || [ -f "$repo_root/.git" ]; } && \
        command -v git >/dev/null 2>&1 && \
        git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

spec_kit_effective_branch_name() {
    printf '%s\n' "$1"
}

check_feature_branch() {
    local raw="$1"
    local has_git_repo="$2"

    if [[ "$has_git_repo" != "true" ]]; then
        echo "ERROR: Git is required for Keynes feature work" >&2
        return 1
    fi

    local repo_root=$(get_repo_root)
    (cd "$repo_root" && node .specify/scripts/feature-identity.mjs active --json >/dev/null)
}
