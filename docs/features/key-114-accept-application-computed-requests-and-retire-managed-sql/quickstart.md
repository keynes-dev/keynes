# Customer examples and validation

> **Implementation status:** Implemented and locally verified. [Acceptance](acceptance.md) records exact clean-candidate repository, paired SQLite/PostgreSQL and archive-consumer evidence, plus remaining deployment limits.

## TypeScript

The application owns this rule and its signature. Keynes receives only the resulting amounts.

```ts
import { createKeynes } from "@keynes/sdk";

function requestFor(tier: string, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error("Invalid limit");
  }
  return tier === "pro" && limit >= 25 ? { usdCents: 25 } : null;
}

const client = await createKeynes({
  resources: {
    usdCents: { unit: "cent", accountingBehavior: "consumable" },
  },
});
try {
  const root = await client.createBudget({ usdCents: 100 });
  const amounts = requestFor("pro", 25);
  if (amounts !== null) {
    const result = await root.request(amounts, {
      decisionEvidence: { rule: "pro", revision: 1 },
    });
    if (result.status === "approved") {
      await result.budget.settle({ usdCents: 20 });
    }
  }
} finally {
  await client.close();
}
```

Approval leaves parent availability 75; settlement returns 5 and records 20 consumed. A 10-cent parent denies the same valid request. Tier `basic` or limit 24 causes no submission. Remote callers may capture a `createOperationKey()` value and reuse it with identical amounts/evidence for exact retry. Separate public Local calls are new commands.

## Customer SQL

After validating the limit as a nonnegative safe integer, execute this parameterized query on a customer-owned connection:

```sql
SELECT jsonb_build_object('usdCents', 25) AS request
WHERE $1::text = 'pro' AND $2::bigint >= 25;
```

Inputs `pro, 25` produce the same envelope; `basic, 25` or `pro, 24` produce no row and no Keynes submission. The query can read customer tables; the caller owns its permissions, errors and freshness.

For atomic application writes and allocation, use one caller-owned PostgreSQL transaction and run the evaluation query inside it. Native fixtures must provision the tenant, principal, Resource, parent and canonical procedure grants. This does not claim the current packaged installer delivers a completed Embedded profile.

Execute each statement separately on that connection. Parameters restart at each statement; do not concatenate parameterized statements into one extended-query call.

```sql
BEGIN;
```

Bind trusted tenant and principal IDs:

```sql
SELECT set_config('keynes.tenant_id', $1::text, true),
       set_config('keynes.principal_id', $2::text, true);
```

Run the customer query. If it permits work, bind a fresh command UUID, existing parent UUID and provisioned Resource UUID to this ordinary request:

```sql
SELECT keynes.request(jsonb_build_object(
  'commandId', $1::uuid,
  'parentBudgetId', $2::uuid,
  'resources', jsonb_build_array(jsonb_build_object(
    'resourceTypeId', $3::uuid, 'amount', 25
  )),
  'decisionEvidence', jsonb_build_object('rule', 'pro', 'revision', 1)
));
```

Inspect the error/denial/approval envelope before application work. The caller may write its application row after approval. For the rollback demonstration finish with:

```sql
ROLLBACK;
```

Verify that neither customer writes nor child, movements, command, evidence or history survive. For a successful application transaction the caller chooses `COMMIT`; Keynes never makes that choice. Rollback removes the command identity too, allowing a subsequent new attempt with that identity.

## Development checks

First observe new behavioral cases fail for the expected reason, then implement. Existing unchanged regression cases may already pass.

```sh
pnpm test:local
pnpm --filter @keynes/contracts test
pnpm test:embedded
pnpm test:remote -- --mode direct
```

| Proof                                            | Existing test home                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Validation, denial, membership, accounting       | contracts shared request-denial, budget-lifecycle and settlement scenarios  |
| Evidence bounds, snapshot, replay/conflict       | shared replay plus new request-evidence scenario; SDK public/recovery tests |
| Native competition and request/settlement        | PostgreSQL system contention.test.ts                                        |
| Injected rollback and caller writes              | shared rollback; native rollback.test.ts and embedded-transactions.test.ts  |
| Permission, tenant isolation, recovery           | native remote-security.test.ts and remote-recovery.test.ts                  |
| Version rejection, old/partial target, reinstall | native installation and integration recheck suites                          |
| Removed exports/assets and runnable examples     | SDK/PostgreSQL package consumers and example contract tests                 |

## Final acceptance

Use a clean candidate and a new output directory for every attempt:

```sh
pnpm test:pr
pnpm test:sqlite-postgres -- --output .artifacts/key-114/attempt-01
pnpm --config.node-linker=hoisted --filter @keynes/sdk pack --pack-destination "$PWD/.artifacts/key-114/packages"
pnpm --filter @keynes/postgresql pack --pack-destination "$PWD/.artifacts/key-114/packages"
pnpm test:package:sdk -- --archive .artifacts/key-114/packages/keynes-sdk-0.0.0.tgz --output .artifacts/key-114/packages/sdk-consumer.json
pnpm test:package:postgresql -- --archive .artifacts/key-114/packages/keynes-postgresql-0.0.0.tgz --output .artifacts/key-114/packages/postgresql-consumer.json
```

The paired command supplies Local/native qualification; do not repeat the same full native run without a changed candidate or unresolved failure. Retain exact revision, dependency/tool/host identities, archives/digests, reports, child process exits and cleanup outcomes. Keep both required CI check names and fail-closed applicability classification. Routine `pnpm test:ci:postgresql` remains correctness evidence, not package or managed-operation qualification.

Installed Embedded, managed Hosted, external providers, durable Local and delegation remain separate acceptance lanes. Performance qualification is NOT RUN; run affected measurement-tool unit checks without claiming a benchmark improvement.
