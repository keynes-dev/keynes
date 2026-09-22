# Research: Simplify Policy Requests and Clarify Command-Result Lookup

## One request API

**Decision**: Remove `prepareRequest` from every public Budget handle and keep the existing internal Policy preparation function as the single validation path for integrated `request`.

**Rationale**: Preparation does not allocate and cannot make an application workflow durable. Applications can call their Policy directly, retain its ordinary result in their own stack and submit final resources with an operation key. The SDK only needs to own validation when it invokes Policy as part of a request.

**Alternatives considered**: Renaming preparation to `testPolicy`, `runPolicy` or `evaluatePolicy`; request builders; checkpoint callbacks; resume overloads; persistence adapters. Each preserves a second public operation or moves application workflow state into Keynes without adding accounting correctness.

## High-level lookup name

**Decision**: Rename the high-level facade to `getOperationResult` and its public projection to `OperationResult`. Remove the prior high-level names immediately. Keep `recoverOperation` in the generated wire client and PostgreSQL procedure.

**Rationale**: The call reads a receipt. It does not recover a workflow, retry a command or restore an effect. Keeping the lower-level identifiers avoids an unnecessary database contract rename while the high-level API states the product meaning.

**Alternatives considered**: `recoverOperation`, `inspectOperation` and deprecated aliases. `getOperationResult` matches the read-only behavior; aliases would leave two APIs for the same operation.

## Missing and expired receipts

**Decision**: Add `not_found` to the canonical wire result union and make the lookup procedure return it only when no tenant-scoped receipt exists. Preserve `expired` for an existing receipt whose expiry has passed.

**Rationale**: The current combined result hides relevant evidence. The distinction remains observational: a delayed command can arrive after either result, and mutation replay behavior is unchanged.

**Alternatives considered**: Continue collapsing both states into `expired`; return an error for absence; delete expired receipts during lookup. These either lose information or turn a read into cleanup/mutation.

## Compatibility

**Decision**: Advance `semanticGeneration` and `minimumSdkGeneration` from 5 to 6 and the `recoverOperation` procedure revision from 3 to 4. Regenerate artifacts from `schema.json` and `contract.json` before editing consumers.

**Rationale**: An added wire result variant changes exhaustive consumers and requires a database that can produce the new distinction. Existing compatibility checks already reject a semantic or procedure mismatch.

**Alternatives considered**: Leave generation 5 and rely on tolerant readers. The installed SDK validates the union and the accepted contract requires explicit old/new mismatch failure.

## Constitution ownership

**Decision**: Constitution 14 retains stable accounting, ownership, trust, deterministic command and evidence principles. The [ownership ledger](contracts/constitution-ownership.md) maps version 13's detailed requirements to product, architecture, ADR, feature/command contract or contributor workflow owners, and records obsolete statements.

**Rationale**: A constitution should constrain direction without freezing current technologies, package layouts, issue sequencing or public signatures.

**Alternatives considered**: Remove only `prepareRequest`; retain all other detail; rewrite historical ADRs and features. Both would preserve the governance problem or erase accepted history.
