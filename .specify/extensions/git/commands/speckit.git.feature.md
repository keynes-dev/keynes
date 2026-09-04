---
description: Start a feature from one selected Linear issue
---

# Start a Linear-native feature

Fetch the selected issue and reject archived, canceled, completed, or already-bound work unless recovery is explicit. Pass its exact values to one platform command:

- Bash: `.specify/extensions/git/scripts/bash/create-new-feature.sh --json --linear-issue-id "<uuid>" --linear-issue-identifier "KEY-123" --linear-issue-title "<exact title>" --linear-issue-url "<url>" --linear-branch-name "<gitBranchName>"`
- PowerShell: `.specify/extensions/git/scripts/powershell/create-new-feature.ps1 -Json -LinearIssueId "<uuid>" -LinearIssueIdentifier "KEY-123" -LinearIssueTitle "<exact title>" -LinearIssueUrl "<url>" -LinearBranchName "<gitBranchName>"`

Use the returned identity without modification. Never allocate a number, create a slug, or derive a branch.
