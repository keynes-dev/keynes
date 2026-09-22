# Feature Specification: Declare typed policy parameters

**Feature Branch**: `key-116-declare-typed-policy-parameters`

**Created**: 2026-09-20

**Document stage**: Implementation specification. See acceptance.md for revision-scoped verification.

**Linear issue**: [KEY-116 Declare typed policy parameters](https://linear.app/keynes/issue/KEY-116/declare-typed-policy-parameters)

**Input**: Applications declare named, typed policy parameters in code and consume validated local snapshots without contacting Cloud. JSON Schema is the portable definition; Zod authoring remains optional.

## User Scenarios & Testing

### User Story 1 - Declare and provision parameters locally (Priority: P1)

An application author declares reusable policy settings such as a review threshold, supplies explicit initial values and reads a validated snapshot with inferred application types. Per-request facts such as an order total stay in the application's request inputs.

**Why this priority**: A policy needs dependable configuration before composition, fixtures or Cloud storage can use it.

**Independent Test**: Declare a numeric threshold and an enum, provision valid values offline and read their declared types. Invalid or incomplete values fail without producing a snapshot.

**Acceptance Scenarios**:

1. **Given** named JSON Schema declarations and explicit initial values, **When** the application creates a snapshot, **Then** all values validate and typed access preserves declared names and value types.
2. **Given** a missing required initial value, **When** its schema contains a default, **Then** provisioning fails instead of applying that default.
3. **Given** a wrong type, an unknown parameter or an unsupported schema check, **When** a declaration or value enters the helper, **Then** it fails explicitly without coercion, removed fields or a partial snapshot.
4. **Given** a raw schema consumer with no Zod dependency, **When** it declares and validates parameters, **Then** the workflow succeeds without loading Zod or contacting a service.

### User Story 2 - Override and reproduce a snapshot (Priority: P1)

An application author replaces selected parameter values for a local scenario and records the exact definition and effective values used. Reopening a fixture must not silently adopt a changed declaration or current initial values.

**Why this priority**: Overrides and portable identity make local policy tests reproducible.

**Independent Test**: Serialize a snapshot, restore it against its declaration and compare identities and values. Repeat with reordered object keys, changed schemas, changed values and tampered identity fields.

**Acceptance Scenarios**:

1. **Given** a valid snapshot, **When** an explicit override replaces one named parameter, **Then** the entire effective value set validates and the original snapshot remains unchanged.
2. **Given** an object-valued parameter, **When** an override omits a required nested field, **Then** the override fails rather than deep-merging the previous object.
3. **Given** equivalent definitions and values with different object-key order, **When** snapshots are produced, **Then** their canonical bytes and identities match. Array order remains significant.
4. **Given** a portable snapshot, **When** its expected definition, digest, version or values differ, **Then** restoration rejects it. Current initial values and defaults cannot repair it.
5. **Given** a snapshot retained by application code, **When** original declaration, initial-value or override objects later change, **Then** the snapshot and its identities remain unchanged.

### User Story 3 - Author representable schemas with Zod (Priority: P2)

An application author uses supported Zod declarations and retains inferred types while producing the same JSON Schema and snapshot contract used by consumers without Zod.

**Why this priority**: Zod is an authoring convenience; portability and runtime validation must work independently.

**Independent Test**: Compare supported Zod-authored and equivalent raw JSON Schema definitions with matching identity and values. Reject custom refinements and transformations before conversion can drop them.

**Acceptance Scenarios**:

1. **Given** a supported Zod declaration, **When** it is converted, **Then** inferred types and runtime checks agree with its portable JSON Schema definition.
2. **Given** a declaration containing a transform, coercion, custom refinement, default-producing operation or unsupported node, **When** it is converted, **Then** declaration fails with a location and reason instead of weakening its checks.
3. **Given** a converted portable fixture, **When** a consumer restores it without Zod, **Then** it validates identically against the expected definition.

### Edge Cases

- Unknown or duplicate logical names, invalid names, empty declarations and inherited object properties.
- Missing values versus explicit null, false, zero, empty string and undefined.
- Non-JSON values, non-finite numbers, cycles, accessors, custom serialization and prototype-sensitive keys.
- Unsupported dialects, unknown schema keywords, remote references, unsupported formats and unrepresentable Zod constraints.
- Mutation after validation, invalid nested overrides, changed definitions, stale initial values and tampered snapshots.
- Errors must identify the parameter and failing rule without echoing configuration values or secrets.

## Requirements

### Functional Requirements

- **FR-001**: Applications MUST declare a non-empty set of uniquely named parameters with JSON Schema definitions and explicit initial values. Parameters represent reusable configuration; per-request business facts remain separately owned by the application.
- **FR-002**: Declarations MUST validate schemas and initial values at runtime. Snapshot boundaries MUST require exact equality with the validated expected definition and validate effective values, reject unknown parameter names and missing values, and return no partial result. Restoration MUST NOT compile incoming schemas.
- **FR-003**: Typed authoring MUST preserve inferred names and value types for supported declarations. Dynamically loaded definitions MUST remain untrusted until checked against the application's expected declaration; callers cannot obtain trusted types merely by choosing a generic type.
- **FR-004**: Initial values MUST be explicit provisioning inputs. JSON Schema defaults MUST remain annotations and MUST NOT fill missing values, mutate configuration or replace restored values.
- **FR-005**: Explicit local overrides MUST replace whole named parameter values, validate the complete result and leave the declaration, inputs and earlier snapshots unchanged. There is no implicit environment lookup or deep merge.
- **FR-006**: Portable snapshots MUST carry a format version, complete portable definition, definition identity, effective values and snapshot identity. Identity MUST be deterministic, independent of object-key insertion order and sensitive to definition and value changes.
- **FR-007**: Snapshot restoration MUST check strict JSON and envelope structure, then content identities, then exact expected definition, then values before returning typed values. A structurally valid payload with valid identities but a different definition MUST report a definition mismatch even if that definition contains unsupported schemas. It MUST reject incompatible versions and mismatches without migration, defaults or fallback.
- **FR-008**: Zod-to-JSON-Schema authoring MUST preserve every supported validation check and reject unrepresentable declarations, including nested ones, without accepting conversion that silently drops checks.
- **FR-009**: JSON Schema consumers MUST NOT require Zod. All declaration, validation, override and snapshot operations MUST work locally without Cloud, providers or database access.
- **FR-010**: Values and definitions MUST survive lossless JSON round trips. Snapshots MUST resist later mutation. Invalid inputs MUST produce explicit error families and locations without including raw values in diagnostics.
- **FR-011**: The contract MUST remain optional application tooling. It MUST NOT execute policies, submit requests, grant Budget authority, change command replay, own application transactions or become a generic configuration service.
- **FR-012**: Provider-free acceptance MUST cover invalid values and declarations, typed access, explicit overrides, default non-application, Zod fidelity, schema mismatch, mutation isolation and snapshot reproducibility.

### Key Entities

- **Parameter declaration**: Named portable schemas and explicit provisioning values, with inferred application types.
- **Parameter definition**: Versioned portable schemas without provisioning values or evaluator code.
- **Parameter snapshot**: The definition and effective values selected by an application, with reproducible identities.
- **Local override**: Explicit replacements for a subset of declared names, applied to one snapshot.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every accepted declaration in the provider-free acceptance matrix produces fully validated values with the expected application types; every negative case fails explicitly.
- **SC-002**: Equivalent definition/value fixtures produce identical canonical bytes and identities in separate processes. Changed definitions or effective values change the appropriate identity, and all mismatch fixtures reject.
- **SC-003**: Raw JSON Schema workflows run with zero Cloud, provider or database calls and without Zod installed in the consumer environment.
- **SC-004**: Every accepted Zod fixture agrees with its portable schema on the positive and negative value corpus. Every unsupported declaration fixture rejects before a snapshot is returned.

## Assumptions

- TypeScript is the supported application language. JSON Schema and Zod are explicit issue requirements, not a new schema language or a new SDK commitment.
- KEY-113's boundary has landed in PR #63. This feature has one acceptance outcome and does not depend on KEY-117 shipping first.
- KEY-116 owns the source declaration/snapshot contract. KEY-117 owns its optional tooling distribution; KEY-118 consumes snapshots for fixtures and KEY-119 later owns Cloud persistence.
- Budget runtime behavior, database migration, recovery, model integration, editor UI and performance qualification are N/A because no such capability is changed or promised.
- Budget storage remains private ephemeral Node SQLite for Local and PostgreSQL for Hosted/Embedded. Snapshot validation touches neither. Application effects, evaluation and retries remain customer-owned; command replay never re-evaluates policy.
- Snapshots intentionally contain values. Applications must not commit secrets in fixtures or attach snapshots automatically to decision evidence. Digests identify content and provide no authentication or proof of policy execution.
