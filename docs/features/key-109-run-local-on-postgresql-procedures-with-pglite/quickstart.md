# Validation guide

This is the planned validation sequence. Implementation, runtime tests and measurements are NOT RUN. Commands using `--observations` and PGlite test files become runnable only after their tasks are implemented. Existing compatibility command names intentionally remain available through the transition.

## Planning checks available now

```sh
SPECIFY_FEATURE_DIRECTORY=docs/features/key-109-run-local-on-postgresql-procedures-with-pglite .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
pnpm exec oxfmt --check docs/features/key-109-run-local-on-postgresql-procedures-with-pglite
git diff --check
```

## Prerequisites for implementation qualification

Use a clean candidate on the exact feature branch with KEY-76 in ancestry, frozen dependencies, Node 24 or 26 and pnpm 11.21.0. Native lanes need Docker and the planned PostgreSQL 18.3 image pinned by digest. First complete the native profile/generator/SDK identity alignment tasks and verify both engines report 180003. Record an explicit fresh attempt path. The examples below use `attempt-001`; select a new suffix for another attempt and never overwrite evidence.

```sh
pnpm install --frozen-lockfile
pnpm generate:check
pnpm --filter @keynes/sdk exec vitest run test/unit/local/pglite-installation.test.ts --maxWorkers=1
```

Expected: unchanged canonical baseline installs and rechecks, identity/partial-install negatives reject, representative procedure bodies execute and cleanup passes. Stop replacement on any incompatibility. Run the compatibility-host measurement through the same engine-aware worker before changing Local's default; retain its independently identified artifact and raw observations as specified in contracts/qualification.md.

## Local replacement and both engines

```sh
pnpm test:pr
pnpm test:ci:postgresql
pnpm test:sqlite-postgres -- --output .artifacts/key-109/attempt-001/paired
```

Expected after implementation: paired command identifies PGlite and native PostgreSQL despite its retained compatibility name. Both reports contain the full expected case inventory and passing processes/cleanup. Local public creation/Resource/Policy/request/settle/inspect and close/isolation tests pass. Native races, permissions and borrowed transaction semantics remain separately tested. Record exact outputs rather than inferring acceptance from exit code alone.

## Exact interim archive and final measurements

```sh
pnpm pack:sdk
pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/key-109/attempt-001/package.json --observations
pnpm measure:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/key-109/attempt-001/measurements.json --observations
```

The planned observations option preserves structural/package/consumer failures while reporting legacy size thresholds separately. Smoke the packed SDK in a clean consumer using only public imports, with canonical assets present and no sibling workspace runtime resolution. Confirm Node 24 and 26 compatibility separately and retain each environment's result. No full archive release qualification is claimed.

Review raw startup, memory, byte-size, latency, throughput and close samples. Compare with the pre-switch PGlite compatibility result; explain any changed measurement boundary. Never describe an unrun or failed legacy envelope check as passed.

## Final acceptance

Before SQLite deletion, retain passing replacement compatibility, measurements, paired behavior, lifecycle and interim consumer evidence. After deletion, repeat final-candidate checks and measurements, verify production imports/dependency closure and installed canonical bytes, and inspect live required contexts/rulesets. Retain evidence in a new attempt with digests and explicit NOT RUN lanes. Use the feature's future acceptance.md to link records without rewriting historical evidence.
