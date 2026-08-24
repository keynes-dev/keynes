# Run the shared core platform gate

**Status**: `NOT RUN` for the current revision. The CI stabilization change has local evidence only.

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

## Evidence limits

A pass covers the FEAT-0002 corpus, the declared native contention cases, and the current migration graph on PGlite 0.5.5 and PostgreSQL 18.6. Customer installation, other PostgreSQL releases, managed providers, Cloud, hostile roles, tenant isolation, Policy, recovery, compatibility, packaging, and performance remain `NOT RUN`.

The roadmap gate passes only after `pnpm verify` and `pnpm test:platform` pass in CI for the same commit.
