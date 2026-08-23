# Quickstart: Provider-free Budget lifecycle

**Status**: `PLANNED — NOT RUN`. These commands and imports are the implementation target for FEAT-0002. They are not evidence until the feature is implemented and the retained provider-free run passes.

## Prerequisites

- Node.js 24.19.0, or another repository-supported Node.js 24–26 release
- pnpm 11.21.0
- no database service, credentials, container runtime, or network provider

From the repository root, install the exact lockfile:

```sh
pnpm bootstrap
```

## Generate and check the contract

The implementation adds these root commands:

```sh
pnpm generate
pnpm generate:check
```

`generate` reads the ordered contract source and hand-authored migration graph, then emits TypeScript types, standalone validators, the concrete five-method client, public SQL wrappers, canonical fixtures, operation metadata, checksums, and distinct digest records. `generate:check` regenerates in a temporary directory and fails on a byte difference, undeclared output, or stale checked-in artifact.

The retained determinism check runs three generations from unchanged inputs and requires identical contract digests plus zero generated-file differences.

## Run the real local lifecycle

The implementation adds a focused provider-free command:

```sh
pnpm test:budget
```

That command creates a fresh in-memory PGlite database, applies the hand-authored migration graph, verifies the installed contract digest, selects private permission fixtures, and drives the generated five-method client. It does not mock a public operation or edit a private table to create lifecycle state.

The documented acceptance flow is equivalent to:

```ts
const local = await openLocalKeynes();

try {
  const publisher = local.clientFor("publisher-fixture");
  const allocator = local.clientFor("allocator-fixture");
  const requester = local.clientFor("requester-fixture");
  const settlement = local.clientFor("settlement-fixture");
  const reader = local.clientFor("reader-fixture");

  const resource = await publisher.publishResource({
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

## Required provider-free cases

The focused command must pass all of these groups through installed public functions:

| Group                  | Required observations                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publication            | first publish, exact republication, changed-definition conflict, no quantity                                                                                |
| Permissions            | five independent permissions, including request-only and settlement-only principals                                                                         |
| Allocation and request | safe arithmetic, exact approval, canonical denial, no partial envelope, sibling conservation under the serialized local queue                               |
| Settlement             | nested open descendants, missing usage, later evidence, repeated known value, conflicting known value, consumable return, reusable return, isolated overage |
| Replay                 | lost-response simulation for all four mutations, exact stored result, no duplicate state or history entry, changed-body conflict across principals          |
| Rollback               | each declared private checkpoint leaves no partial base fact, result, or history entry visible through public reads                                         |
| Generation             | every manifest binding resolves, three clean generations match, no undeclared output                                                                        |

## Full repository verification

After focused acceptance passes, run:

```sh
pnpm verify
```

The implementation must retain the exact PGlite package version, runtime `server_version`, contract digest, migration checksums, generated-file hashes, test result, and repository revision in an ordinary provider-free test artifact or CI log. It must not store credentials or arbitrary command bodies.

## Evidence limits

A passing quickstart proves only the fresh local generated-client-to-installed-PGlite lifecycle, deterministic generation, serialized conservation, declared authorization branches, replay, and declared rollback checkpoints.

The report must state `NOT RUN` for native PostgreSQL concurrency, independent connections, roles, tenant isolation, hostile-caller security, customer installation, Cloud, cross-host equivalence, recovery, rolling upgrades, broad fault campaigns, package footprint, memory use, startup, latency, paid services, and managed providers.
