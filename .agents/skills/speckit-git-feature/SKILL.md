---
name: speckit-git-feature
description: Start a Keynes feature from one selected Linear issue and its generated branch
---

# Start a Linear-native feature

Fetch the selected Linear issue. Read its UUID, identifier, exact title, URL, project, lifecycle state, and `gitBranchName`.

Reject the issue if it is archived, canceled, completed, or already bound to a feature directory. Continue only when the user explicitly requests recovery and the existing manifest has the same key, UUID, URL, title, branch, and directory.

Run the platform command once with the exact Linear values:

- Bash: `.specify/extensions/git/scripts/bash/create-new-feature.sh --json --linear-issue-id "<uuid>" --linear-issue-identifier "KEY-123" --linear-issue-title "<exact title>" --linear-issue-url "<url>" --linear-branch-name "<gitBranchName>"`
- PowerShell: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -LinearIssueId "<uuid>" -LinearIssueIdentifier "KEY-123" -LinearIssueTitle "<exact title>" -LinearIssueUrl "<url>" -LinearBranchName "<gitBranchName>"`

The command validates `gitBranchName` with `git check-ref-format --branch`, creates the exact branch, writes the version 3 manifest, creates `docs/features/<final-branch-segment>/`, and materializes the specification template. Use its returned `FEATURE_ID`, `FEATURE_TITLE`, `BRANCH_NAME`, `FEATURE_DIR`, `FEATURE_FILE`, `LINEAR_ISSUE_ID`, `LINEAR_ISSUE_IDENTIFIER`, and `LINEAR_ISSUE_URL` without modification.

Never allocate a number, make a slug, parse identity from a branch, or construct a branch name from the key or title.
