# Git Branching Workflow Extension

Git repository initialization, Linear-native feature branches, phase stacks, validation, remote detection, and auto-commit for Spec Kit.

## Overview

This extension provides Git operations as an optional, self-contained module. It manages:

- **Repository initialization** with configurable commit messages
- **Feature branch creation** with the exact key, title, UUID, URL, and branch returned by Linear
- **Branch validation** to ensure branch, manifest, specification, and Linear reference agree
- **Phase stack management** with branches recorded in `tasks.md`
- **Git remote detection** for GitHub integration (e.g., issue creation)
- **Auto-commit** after core commands (configurable per-command with custom messages)

## Commands

| Command                  | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| `speckit.git.initialize` | Initialize a Git repository with a configurable commit message             |
| `speckit.git.feature`    | Reserve one canonical feature identity and branch                          |
| `speckit.git.validate`   | Validate current branch follows feature branch naming conventions          |
| `speckit.git.remote`     | Detect Git remote URL for GitHub integration                               |
| `speckit.git.commit`     | Auto-commit changes (configurable per-command enable/disable and messages) |
| `speckit.git.stack`      | Validate, navigate, rebase, push, and submit the recorded phase stack      |

## Hooks

| Event                  | Command                  | Optional | Description                                       |
| ---------------------- | ------------------------ | -------- | ------------------------------------------------- |
| `before_constitution`  | `speckit.git.initialize` | No       | Init git repo before constitution                 |
| `before_specify`       | `speckit.git.feature`    | No       | Create feature branch before specification        |
| `before_clarify`       | `speckit.git.commit`     | Yes      | Commit outstanding changes before clarification   |
| `before_plan`          | `speckit.git.commit`     | Yes      | Commit outstanding changes before planning        |
| `before_tasks`         | `speckit.git.commit`     | Yes      | Commit outstanding changes before task generation |
| `before_implement`     | `speckit.git.commit`     | Yes      | Commit outstanding changes before implementation  |
| `before_checklist`     | `speckit.git.commit`     | Yes      | Commit outstanding changes before checklist       |
| `before_analyze`       | `speckit.git.commit`     | Yes      | Commit outstanding changes before analysis        |
| `before_taskstoissues` | `speckit.git.commit`     | Yes      | Commit outstanding changes before issue sync      |
| `after_constitution`   | `speckit.git.commit`     | Yes      | Auto-commit after constitution update             |
| `after_specify`        | `speckit.git.commit`     | Yes      | Auto-commit after specification                   |
| `after_clarify`        | `speckit.git.commit`     | Yes      | Auto-commit after clarification                   |
| `after_plan`           | `speckit.git.commit`     | Yes      | Auto-commit after planning                        |
| `after_tasks`          | `speckit.git.commit`     | Yes      | Auto-commit after task generation                 |
| `after_implement`      | `speckit.git.commit`     | Yes      | Auto-commit after implementation                  |
| `after_checklist`      | `speckit.git.commit`     | Yes      | Auto-commit after checklist                       |
| `after_analyze`        | `speckit.git.commit`     | Yes      | Auto-commit after analysis                        |
| `after_taskstoissues`  | `speckit.git.commit`     | Yes      | Auto-commit after issue sync                      |

## Configuration

Configuration is stored in `.specify/extensions/git/git-config.yml`:

```yaml
# Linear returns the exact branch for every feature and phase.
branch_source: linear

# Custom commit message for git init
init_commit_message: "[Spec Kit] Initial commit"

# Auto-commit per command (all disabled by default)
# Example: enable auto-commit after specify
auto_commit:
  default: false
  after_specify:
    enabled: true
    message: "[Spec Kit] Add specification"
```

## Installation

```bash
# Install the bundled git extension (no network required)
specify extension add git
```

## Disabling

```bash
# Disable the git extension
specify extension disable git

# Re-enable it
specify extension enable git
```

## Git requirement

Keynes feature creation and validation require Git. Feature creation requires the exact UUID, identifier, title, URL, and `gitBranchName` of an existing Linear issue. Phase stack commands require the official `github/gh-stack` extension. Repository validation checks stored values offline.

```bash
gh extension install github/gh-stack
```

## Scripts

The extension bundles cross-platform scripts:

- `scripts/bash/create-new-feature.sh` — Bash implementation
- `scripts/bash/git-common.sh` — Shared Git utilities (Bash)
- `scripts/powershell/create-new-feature.ps1` — PowerShell implementation
- `scripts/powershell/git-common.ps1` — Shared Git utilities (PowerShell)
