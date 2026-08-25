# Qualify the local preview

**Status**: Local package acceptance passed on Darwin arm64 with Node.js 26.5.0. The Linux reference measurement and hosted matrix remain `NOT RUN`.

The local run used archive SHA-256 `c804a41d08d57c7611359ada6fc1b9e0fbb15bbe971764a7d609940c2cf1b690`. The archive was 28,400 bytes, and its production installation was 25,577,410 bytes. This run does not qualify the declared hosted matrix or reference performance limits.

The same archive passed the installed Budget loop, two-runtime isolation, repeated closure, post-close rejection, and fresh-process state-loss checks. The unchanged source lifecycle and committed-response replay files passed 15 tests against the production source graph. Replay controls remain private and were not added to the archive.

The measurement controller and worker checks passed, including a controlled cold-create limit failure. No retained performance record was produced because the required Linux x64 Node.js 24 reference environment was unavailable. Memory and latency remain `NOT RUN`.

## Prerequisites

- a clean checkout of `feat/0005-local-preview-qualification`
- Node.js 24 on the Linux x64 reference environment
- pnpm 11.21.0
- no Keynes account, credential, database service, daemon, or package-registry publication

Install the locked repository dependencies:

```sh
pnpm bootstrap
```

## Build one archive

Create a temporary output directory, emit the SDK, and pack it:

```sh
package_dir="$(mktemp -d)"
pnpm generate:check
pnpm --filter @keynes/sdk build
pnpm --filter @keynes/sdk pack --pack-destination "$package_dir"
```

Use the one archive in `$package_dir` for every later command. Repacking creates a different qualification subject.

## Run provider-free acceptance

Run the archive-content and clean-consumer suite:

```sh
pnpm test:package -- --archive "$package_dir/keynes-sdk-0.0.0.tgz"
pnpm verify
```

The package test compares copied database files with their canonical source, installs the archive outside the repository, and compiles and executes one public consumer. `pnpm verify` also runs the existing repository and source-workspace suites.

## Run the reference measurement

The benchmark is an explicit qualification lane. Write one new record:

```sh
pnpm qualify:local -- \
  --archive "$package_dir/keynes-sdk-0.0.0.tgz" \
  --output "$package_dir/local-preview-qualification.json"
```

Check that the command reports the archive digest, exact environment, sample counts, p95 values, and limits, then exits successfully. A local pass applies only to that named environment.

## Run the support matrix

After the feature branch contains the manual workflow, dispatch it for the exact commit:

```sh
gh workflow run local-preview.yml --ref feat/0005-local-preview-qualification
```

The workflow must use one archive digest for all six Node.js and host combinations. The Linux x64 Node.js 24 job also runs the reference measurement. Record the accepted workflow run URL and evidence limits in `docs/roadmap.md` only after every required job passes.

## Evidence limits

Provider-free acceptance proves the packed ESM facade, copied database files, clean Linux installation, Budget-loop behavior, and declared lifecycle cases. The manual workflow can add the declared Node.js, operating-system, architecture, size, memory, startup, and latency evidence.

Browser, bundler, CommonJS, Bun, Deno, other architectures, customer PostgreSQL, Cloud, Policy, hostile-process security, recovery, upgrades, registry publication, paid providers, production workloads, and adopter use remain `NOT RUN`.
