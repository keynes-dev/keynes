# Feature Specification: Separate SDK and database runtime packages

**Feature Branch**: `key-96-separate-sdk-and-database-runtime-packages`

**Created**: 2026-09-20

**Document state**: Proposed. Implementation and qualification are NOT RUN.

**Issue**: [KEY-96](https://linear.app/keynes/issue/KEY-96/separate-sdk-and-database-runtime-packages)

**Input**: Applications install a thin TypeScript SDK and one explicit database adapter. One private database source owner supplies canonical contracts and separate SQLite/PostgreSQL accounting implementations. A separate developer CLI owns installation interaction.

## User Scenarios & Testing

### User Story 1 - Install only the selected runtime (Priority: P1)

A developer installs the SDK with the Node SQLite adapter and creates private in-memory Budgets. Consumers who need only SDK types or PostgreSQL do not acquire SQLite execution code.

**Why this priority**: Explicit dependencies make the package boundary useful to every consumer.

**Independent Test**: Install packed SDK alone and SDK/SQLite in separate empty projects outside the workspace. Import and typecheck them, create a root, request a child, settle and close. Inspect dependencies and loaded modules.

**Acceptance Scenarios**:

1. **Given** an SDK-only install, **When** public exports are imported, **Then** no database driver, engine, CLI, Policy compiler or model-provider dependency is installed or imported.
2. **Given** SDK/SQLite archives, **When** the application calls `createKeynes({ resources, runtime: nodeSqlite() })`, **Then** it receives a private ephemeral instance with inferred Resource names and existing Budget behavior, without PostgreSQL or PGlite dependencies.
3. **Given** absent, invalid or failed runtime selection, **When** initialization runs, **Then** it rejects without fallback or leaked owned resources.
4. **Given** two Local instances and work admitted before close, **When** one closes, **Then** admitted work drains, later calls reject with `runtime_closed`, repeated close is safe and the other instance remains independent.

### User Story 2 - Enforce requests in the database runtime (Priority: P1)

An application supplies amounts and optional decision evidence. Both runtimes enforce the same command meaning even when callers bypass SDK types.

**Why this priority**: A smaller SDK must not weaken validation, replay or conservation.

**Independent Test**: Run shared scenarios against SQLite and native PostgreSQL, plus invalid commands sent directly to each runtime. Retain SDK malformed-response and inference checks.

**Acceptance Scenarios**:

1. **Given** root creation, child requests, usage and settlement, **When** both runtimes execute shared scenarios, **Then** results, errors, replay, history and final state agree with the existing contract.
2. **Given** invalid quantities, definitions, empty envelopes or decision evidence, **When** commands reach either runtime without SDK semantic validation, **Then** they reject without partial state changes.
3. **Given** an unknown Resource alias, **When** a public method encodes input, **Then** its existing operation-specific unknown-key error remains. No key is silently dropped or assigned a fabricated database identity.
4. **Given** a malformed response or mismatched Resource identity, **When** the SDK maps it, **Then** it rejects instead of constructing an unsound typed handle.
5. **Given** exact replay or conflicting operation-key reuse, **When** the caller retries, **Then** stored outcomes and conflict errors remain unchanged, without rerunning customer policy or external work.

### User Story 3 - Retain PostgreSQL transaction ownership (Priority: P1)

A developer selects PostgreSQL through an owned pool or an existing application connection. Application work and Budget changes can commit or roll back together.

**Why this priority**: The server package must preserve caller-owned transactions.

**Independent Test**: Install SDK/PostgreSQL archives in a clean consumer. In native PostgreSQL, combine an application outbox write and Budget mutation on a borrowed connection; prove both commit and both roll back.

**Acceptance Scenarios**:

1. **Given** SDK/PostgreSQL archives, **When** an owned remote runtime initializes, **Then** existing authentication, compatibility checks, references, recovery and strict TLS behavior remain available without SQLite or CLI code.
2. **Given** a supplied connection, **When** Keynes initializes, executes and closes its handle, **Then** every query uses that connection. Keynes never begins/manages an application transaction, commits, rolls back, closes, releases or replaces the connection, or retries a transaction fragment.
3. **Given** application and Budget writes inside a caller transaction, **When** the caller commits or rolls back, **Then** both become visible or neither remains. Returned results remain provisional until commit.
4. **Given** connection, permission or compatibility failure, **When** an operation rejects, **Then** errors remain sanitized, no Local fallback occurs and caller-owned resources stay with the caller.

### User Story 4 - Install through the developer CLI (Priority: P2)

An operator explicitly installs the CLI to provision PostgreSQL. Library consumers use the same installation API without acquiring the CLI.

**Why this priority**: Installation interaction needs its own archive and failure contract.

**Independent Test**: Install CLI and declared dependencies from exact archives outside the workspace. Exercise fresh installation, exact recheck, mismatch refusal and sanitized failures against disposable native PostgreSQL.

**Acceptance Scenarios**:

1. **Given** `@keynes/cli`, **When** the operator runs `keynes install --config <path>`, **Then** it delegates to PostgreSQL installation APIs with the existing config, environment credential handling and machine-readable results.
2. **Given** an exact installed target, **When** installation is repeated, **Then** it reports `already-installed` without definition/accounting writes. Partial, drifted or mismatched targets fail closed.
3. **Given** invalid arguments/config, connection or installation failure, **When** the CLI exits, **Then** it exits nonzero with no credentials or raw database errors in either output stream.
4. **Given** the migration guide, **When** a consumer replaces imports, constructor and `keynes-postgresql`, **Then** examples work without compatibility shims, registry publication or database upgrades.

### Edge Cases

- Zero membership, all-zero roots, omitted keys, missing usage and child subsets retain their meanings.
- Encoding must not silently turn non-finite numbers, undefined values, symbol keys or accessors into valid command values. Nonrepresentable inputs fail explicitly.
- Alias translation is mechanical; canonical identity, definition compatibility, quantity limits and lifecycle decisions remain runtime-owned.
- Close races, initialization failure and lost responses preserve ownership. Borrowed commands are never automatically retried.
- Public declarations cannot reference private workspaces. Generated outputs cannot embed another engine, CLI or a private package manifest.
- Borrowed connections retain existing database grants and security context; a supplied connection does not confer permission.

## Requirements

### Functional Requirements

- **FR-001**: Deliver separately installable `@keynes/sdk`, `@keynes/node-sqlite`, `@keynes/postgres` and `@keynes/cli` archives. SDK-only, SDK/SQLite, SDK/PostgreSQL and CLI clean consumers MUST resolve declarations and execute documented entrypoints without private workspace dependencies.
- **FR-002**: Move existing canonical Budget/Resource definitions and command contracts into one private database source owner. It MUST own separate engine-specific accounting sources and generate public bindings. No competing authored contract, shared accounting-engine rewrite or mandatory public contracts package is allowed.
- **FR-003**: SDK responsibilities MUST be limited to typed handles, inference, invocation, mechanical request encoding, result mapping and public errors. It MUST contain no accounting code, semantic request validators, Policy compiler, database driver or provider integration.
- **FR-004**: `createKeynes({ resources, runtime })` MUST require explicit selection through the exact factories in the public construction contract. Missing/conflicting selection MUST reject without fallback.
- **FR-005**: SQLite MUST own private in-memory Node initialization, atomic execution, admission and close/drain. It MUST expose no database handle, persistence option, public migration API, browser support or PostgreSQL dependency.
- **FR-006**: PostgreSQL MUST own connection integration, procedure invocation and reusable installation APIs. It MUST preserve supported SQL access and existing owned remote connection/security behavior, excluding SQLite/PGlite implementations.
- **FR-007**: Runtime implementations MUST enforce semantic validation directly: definitions, names, membership, quantities, decision evidence, permissions and lifecycle. Generated SDK request validators MUST NOT retain these rules.
- **FR-008**: SDK encoding MUST preserve operation-specific unknown-key errors, lossless supported values and database-owned identities. Result checks and type inference MUST remain sound, including exact child subsets and deployment-specific capabilities.
- **FR-009**: Both runtimes MUST pass shared scenarios without changing funding, conservation, settlement, decision-evidence meaning, replay or error families. Calls remain atomic; invalid commands leave no partial state.
- **FR-010**: Borrowed connections MUST be used as supplied. Keynes MUST NOT manage application transactions, commit, roll back, release, close, replace or retry them. Results are provisional until commit; real commit/rollback evidence is required.
- **FR-011**: Initialization and close MUST release only owned resources, drain admitted work and reject later calls. Failures MUST remain sanitized without selecting another authority.
- **FR-012**: `apps/cli`, distributed as `@keynes/cli`, MUST expose `keynes install --config <path>` using `@keynes/postgres/install`. Preserve installation, exact recheck, mismatch refusal, config validation, nonzero failures and credential-safe diagnostics. Runtime packages MUST NOT depend on CLI.
- **FR-013**: Relocated modules MUST use functional names: `adapter.ts`, `cli.ts`, `result-mapping.ts`, explicit request validation/serialization modules. Installation code MUST be separate from CLI interaction.
- **FR-014**: Active product, architecture, package ownership and migration docs MUST match final imports and constructor. Preserve historical evidence and KEY-114's separate Policy retirement migration.
- **FR-015**: Acceptance MUST retain source revision, archive hashes, contract identities, dependency/tool versions, host, commands and outcomes. Preserve required CI checks and separate native/package qualification. Unexecuted lanes MUST remain `NOT RUN`.

### Public construction contract

[Package API contract](contracts/package-api.md) is normative and defines exact signatures and capability mapping. Factories return cold descriptors; `createKeynes` initializes asynchronously. Reusing a descriptor creates separate handles, not shared Local state.

```typescript
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";
import { postgres } from "@keynes/postgres";

const local = await createKeynes({ resources, runtime: nodeSqlite() });
const remote = await createKeynes({
  resources,
  runtime: postgres({ databaseUrl }),
});
const embedded = await createKeynes({
  resources,
  runtime: postgres({ connection }),
});
```

Remove implicit Local `{ resources }` and SDK `{ resources, databaseUrl }` constructors. Preserve existing Budget methods and remote `openBudget`; the separately planned `loadBudget` change is not included.

### Key Entities

- Resource declaration/binding: application alias linked to a runtime-validated immutable Resource identity.
- Budget: existing funded tree node, memberships, quantities, lifecycle and history in one database.
- Command/result: canonical input, operation identity and runtime-owned validation/replay outcome.
- Runtime descriptor/session: explicit engine/capability selection and owned or borrowed lifecycle.
- Installation configuration/receipt: existing profile, version, identity and asset checks.
- Archive evidence: exact bytes and clean-consumer observations qualifying them.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four clean-consumer combinations install, import and resolve types with zero forbidden runtime, tooling or private-workspace dependencies.
- **SC-002**: Every applicable existing shared scenario passes on both engines with matching outcomes; direct invalid-input cases prove runtime enforcement.
- **SC-003**: Commit and rollback demonstrations each preserve atomic application/Budget outcomes with zero adapter transaction-control, connection-release or retry actions on borrowed connections.
- **SC-004**: Fresh CLI install, exact recheck and each documented refusal/failure pass from exact archives with zero credential disclosures.
- **SC-005**: Every acceptance claim identifies its revision and relevant archives; every unexecuted qualification/deployment lane is explicitly `NOT RUN`.

## Assumptions

- Baseline `74fce43` includes KEY-114. KEY-113 and KEY-121 are ancestors. Their evidence does not qualify this split. Canceled KEY-109 is not a prerequisite.
- One issue and normally one independently accepted PR cover all stories; phases are internal increments, not separate feature acceptance or Linear issues.
- Application effects/customer policy execution are N/A to implementation because applications retain them. Their replay/evidence boundaries remain constraints. No KEY-117 toolkit or model-provider dependencies are added.
- No accounting redesign, database upgrade, compiler rewrite, browser/persistent Local, generic adapter framework, npm publication, Hosted readiness or full Embedded recovery claim. KEY-88, KEY-6, KEY-10, KEY-11 and KEY-97 retain downstream acceptance; KEY-108 owns catalog workflows; KEY-123/124 own durability/delegation.
- Performance targets are N/A because relocation promises no speed/memory improvement. Existing measurement tooling must identify both installed SDK and selected runtime archives.
