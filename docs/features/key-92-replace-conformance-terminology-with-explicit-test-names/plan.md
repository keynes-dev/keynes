# Implementation Plan: Explicit test names

**Branch**: `key-92-replace-conformance-terminology-with-explicit-test-names` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Summary

Apply KEY-92's naming table atomically without changing test behavior. Emit only the new evidence schema, preserve historical records, and coordinate the required-check transition after authorized publication.

## Technical Context

**Language/Version**: TypeScript 7, supported Node 24 or 26.
**Primary Dependencies**: Existing pnpm 11.21.0, Vitest 4, Docker and native PostgreSQL runner.
**Storage**: Existing in-process SQLite and native PostgreSQL fixtures. No storage changes.
**Testing**: Provider-free PR checks, formatting, paired real database execution, then authorized hosted verification.
**Target Platform**: macOS locally and Ubuntu GitHub Actions.
**Project Type**: Internal test infrastructure within the existing monorepo.
**Performance Goals**: Preserve existing execution and timeout behavior.
**Constraints**: No aliases, weakened validation, runtime redesign, or historical evidence edits.
**Scale/Scope**: Packages, runner, CI, contributor guidance, applicable KEY-75 documents, and two constitution phrases.

## Constitution Check

Pre-research: PASS. One accepted feature and merged KEY-75 prerequisite. Budget storage and application-owned effects do not change. Policy, security, replay, transactions, recovery, and public Budget commands do not change. Mechanical renaming uses existing tests rather than introducing failing runtime tests. Both real runtimes remain required. Git owns detailed artifacts; Linear owns status.

Post-design: PASS. New schema identity deliberately has no compatibility support, as selected by the user. Historical evidence remains tied to original revisions. Constitution 8.0.1 is a wording clarification only. Hosted policy and publication remain separately authorized and cannot be claimed from local results.

## Project Structure

Feature artifacts live beside this plan: spec.md, research.md, data-model.md, contracts/test-names.md, quickstart.md, tasks.md, and evidence/acceptance.md.

Rename packages/contracts/conformance to packages/contracts/contract-tests and packages/sdk/test/conformance to packages/sdk/test/contract. Rename scripts/run-conformance.ts and its test to run-sqlite-postgres. Update all package and native scenario consumers together. Keep existing feature directory identities.

## Implementation decisions

Use the full naming table in [contracts/test-names.md](contracts/test-names.md). Classify historical docs before editing. Update current KEY-75 normative guidance and move its check contract, preserving dated observations, recorded commands, output, and evidence. Other completed feature artifacts and ADRs remain historical.

CI emits the new check immediately in the candidate. The existing old required context remains enforced until the candidate's new context is observed and an authorized atomic policy update replaces it. Preserve strict=true, enforce_admins=true, Repository and tests, and app_id=15368. Re-read policy immediately before mutation to preserve any newly added requirements. Retain pre/post readbacks and native failure proof. Do not merge automatically.

## Verification

Run pnpm test:pr, pnpm format, and pnpm test:sqlite-postgres with a fresh output directory. Review renamed full names and existing failure-path tests. Preserve all artifact hashes and cleanup requirements. Repeat tracked-file and untracked authored-file content/path inventory, classifying each surviving match in evidence. Record exact base, working-input digest, commands, results, and NOT RUN hosted lanes.

## Complexity Tracking

No constitutional exceptions.
