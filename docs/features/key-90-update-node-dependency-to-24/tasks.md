# Tasks: KEY-90 Update node dependency to 24+

## Phase 1: Setup

- [x] T001 Inspect current policy and record the bounded design in plan.md.

## Phase 2: Foundational verification

- [x] T002 Update existing regression expectations in scripts/run-conformance.test.ts and packages/sdk/test/package/qualify.test.ts; observe the version restriction failures.

## Phase 3: US1 - Use Node.js 24 and later

- [x] T003 [US1] Align package manifests, scripts/run-conformance.ts, and packages/sdk/test/package/qualify.ts with the minimum-only policy.
- [x] T004 [US1] Update packages/sdk/README.md and .github/workflows/sdk-package.yml, retaining per-consumer evidence.

## Phase 4: Validation

- [x] T005 Run local installation, provider-free and packed-consumer checks; record exact results and hosted limitations in acceptance.md.

## Dependencies and strategy

T001 -> T002 -> T003 -> T004 -> T005. One independently reviewable correction. No extra foundational code. Manifest and documentation edits are mechanical; executable checks receive failing regression coverage first. After implementation, local consumer runs for distinct Node versions can run independently against one archive. Hosted acceptance remains separate from local implementation completion.
