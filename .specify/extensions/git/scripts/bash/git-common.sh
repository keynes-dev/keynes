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
    local raw="$1"
    if [[ "$raw" =~ ^feat/([0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*)$ ]]; then
        printf '%s\n' "${BASH_REMATCH[1]}"
    else
        printf '%s\n' "$raw"
    fi
}

check_feature_branch() {
    local raw="$1"
    local has_git_repo="$2"

    if [[ "$has_git_repo" != "true" ]]; then
        echo "ERROR: Git is required for Keynes feature work" >&2
        return 1
    fi

    if [[ ! "$raw" =~ ^feat/[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
        echo "ERROR: Not on a feature branch. Current branch: $raw" >&2
        echo "Feature branches must be named like feat/0001-feature-name" >&2
        return 1
    fi

    return 0
}
