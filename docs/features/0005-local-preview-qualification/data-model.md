# Data model: Local preview qualification

This model describes package and qualification records. It does not add a product entity or change database-owned Resource, Budget, command, settlement, or history data.

## SDK archive

One unpublished package candidate used by every check in an attempt.

| Field | Meaning |
| --- | --- |
| `path` | Explicit local path passed to the qualification command |
| `sha256` | SHA-256 of the exact compressed archive bytes |
| `packageName` | `@keynes/sdk` |
| `packageVersion` | Provisional package version from the archive manifest |
| `compressedBytes` | Exact archive byte length |
| `files` | Sorted archive-relative file list with byte sizes |
| `contractDigest` | Generated database contract identity shipped by the archive |
| `pgliteVersion` | Exact production dependency version |

The archive is immutable within one attempt. Repacking creates another archive identity even when the source commit is unchanged.

## Packaged database files

The archive preserves the canonical database layout used by the installer.

| Field | Meaning |
| --- | --- |
| `sourceRoot` | Canonical `packages/database/` directory |
| `packageRoot` | Copied `packages/sdk/dist/database/` directory |
| `files` | Ordered relative paths, byte sizes, and SHA-256 digests compared before packing |

Package validation rejects missing, additional, or changed copied files. Local startup retains the existing migration graph, digest, installation-record, and contract checks before executing SQL.

## Clean consumer

A temporary project outside the repository.

| Field | Meaning |
| --- | --- |
| `directory` | Fresh temporary directory for one installed archive |
| `archiveSha256` | Archive identity expected by the consumer |
| `nodeVersion` | Exact Node.js version running the fixture |
| `packageManagerVersion` | Exact pnpm version used for installation |
| `productionBytes` | Installed production dependency tree size |

The consumer imports only `@keynes/sdk`. It does not receive a workspace link, repository path, database path, fixture principal, or qualification control.

## Qualification environment

| Field | Meaning |
| --- | --- |
| `os` | Normalized operating system name |
| `release` | Operating system release reported by the runner |
| `architecture` | `x64` or `arm64` for the declared matrix |
| `nodeVersion` | Exact Node.js version |
| `runnerName` | Hosted runner image or explicit local identity |
| `commit` | Git commit under qualification |

Only Linux x64 with Node.js 24 is a performance reference. Other declared environments earn package and behavior support only.

## Measurement attempt

| Field | Meaning |
| --- | --- |
| `archive` | SDK archive identity and size |
| `environment` | Exact host and toolchain identity |
| `fixtures` | Stable operation names, Resource definitions, and amounts |
| `warmupCount` | Requests excluded before steady measurement |
| `samples` | Unchanged raw observations grouped by measurement |
| `observed` | Fixed count and nearest-rank p95 fields for each measured limit |
| `limits` | Checked-in ceilings applied to the observations |

### State transitions

```text
archive verified -> environment captured -> samples collected
        -> observations computed -> limits checked -> command succeeds or fails
```

Any digest mismatch, missing identity, invalid sample, insufficient sample count, or exceeded limit makes the command fail. A failed or partial attempt cannot support a roadmap claim.
