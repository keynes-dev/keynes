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

    $repoRoot = (git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0) { return $false }
    & node (Join-Path $repoRoot ".specify/scripts/feature-identity.mjs") active --json *> $null
    return ($LASTEXITCODE -eq 0)
}
