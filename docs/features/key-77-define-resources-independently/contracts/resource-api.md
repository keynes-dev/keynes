# SDK contract: Independent Resource definitions

This is the proposed KEY-77 API, not implemented behavior. See the
[authority command contract](resource-commands.md) for validation and transactions.

## Ordinary use

```ts
import { createKeynes } from "@keynes/sdk";

const definitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
};

const keynes = await createKeynes();
try {
  const resources = await keynes.defineResources(definitions);
  const root = await keynes.createBudget(resources, { usdCents: 1_000 });
  const state = await root.inspect();
} finally {
  await keynes.close();
}
```

The binding covers both names. The root includes only `usdCents` because KEY-77
retains allocation-based membership. Definition creates no Budget or quantity.
The root's amount is its complete original funding.

## Definition input and inferred result

Local and Remote clients expose `defineResources(definitions)` and return
`Promise<ResourceBinding<Extract<keyof Definitions, string>>>`.

Normal calls need no explicit generic, identity, digest, recovery key, helper,
or second binding step. The input is a non-empty plain object with the existing
lower-camel name convention and entries containing only `unit` and
`accountingBehavior`. The authority validates values and canonicalizes names.

The input's inference constraint allows string-valued behavior properties so an
ordinary separately declared object works. It does not promise that every string
is valid; unsupported behavior rejects. The exported `ResourceDefinitions` type
retains the strict behavior union for callers wanting an optional check:

```ts
const definitions = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
} satisfies ResourceDefinitions;
```

The binding is a frozen opaque value with a private brand. It exposes no token,
Resource IDs, tenant/authority information, digest, producer client, or balance.
It has no constructor, serializer, public persisted format, or rehydration API.
Reflection and JSON output must not disclose its private state.

## Creation overloads

Both Local and Remote preserve these positional shapes and existing Policy options:

```ts
keynes.createBudget(definitions, allocation, ...options);
keynes.createBudget(binding, allocation, ...options);
```

Return types retain the existing Budget/RemoteBudget and Policy generics. Budget
Resource names come from allocation keys intersected with the definition/binding
names. They do not expand to every name in the binding. Existing numeric and
membership behavior applies; KEY-78 owns object-form creation and omitted amounts.

Allowed names are inferred from the first argument alone. Retain the existing
exact-amount key constraint, including separately declared variables:

```ts
const invalidAllocation = { usdCents: 100, unknownResource: 1 };
// This must fail type checking, just like an inline extra property.
await keynes.createBudget(resources, invalidAllocation);
```

A deliberately widened name dictionary can only offer broad static checking.
Runtime validation still rejects unknown names and invalid amounts atomically.

Raw creation validates the complete declaration and reconciles its allocated
definitions with root creation in one transaction. Binding creation uses the
recorded member set and performs no definition writes. It rejects any allocation
outside that set. Previously committed definitions survive a failed creation.

## Scope, identity, and lifetime

Two authorized durable clients using the same installed SDK can pass the binding
object between them. The producer may be closed. The consumer sends the hidden
reference to its own authority; the authority validates its tenant-scoped receipt
inside creation and checks the consumer's current permissions.

Foreign tenants or installations, independent Local runtimes, copied objects,
object spreads, reconstructed lookalikes, and JSON round trips cannot become
valid bindings by carrying matching Resource names. Invalid bindings reject with
a safe `invalid_command` error. No failure includes the token or private scope.

The private canonical receipt survives the remote recovery retention window.
Local process exit or close discards the entire authority. Durable backup/clone
identity and cross-process binding transport are outside this feature's public
contract; no new persistence or revocation API is added.

## Retry and recovery

Normal calls generate one command identity per operation. Automatic retry retains
that identity and snapshot. Repeating definitions as a new operation exact-reuses
Resource identities but is not command replay.

Remote definition supports the existing explicit operation-key option:

```ts
await remote.defineResources(definitions, { operationKey });
await remote.recoverOperation(operationKey);
```

Exact retry returns a binding for the stored result. Conflicting key reuse returns
`command_conflict`. Recovery adds the definition result to the existing
discriminated union, concealing private wire fields. By-key recovery returns
`ResourceBinding<string>` because a key carries no literal Resource names. Retry
with the original declaration preserves the inferred name set. Preserve existing
uncertain-outcome and expired-recovery behavior; never synthesize success or rerun
application effects. Local exposes no new recovery API.

## Asynchronous admission

New definition and touched creation methods return Promises for all input,
lifecycle, and operation failures. On Local, close state takes precedence over
malformed input. Check close state before reading input, capture a safe snapshot
before the first await, admit work synchronously, then validate and execute that
snapshot. Calls admitted before close drain; later calls reject `runtime_closed`.
Input getter/copy failures also become Promise rejections and cannot mutate state.

Mutating a caller definition, allocation, or option after invocation cannot alter
an admitted command. Mutating the binding cannot change its hidden receipt.

## Existing declaration consumers

Remove standalone `defineResources` and `ResourceSchema` exports. Keep
`ResourceDefinitions`; export the opaque `ResourceBinding` type. Pure
`definePolicy` and `definePolicySql` consume plain definitions and preserve their
Resource-name inference, context, reasons, normalized program, and fail-closed
evaluation semantics. They perform no database registration.

Adapt existing `remote.openBudget({ reference, resourceTypes: definitions })`
without introducing reference-only loading. Update active README and application
examples, export tests, type fixtures, and installed package consumers. Keep
historical feature artifacts and their evidence unchanged.
