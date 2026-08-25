# Quickstart: Cloud runtime and service

This quickstart is the implementation and acceptance sequence for FEAT-0006. The service does not exist until the tasks in [tasks.md](tasks.md) are complete.

## Prerequisites

- Node.js 24 or 26
- pnpm 11.21.0
- Docker with the daemon available
- A clean port range on loopback
- No managed-provider credentials

Install the pinned repository dependencies:

```sh
pnpm bootstrap
```

## Generate and check the procedure edge

```sh
pnpm test:generator
pnpm generate
pnpm generate:check
```

The generated Cloud manifest must contain the same contract digest and five ordered operations as `packages/contracts/contract.json`. No generated drift may remain.

## Run the default provider-free checks

```sh
pnpm --filter @keynes/cloud test
pnpm --filter @keynes/cloud typecheck
pnpm verify
```

These checks prove generator, service-unit, type, formatting, lint, dependency, local SDK, and repository behavior only. They do not prove native PostgreSQL, actual service-process restart, response loss, Cloud acceptance, or managed deployment.

## Run native Cloud acceptance

Choose a new output path. The command refuses to overwrite an existing record.

```sh
pnpm test:cloud -- --output artifacts/cloud/feat-0006-local.json
```

The runner uses the exact pinned PostgreSQL image, an ephemeral loopback port, controlled test identities, and an actual Cloud child process. It must complete:

1. startup contract and procedure verification;
2. the remote Resource definition, root Budget, request, settlement, read, and history loop for two tenants;
3. known-identifier cross-tenant read, mutation, and replay denial;
4. database permission denial without state change;
5. ordinary client and service restart with PostgreSQL retained;
6. committed-response loss, service exit, restart, and exact replay;
7. concurrent exact retry and same-tenant conflicting command reuse;
8. explicit database-unavailable behavior with no local fallback; and
9. refusal to listen against an empty or incompatible database.

The command removes its container and temporary credentials on success or failure. The selected JSON record remains for review.

## Inspect the evidence boundary

The acceptance record must identify the revision, clean-worktree state, contract digest, Node.js and host environment, exact PostgreSQL image and version, scenario results, and explicit exclusions. It must not contain tokens, token digests, passwords, database URLs, command bodies, or process environments.

Passing `pnpm test:cloud` proves only the declared provider-free FEAT-0006 service and native PostgreSQL scenarios. Managed-provider deployment, external identity, live exposure, TLS, Policy, public SDK/protocol compatibility, backup restoration, failover, multi-region behavior, performance, security qualification, Cloud-preview readiness, and production readiness remain `NOT RUN`.

## Accept the feature

After the exact branch revision passes both `pnpm verify` and `pnpm test:cloud`:

1. record the accepted revision, contract digest, environment, acceptance-record path, and exclusions in `docs/roadmap.md`;
2. mark FEAT-0006 complete only from those executed results;
3. name the smallest missing capability that blocks a usable Cloud preview; and
4. promote exactly one unnumbered next candidate without reserving its feature identity.
