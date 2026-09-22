# Configured creation contract

This is the planned KEY-78 contract. It is not implemented or runtime-qualified.

## Public SDK

```ts
const resources = {
  usdCents: { unit: "cent", accountingBehavior: "consumable" },
  reviewSeats: { unit: "seat", accountingBehavior: "reusable" },
} satisfies ResourceDefinitions;

const keynes = await createKeynes({ resources });
const root = await keynes.createBudget({ usdCents: 1_000, reviewSeats: 0 });
const moneyOnly = await keynes.createBudget({ usdCents: 1_000 });

const remote = await createKeynes({ resources, databaseUrl });
const durableRoot = await remote.createBudget(
  { usdCents: 1_000 },
  { operationKey },
);
```

The package exports the existing ResourceDefinitions structural type. Initialization
requires exactly resources and, for remote use, databaseUrl. Zero arguments,
connection-only options, empty declarations, unknown fields, malformed definitions,
and a ResourceBinding supplied as resources reject. Presence of invalid databaseUrl
must fail rather than select local mode.

LocalKeynes/Keynes and RemoteKeynes carry the declaration-name generic. Factory
overloads infer names without explicit generics; named public types may retain a
default string parameter for existing annotations. Factory inference must not
widen an inferred finite key set to string to accept a creation input.

The creation signature retains the existing type helpers in this shape:

```ts
interface ConfiguredCreator<Names extends string> {
  <
    const Amounts extends ResourceAmounts<Names>,
    const Policies extends PolicySetInput | undefined = undefined,
  >(
    amounts: ExactResourceAmounts<NoInfer<Names>, Amounts>,
    ...options: AttachPolicyArguments<Extract<keyof Amounts, Names>, Policies>
  ): Promise<
    Budget<
      Extract<keyof Amounts, Names>,
      ContextOfPolicySet<Policies>,
      ReasonsOfPolicySet<Policies>
    >
  >;
}
```

Remote creation substitutes RemoteAttachPolicyArguments and RemoteBudget with
the same membership/context/reason parameters. Local options permit the existing
policies value; remote options also permit operationKey. Unknown options reject.
No initial, definitions, bindings, Policy, or recovery fields belong inside amounts.
A Resource whose valid configured name is policies is still an ordinary Resource
key; only the separate options argument carries Policy metadata.

Known extra keys reject in inline objects and variables, including zero-valued
extras. Exact returned names equal supplied keys, not all declared names. An
explicit zero member is usable by typed request/settle/inspect consumers; omitted
members are not. Policy requirements must fit the selected membership.

Imported plain declaration objects work without a helper or generics; runtime
validates accountingBehavior when TypeScript has widened a string. Callers can use
satisfies for static definition checks. Broad dictionary annotations erase exact
names and cannot regain autocomplete. Runtime validation still rejects unknown
keys; finite known extra keys must never be silently accepted by inference.

## Initialization and lifecycle

Copy all own declaration data before the first asynchronous suspension. Validate
plain objects with existing strict name, field, unit, and accounting rules,
including unsupported own fields/symbols. No mutation by the caller may change
admitted configuration or commands.

Local startup opens one private SQLite authority and atomically defines the
supplied catalog using existing explicit definition semantics. It creates no
Budget or quantity. Failed startup closes the private host.

Remote startup normalizes and verifies databaseUrl, completes the existing
compatibility handshake, then calls validateResources for all declarations.
Return a usable client only on complete success. Any failure closes the acquired
executor/pool, preserves the relevant error family, and never falls back.

defineResources remains an explicit independent operation. Its existing return
binding and authorization remain; it cannot extend the configured client's names.
An empty durable catalog must be provisioned before configured initialization
through the existing authorized database definition operation.

Local operations check runtime_closed before inspecting malformed input. Capture
amounts and options inside the async method before queuing semantic validation.
All Promise-returning methods reject failures asynchronously. Preserve admission,
close/drain, disposal, remote retry, and remote pool ownership.

## Authority interfaces

| Method                   | Canonical target                             | Input                                             | Result and permission                                                |
| ------------------------ | -------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| validateResources        | keynes.validate_resources                    | { definitions }                                   | { valid: true }; create_root_budget; read-only                       |
| createBudget             | keynes.create_budget                         | { commandId, definitions, amounts, policies? }    | Existing CreateBudgetResult; create_root_budget                      |
| remote validateResources | keynes.remote_validate_resources, revision 1 | { definitions }                                   | Same confirmation inside existing response envelope; mapped identity |
| remote createBudget      | keynes.remote_create_budget, revision 3      | { operationKey, definitions, amounts, policies? } | Existing RemoteCreateBudgetResult; mapped identity                   |

Definitions use the existing public-key-to-unit/behavior map. For creation,
definition keys MUST exactly equal amount keys. The SDK selects these entries from
captured configuration; it does not expose definitions as a per-Budget parameter.
Supported direct embedded callers supply the same effective command to procedures
inside their own transaction. They receive identical accounting and atomicity.
There is no durable registry of SDK client name restrictions; declarations are
compatibility input, never authorization.

Validation compares all supplied definitions with immutable catalog entries in the
selected tenant. Additional persisted names are allowed. Missing names or
unit/behavior mismatches reject. Creation repeats selected definition validation
at the authority; successful startup alone is not permission for later commands.

Neither operation calls an inserting Resource resolver. Durable validation writes
no catalog, binding, command, remote-operation, Budget, quantity, or history rows.
Successful creation writes only its normal creation/recovery effects, with no
definition or ResourceBinding writes.

Creation accepts a non-empty amounts object whose values are integers from zero
through 9007199254740991, matching existing exact quantity rules. Reject negatives,
fractions, non-finite values, unsafe integers, unsupported fields, malformed
objects, and mismatched keys. Preserve explicit zero membership without a funding
movement. Non-empty all-zero roots remain active and cannot later gain funding.

## Authorization, replay, and rollback

Authenticate and authorize before catalog lookup or result disclosure. Remote
wrappers derive identity from protected login-role mapping. Never accept tenant,
principal, binding identity, or credentials from declarations.

Canonical creation identity includes selected canonical Resource meaning,
normalized amounts with zero members retained, and effective Policy input.
Canonicalize object order and existing Policy defaults/ordering consistently in
both remote_operations and canonical commands. Unused configuration, connection
details, and operation identity itself are not part of the payload digest.

Exact retry returns the stored result without a new root or funding effect,
including after ordinary later lifecycle changes. Removing zero membership,
changing an amount, or changing effective Policy input produces command_conflict.
Adding compatible unused declarations to a new recovering client does not conflict.
Read-only selected declaration validation and authorization precede replay return.

Retain existing identity uniqueness and contention protection so concurrent exact
attempts have one committed result and conflicting attempts cannot both commit.
The transaction owns Budget, memberships, funding, history, command result, and
remote recovery reference together. Faults and application transaction rollback
leave no partial successful creation. Existing remote known-failure receipts may
retain their current behavior; they must not become successful replay records.
Procedures never commit the application's enclosing transaction.

## Errors

| Condition                                               | Error family                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| Malformed factory options                               | invalid_configuration                                               |
| Invalid names/definitions/amounts                       | Existing invalid_resource_name or invalid_command validation family |
| Amount name outside captured configuration              | SDK resource_not_defined                                            |
| Missing selected-tenant catalog definition              | resource_type_not_found                                             |
| Conflicting unit/accounting definition                  | resource_type_conflict                                              |
| Missing authority permission or invalid remote identity | Existing authorization/authentication family                        |
| Conflicting command reuse                               | command_conflict                                                    |
| Calls after local close begins                          | runtime_closed                                                      |
| Runtime acquisition or incompatible connection          | Existing initialization/remote compatibility family                 |

Return existing safe error details only. Do not disclose foreign catalog contents,
private IDs, SQL, or credentials. Missing and mismatched definitions must remain
distinguishable from malformed input and authorization failures.

## Compatibility and exclusions

Advance semanticGeneration and minimumSdkGeneration to 3. Regenerate schema,
validator, client, procedure inventory, and digests. Freeze migrations 0001-0007;
add generated 0008 and move the sole current contract marker there. Keep the
preview installation profile; recreate development installations and prove exact
recheck/drift refusal. No installed upgrade support is claimed.

Remove superseded public factory/creation overloads and reject old wire inputs.
Adapt current callers and consumer fixtures. Preserve historical docs/evidence
with their original revision meaning. Existing openBudget, request, settle,
PolicySet, and explicit definition behavior retain their current semantics;
future loadBudget, Policy bindings, allows, generation tooling, and journal
conversion are outside KEY-78.
