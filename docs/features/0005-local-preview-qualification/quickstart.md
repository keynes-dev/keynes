# Qualify the local preview

**Status**: Qualified for the declared local-preview ESM matrix and temporary Linux reference limits.

The final local run used archive SHA-256 `2e01a7c323e3b1fd6d45a72f9fefc7096bdbbab648e8efa2b69005bebb49d23e`. The archive was 28,847 bytes, and its production installation was 25,577,997 bytes. This run does not qualify the declared hosted matrix or reference performance limits.

The same archive passed the installed Budget loop, two-runtime isolation, repeated closure, post-close rejection, and fresh-process state-loss checks. The unchanged source lifecycle and committed-response replay files passed 15 tests against the production source graph. Replay controls remain private and were not added to the archive.

The measurement controller and worker checks passed, including a controlled cold-create limit failure. [Hosted run 32851452990](https://github.com/shubsharan/keynes/actions/runs/32851452990) retained a Linux x64 Node.js 24 record for commit `209620f3e2b5804a5517ce6d7f3bd9239d485fc8` and archive SHA-256 `c3858fb712dcf4479b06b44f36f04c264af4b7320128dfe391eba91ee5aa5aed`. Ready-runtime RSS p95 was 774,340,608 bytes against the then-current 201,326,592-byte limit. Cold creation, first request, and steady request p95 values passed at 2,550.779, 18.773, and 9.469 milliseconds. The failed RSS check makes that attempt ineligible as accepted evidence.

The ready-runtime RSS ceiling is temporarily 1 GiB for the local preview. [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) records the required 512 MiB p95 reduction, the 384 MiB stretch target, and the investigation into a lean PGlite build. The earlier failed attempt is not reclassified.

[Hosted run 32882262030](https://github.com/shubsharan/keynes/actions/runs/32882262030) passed for exact commit `7231d0a461d20c73b85a767376653d824be7e514` and archive SHA-256 `d5b85d4bcf3df7896d599254d138a487a3784c4a6cb10da77e3af7ee9b3e9e46`. All six clean consumers passed. The Linux x64 Node.js 24 record measured ready RSS, cold creation, first request, and steady request p95 values of 768,188,416 bytes, 2,585.030 milliseconds, 22.832 milliseconds, and 9.953 milliseconds. The archive was 28,871 bytes and the production installation was 25,576,425 bytes.

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
archive="$package_dir/keynes-sdk-0.0.0.tgz"
sha256sum "$archive"
```

Use `$archive` for every later command. Repacking creates a different qualification subject.

## Run provider-free acceptance

Run the archive-content and clean-consumer suite:

```sh
pnpm test:package -- --archive "$archive"
pnpm verify
```

The package test compares copied database files with their canonical source, installs the archive outside the repository, and compiles and executes one public consumer. `pnpm verify` also runs the existing repository and source-workspace suites.

## Run the reference measurement

The benchmark is an explicit qualification lane. Write one new record:

```sh
pnpm qualify:local -- \
  --archive "$archive" \
  --output "$package_dir/local-preview-qualification.json"
```

Check that the command reports the archive digest, exact environment, sample counts, p95 values, and limits, then exits successfully. A local pass applies only to that named environment.

The JSON record has fixed `archive`, `environment`, `method`, `samples`, `observed`, and `limits` objects. The controller retains all 30 RSS, cold-create, and first-request samples in collection order. It also retains all 100 steady-request samples after 10 excluded warmups. Each `observed` value contains only `count` and nearest-rank `p95`.

The command refuses to overwrite the output path. It removes the external installation and waits for every child process before it exits. Keep `$package_dir` until you have retained the archive and JSON record, then remove it.

## Run the support matrix

After the feature branch contains the manual workflow, dispatch it for the exact commit:

```sh
gh workflow run local-preview.yml --ref feat/0005-local-preview-qualification
```

The workflow must use one archive digest for all six Node.js and host combinations. The Linux x64 Node.js 24 job also runs the reference measurement. Record the accepted workflow run URL and evidence limits in `docs/roadmap.md` only after every required job passes.

## Evidence limits

Provider-free acceptance proves the packed ESM facade, copied database files, clean Linux installation, Budget-loop behavior, and declared lifecycle cases. The manual workflow can add the declared Node.js, operating-system, architecture, size, memory, startup, and latency evidence.

Browser, bundler, CommonJS, Bun, Deno, other architectures, customer PostgreSQL, Cloud, Policy, hostile-process security, recovery, upgrades, registry publication, paid providers, production workloads, and adopter use remain `NOT RUN`.

The hosted lanes were executed for commit `209620f3e2b5804a5517ce6d7f3bd9239d485fc8`. All six consumer jobs passed from one archive digest, but the Linux x64 Node.js 24 measurement failed its RSS ceiling. Neither the matrix nor the performance target is qualified until one complete manual workflow passes for the exact commit and archive digest.
