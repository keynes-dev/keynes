# Quickstart: Provider-free Budget lifecycle

**Status**: `COMPLETE (PROVIDER-FREE)`. The commands below passed for FEAT-0002 on August 23, 2026. They exercise a private, process-scoped, in-memory PGlite database.

## Prerequisites

- Node.js 24.19.0, or another repository-supported Node.js 24–26 release
- pnpm 11.21.0
- no database service, credentials, container runtime, or network provider

From the repository root, install the exact lockfile:

```sh
pnpm bootstrap
```

## Generate and check the contract

Generate the checked-in consumers, or check them without changing the worktree:

```sh
pnpm generate
pnpm generate:check
```

`generate` reads the ordered contract source and the hand-authored migration graph. It emits TypeScript types, standalone validators, the concrete five-method client, public SQL wrappers, migration checksums, expected target names, and the contract digest. Test fixtures remain direct hand-authored inputs. `generate:check` regenerates in a temporary directory and fails on a byte difference, an undeclared output, or a stale checked-in artifact.

The retained determinism check runs three generations from unchanged inputs and requires identical contract digests plus zero generated-file differences.

## Run the real local lifecycle

Run the focused provider-free lifecycle:

```sh
pnpm test:budget
```

The command creates a fresh in-memory PGlite database, applies the hand-authored migration graph, verifies the installed contract digest, selects private permission fixtures, and drives the generated five-method client. It does not mock a public operation or edit a private table to create lifecycle state.

The documented acceptance flow is equivalent to:

```ts
const local = await openLocalKeynes();

try {
  const definer = local.clientFor("definer-fixture");
  const allocator = local.clientFor("allocator-fixture");
  const requester = local.clientFor("requester-fixture");
  const settlement = local.clientFor("settlement-fixture");
  const reader = local.clientFor("reader-fixture");

  const resource = await definer.defineResourceType({
    commandId: "10000000-0000-0000-0000-000000000001",
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });

  const root = await allocator.createBudget({
    commandId: "20000000-0000-0000-0000-000000000001",
    resources: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 100 },
    ],
  });

  const request = await requester.requestBudget({
    commandId: "30000000-0000-0000-0000-000000000001",
    parentBudgetId: root.budget.budgetId,
    resources: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 40 },
    ],
  });

  if (request.kind !== "approved")
    throw new Error("fixture request must be funded");

  await settlement.settleBudget({
    commandId: "40000000-0000-0000-0000-000000000001",
    budgetId: request.childBudgetId,
    usage: [
      { resourceTypeId: resource.resourceType.resourceTypeId, amount: 25 },
    ],
  });

  const { budget: child, history } = await reader.getBudget({
    budgetId: request.childBudgetId,
  });

  expect(child.lifecycle).toBe("settled");
  expect(child.resources[0]?.directUsage).toBe(25);
  expect(history.entries.map((entry) => entry.kind)).toEqual([
    "budget_created",
    "request_approved",
    "budget_settlement_recorded",
  ]);
} finally {
  await local.close();
}
```

`openLocalKeynes` and `clientFor` are private test APIs, not package-root exports. Product-facing local construction remains outside FEAT-0002.

## Provider-free coverage

The full SDK and generator suites cover these groups through installed public functions and generated consumers:

| Group                  | Required observations                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definition             | first definition, exact redefinition, changed-definition conflict, no quantity                                                                                                  |
| Permissions            | five independent permissions, including request-only and settlement-only principals                                                                                             |
| Allocation and request | safe arithmetic, exact approval, canonical denial, no partial envelope, sibling conservation under the serialized local queue                                                   |
| Settlement             | nested open descendants, explicit or omitted unknown usage, later evidence, repeated known value, conflicting known value, consumable return, reusable return, isolated overage |
| Replay                 | lost-response simulation for all four mutations, exact stored result, no duplicate state or history entry, changed-body conflict across principals                              |
| Rollback               | each declared private checkpoint leaves no partial base fact, result, or history entry visible through public reads                                                             |
| Validation             | canonical issue order independent of object property insertion order                                                                                                            |
| Generation             | every ordered operation resolves, three clean generations match, no undeclared output                                                                                           |

## Full repository verification

Run the generator tests, the full SDK suite, and the repository checks:

```sh
pnpm test:generator
pnpm --filter @keynes/sdk test
pnpm verify
```

The retained FEAT-0002 run has 15 passing generator tests and 38 passing SDK tests. The acceptance record contains the exact PGlite package version, runtime `server_version`, contract digest, migration checksums, generated-file hashes, command results, and repository revision. It does not contain credentials or arbitrary command bodies.

## Evidence limits

A passing quickstart proves only the fresh local generated-client-to-installed-PGlite lifecycle, deterministic generation, serialized conservation, declared authorization branches, replay, and declared rollback checkpoints. Budget semantics remain in the database procedures. The generated client validates and transports commands and results.

Native PostgreSQL concurrency, independent connections, roles, tenant isolation, hostile-caller security, customer installation, Cloud, cross-host equivalence, recovery, rolling upgrades, broad fault campaigns, package footprint, memory use, startup, latency, paid services, and managed providers remain `NOT RUN`.
