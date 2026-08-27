#!/usr/bin/env pwsh

param(
    [switch]$Json,
    [switch]$DryRun,
    [switch]$AllowExistingBranch,
    [string]$ShortName,
    [string]$RoadmapStage,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Description
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../../../..")).Path
$arguments = @((Join-Path $repoRoot "tooling/repository/feature-identity.mjs"), "start")
if ($Json) { $arguments += "--json" }
if ($DryRun) { $arguments += "--dry-run" }
if ($AllowExistingBranch) { $arguments += "--allow-existing-branch" }
if ($ShortName) { $arguments += @("--short-name", $ShortName) }
if ($RoadmapStage) { $arguments += @("--roadmap-stage", $RoadmapStage) }
$arguments += $Description

& node @arguments
exit $LASTEXITCODE
