# Implementation Plan: Retain runtime measurement and CI improvements

**Branch**: `key-121-retain-runtime-measurement-and-ci-improvements` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

## Summary

Extend main's existing SQLite measurement path. Keep hard limits and existing parser/create/request timings, adding measured module identity, startup RSS sampling, full startup time, five cached offline install samples and request throughput. Keep package qualification explicit and include the existing Local groups in full paired qualification.

## Technical Context

**Language/Version**: TypeScript and Node ESM, Node >=24.
**Primary Dependencies**: Existing pnpm, Vitest and node:sqlite; no new packages.
**Storage**: New immutable JSON evidence files; no production storage change.
**Testing**: Existing performance, package, repository, paired and native suites.
**Target Platform**: Existing supported Node/OS policy; local run records actual environment.
**Project Type**: Internal maintenance tooling.
**Performance Goals**: Preserve existing archive, production-size, RSS and latency limits. Additional observations set no new gate.
**Constraints**: Exact archive and source identity; bounded subprocesses; no changed accounting or policy semantics.
**Scale/Scope**: 30 cold processes after 3 warmups, 100 requests after 10 warmups, 5 offline installs.

## Constitution Check

Before research and after design: PASS within the explicitly approved maintenance scope. SQLite already exists on main and the transition clause retains its checks until replacement qualification. The user canceled that replacement and assigned normative amendments to KEY-113. This feature preserves existing Budget storage, transaction boundaries, policies, replay and accounting. No policy/numeric rewrite or production API change. Validation tests precede tooling changes. Required checks remain unchanged; full native/package qualification stays explicit. One issue and one independently acceptable PR. Source, archive and exclusions are retained. Security and migration features are N/A for internal tooling; existing archive/subprocess validation is preserved.

## Project Structure

Existing files in `packages/sdk/test/performance/`, `packages/sdk/package.json`, `scripts/run-sqlite-postgres.ts`, `scripts/repository-organization.test.ts` and their existing tests. Feature documents live alongside this plan. No external API contract file is needed for internal tooling.

## Complexity Tracking

The approved SQLite decision precedes KEY-113's formal documentation amendment; this PR changes no runtime selection. Do not port PGlite observation/comparison machinery, snapshots, compiler changes, serial Turbo execution or PostgreSQL 18.3. Keep legacy workload meaning and limits; additional measurements are explicitly named.

See [research.md](research.md), [data-model.md](data-model.md) and [quickstart.md](quickstart.md).
