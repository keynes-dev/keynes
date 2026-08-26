# Verify the SQLite local runtime

Use this guide after implementation. Run provider-free checks first. Keep native PostgreSQL, hosted compatibility, and benchmarks in their separate lanes.

## Run the focused behavior tests

Run the generated-client, local lifecycle, local replay, lifecycle, denial, settlement, replay, rollback, malformed-input, isolation, and public-export suites with one worker.

```bash
pnpm --filter @keynes/sdk test
```

The suite must use SQLite for local and provider-free tests. It must report no PGlite startup or copied migration path.

## Run repository acceptance

```bash
pnpm test:qualification
pnpm check:repo
pnpm test:unit
pnpm test:pr
git diff --check
```

These commands prove source behavior and qualification tooling in the current checkout. They do not prove the packed archive on six environments, native PostgreSQL comparison, Cloud behavior, or reference measurements.

## Qualify one exact archive locally

```bash
pnpm build:package
pnpm --filter @keynes/sdk pack --pack-destination artifacts
pnpm test:package -- --archive artifacts/keynes-sdk-0.0.0.tgz
```

Record the archive SHA-256 from the package result. Confirm that the clean consumer installs only the SDK archive and that package inspection finds no production dependency, PGlite file, or `dist/database` asset.

## Run the native PostgreSQL comparison

This lane starts pinned Docker infrastructure and is not part of provider-free acceptance.

```bash
pnpm test:platform
```

Retain the exact commit, PostgreSQL image digest, host, tool versions, and result. A pass proves the declared comparison examples and native contention only. It does not prove provider support, recovery, or production readiness.

## Run the native Cloud regression

This lane starts native PostgreSQL and the private Cloud service.

```bash
pnpm test:cloud
```

Treat the result as FEAT-0006 regression evidence. It does not prove public remote access, TLS, managed Cloud, or production operations.

## Run hosted package compatibility and measurements

Invoke `.github/workflows/local-preview.yml` for the exact accepted commit. The workflow must reuse one archive digest across Node.js 24 and 26 on Ubuntu, macOS, and Windows. Its reference job must retain exact archive and production-install byte counts plus raw samples and p95 values for ready RSS, cold creation, first request, steady request, and shutdown.

Do not mark the feature accepted until all six consumer jobs pass and the reference record reports ready RSS strictly below 512 MiB. Retain the workflow URL, exact commit, archive digest, all six job outcomes, and measurement artifact identity. Preserve failed and partial attempts as failed or partial.

## Keep unproved claims explicit

Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node builds, undeclared architectures, provider qualification, paid services, security qualification, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry publication, adopter use, broader fault campaigns, and production operations remain `NOT RUN`.
