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

NOT RUN until the implementation is committed locally. The runner requires a clean exact revision and retains both before/after identity. Record the attempt and its immutable manifest here after execution.

## Hosted acceptance boundary

NOT RUN: new CI check observation, hosted artifact receipts, native-failure blocked-merge demonstration, and policy mutation/readback. Local implementation does not qualify SC-003 or hosted FR-004 acceptance. The pre-change readback and exact proposed status-check payload are retained beside this record; [hosted-transition.md](hosted-transition.md) describes the coordinated transition.

The existing old required context remains enforced, with strict updates and admin enforcement. Publication and policy mutation await authorization under docs/workflow.md. Artifacts are local-only; Linear links and status are unchanged. No merge was attempted.
