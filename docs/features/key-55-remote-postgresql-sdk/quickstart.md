# Quickstart: Remote PostgreSQL flow

> **Status:** Historical quickstart for implementation revision
> `52da617be4f77ef5913955e397c3bc6ff2423ae6`. The feature delivery plan is
> superseded by the current deployment-mode roadmap. Provider-free positive TLS,
> the timed walkthrough, and external-provider qualification remain `NOT RUN`.

## Provision one scoped credential

An operator installs a compatible Keynes PostgreSQL authority and uses its private administrative procedures to issue one application credential. The operator delivers a strict `postgresql:` URL through the application's secret manager.

The URL must contain exactly one `sslmode=verify-full`. Do not commit, log, print, or retain the URL in test evidence.

```sh
export KEYNES_DATABASE_URL='postgresql://application:secret@db.example.test/keynes?sslmode=verify-full'
```

## Connect and create a root Budget

```ts
import { createKeynes, createOperationKey, defineResources } from "@keynes/sdk";

const resourceTypes = defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

await using keynes = await createKeynes({
  databaseUrl: process.env.KEYNES_DATABASE_URL!,
});

const root = await keynes.createBudget(resourceTypes, {
  usdCents: 1_000,
  searchQueries: 100,
});
```

KEY-56 owns this root-creation signature. KEY-55 consumes it without adding another Resource-registration path.

## Request, inspect, and settle

```ts
const operationKey = createOperationKey();
await persistOperationKey(operationKey);

const result = await root.request(
  { usdCents: 25, searchQueries: 2 },
  { operationKey },
);

if (result.status === "approved") {
  const before = await result.budget.inspect();
  await runWorkflow(result.budget);
  await result.budget.settle({ usdCents: 19, searchQueries: 2 });
  const after = await result.budget.inspect();
  recordApplicationEvidence({ before, after });
}
```

`inspect()` returns the same public snapshot and ordered history as local mode. The remote SDK may fetch several bounded history pages internally.

## Reopen a Budget

Store the remote-only `root.reference` in application-owned state. A later process reconnects and supplies the expected Resource binding:

```ts
const reopened = await keynes.openBudget({
  reference: storedReference,
  resourceTypes,
});
```

Local Budget handles expose no durable reference and cannot reopen state after process exit.

## Recover an uncertain operation

Create and persist an operation key before a mutation when the application needs recovery after process loss. Query recovery without resubmitting a different command body:

```ts
const recovery = await keynes.recoverOperation(operationKey);
```

The result is committed, known failure, unresolved, or expired. Completed operations remain recoverable for at least seven days. Application code decides whether and when to retry external work. Keynes recovers only the Budget command.

## Rotate or revoke access

Use the private administrative procedure boundary from an operator-controlled session. Ordinary SDK credentials cannot call it. Validate the published behavior for already-open pooled connections before treating rotation or revocation as qualified.

## Optionally run external-provider qualification

Use a dedicated, disposable PostgreSQL 18.6 database. Before running the
qualifier, prepare these roles on that database server:

- `keynes_owner` as `NOLOGIN`;
- `keynes_execution` as `NOLOGIN NOINHERIT`;
- distinct `NOINHERIT LOGIN` roles for administration, the primary runtime,
  its replacement, and a second tenant; and
- an operator login that can install Keynes, assume `keynes_owner`, grant the
  runtime procedures, and recreate the replacement role.

The runner may install Keynes into an empty target or exactly recheck an
existing installation. It never creates or deletes a provider database,
instance, project, endpoint, or network rule. Dispose of the database after the
run; credential rotation and terminal revocation intentionally leave test
state behind.

Create a secret-free profile. Obtain the expected leaf fingerprint from the
approved provider endpoint through a separate operator channel:

```json
{
  "schemaVersion": "keynes.external-postgresql-profile/v1",
  "authorizationReference": "user-approved-2026-09-03",
  "provider": "provider-slug",
  "serverProfile": "postgresql-18.6",
  "hostClass": "public-dns",
  "topology": "direct",
  "downstreamTlsOwner": "provider",
  "expectedLeafCertificateSha256": "<64-lowercase-hex-characters>"
}
```

Have the approved secret manager inject these seven variables directly into a
non-interactive qualifier process. Do not write them to a retained file or
paste them into an interactive shell. The wrong-CA URL must address the primary
endpoint and name an unrelated local CA file through `sslrootcert`. The
hostname-mismatch URL must route to the same endpoint through a name or address
that is absent from the certificate. Both must fail for the intended TLS
reason, not for routing or authentication.

```text
KEYNES_EXTERNAL_OPERATOR_URL
KEYNES_EXTERNAL_ADMIN_URL
KEYNES_EXTERNAL_PRIMARY_URL
KEYNES_EXTERNAL_REPLACEMENT_URL
KEYNES_EXTERNAL_SECONDARY_URL
KEYNES_EXTERNAL_UNTRUSTED_CA_URL
KEYNES_EXTERNAL_HOSTNAME_MISMATCH_URL
```

In that injected process, run:

```sh
pnpm test:external:postgresql -- \
  --profile .artifacts/external/provider-profile.json \
  --sdk-archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --postgresql-archive .artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz \
  --output .artifacts/acceptance/feat0013-external.json
```

The create-once mode-`0600` result binds the clean source revision and both
archive digests to the live server, semantic, procedure, TLS, credential, and
tenant-isolation observations. This first qualifier accepts only a direct
topology. Pooler qualification needs separate client-to-pooler and
pooler-to-PostgreSQL observations and remains `NOT RUN`.

## Run the timed package walkthrough

Run this lane against a fresh disposable PostgreSQL 18.6 target with verified
TLS after the provider-free TLS qualifier passes. Set the secret URL outside
shell history and supply a separate non-secret target identity so the runner
cannot reach a different database accidentally. Do not reuse a qualification
target whose credential-lifecycle scenarios changed or revoked its runtime
credentials:

```sh
export KEYNES_QUALIFICATION_TARGET='application@db.example.test:5432/keynes'
pnpm test:package:sdk -- \
  --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --authorized-database
```

The runner requires `KEYNES_DATABASE_URL`, creates a five-unit root, requests and settles two units, closes the first client, reconnects, reopens the root, and verifies the durable result. It does not retain or print the URL. Passing this walkthrough proves the clean-user path against the supported local TLS profile. It does not prove the facts owned by an external provider, public network, or production deployment.
