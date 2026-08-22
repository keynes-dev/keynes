---
description: "Reserve one canonical Keynes feature identity"
---

# Create a feature branch

Create and switch to the next `feat/XXXX-kebab-name` branch. The command also writes the complete identity to `.specify/feature.json`. The specification workflow must use the returned directory and file without allocating again.

## Execution

Generate a concise lowercase kebab-case short name with two to four words, then run one command:

- Bash: `.specify/extensions/git/scripts/bash/create-new-feature.sh --json --short-name "<short-name>" "<description>"`
- PowerShell: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -ShortName "<short-name>" "<description>"`

Pass `--roadmap-stage "<stage name>"` or `-RoadmapStage "<stage name>"` when the feature belongs to a roadmap stage. Omit it for standalone work.

Git is required. Timestamp numbering, manual numbers, and arbitrary branch names are unsupported. A `GIT_BRANCH_NAME` override must already match the canonical branch and acts only as a recovery assertion.

Run the command once per feature. Its JSON result contains `FEATURE_ID`, `FEATURE_NUM`, `FEATURE_SLUG`, `BRANCH_NAME`, `FEATURE_DIR`, `FEATURE_FILE`, and `ROADMAP_STAGE`.
