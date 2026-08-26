# Verify the SQLite local runtime

Use this guide after implementation. Run provider-free checks first. Keep native PostgreSQL, hosted compatibility, and benchmarks in their separate lanes.

## Run the focused behavior tests

Run the generated-client, local lifecycle, local replay, lifecycle, denial, settlement, replay, rollback, malformed-input, isolation, and public-export suites with one worker.

```bash
pnpm --filter @keynes/sdk test
```

The suite must use SQLite for local and provider-free tests. It must pass without starting PGlite or reading copied migration assets.

## Run repository acceptance

```bash
pnpm test:qualification
pnpm check:repo
pnpm test:unit
pnpm test:pr
pnpm exec oxfmt --check docs/features/0008-sqlite-local-runtime docs/workflow.md packages/sdk/README.md docs/roadmap.md
git diff --check
```

`pnpm test:qualification` builds, packs, installs, and exercises an ephemeral local archive. Together, these commands prove source behavior and qualification tooling in the current checkout. They do not bind their results to the retained `artifacts/keynes-sdk-0.0.0.tgz`, six hosted environments, native PostgreSQL, native Cloud, or hosted reference measurements.

## Qualify one exact archive locally

```bash
pnpm build:package
pnpm --filter @keynes/sdk pack --pack-destination artifacts
pnpm test:package -- --archive artifacts/keynes-sdk-0.0.0.tgz
```

Retain a non-overwriting record at `artifacts/local-preview/<source-revision>-local-qualification.json`. Record the source revision, Node.js and pnpm versions, archive SHA-256, compressed and production-install byte counts, package version, contract digest, engine declaration, dependency count, checks, and `NOT RUN` lanes. Confirm that the clean consumer installs only the SDK archive and that package inspection finds no production dependency, PGlite file, or `dist/database` asset.

## Run the native PostgreSQL comparison

This lane starts pinned Docker infrastructure and is not part of provider-free acceptance.

```bash
pnpm test:platform
```

Retain the exact commit, PostgreSQL image digest, host, tool versions, and result. A pass proves the declared comparison examples and native contention only. It does not prove provider support, recovery, or production readiness.

## Run the native Cloud regression

This lane starts native PostgreSQL and the private Cloud service.

```bash
pnpm test:cloud -- --output artifacts/cloud/feat-0008-acceptance.json
```

The runner refuses to overwrite an existing record. Treat the result as FEAT-0006 regression evidence. It does not prove public remote access, TLS, managed Cloud, or production operations.

## Run hosted package compatibility and measurements

Invoke `.github/workflows/local-preview.yml` for the exact accepted commit. The workflow must reuse one archive digest across Node.js 24 and 26 on Ubuntu, macOS, and Windows. Its reference job must retain the workflow URL, exact commit, archive and contract digests, host, Node.js and SQLite versions, exact archive and production-install byte counts, method, raw samples, nearest-rank p95 values, and declared limits for ready RSS, cold creation, first request, steady request, and shutdown.

Do not mark the feature accepted until all six consumer jobs pass and the reference record reports ready RSS strictly below 512 MiB. Retain all six job outcomes and the measurement artifact identity. Preserve failed and partial attempts as failed or partial.

[Local Preview run 32958313497](https://github.com/shubsharan/keynes/actions/runs/32958313497) is the accepted FEAT-0008 hosted record. It passed all six consumer jobs for clean commit `a2176c7512e5bb37e88d6884d255e18fc4a3d92e`, including the final SQLite/PostgreSQL parity repair; the retained acceptance and raw measurement records are under `artifacts/local-preview/run-32958313497/`. Run 32956043624 remains passing pre-alignment evidence, and failed run 32955451763 remains retained separately as non-passing evidence.

## Keep unproved claims explicit

Policy, persistence, browsers, bundlers, CommonJS, Node.js 25, Bun, Deno, custom Node builds, undeclared architectures, provider qualification, paid services, security qualification, recovery, upgrades, backup restoration, self-hosted operations, managed Cloud, registry publication, adopter use, broader fault campaigns, and production operations remain `NOT RUN`.
