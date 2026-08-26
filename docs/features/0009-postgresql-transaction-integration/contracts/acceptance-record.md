# PostgreSQL acceptance record

`pnpm test:platform -- --output <path>` may write one non-overwriting JSON record for an exact provider-free native pass. The record wraps Vitest's JSON report with the provenance that Vitest does not know. A passing record is required for FEAT-0009 acceptance but does not replace `pnpm test:pr`.

## Write rules

- The runner refuses an existing output path.
- It requires a clean worktree before the native run starts.
- It writes the record only after every required test and cleanup pass.
- Record-write or cleanup failure makes the attempt fail.
- Missing, failed, renamed, or skipped required scenarios make the attempt fail and produce no record.
- A failed attempt retains workflow logs, not acceptance evidence.

## Schema

```ts
interface PostgreSqlAcceptanceRecord {
  readonly schemaVersion: "keynes.postgresql-acceptance/v1";
  readonly revision: {
    readonly commit: string;
  };
  readonly distribution: {
    readonly package: "@keynes/postgresql";
    readonly version: string;
    readonly archiveSha256: string;
    readonly installationRecordSha256: string;
  };
  readonly profile: {
    readonly postgresImage: string;
    readonly postgresServerVersionNum: "180006";
    readonly profileId: "embedded-postgresql-18.6-preview";
    readonly contractDigest: string;
    readonly migrations: readonly MigrationIdentity[];
  };
  readonly roles: RoleEvidence;
  readonly tests: VitestJsonReport;
  readonly exclusions: Record<ExcludedLane, "NOT RUN">;
}
```

`MigrationIdentity` contains only ID, relative path, checksum, and optional contract digest. `RoleEvidence` records the owner and application role names, the required owner privileges, the five application grants, and the private-access denials. It contains no role passwords or private ACL rows.

`VitestJsonReport` is the JSON emitted by Vitest's built-in JSON reporter for the passing native run. The runner does not define another scenario result format. Test names are the scenario identifiers, and Vitest supplies suite and test totals plus each test status.

The runner writes only a passing report, so retained Vitest output contains no failure messages or stack traces. Test titles and file paths must not contain credentials, tenant IDs, principal IDs, command bodies, application payloads, SQL text, or private authority data.

## Required scenario inventory

The fixed inventory must cover:

- archive completeness and SDK archive separation;
- fresh install and exact read-only recheck;
- unsupported-version injection and insufficient privilege;
- incompatible targets caused by partial state, migration-byte drift, contract mismatch, unexpected or missing objects, owner drift, function drift, bootstrap mismatch, and ACL drift;
- complete-install rollback after representative failures before and after migration execution;
- all five public functions through the application role;
- logical permission denial and private, unsupported, and `PUBLIC` access denial;
- request plus outbox commit, explicit rollback, application-write failure, denial, and invalid request;
- pending-state invisibility before commit and absence after rollback;
- exact replay after commit and conflicting command reuse;
- sibling overcommit, settlement-before-request, request-before-settlement, and concurrent exact replay with observed blocking; and
- the complete SQLite/PostgreSQL lifecycle, denial, settlement, replay, conflict, malformed-input, rollback, history, and serialized sibling comparison corpus.

## Exclusions

The record must include these `NOT RUN` lanes:

```ts
type ExcludedLane =
  | "otherPostgresqlVersions"
  | "managedProvider"
  | "upgradeDowngrade"
  | "rollingDeployment"
  | "extensionPackaging"
  | "backupRecovery"
  | "failover"
  | "securityQualification"
  | "faultCampaign"
  | "benchmark"
  | "selfHosted"
  | "managedCloud"
  | "productionReadiness";
```

Role conformance tests are provider-free least-privilege evidence. They are not a hostile-role campaign or security qualification. The outbox scenarios prove database atomicity and visibility; they do not execute an external effect.

## Prohibited content

The record must not contain passwords, database URLs, bearer tokens, token digests, environment dumps, role-password hashes, raw command bodies, application payloads, SQL text, private authority rows, stack traces, or raw driver errors.
