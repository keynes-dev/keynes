# Research: configured creation

Research uses source at `93c4baa`, the KEY-78 spec, and ADR-0011. KEY-77 landed at
`abd1e18`. These are source-grounded design decisions, not runtime results.

## Client configuration and exact inference

**Decision**: Parameterize clients by inferred declaration names. Reuse
`ExactResourceAmounts`, const generics, and `NoInfer`. Infer returned Budget names
from the supplied amounts object's keys.

**Rationale**: `packages/sdk/src/keynes.ts` already infers allocations and Policies;
`packages/sdk/src/budget.ts` rejects extra keys with a mapped never constraint.
Plain Partial/Record types alone accept extra keys in separately declared objects.
Keep imported plain declarations usable through the existing
`ResourceDefinitionsInput` constraint and runtime behavior validation.
`satisfies ResourceDefinitions` supplies optional static definition checks.

**Alternatives considered**: Per-Budget bindings violate the revised brief.
Whole-schema Budget types include omitted members incorrectly. Explicit generic
arguments or a mandatory helper complicate the ordinary API. Broad annotations
erase names; runtime validation must still protect dynamic input.

## Policy and recovery integration

**Decision**: Move the current `AttachPolicyArguments` and
`RemoteAttachPolicyArguments` after amounts. Retain local `{ policies }`, remote
`{ operationKey }`, and combined remote options.

**Rationale**: Existing PolicySet context/reason inference and recoverOperation
already use these options. Policy Resource requirements must be checked against
supplied Budget membership, not the whole configuration.

**Alternatives considered**: Nested initial amounts violate FR-001. Metadata inside
amounts creates name ambiguity. Future Policy bindings, behavior controls, and
loading APIs are outside this change. A public local recovery API is unnecessary;
local retry retains its generated command identity internally.

## Initialization and provisioning

**Decision**: Add canonical and remote read-only `validateResources` operations
requiring create_root_budget permission. Compare every supplied declaration within
the current tenant. Local startup explicitly defines its private catalog. Remote
startup validates after compatibility succeeds.

**Rationale**: Existing defineResources can write bindings and replay records even
for exact reuse. It cannot implement a read-only durable startup. Validation
returns confirmation without a binding, command record, or private identity.

**Alternatives considered**: Persisted configuration tokens add unnecessary state.
SDK-only checks cannot prove catalog compatibility. Private-table reads bypass
the procedure boundary. Reusing definition resolution would insert missing names.

Explicit defineResources remains available under its current permission. An empty
durable installation is provisioned through existing supported database operations
before application startup. Defining more Resources through an initialized client
never expands that client's captured names.

## Creation and replay

**Decision**: Send selected definitions and amounts with equal non-empty key sets.
Replace the ResourceSource union. Resolve existing definitions without writes.
Normalize effective Resources, amounts, and Policies consistently in canonical
commands and remote operation recovery.

**Rationale**: Current remote_apply_command_v0007 hashes the entire submitted input
before the core call. Fixing inner replay alone leaves remote conflicts. Sending
selected definitions excludes unused declarations before either layer hashes them.
Current remote validation also rejects zero allocations and must change.

**Alternatives considered**: Sending the full configuration repeats unused metadata
and requires extra replay exclusions. Calling resolve_resource_v0007 provisions
definitions. Keeping binding-based creation leaves competing contracts.

Authenticate and authorize before catalog access or replay. Read-only validation
of selected definitions also precedes returning a replay result. Immutable tenant
definitions give selected canonical metadata stable meaning.

## Lifecycle

**Decision**: Snapshot declarations before the factory's first await. Local
creation checks close state first, captures amounts/options inside the async
method, then performs semantic validation within admission. Reuse queue/drain and
remote executor cleanup.

**Rationale**: The existing local runtime owns open/closing/closed transitions.
Delayed copying changes command meaning when callers mutate input. A failed
initialization must close acquired resources before rejecting.

**Alternatives considered**: Publishing a partial client permits incompatible use.
Fallback violates the selected-authority contract. A second lifecycle manager
duplicates existing ownership.

## Generated compatibility and storage

**Decision**: Increase remote semantic/minimum SDK generation 2 to 3, creation
revision 2 to 3, and introduce validation revision 1. Preserve Policy profile and
definition semantics. Add generated migration 0008 through a renderer.

**Rationale**: Creation changes incompatibly. The existing handshake checks
generation, digests, and procedure inventory. In current generate.ts, 0001-0006
are hash-pinned and 0007 still interpolates the current contract. Freeze 0007 at
its existing bytes and digest, add its immutable hash, and move the manifest's
sole contract:true marker to 0008. Regenerate current outputs from source.

**Alternatives considered**: Editing old migration bytes breaks retained evidence.
Retaining old SDK overloads creates conflicting contracts. Collapsing the
historical graph into the target clean baseline or supporting installed upgrades
would broaden this feature. Recreate development databases; keep the existing
preview profile and its exact-recheck behavior. No upgrade readiness is claimed.

All design questions are resolved. [quickstart.md](quickstart.md) specifies future
validation; new runtime and type results remain NOT RUN.
