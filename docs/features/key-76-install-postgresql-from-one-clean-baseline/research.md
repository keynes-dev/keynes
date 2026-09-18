# Research: Install PostgreSQL from one clean baseline

## Decision 1: Ship one final-state SQL file

**Decision**: Replace all migration assets with `migrations/0001-baseline.sql`. Author it from the final installed schema so it contains direct final definitions rather than the old sequence of alterations, backfills, renames, and replacements.

**Rationale**: KEY-76 is a greenfield reset. Development databases are recreated and no upgrade promise exists. One final-state file matches the architecture and gives KEY-109 one canonical PostgreSQL installation subject.

**Alternatives considered**:

- Concatenate the eight migrations. Rejected because it would package the historical graph inside one file and retain backfills and replacements that an empty database does not need.
- Keep the old graph and add a ninth squashing marker. Rejected because fresh installation would still execute history and imply migration compatibility.
- Add a schema DSL or a new migration dependency. Rejected because the existing SQL, installer, and generator already cover the requirement.

## Decision 2: Keep the baseline as committed source

**Decision**: Use the current installed schema as a one-time authoring aid, then commit and review the portable baseline as source. Routine `generate` and `generate:check` read it and calculate identity without starting PostgreSQL.

**Rationale**: Provider-free generation is part of the current PR gate. Requiring Docker or `pg_dump` to regenerate ordinary outputs would slow and destabilize every change. The package already treats migration SQL as reviewed source with generated checksum metadata.

**Alternatives considered**:

- Generate the baseline from a live database on every build. Rejected because output would depend on PostgreSQL tooling and environment normalization.
- Retain every old migration as an unshipped source fragment. Rejected unless a live dependency remains. Dead history belongs in Git, not the working tree.
- Split the baseline into a new custom fragment system. Rejected because one file is manageable and no second consumer requires fragments.

## Decision 3: Record one contract-bearing migration

**Decision**: The manifest and installation record contain one entry named `0001-baseline`, and that entry carries the current contract digest.

**Rationale**: Exact reinstall needs one unambiguous byte identity. Historical intermediate contract digests have no meaning for a target that cannot be upgraded.

**Alternatives considered**:

- Keep historical ledger rows in generated identity. Rejected because they would make the new target look compatible with the deleted graph.
- Store no migration ledger. Rejected because the existing exact-recheck and drift diagnostics use it to bind bytes to the installed contract.

## Decision 4: Historical targets are incompatible

**Decision**: A target containing the previous multi-row ledger, one Keynes schema, unexpected objects, or a mismatched profile fails through the existing `incompatible_target` error family before installation changes commit.

**Rationale**: Upgrade and data preservation are explicitly excluded. One fail-closed path is smaller and safer than version dispatch or compatibility views.

**Alternatives considered**:

- Drop and recreate automatically. Rejected because an installer must not destroy a database that may contain data.
- Rewrite the old ledger when objects appear current. Rejected because object equivalence and data safety are not an upgrade contract.
- Add a `--force` option. Rejected because the issue authorizes development database recreation by the operator, not destructive installer behavior.

## Decision 5: Preserve both installation profiles and all current behavior

**Decision**: Keep the current embedded and remote profile configuration after baseline application, and qualify shared behavior plus native permissions, contention, rollback, recovery, and caller-owned transactions.

**Rationale**: Migration flattening changes installation representation only. Profile access boundaries and Budget semantics remain current behavior.

**Alternatives considered**:

- Qualify only installation smoke tests. Rejected because a structurally valid dump can still change function security, search paths, grants, or command behavior.
- Claim PGlite compatibility from the SQL shape. Rejected because KEY-109 owns actual PGlite execution and operating-envelope evidence.

## Decision 6: Preserve evidence boundaries

**Decision**: Retain provider-free, native source, paired, and exact-archive results for the candidate. Mark registry publication, PGlite, managed providers, upgrades, downgrades, backup, failover, security qualification, performance qualification, and production readiness as excluded or `NOT RUN`.

**Rationale**: The exact package and native database prove this feature. They do not prove later delivery targets or operations work.

**Alternatives considered**:

- Reuse older multi-migration qualification. Rejected because it covers different bytes and a different installation identity.
- Treat source tests as package qualification. Rejected because clean consumers must receive and install the exact archive.
