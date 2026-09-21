# KEY-85 acceptance evidence

## Phase 1: Setup

Starting revision: `a0a786fac300e7e3e1f6b7469f3ce15f30008a4c`, clean worktree on `key-85-make-sdk-failures-consistently-asynchronous`. Merged KEY-96 baseline `3c47555` is an ancestor. Feature directory explicitly selected through stock Spec Kit. No extension hooks are registered.

Environment: Node.js 25.9.0, pnpm 11.21.0, Docker server 29.6.2, macOS arm64. `pnpm install --frozen-lockfile` passed. Docker responds; database execution is not inferred from availability. Existing Git/Docker ignore rules cover generated output, dependencies and secrets. Package file allowlists own archive inclusion; no new ignore files or dependencies are needed.

All 15 specification-checklist items are checked. Checklist markers are unchanged. Runtime and package tests are NOT RUN at setup. Attempts and logs will live under `.artifacts/key-85/`; final retained qualification evidence will identify the exact candidate and hashes.

Phase review and implementation results follow below. Managed Hosted, durable Local, delegation and live-provider behavior remain outside this feature's claim.

Phase 1 Ponytail review: no complexity findings. Setup checks passed; T001-T002 complete.
