# Run the shared core platform gate

**Status**: `PASSED` for commit [`9bc3d56bfcf80519669375ecc7ad632262837dae`](https://github.com/shubsharan/keynes/commit/9bc3d56bfcf80519669375ecc7ad632262837dae) in [GitHub Actions run 32691897192](https://github.com/shubsharan/keynes/actions/runs/32691897192). That run used dependent Verify and Platform jobs to close KEY-48. Pull requests now run only Verify automatically.

## Run the provider-free checks

```sh
pnpm bootstrap
pnpm verify
```

This lane uses PGlite and requires no database service. It does not prove native PostgreSQL behavior.

## Check Docker

```sh
docker info
```

The platform command fails if the Docker CLI or daemon is unavailable.

## Run the platform checks

```sh
pnpm test:platform
```

The command starts this exact image:

```text
postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941
```

The runner generates a credential, publishes an ephemeral port only on `127.0.0.1`, checks PostgreSQL 18.6, and removes the container after success or failure. It does not accept a database URL, existing cluster, managed provider, customer database, or persistent volume.

## Run the hosted platform checks

After `platform.yml` exists on the default branch, dispatch it for the revision that needs native qualification:

```sh
gh workflow run platform.yml --ref <branch-or-commit>
```

The Platform workflow is manual. Run it when a feature changes database semantics, migrations, shared host behavior, or native transactions, or when an acceptance plan requires PostgreSQL evidence.

## Evidence limits

A pass covers the KEY-43 corpus, the declared native contention cases, and the current migration graph on PGlite 0.5.5 and PostgreSQL 18.6. Customer installation, other PostgreSQL releases, managed providers, Cloud, hostile roles, tenant isolation, Policy, recovery, compatibility, packaging, and performance remain `NOT RUN`.

The roadmap gate passed after `pnpm verify` and `pnpm test:platform` passed in CI for the same commit. Moving the Platform workflow to manual dispatch does not change that recorded result.
