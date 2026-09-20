# Request contract

Implemented and locally verified. See [acceptance.md](../acceptance.md) for exact candidate evidence and remaining qualification limits.

## API and validation

Keep `createKeynes({ resources })`, current remote configuration, `createBudget(amounts)`, `Budget.request(amounts, options?)`, settlement and inspection. Retain Resource inference and exact child membership. Remove Policy/context/reason generics, registration/authoring exports and Policy-only errors.

Local request options accept only optional `decisionEvidence`. Remote options also retain `operationKey` created by `createOperationKey()`. Local creation accepts amounts only; remote creation retains operation-key options. Detect unsupported fields and extra arguments before serialization, including empty or explicitly undefined legacy fields in JavaScript. Reject `policies`, `childPolicies`, `context` and `policyEvidence` as inputs; never strip them.

Canonical requests retain `commandId`, `parentBudgetId` and `resources: [{ resourceTypeId, amount }]`. Remote requests retain `operationKey`, `parentBudgetReference` and their named Resource entries. Both add optional `decisionEvidence`; strict schemas reject additional keys. Parent membership is required even at zero. Empty/duplicate envelopes and nonnegative-safe-integer violations retain structured errors. A missing parent member rejects with `invalid_command` and a membership issue; catalog existence grants no membership.

Public outcomes remain `status: approved` with a Budget or `status: denied` with ordinary availability reasons. Wire outcomes retain `kind` and `replayed`. Both outcomes and approved/denied history may carry nonempty evidence. Inspection and remote recovery preserve it. Remove Policy evidence and ceiling reasons. Keep unrelated error families. SDK option mistakes use `invalid_configuration`; invalid canonical evidence uses `invalid_command` with a field/rule issue. Transport-unrepresentable input can fail before SQL entry but must change no state.

## Evidence

Use a readonly flat map of canonical keys to string, boolean, null or nonnegative safe integer. Reuse old scalar-context limits: 32 fields, keys matching `^[a-z][a-z0-9_]{0,62}$`, 256 UTF-8 bytes per string, and 8192 bytes of canonical JSON. Reject NUL, unpaired surrogates, nested values, arrays, undefined members, non-finite/fractional/negative numbers, bigint, accessors and non-JSON properties. Require a plain object with own enumerable data fields. Preserve key spelling.

Omission, an undefined optional SDK field and an empty map normalize to omission. Top-level null rejects. Negative zero normalizes to zero. Canonical JSON sorts ASCII keys, uses compact JSON string escaping, emits other valid Unicode unchanged, and serializes integers in decimal. Do not normalize Unicode. Both authorities enforce the same canonical UTF-8 byte limit.

Snapshot validated caller data before admission and retries. Evidence remains a caller assertion even if its key says `approved` or `ceiling`; it cannot override permission, membership, lifecycle, availability or funding. Detailed evaluation records stay in the application.

## Replay and transactions

Canonical input includes normalized evidence. Reordered equivalent input replays; changed evidence, parent or envelope conflicts. Replay resolves before current availability changes the prior result, retaining applicable current permission checks. A denied replay stays denied after a settlement return. Local public calls generate new identities; existing internal retry remains. Remote retains operation recovery and known-failure receipts. No Local recovery API is added.

Keep existing transaction boundaries, permission checks, sorted native locks and journal arithmetic. Canonical PostgreSQL calls remain provisional inside caller-owned transactions; adapters never commit, roll back, close or retry a fragment. Customer SQL evaluation is outside Keynes and can use the same application transaction when needed. Evaluation elsewhere has no atomic cross-database guarantee.

## Compatibility and migration

Advance semantic/minimum SDK generation to 4 and revise affected procedure identities. Remove Policy-profile identity from command/procedure/installation checks while retaining the remaining exact checks. New/old client-runtime combinations fail before mutation.

Regenerate the single fresh-install baseline and ordinary object inventory. Exact reinstall is read-only; historical, partial, drifted and profile-mismatched targets return structured incompatibility without repair. Check layout/inventory before querying identity columns absent in an older target.

Customers remove attachments, compute ordinary envelopes themselves and optionally submit a bounded explanation. Recreate incompatible development databases explicitly; no automatic upgrade, destructive recreation or state conversion is supplied. Document current behavior only after implementation passes. Historical specs, ADR bodies and evidence keep their original meaning.
