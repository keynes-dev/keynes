# Contract: FEAT-0012 acceptance record

Retain a FEAT-0012 acceptance record only when it describes one exact source revision and its exact generated or packed subjects. A record is evidence, not a release declaration or a substitute for missing lanes.

## Identity

```ts
interface PolicyAcceptanceRecord {
  readonly schema: "keynes.policy-acceptance/v1";
  readonly featureId: "FEAT-0012";
  readonly sourceRevision: string;
  readonly createdAt: string;
  readonly contractDigest: string;
  readonly policyProfileDigest: string;
  readonly localBackendDigest: string | "NOT RUN";
  readonly postgresqlBackendDigest: string | "NOT RUN";
  readonly kyselyVersion: "0.29.5";
  readonly parserVersion: "libpg-query@18.1.4";
  readonly decimalVersion: "10.6.0";
  readonly installationDigest: string | "NOT RUN";
  readonly sdkArchiveDigest: string | "NOT RUN";
  readonly lanes: PolicyAcceptanceLanes;
  readonly unsupported: Readonly<Record<UnsupportedLane, "NOT RUN">>;
}
```

`sourceRevision` is the complete 40-character Git revision with a clean worktree. Each digest names the subject exercised by its lane. The backend digests bind generated metadata and executable backend code, not only the shared profile. An older record is historical evidence for its recorded revision only.

## Required lanes

```ts
interface PolicyAcceptanceLanes {
  readonly providerFreeRepository: LaneResult;
  readonly localPolicyComparison: LaneResult;
  readonly noPolicyRegression: LaneResult;
  readonly nativePostgresql: LaneResult;
  readonly privateCloudRegression: LaneResult;
  readonly sdkPackage: LaneResult;
  readonly postgresqlPackage: LaneResult;
  readonly hostedSdkCompatibility: LaneResult;
  readonly sdkMeasurement: LaneResult;
}

interface LaneResult {
  readonly status: "passed" | "failed" | "NOT RUN";
  readonly commands: readonly string[];
  readonly subjectRevision: string;
  readonly artifactDigest?: string;
  readonly passed?: number;
  readonly failed?: number;
  readonly skipped?: number;
  readonly recordPath?: string;
  readonly runUrl?: string;
  readonly note?: string;
}
```

Do not infer one lane from another. In particular:

- `providerFreeRepository` records `check:repo`, `test:unit`, and `test:pr` separately in `commands`;
- `localPolicyComparison` records public API type fixtures, Kysely/raw, parser, decimal, generated semantic-vector, property-conformance, and TypeScript backend outcomes;
- `noPolicyRegression` records the unchanged complete Budget corpus;
- `nativePostgresql` names PostgreSQL 18.6, the packed installer subject, exact four-migration identity, generated semantic-vector and property-conformance outcomes, and Policy comparison counts;
- `privateCloudRegression` records Policy-field rejection and the no-Policy native scenarios without claiming remote Policy support;
- package lanes name the exact extracted archive and real executable/import path;
- hosted compatibility names the one SDK archive reused across all six Node.js 24/26 operating-system consumers; and
- measurement retains raw samples and the existing size, RSS, initialization, request, and shutdown method.

A failed or unavailable lane remains `failed` or `NOT RUN`; it is not omitted. A current record cannot reuse a pass from another source revision or an archive built before a compatibility repair.

## Unsupported lanes

The record includes at least these explicit fields:

```ts
type UnsupportedLane =
  | "publicIngress"
  | "externalIdentity"
  | "remotePolicy"
  | "selfHostedOperations"
  | "managedCloud"
  | "otherPostgresqlVersions"
  | "managedProviders"
  | "hostileRoleSecurityQualification"
  | "recovery"
  | "backupRestore"
  | "failover"
  | "upgradeDowngrade"
  | "rollingDeployment"
  | "paidInfrastructure"
  | "registryPublication"
  | "adopterUse"
  | "productionReadiness";
```

Other unavailable benchmark, live, fault, or compatibility claims are added rather than hidden in prose.

## Content restrictions

The record must not contain:

- Policy context values or application facts;
- Policy source beyond stable fixture names;
- credentials, connection strings, role secrets, tokens, or environment dumps;
- private database rows, SQL errors, stack traces, or temporary filesystem paths; or
- an approval, release, or production-support claim not proved by a named lane.

Fixture identifiers, Policy digests, stable error categories, counts, revisions, package digests, migration identities, PostgreSQL version, Node.js version, operating-system identity, and sanitized measurements are allowed.
