# How to verify the idiomatic monorepo

Run this guide from the repository root after the KEY-53 cutover.

## Inspect the source roots

List the active source directories:

```sh
find apps packages scripts docs -maxdepth 2 -type d | sort
```

Confirm that no removed active root remains:

```sh
for path in services contracts tooling package-tests system-tests artifacts; do
	if test -e "$path"; then
		echo "unexpected path: $path" >&2
		exit 1
	fi
done
```

The first command shows the Cloud application, package workspaces, concrete scripts, and documentation. The second command prints nothing.

## Check workspace and import boundaries

Run the repository and dependency checks:

```sh
CI=true pnpm check:repo
CI=true pnpm check:deps
```

These commands check workspace discovery, generated output, formatting, lint, types, and allowed imports. Production SDK, PostgreSQL, and Cloud source must have no Keynes workspace dependency.

## Check deterministic generation

Run generation twice:

```sh
pnpm generate
git diff --exit-code
pnpm generate
git diff --exit-code
pnpm generate:check
```

Both diff checks must report no change. Compare the contract digest, generated SQL, installation record, and migration checksums with the KEY-53 baseline before accepting the move.

## Run provider-free tests

Run the aggregate local gates:

```sh
CI=true pnpm test:unit
CI=true pnpm test:pr
```

The provider-free suite includes owner-local unit tests and SQLite conformance. It does not qualify packed archives, native PostgreSQL, Cloud system behavior, SDK performance, or the hosted SDK matrix.

## Test the SDK archive

Create one archive under the ignored output directory:

```sh
pnpm pack:sdk
```

Use the exact archive path returned by `pnpm pack`:

```sh
CI=true pnpm test:package:sdk -- \
	--archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
	--output .artifacts/package-tests/sdk/local.json
CI=true pnpm measure:package:sdk -- \
	--archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
	--output .artifacts/package-tests/sdk/measurement-local.json
```

The package result and measurement remain separate evidence records. A local pass does not prove the six-environment hosted matrix.

## Test the PostgreSQL archive and runtime

Docker must be available for the system lane.

```sh
pnpm pack:postgresql
CI=true pnpm test:package:postgresql -- \
	--archive .artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz \
	--output .artifacts/package-tests/postgresql/local.json
CI=true pnpm test:system:postgresql -- \
	--output .artifacts/system-tests/postgresql/local.json
```

The package lane checks the archive and command. The system lane installs that command into disposable PostgreSQL 18.6 and checks roles, SQL behavior, replay, rollback, transactions, and contention.
The system lane writes an acceptance record only from a clean source revision;
omit `--output` while iterating on uncommitted changes.

## Test Cloud end to end

The Cloud lane packs and installs the current PostgreSQL workspace through its
command boundary:

```sh
mkdir -p .artifacts/system-tests/cloud
CI=true pnpm test:system:cloud -- \
	--output .artifacts/system-tests/cloud/local.json
```

This lane starts the current private Cloud process. It does not prove public ingress, TLS, self-hosted packaging, managed hosting, recovery, or production operation.

## Check the output policy

Confirm that Git tracks no output and ignores the local directory:

```sh
test -z "$(git ls-files artifacts .artifacts)"
git check-ignore .artifacts/probe.json
git status --short
```

The first command prints nothing. The ignore check prints the matching path. After cleanup and evidence writes, `git status --short` remains empty.

## Check retained evidence

Verify the five retained record hashes:

```sh
shasum -a 256 \
	docs/features/key-47-build-cloud-runtime-and-service/evidence/cloud-1fa83d1.json \
	docs/features/key-50-build-sqlite-local-runtime/evidence/cloud-430edf6.json \
	docs/features/key-50-build-sqlite-local-runtime/evidence/local-preview-run-32963676499/acceptance.json \
	docs/features/key-50-build-sqlite-local-runtime/evidence/local-preview-run-32963676499/measurement.json \
	docs/features/key-51-integrate-postgresql-transactions/evidence/postgresql-7edb1ee.json
```

Compare the output with [evidence-migration.md](evidence-migration.md). Moving these files does not make them KEY-53 evidence. Each file remains evidence for its recorded source revision.

## Run hosted checks last

After the final commit passes provider-free checks, dispatch the SDK package workflow for that exact revision. Dispatch the PostgreSQL system workflow when the feature-branch workflow is available. Record the run URL and exact revision in the pull request.

If a hosted or Docker-backed lane does not run, report it as `NOT RUN`.
