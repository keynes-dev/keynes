# Local API contract

This document defines the planned public `@keynes/sdk` entry point for KEY-5. The current package does not yet implement this contract. All operations return promises, including validation failures. There is one Budget type for parentless and child Budgets.

## Application calls

```ts
const keynes = await createKeynes();
const resources = await keynes.defineResources({
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
});
const budget = await keynes.createBudget({
  resources,
  initial: { usdCents: 100, reviewSeats: 2 },
  allows: { add: true, request: true },
});
await budget.add({ usdCents: 20 });
const result = await budget.request({
  resources: { usdCents: 40, reviewSeats: 1 },
  allows: { add: false, request: false },
});
if (result.status === "approved") {
  await result.budget.settle({ usdCents: 25, reviewSeats: 1 });
}
await budget.settle({ usdCents: 0, reviewSeats: 0 });
const snapshot = await budget.inspect();
await keynes.close();
```

## Type and signature sketch

The signatures express the contract. Implementation derives wire types from shared schemas and preserves literal Resource names instead of copying this sketch into a second schema system.

```ts
type AccountingBehavior = "consumable" | "reusable";
type ResourceDefinitions = Readonly<
  Record<
    string,
    {
      readonly unit: string;
      readonly accountingBehavior: AccountingBehavior;
    }
  >
>;
type Allows = Readonly<{ add: boolean; request: boolean }>;
type Amounts<N extends string> = Readonly<Partial<Record<N, number>>>;
type Usage<N extends string> = Readonly<Partial<Record<N, number | null>>>;

interface ResourceBinding<N extends string> {
  readonly definitions: Readonly<
    Record<
      N,
      {
        readonly unit: string;
        readonly accountingBehavior: AccountingBehavior;
      }
    >
  >;
  // Implementation-private brand and authority registration.
}

interface LocalKeynes extends AsyncDisposable {
  defineResources<const D extends ResourceDefinitions>(
    definitions: D,
  ): Promise<ResourceBinding<Extract<keyof D, string>>>;
  createBudget<N extends string>(options: {
    readonly resources: ResourceBinding<N>;
    readonly initial?: Amounts<N>;
    readonly allows?: Partial<Allows>;
  }): Promise<Budget<N>>;
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface Budget<N extends string> {
  add(amounts: Amounts<N>): Promise<BudgetState<N>>;
  request<const A extends Amounts<N>>(options: {
    readonly resources: A;
    readonly allows?: Partial<Allows>;
  }): Promise<
    | {
        readonly status: "approved";
        readonly budget: Budget<Extract<keyof A, N>>;
      }
    | {
        readonly status: "denied";
        readonly reasons: readonly InsufficientAvailable<N>[];
      }
  >;
  settle(usage: Usage<N>): Promise<Settlement<N>>;
  inspect(): Promise<BudgetSnapshot<N>>;
}
```

The implementation must reject extra Resource keys both in literal/variable compile tests and at runtime. Generic inference must not widen the binding's names from `initial`. The binding's brand alone is insufficient; validate registry provenance. Returned bindings, controls, snapshots, and history are deeply immutable copies. Inspection identities are opaque observational values and are not accepted as load, authorization, or recovery inputs.

## Inputs and results

| Operation                    | Contract                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| createKeynes()               | Opens one private SQLite authority. Any configuration argument, including databaseUrl, rejects as invalid_configuration. No fallback or public alternate store selector.                                                                         |
| defineResources(definitions) | Non-empty batch; exact reuse returns existing definitions. Any conflicting name aborts the batch. Resolves one quantity-free binding.                                                                                                            |
| createBudget(options)        | Binding required; no raw definitions or ResourceSchema. All binding members are included. Initial amounts default to zero. Missing control booleans default to true, independently. Initial funding does not consult `allows.add`.               |
| add(amounts)                 | Non-empty map of existing members. Active and `allows.add` permitted. Introduces exact quantities; zero amounts are valid. Resolves target Budget state.                                                                                         |
| request(options)             | Non-empty resources map. Active and request permitted. Exact affordable envelope creates one child; unaffordable envelope resolves a denial with sorted insufficient_available reasons. Child controls default independently and do not inherit. |
| settle(usage)                | Cumulative direct usage, possibly empty or unresolved. Resolves kind, target Budget state, changed usage totals, and unresolved member names. Automatic ancestor changes are read through inspect.                                               |
| inspect()                    | Resolves `{ budget, history: { entries } }` at one committed point. State is only for the selected Budget; history contains its whole tree.                                                                                                      |
| close() / asyncDispose       | Closing immediately rejects new calls, drains admitted work, then closes SQLite. Repeated close shares the same completion and disposal behavior.                                                                                                |

`BudgetState` includes opaque `id`, `parentId`, `rootId`, immutable `allows`, lifecycle, and a canonically ordered `resources` array. Each member has its name, unit, accountingBehavior, live quantity, directUsage as number or null, and cumulative deficit. It contains no allocation-derived shadow balance. `Settlement` contains `kind: "settling" | "settled"`, `budget`, `updatedUsage`, and `unresolvedResources`. The public result contains no command identity, operation key, recovery handle, or replay administration.

An `InsufficientAvailable` reason contains `code: "insufficient_available"`, `resource`, `requested`, and `available`. History entries are a discriminated union of Budget creation, request approval/denial, movement, usage, deficit, settlement start, and finalization. Every entry contains a tree sequence and subject Budget ID. Movement payloads follow [data-model.md](../data-model.md). History Resource names are strings from the connected tree, not falsely constrained to the selected child's membership.

## Failure contract

Reuse `KeynesError` for generated domain errors and `KeynesSdkError` for Local lifecycle and input preparation. Add missing variants to the owning schema or SDK error union rather than throwing strings. Planned new variants are marked here.

| Category                  | Code                              | Outcome                                                                                                                                                    |
| ------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape or quantity         | invalid_command                   | Reject with operation and structured validation issues; no domain change.                                                                                  |
| Resource spelling         | invalid_resource_name             | Reject invalid public names.                                                                                                                               |
| Unknown membership        | resource_not_defined              | Reject a key outside the selected binding or Budget, including zero-valued requests.                                                                       |
| Definition conflict       | resource_type_conflict            | Roll back the entire batch.                                                                                                                                |
| Binding provenance        | invalid_resource_binding, new     | Reject forged, copied, or foreign binding without exposing private scope IDs.                                                                              |
| Disabled behavior         | budget_operation_not_allowed, new | Reject with Budget operation; controls cannot change.                                                                                                      |
| Lifecycle                 | budget_not_active                 | Reject additions and requests once settlement begins.                                                                                                      |
| Settlement conflict       | invalid_command                   | Reject decreasing usage, clearing known usage, or any changed total after finalization; structured rule names distinguish monotone and settled violations. |
| Internal command conflict | command_conflict                  | Shared command seam rejects different normalized input under one ID. Public methods never take that ID.                                                    |
| Runtime lifecycle         | runtime_closed                    | New calls after closing begins reject before argument validation.                                                                                          |
| Configuration             | invalid_configuration             | Reject legacy configuration, Policy fields, and unsupported options.                                                                                       |
| Repeated response loss    | operation_interrupted             | Existing bounded same-command retry exhausted; no duplicate accounting or external work.                                                                   |

Public calls must return a promise before any property access, copying, validation, or binding lookup can throw. Check runtime admission first, capture inputs at invocation inside the promise-returning boundary, and enqueue the immutable captured values. Do not wait until queue execution to copy mutable caller objects. A capture failure becomes a rejected promise and does not poison the queue. Runtime closing wins over malformed input on calls made after close begins.

## Compatibility and exclusions

This replaces the old public schema-first API in the private `0.0.0` package. Remove standalone `defineResources`, `ResourceSchema`, Policy authors/types, remote options/handles, and operation recovery from the root export. Do not add public aliases or a legacy entry point. Existing deferred implementations can remain private source. Compile tests must prove the removed calls are unavailable, and JavaScript consumer tests must prove unsupported inputs reject.

Local users never provide SQL, identities, credentials, PostgreSQL options, or replay keys. A private PostgreSQL test adapter is not a new public SDK mode. [Shared commands](shared-commands.md) own backend conformance.
