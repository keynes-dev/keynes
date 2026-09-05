# Implementation Plan: KEY-89 Restore a small upstream-compatible Spec Kit workflow

**Branch**: `key-89-restore-a-small-upstream-compatible-spec-kit-workflow` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Summary

Restore the managed 1.0.4 Codex integration in a separate checkout based on
KEY-74. Remove custom identity and orchestration, preserve authored artifacts,
and explain ordinary connector intake in the contributor workflow.

## Technical Context

**Language/Version**: upstream Bash scripts and Markdown; Specify CLI 1.0.4.
**Primary Dependencies**: Git, installed Codex integration, existing Linear connector.
**Storage**: local Markdown and upstream installation metadata; no runtime storage changes.
**Testing**: real CLI upgrades and scripts in disposable Git worktrees; existing
repository organization test and formatting. No new permanent lifecycle test framework.
**Target Platform**: current macOS Bash contributor environment; preserve upstream portability.
**Project Type**: contributor tooling maintenance.
**Constraints**: preserve existing feature docs, product principles, and parent worktree.
**Scale/Scope**: one toolchain reset, one independently reviewed PR after KEY-74.

## Constitution Check

Pre-design and post-design: one issue and one acceptance outcome, KEY-74 prerequisite
recorded, no product runtime change. Budget ownership, effects, Policy boundaries,
and shared commands are N/A because all product sources remain unchanged. Existing
SQLite/native PostgreSQL obligations are retained for future shared behavior features.
The user approved replacing the custom identity requirements with stock selection;
constitution 8.0.0 records that explicit amendment. No extension-based auto-commit,
sub-issue publication, background synchronization, or automatic completion remains.

## Project Structure

Feature artifacts live beside this plan. Upstream commands are materialized in
`.agents/skills`; upstream infrastructure and constitution live under `.specify`.
Contributor guidance lives in docs/workflow.md and AGENTS.md. Existing package
scripts and the repository organization test lose custom identity dependencies.

## Implementation decisions

1. Remove the Git extension using its manager and restore commands and shared
   infrastructure through the reviewed `integration upgrade ... --force` path.
2. Remove custom identity scripts/tests and customized workflow registration.
   Keep the stock local pointer, explicitly untrack it, and include every managed skill.
3. Keep constitution principles in their owner; trim obsolete delivery requirements.
   Explain intake/resume/upgrade in ordinary instructions and add an ADR without
   rewriting older records. No public SDK/API changes and no new contract files.
4. Verify real script resolution, existing-artifact preservation, isolated selections,
   clean-checkout materialization, same-version upgrades, and a small stock lifecycle.

## Complexity Tracking

The approved migration supersedes the old identity bootstrap before restoring
stock commands. Retaining that engine for its own removal would keep an unnecessary
parallel authority. Its removal is the migration path; no compatibility shim remains.
