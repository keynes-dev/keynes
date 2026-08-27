# Quickstart: Portable Policy evaluation

This is the implementation and acceptance walkthrough for FEAT-0012. The feature is planned, not implemented, until its tasks and exact-revision evidence say otherwise.

## Author a typed Policy

```ts
import { Keynes, definePolicy, policySet, policyValue } from "@keynes/sdk";

const supportLimit = definePolicy({
  name: "support_limit",
  revision: 1,
  resources: {
    inputs: ["usdCents", "searchQueries"],
    outputs: ["usdCents", "searchQueries"],
  },
  context: {
    customerTier: policyValue.text(),
    riskClass: policyValue.text(),
  },
  reasons: ["customer_tier_limit", "workflow_risk_limit"],
  query: ({ db, sql }) =>
    db
      .selectFrom("requested_resources as requested")
      .innerJoin("available_resources as available", (join) =>
        join.onRef("available.resource", "=", "requested.resource"),
      )
      .crossJoin("policy_context as context")
      .select(({ eb }) => [
        "requested.resource as resource",
        sql<number>`
          CASE
            WHEN ${eb.ref("context.customer_tier")} = ${"standard"}
            THEN least(2500, round(${eb.ref("available.amount")} * 0.75))
            ELSE ${eb.ref("available.amount")}
          END
        `.as("ceiling"),
        sql<string>`
          CASE
            WHEN ${eb.ref("context.risk_class")} = ${"high"}
            THEN ${"workflow_risk_limit"}
            ELSE ${"customer_tier_limit"}
          END
        `.as("reason"),
      ]),
});
```

The callback receives a restricted Kysely database and Kysely's parameterizing `sql` template. Only the virtual Policy tables are typed. Kysely catches ordinary relation, column, context, and output-shape mistakes, while the shared parser and validator remain authoritative for every compiled expression. `supportLimit` is a frozen value; it is not a remote handle or mutable Policy record.

## Compare the raw-SQL path

```ts
import { definePolicySql, policyValue } from "@keynes/sdk";

const supportLimitFromSql = definePolicySql({
  name: "support_limit",
  revision: 1,
  resources: {
    inputs: ["usdCents", "searchQueries"],
    outputs: ["usdCents", "searchQueries"],
  },
  context: {
    customerTier: policyValue.text(),
    riskClass: policyValue.text(),
  },
  reasons: ["customer_tier_limit", "workflow_risk_limit"],
  sql: `
    SELECT requested.resource AS resource,
           CASE
             WHEN context.customer_tier = 'standard'
             THEN least(2500, round(available.amount * 0.75))
             ELSE available.amount
           END AS ceiling,
           CASE
             WHEN context.risk_class = 'high'
             THEN 'workflow_risk_limit'
             ELSE 'customer_tier_limit'
           END AS reason
      FROM requested_resources AS requested
      INNER JOIN available_resources AS available USING (resource)
      CROSS JOIN policy_context AS context
  `,
});
```

The Kysely and raw definitions must have equal `canonicalSql`, `sourceDigest`, and `definitionDigest`. Kysely's parameters and the raw literals normalize into the same typed program nodes. The raw input's whitespace and comments are not retained. Its text is parsed and validated in TypeScript but never executed by SQLite or PostgreSQL.

## Govern local requests

```ts
const keynes = await Keynes.create();

await keynes.defineResources({
  usdCents: { unit: "USD cent", accountingBehavior: "consumable" },
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

const root = await keynes.createBudget(
  { usdCents: 10_000, searchQueries: 100 },
  { policies: policySet(supportLimit) },
);

const approved = await root.request(
  { usdCents: 2_000, searchQueries: 2 },
  {
    context: {
      customerTier: "standard",
      riskClass: "low",
    },
  },
);

const denied = await root.request(
  { usdCents: 3_000, searchQueries: 2 },
  {
    context: {
      customerTier: "standard",
      riskClass: "high",
    },
    // Omit policies: an approved child receives an empty set, not the parent set.
  },
);

if (approved.status !== "approved") {
  throw new Error("expected the first request to be approved");
}

if (denied.status === "denied") {
  for (const reason of denied.reasons) {
    console.log(reason);
  }
}

const inspection = await root.inspect();
await keynes.close();
```

The Policy sees one immutable request, relevant parent availability, and context snapshot. A request above an effective ceiling is denied without revision. A valid denial is recorded. Invalid context or evaluation throws a stable error and records nothing.

## Preserve legacy behavior

```ts
const keynes = await Keynes.create();

await keynes.defineResources({
  searchQueries: { unit: "query", accountingBehavior: "consumable" },
});

const root = await keynes.createBudget({ searchQueries: 100 });
const result = await root.request({ searchQueries: 2 });
```

This flow must produce the existing command, result, history, and replay JSON. It does not include an empty Policy set, empty context, or empty evidence field.

## Use embedded PostgreSQL

An embedded adopter starts and owns the transaction, reads application facts if needed, and invokes the same `keynes.*(jsonb)` boundary:

```sql
BEGIN;

SELECT set_config('keynes.tenant_id', :tenant_id, true);
SELECT set_config('keynes.principal_id', :principal_id, true);

-- The application can read its own table in this transaction.
SELECT customer_tier, risk_class
  FROM application_workflow
 WHERE workflow_id = :workflow_id
 FOR SHARE;

SELECT keynes.request(:compiled_approved_command::jsonb);

SELECT keynes.request(:compiled_denied_command::jsonb);

INSERT INTO application_outbox (workflow_id, decision)
VALUES (:workflow_id, :approved_and_denied_decisions);

COMMIT;
```

The two compiled commands use the same Policy definition and logical cases as the local walkthrough. Each contains canonical context and, when an approved child needs them, compiled child Policy definitions. Raw Policy SQL is an SDK authoring input, not a database procedure input. The application owns `BEGIN`, `COMMIT`, `ROLLBACK`, and its application-table read. PostgreSQL owns Policy evaluation, reservation, child creation, replay, and canonical evidence. With the local and PostgreSQL runtimes already available, this walkthrough is designed to complete in under 15 minutes.

## Reject remote Policy transport

The private Cloud `/rpc` path keeps its existing no-Policy behavior. For FEAT-0012 it rejects any Policy-bearing field before a database call. Do not use the private service to author, attach, or submit Policies. A later remote SDK and public service feature must version that capability explicitly.

## Implement and verify

Write the shared Kysely/raw and parser fixtures, generated semantic node vectors,
property-generated programs, numeric boundaries, and cross-backend comparisons
failing first. Then run provider-free gates:

```sh
CI=true pnpm check:repo
CI=true pnpm test:unit
CI=true pnpm test:pr
```

Rebuild and test the exact archives:

```sh
pnpm test:package:sdk
pnpm measure:package:sdk
pnpm test:package:postgresql
```

Run native authority and blast-radius lanes when Docker is available:

```sh
pnpm test:system:postgresql
pnpm test:system:cloud
```

The PostgreSQL test must use the packed CLI, a clean PostgreSQL 18.6 database, the exact four-migration graph, application-role calls, caller-owned transactions, sandbox attacks, replay, contention, and rollback. The Cloud test must prove each Policy field is rejected and the existing no-Policy scenarios still pass.

Dispatch the hosted SDK package matrix only for the exact accepted archive. Retain its archive digest, Node.js 24/26 results on Linux, macOS, and Windows, package size, install size, ready RSS, initialization, first request, steady request, and shutdown values.

## Evidence boundaries

Planning and documentation checks do not prove Policy behavior. Until exact implementation evidence exists, local Policy evaluation, native PostgreSQL Policy evaluation, Kysely/raw equivalence, parser packaging, numeric parity, package compatibility, hosted compatibility, and performance are `NOT RUN`.

Provider qualification, public ingress, external identity, self-hosted operations, managed Cloud, hostile-role security qualification, recovery, backup restoration, failover, upgrades, rolling deployment, paid infrastructure, registry publication, adopter use, and production readiness remain `NOT RUN` for this feature.
