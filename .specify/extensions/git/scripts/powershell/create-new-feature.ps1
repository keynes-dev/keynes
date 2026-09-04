#!/usr/bin/env pwsh

param(
    [switch]$Json,
    [switch]$DryRun,
    [switch]$AllowExistingBranch,
    [string]$LinearIssueId,
    [string]$LinearIssueIdentifier,
    [string]$LinearIssueTitle,
    [string]$LinearIssueUrl,
    [string]$LinearBranchName
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../../..")).Path
$arguments = @((Join-Path $repoRoot ".specify/scripts/feature-identity.mjs"), "start")
if ($Json) { $arguments += "--json" }
if ($DryRun) { $arguments += "--dry-run" }
if ($AllowExistingBranch) { $arguments += "--allow-existing-branch" }
if ($LinearIssueId) { $arguments += @("--linear-issue-id", $LinearIssueId) }
if ($LinearIssueIdentifier) { $arguments += @("--linear-issue-identifier", $LinearIssueIdentifier) }
if ($LinearIssueTitle) { $arguments += @("--linear-issue-title", $LinearIssueTitle) }
if ($LinearIssueUrl) { $arguments += @("--linear-issue-url", $LinearIssueUrl) }
if ($LinearBranchName) { $arguments += @("--linear-branch-name", $LinearBranchName) }

& node @arguments
exit $LASTEXITCODE
