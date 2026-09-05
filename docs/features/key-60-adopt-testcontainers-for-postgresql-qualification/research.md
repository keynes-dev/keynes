# Research: simplify native PostgreSQL testing

Research informs the proposed design. Runtime adoption and performance remain
`NOT RUN`. The original worker/reconciliation proposal is superseded.

## Current code and repeated work

Inspected at `d9a0bee9980c0cc2c6bae4cc13a3df7e3b97885e`:

- `packages/postgresql/test/system/run.ts` prepares the packed package before
  selected feedback as well as full acceptance.
- `support/postgres-database.ts` implements database/roles/client/transaction
  ownership. Its ordinary installed fixture invokes the packed CLI twice,
  expecting `installed` and `already-installed`.
- `support/test-keynes.ts` requires a packed command path even for ordinary
  selected hosts. This makes packaging a fixture prerequisite.
- `support/remote-identity.ts` already calls the product source installer and
  has explicit Remote role, connection and recheck behavior.
- `test/integration/installation.test.ts` and `recheck.test.ts`, system
  installation tests, and package tests already own installer-contract proof.

**Decision**: Reuse the product source installer and existing fixture/package helpers.
Share equivalent surrounding preparation and cleanup; represent only source/packed
installation differences. Install once for ordinary semantic fixtures.

**Rationale**: The duplication is observable in current callers. A second migration
runner, generalized fixture framework, template database, or blanket rollback would
add ownership or change test meaning. Keep dedicated fault-injected migration tests.

**Alternatives considered**: Making packaging faster still leaves unwanted feedback
work. Removing no-op proof entirely loses product assertions. Mapping each removed
ordinary check to dedicated proof is required before deletion.

## Standard Testcontainers and Vitest lifecycle

**Decision**: Pilot pinned core `testcontainers@12.1.0` using standard `Network`
and `GenericContainer` APIs. Use one native Vitest global setup, serializable
`provide`/`inject` context, and normal teardown. Container handles remain local
to setup. Register the setup once per invocation, not once per selected mode.

**Rationale**: Official examples support this lifecycle and endpoint sharing.
Published core metadata supports the planned Node versions. Retain the existing
SQL readiness/version probes and image identities without introducing a PostgreSQL
subclass or extra package solely for a wrapper.

Sources: [Testcontainers global setup](https://node.testcontainers.org/quickstart/global-setup/),
[Vitest global setup](https://vitest.dev/config/globalsetup),
[published core metadata](https://registry.npmjs.org/testcontainers/12.1.0),
[standard container implementation](https://raw.githubusercontent.com/testcontainers/testcontainers-node/v12.1.0/packages/testcontainers/src/generic-container/generic-container.ts).

Preserve these current constants without an image upgrade:

- PostgreSQL: `postgres:18.6@sha256:06cad38a5d9f5d24b4d83d86def30795d5e4b757fedbf5281172b576dedcd941`
- PgBouncer: `edoburu/pgbouncer@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340`

**Alternatives considered**: The previous binding subclass, acquisition and cleanup
workers, resource reconciliation, and custom supervision violate the simplification
brief. If ordinary library lifecycle fails the gates, remove the pilot.

## Controlled Docker defaults and Ryuk

**Decision**: Document an explicitly controlled Docker Engine 28+ environment with
`ip: 127.0.0.1` for the default bridge and
`default-network-opts.bridge.com.docker.network.bridge.host_binding_ipv4: 127.0.0.1`
for new user-defined bridges. Keep Ryuk enabled. Verify observed bindings through
one focused check.

**Rationale**: Standard container publication relies on Docker defaults. Default
bridge and user-defined network settings are separate. Existing networks do not
inherit new defaults; a daemon configuration edit requires restart. Engine 28+
avoids the older localhost-publishing limitation documented by Docker.

Sources: [Docker published ports](https://docs.docker.com/engine/network/port-publishing/),
[daemon network defaults](https://docs.docker.com/reference/cli/dockerd/#default-network-options).

The tagged Ryuk implementation publishes its helper port and can reuse an existing
labeled Ryuk. Therefore inspect the actual active helper, not only resources newly
created during this invocation. Confirm no wildcard IPv4 or IPv6 publications.
Reject disabled Ryuk or unsafe bindings without logging raw environment/inspect output.
No general developer-daemon mutation belongs in tests.

Sources: [Ryuk implementation](https://raw.githubusercontent.com/testcontainers/testcontainers-node/v12.1.0/packages/testcontainers/src/reaper/reaper.ts),
[Testcontainers configuration](https://node.testcontainers.org/configuration/).

**Alternatives considered**: Disabling Ryuk contradicts the requested loss boundary.
A container subclass or custom helper provisioning adds maintenance. Configuration
documentation alone does not prove actual runtime bindings.

## Cleanup and evidence

**Decision**: Await ordinary teardown, propagate normal cleanup failures, and retain
existing cancellation and success-publication checks. Use Ryuk, external execution
limits and CI host disposal after loss; no custom bounded resource-absence guarantee.

**Rationale**: Standard stopped-container code owns container removal. Its existence
does not prove the Keynes wrapper propagates failures, so test that behavior before
integration. Keep exact archive identity, report sanitization, source checks, and
exclusive acceptance writes in their existing owners.

Source: [standard stop implementation](https://raw.githubusercontent.com/testcontainers/testcontainers-node/v12.1.0/packages/testcontainers/src/generic-container/started-generic-container.ts).

**Alternatives considered**: A new evidence schema or worker result protocol
duplicates existing responsibilities. Treating a passing report as sufficient
would permit teardown failure or cancellation to qualify.

## Measurement decision

Count physical and nonblank authored lines over the declared testing scope before
editing and at all four checkpoints. Report dependency/lockfile and documentation
changes separately. Preserve a product-assertion map; smaller orchestration tests
are useful only if removed checks are redundant or implementation-coupled.

Use five complete warm-cache runs per command and revision under the same host,
image, dependency-cache and resource conditions. Compare feedback commands separately
from full acceptance; use a 10% median ceiling for each. No benchmark framework is
needed. See [quickstart.md](quickstart.md).

No library feasibility, code-size reduction, installer invocation totals, product
inventory comparison, timing, package closure, native acceptance, or CI result is
established by this research.
