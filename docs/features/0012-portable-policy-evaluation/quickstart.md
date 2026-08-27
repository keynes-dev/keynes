# Quickstart: Portable Policy evaluation

This walkthrough creates one typed Resource schema, authors the same Policy
through Kysely and raw SQL, and exercises an approval and a denial in local
SQLite. It then shows the equivalent embedded PostgreSQL request boundary.

The source and PostgreSQL 18.6 system lanes implement this behavior. Final SDK
and PostgreSQL archives, the hosted Node.js matrix, provider qualification, and
production readiness remain `NOT RUN` until Phase 7 records exact-revision
evidence.

## Author one portable Policy

Import only the SDK package root:

```ts
import {
  createKeynes,
  definePolicy,
  definePolicySql,
  defineResources,
  policySet,
  policyValue,
} from "@keynes/sdk";

const resources = defineResources({
  tokens: { unit: "token", accountingBehavior: "consumable" },
});

const declaration = {
  name: "context_limit",
  revision: 1,
  inputs: ["tokens"],
  outputs: ["tokens"],
  context: {
    limit: policyValue.integer(),
    segment: policyValue.text(),
  },
  reasons: ["tier_limit"],
} as const;

const contextLimit = definePolicy(resources, {
  ...declaration,
  query: ({ db, sql }) =>
    db
      .selectFrom("requested_resources as requested")
      .innerJoin("available_resources as available", (join) =>
        join.onRef("available.resource", "=", "requested.resource"),
      )
      .crossJoin("policy_context as context")
      .select(({ eb }) => [
        "requested.resource as resource",
        sql<number>`least(
          ${eb.ref("available.amount")},
          ${eb.ref("context.limit")}
        )`.as("ceiling"),
        eb.val("tier_limit").as("reason"),
      ]),
});

const contextLimitFromSql = definePolicySql(resources, {
  ...declaration,
  sql: `
    SELECT requested.resource AS resource,
           least(available.amount, context.limit) AS ceiling,
           'tier_limit' AS reason
      FROM requested_resources AS requested
      INNER JOIN available_resources AS available USING (resource)
      CROSS JOIN policy_context AS context
  `,
});

if (
  contextLimit.canonicalSql !== contextLimitFromSql.canonicalSql ||
  contextLimit.sourceDigest !== contextLimitFromSql.sourceDigest ||
  contextLimit.definitionDigest !== contextLimitFromSql.definitionDigest
) {
  throw new Error("the Kysely and raw Policy definitions diverged");
}
```

`defineResources(...)`, both Policy definitions, and `policySet(...)` return
deeply frozen values. Kysely catches ordinary table, column, context, and result
shape mistakes. The parser and validator remain authoritative for both
authoring paths. They accept only the published Policy query profile.

The original SQL, comments, whitespace, Kysely tree, and parameter vector do
not become Policy identity. Both paths produce one canonical SQL string, one
normalized program, and the same source and definition digests.

## Govern local requests

Create the runtime from the complete Resource schema. The returned `Keynes` and
`Budget` values are frozen capability handles, not classes or serializable
records.

```ts
await using keynes = await createKeynes({ resources });

const root = await keynes.createBudget(
  { tokens: 10 },
  { policies: policySet(contextLimit) },
);

const context = { limit: 6, segment: "standard" } as const;
const approved = await root.request({ tokens: 4 }, { context });
const denied = await root.request({ tokens: 7 }, { context });

if (approved.status !== "approved") {
  throw new Error("expected the first request to be approved");
}
if (denied.status !== "denied") {
  throw new Error("expected the second request to be denied");
}

console.log(approved.policyEvidence);
console.log(denied.reasons);
console.log(denied.policyEvidence);
console.log(await root.inspect());
```

The approval reserves exactly four tokens and returns evidence with this
shape. Digest strings are omitted here only because their values depend on the
exact canonical definition.

```ts
{
  context: { limit: 6, segment: "standard" },
  policies: [{
    name: "context_limit",
    revision: 1,
    sourceDigest: "<sha256>",
    definitionDigest: "<sha256>",
    rows: [{ resource: "tokens", ceiling: 6, reason: "tier_limit" }],
  }],
  effectiveCeilings: [{
    resource: "tokens",
    ceiling: 6,
    reasons: [{
      policyName: "context_limit",
      policyRevision: 1,
      reason: "tier_limit",
    }],
  }],
  decision: "approved",
}
```

The second request exceeds the ceiling. These selected fields show the denial;
its context, rows, and effective ceilings match the approval evidence above.
Keynes records the denial and leaves the root holding unchanged:

```ts
{
  status: "denied",
  reasons: [{
    code: "policy_ceiling",
    resource: "tokens",
    requested: 7,
    ceiling: 6,
    policyName: "context_limit",
    policyRevision: 1,
    reason: "tier_limit",
  }],
  policyEvidence: {
    policies: [{
      name: "context_limit",
      revision: 1,
    }],
    decision: "denied",
  },
}
```

`root.inspect()` reports 10 allocated tokens, 6 available tokens, and 4
committed tokens. Its history contains `budget_created`, `request_approved`,
and `request_denied` in that order. The denial creates no child and reserves no
additional tokens.

A child receives no Policies by inheritance. To govern an approved child, pass
its complete set as `policies` in that request's options. Omitting the field and
passing `policySet()` have the same canonical meaning.

## Run without Policies

Omit both Policy options and context:

```ts
const ungovernedRoot = await keynes.createBudget({ tokens: 100 });
const result = await ungovernedRoot.request({ tokens: 2 });
```

The no-Policy path omits Policy sets, context, and Policy evidence. Its command,
result, history, replay, and error bytes retain the established contract.

## Use embedded PostgreSQL

Install the PostgreSQL 18.6 preview as described in the
[embedded PostgreSQL walkthrough](../0009-postgresql-transaction-integration/quickstart.md).
The installer adds `0004-policy.sql` to the exact migration graph. The
application then calls the same five `keynes.*(jsonb)` functions through a
checked-out connection.

For a governed request, attach the portable Policy definition to the parent
when the parent is created. Read application facts and call Keynes on the same
checked-out connection and transaction:

```sql
BEGIN;

SELECT set_config('keynes.tenant_id', :tenant_id, true),
       set_config('keynes.principal_id', :principal_id, true);

SELECT token_limit AS limit, customer_segment AS segment
  FROM application_workflow
 WHERE workflow_id = :workflow_id
   FOR SHARE;

SELECT keynes.request(:request_command::jsonb);

COMMIT;
```

Build `request_command` with a fresh `commandId`, the parent Budget UUID,
Resource UUID-and-amount rows, and the canonical context returned by the
business-table read. Roll back instead of committing if the read or procedure
call fails.

The application owns the connection, business-table read, `BEGIN`, `COMMIT`,
and `ROLLBACK`. PostgreSQL owns Policy validation, evaluation, reservation,
child creation, replay, and evidence in the same transaction. Direct procedure
results use Resource and Budget UUIDs on the wire. The local SDK projects those
private IDs back to schema keys and capability handles.

An approval returns `ok: true`, `result.kind: "approved"`, one child Budget,
and `policyEvidence.decision: "approved"`. A Policy denial returns `ok: true`,
`result.kind: "denied"`, canonical reasons, and
`policyEvidence.decision: "denied"`. Invalid Policy source, context, execution,
or result rows return a stable error and roll back the command. They never
become approvals or domain denials.

Exact replay returns the stored result and evidence before Policy validation,
parent snapshot reads, holding reads, or evaluation. Keynes does not query
application tables during replay. Reusing the command ID with different
canonical context or child Policies returns `command_conflict`.

## Know the unsupported operations

Policy v1 does not support arbitrary database relations, application-table
reads, catalog reads, DDL, DML, multiple statements, subqueries, CTEs, window
functions, nondeterministic functions, or syntax outside the published
[Policy query profile](contracts/policy-query-profile.md).

The private Cloud `/rpc` path rejects `createBudget.policies`,
`requestBudget.context`, and `requestBudget.childPolicies` whenever each key is
present, including empty arrays. Remote Policy transport, a public remote SDK,
self-hosted operations, managed Cloud, other PostgreSQL versions, upgrades,
recovery, backup restoration, failover, provider qualification, hostile-role
security qualification, registry publication, adopter use, and production
readiness remain `NOT RUN`.

## Run the evidence lanes

Run the provider-free source checks from the repository root:

```sh
CI=true pnpm check:repo
CI=true pnpm test:unit
CI=true pnpm test:pr
```

Build and test fresh archives only after the source checks pass:

```sh
CI=true pnpm pack:sdk
CI=true pnpm test:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/package-tests/sdk/qualification.json
CI=true pnpm measure:package:sdk -- --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz --output .artifacts/package-tests/sdk/measurement.json
CI=true pnpm pack:postgresql
CI=true pnpm test:package:postgresql -- --archive .artifacts/package-tests/postgresql/keynes-postgresql-0.0.0.tgz
```

When Docker and the native prerequisites are available, run each native lane
separately:

```sh
CI=true pnpm test:system:postgresql
CI=true pnpm test:system:cloud
```

Do not infer an archive, hosted, native, Cloud, security, measurement, or
production pass from another lane. The final FEAT-0012 acceptance record must
name one clean source revision and the exact archive or installation subject
that each command exercised.
