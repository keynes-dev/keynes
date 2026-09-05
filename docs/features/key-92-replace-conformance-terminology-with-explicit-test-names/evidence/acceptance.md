# Acceptance evidence: KEY-92

## Source and environment

Base: `6dba2517580da18a088a22f0b05c95bdf594ea0a`, merged KEY-75. Branch: `key-92-replace-conformance-terminology-with-explicit-test-names`. The local KEY-90 commit is excluded.

Host: macOS, Node 26.5.0, pnpm 11.21.0, Docker 29.6.2. The installed Node 24.11.0 was rejected by locked jsdom's engine range during dependency installation; Node 26.5.0 installed frozen dependencies successfully. No package or lockfile engine changes were made.

## Provider-free verification

- `pnpm install --frozen-lockfile`: PASS with Node 26.5.0.
- `pnpm test:pr`: PASS on implementation working inputs before the clean local qualification commit. Runner tests: 125; repository tests: 8; contracts: 51; SDK: 341; PostgreSQL provider-free: 79; web: 24. Contracts also execute in the generator gate. All 11 Turbo tasks passed; types and dependency boundaries passed.
- Initial PR attempt stopped on formatting differences. Targeted formatting repaired them; the complete PR command then passed.
- `pnpm format`: PASS after the authored documents and implementation were formatted.
- Changed-document relative Markdown links: PASS, zero missing targets.
- Diff review: purpose-specific identifiers, test descriptions, paths and formatting only in implementation files. Shared scenario bodies and runtime source are unchanged. Required native inventory descriptions move with their tests.
- Active packages, scripts, workflow, and package commands: zero old-term content matches. All remaining historical content and stable paths are classified in [rename-inventory.md](rename-inventory.md).
- Spec Kit artifact analysis: six functional requirements and three success criteria map to T003-T010; zero blocking ambiguities, unmapped requirements, or constitutional conflicts. Requirements checklist passed. No extension hooks are installed.

## Real database qualification

PASS: `pnpm test:sqlite-postgres -- --output .artifacts/sqlite-postgres/key92-attempt-1`, exit 0, on clean implementation commit `d81d797acab894899e7787a7b09e14cd6cc1e8a8`.

Attempt `a221c2b1-a108-4540-8b1b-86423d1edab4` ran from 2026-09-05T06:44:57.308Z to 2026-09-05T06:45:26.704Z. SQLite: 37/37 passed. Native PostgreSQL: 208/208 passed. Both had zero skipped or failed tests, complete matching shared names, and passed cleanup. The manifest observes the same clean commit before and after execution.

Retained byte-for-byte bundle: [manifest](local-d81d797/manifest.json), [SQLite report](local-d81d797/sqlite.vitest.json), [PostgreSQL report](local-d81d797/postgresql.json.vitest.json), [native acceptance](local-d81d797/postgresql.json), [native observations](local-d81d797/postgresql.json.observations.json). Copied file hashes were checked against the manifest. Manifest SHA-256: `191cc5ff881a67fa23624a6ce13d1e882198b1a83e85ce9f93462b87cceef25e`.

`pnpm test:pr` was rerun successfully on this exact clean implementation commit after native execution: 11/11 Turbo tasks passed, no cached tasks. The later evidence-only commit retains these results and does not claim that it was the original tested revision.

All nine shared scenario files are byte-identical to their previous paths at the base. All 25 KEY-75 evidence files are byte-identical to the base. Upstream-managed skills, scripts, templates, and generated contracts are unchanged.

## Hosted acceptance boundary

NOT RUN: new CI check observation, hosted artifact receipts, native-failure blocked-merge demonstration, and policy mutation/readback. Local implementation does not qualify SC-003 or hosted FR-004 acceptance. The pre-change readback and exact proposed status-check payload are retained beside this record; [hosted-transition.md](hosted-transition.md) describes the coordinated transition.

The existing old required context remains enforced, with strict updates and admin enforcement. Publication and policy mutation await authorization under docs/workflow.md. Artifacts are local-only; Linear links and status are unchanged. No merge was attempted.

A direct validator check using the retained manifest accepted the new schema and rejected the old schema with `Manifest identity mismatch`. Final content-and-path inventory found zero unclassified active matches.

## Task disposition

T001-T008: complete. T009: local transition payload and demonstration prepared; execution blocked on publication and policy authorization. T010: local evidence reconciliation complete, with hosted acceptance explicitly incomplete. Local implementation satisfies FR-001, FR-002, FR-003, FR-005, FR-006, SC-001 and SC-002. FR-004 is implemented locally but hosted enforcement and SC-003 remain NOT RUN.
