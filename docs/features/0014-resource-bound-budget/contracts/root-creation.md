# Root-creation authority contract

## Operation

The generated operation remains `createBudget`. Native PostgreSQL continues to expose `keynes.create_budget(jsonb)`. The operation always requires `create_root_budget`. It requires `define_resource_type` only when exact catalog lookup finds at least one missing canonical Resource name.

Validation and identity resolution precede authorization. Root authority precedes command replay and conflict resolution. Exact replay needs current root authority but does not need definition authority. A changed command identity fails before catalog reconciliation. Matching definitions are reused, conflicting definitions fail, and missing definitions are inserted only after conditional definition authorization.

Standalone `defineResource` and `keynes.define_resource_type(jsonb)` remain supported. Child request, settlement, and inspection commands keep their existing wire shapes.

## Command

```ts
export interface RootResourceInput {
  readonly definition: ResourceDefinition;
  readonly amount: Amount;
}

export interface CreateBudgetCommand {
  readonly commandId: Uuid;
  readonly resources: readonly [RootResourceInput, ...RootResourceInput[]];
  readonly policies?: readonly PolicyDefinitionV1[];
}
```

`resources` contains only allocated definitions. Initial amounts are non-negative, so zero is valid and negative amounts are invalid. The boundary rejects duplicate canonical names, invalid definitions, an empty array, extra fields, and Policies that refer to an unallocated Resource. The authority sorts entries by canonical name and stores that order in the canonical command body.

`CreateBudgetResult` remains the existing `BudgetProjection` result with `kind: "created"` and replay status. Each Resource projection returns the committed opaque Resource identity, canonical name, definition fields, and definition digest.

## Atomic behavior

One authority transaction owns command replay, unconditional Budget-creation permission, conditional definition permission, Resource lookup or insertion, definition-conflict handling, Policy validation and attachment, first-Budget insertion, initial holdings, history, result validation, and result storage.

An exact existing definition is reused. A conflicting definition returns `resource_type_conflict`. A repeated identical command returns the original result with `replayed: true`. Reusing the command identity with a different definition, amount, selected Resource set, or Policy set returns `command_conflict`.

A failure after any Resource insertion but before commit leaves no new Resource, Budget, holding, Policy, command result, history stream, or history entry.

## Resource identity and evidence

The authority creates opaque Resource UUIDs. `resource_type_id` does not encode the command identity. `definition_command_id` names the first command that committed the immutable definition, and `definer_principal_id` names that command's principal.

Standalone definition keeps its current result behavior. For existing rows, the definition evidence returns the original `definition_command_id`. A combined root result does not add a second definition-evidence object; the root command body, Resource rows, holdings, and root result are the canonical evidence.

## Contention

Concurrent commands that introduce the same canonical name must converge on one Resource row. After an insert conflict, the authority reads the committed winner and applies the same exact-definition or conflict rule. It never exposes a raw uniqueness error or creates two identities for one tenant and canonical name.
