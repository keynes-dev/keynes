#!/usr/bin/env pwsh
# Git-specific common functions for the git extension.
# Extracted from scripts/powershell/common.ps1 — contains only git-specific
# branch validation and detection logic.

function Test-HasGit {
    param([string]$RepoRoot = (Get-Location))
    try {
        if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { return $false }
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return $false }
        git -C $RepoRoot rev-parse --is-inside-work-tree 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Get-SpecKitEffectiveBranchName {
    param([string]$Branch)
    if ($Branch -match '^feat/(\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*)$') {
        return $Matches[1]
    }
    return $Branch
}

function Test-FeatureBranch {
    param(
        [string]$Branch,
        [bool]$HasGit = $true
    )

    if (-not $HasGit) {
        [Console]::Error.WriteLine("ERROR: Git is required for Keynes feature work")
        return $false
    }

    $raw = $Branch
    if ($Branch -notmatch '^feat/\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$') {
        [Console]::Error.WriteLine("ERROR: Not on a feature branch. Current branch: $raw")
        [Console]::Error.WriteLine("Feature branches must be named like feat/0001-feature-name")
        return $false
    }
    return $true
}
