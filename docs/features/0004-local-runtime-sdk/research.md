# Research: Local runtime and SDK

This record resolves the technical choices for FEAT-0004. The feature adds the first package-root local workflow over the completed generated client and shared database core. It does not change Budget semantics or qualify a distributable package.

## R1. Put one facade over the generated client

**Decision**: Add `Keynes.create({ mode: "local" })`, `KeynesCreateOptions`, `Keynes`, and an identity-only `Budget` handle at the `@keynes/sdk` package root. FEAT-0004 accepts only the literal `local` mode and rejects missing modes, unknown modes, unknown fields, and durable-host configuration. The facade creates SDK-owned commands and calls the unchanged generated `KeynesClient`. Each generated method still invokes exactly one installed `keynes.*` database RPC function.

**Rationale**: The generated client already validates the five commands and results, maps canonical database errors, and binds each method to one installed target. The local facade needs to hide command IDs, Resource type IDs in inputs, fixture principals, and PGlite lifecycle. It must not repeat contract validation or Budget decisions. A `Budget` handle shortens the application call chain while keeping authority in the installed procedures.

**Alternatives considered**: `Keynes.local()` splits one deployment-selection operation into named constructors as more modes arrive. A nested shape such as `{ mode: { remote: apiKey } }` mixes the discriminator with host configuration and has no clean place for an endpoint or another credential form. Inferring a mode from environment variables can turn a broken durable configuration into ephemeral local state. Exporting `createKeynesClient` would require applications to supply a `ProcedureCaller` and command IDs. Adding a second hand-written client would duplicate generated bindings. Calling SQL from the facade would bypass the generated contract consumer.

## R2. Use one reversible Resource-name mapping

**Decision**: Public local Resource keys use lower camel case and match `^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$`. The facade maps each key to the lower-snake canonical name accepted by the generated contract and keeps the returned Resource type ID in one private runtime catalog. The inverse mapping must reproduce the original key exactly.

**Rationale**: The product examples use `usdCents` and `searchQueries`, while the database contract requires names such as `usd_cents` and `search_queries`. Restricting the public grammar makes the conversion injective and lets name-keyed inputs and denial reasons use one application name. Generated settlement, projection, and history values retain the complete shared domain contract. The catalog transports identities. It never decides Resource availability or state.

**Alternatives considered**: Public Resource IDs make applications carry database contract values through every call. Public lower-snake names contradict the accepted SDK examples. Accepting arbitrary strings or caller-supplied canonical overrides creates collisions and two naming rules.

## R3. Keep Budget identity separate from snapshots

**Decision**: A public `Budget` stores only a private Budget ID and a reference to its owning local runtime. `Budget.inspect()` calls the existing generated `getBudget` method and returns a fresh projection plus complete root-lineage history. `request()` returns a new child handle on approval. `settle()` returns the committed settlement result and snapshot. No Budget object mutates cached accounting fields.

**Rationale**: `RequestApproved` contains a child ID but no projection, so an identity handle can become usable without an extra read. Explicit inspection preserves the one-snapshot `getBudget` contract and avoids presenting stale fields as current authority. The database continues to derive availability, lifecycle, usage, and deficits.

**Alternatives considered**: Eagerly reading every approved child adds an installed call with no user requirement. A mutable Budget snapshot becomes stale after concurrent calls and needs synchronization. A data-only result forces applications back to IDs and flat client methods.

## R4. Generate one command ID per invocation and retry only confirmed response loss

**Decision**: Use Node's built-in `randomUUID()` to construct the full generated command once before its first attempt. The private procedure caller uses an internal `CommittedResponseLostError` only when the transaction has committed but the response is deliberately discarded. The facade catches only that sentinel and retries once with the same command object. A second sentinel becomes `KeynesLocalError` with `code: "operation_interrupted"`. All other failures propagate without an automatic retry.

**Rationale**: The existing replay ledger makes an exact retry safe, and create command IDs are also the created Budget IDs. Rebuilding a command during retry could duplicate authority. PGlite runs inside the process, so the current code has no general transport boundary that can classify arbitrary failures as post-commit response loss. The narrow sentinel proves the required behavior without turning every database or WebAssembly error into a retry loop.

**Alternatives considered**: Retrying every non-`KeynesError` failure can repeat persistent host faults and has no reliable outcome classification. Exposing command IDs moves durable coordination into the process-local API. Adding a retry library adds dependency and policy for one bounded replay.

## R5. Keep local errors separate from database errors

**Decision**: Preserve generated `KeynesError` for canonical contract failures. Add `KeynesLocalError` for local facade concerns with stable codes `invalid_configuration`, `runtime_closed`, `initialization_failed`, `operation_interrupted`, `invalid_resource_name`, and `resource_not_defined`. Add `ResourceDefinitionError` for plural definition failure, including the failed key, the keys committed earlier in that call, and the original `KeynesError` cause.

**Rationale**: Closing and startup are not database transitions, so adding them to the generated `ErrorEnvelope` would change the cross-host contract for a local-only concern. A small separate union lets applications handle expected local failures without parsing PGlite text. It also keeps generated errors authoritative instead of reproducing their full code and details union by hand.

**Alternatives considered**: Extending the database error contract makes every host carry local lifecycle vocabulary. Throwing raw `Error` values fails the stable lifecycle requirement. Replacing `KeynesError` with a hand-written facade error union creates a second contract that can drift.

## R6. Define Resources sequentially and report the committed prefix

**Decision**: `defineResources()` validates all public names first, sorts entries by canonical name, and calls `defineResource` sequentially. Each definition gets its own SDK command ID and commit. On the first failure, `ResourceDefinitionError.completed` lists the keys committed earlier in the call. Repeating the original definition record is safe because exact definitions are idempotent.

**Rationale**: The installed contract exposes one definition per command and no plural transaction. Deterministic sequential execution gives partial completion one stable order and does not invent rollback. Pre-validating names prevents a local grammar error from appearing after database commits have started.

**Alternatives considered**: `Promise.all` still serializes at the PGlite owner but makes observed failure and completion order harder to explain. Compensating deletes are invalid because Resource definitions are immutable. A new plural database procedure expands the contract without a product need.

## R7. Install one private local principal without exposing fixtures

**Decision**: Refactor installation input from fixture names to explicit private principal permission records. Product local mode installs one fixed internal tenant and one fixed internal principal with the five current permissions. Existing tests build their multi-principal fixtures through the same input type. Neither identity nor its permission record is exported.

**Rationale**: `product-fixture` already proves the permission combination, but fixture vocabulary and fault controls do not belong in the product path. One permission input keeps the installer host-neutral and retains database authorization checks. Fixed UUIDs are safe because every local runtime owns an isolated in-memory database.

**Alternatives considered**: Reusing the public-looking `product-fixture` name leaves test concepts in production code. Removing permission checks in local mode would fork database behavior. Accepting a caller principal or tenant violates the process-local trust boundary.

## R8. Keep the source workspace private and qualify behavior only

**Decision**: Add package-root source exports and consumer-style Vitest coverage without changing `@keynes/sdk` to a published package in FEAT-0004. Keep PGlite 0.5.5 as the only local runtime dependency. Run the public happy path, denial, settlement, history, retry, close, initialization cleanup, concurrent admission, two-runtime isolation, Resource mapping, and negative-export checks through the source workspace.

**Rationale**: The current package has no emitted build, export map, files list, or packaged migration assets. The next roadmap feature owns packaged asset loading, supported build environments, package size, memory, startup, latency, and shutdown qualification. Source-level public exports are enough to implement and test the product contract without overstating distribution readiness.

**Alternatives considered**: Publishing or adding a build now mixes behavior implementation with the next qualification gate. A new workspace or host registry adds ownership boundaries with one implementation. Replacing the existing PGlite version reopens the completed platform gate.
