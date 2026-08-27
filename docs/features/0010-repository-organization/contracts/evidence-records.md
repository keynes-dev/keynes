# Evidence record contracts

## Schema identities

| Subject            | Schema                                   | Default location                      |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| SDK package        | `keynes.package-test.sdk/v1`             | `artifacts/package-tests/sdk/`        |
| SDK measurement    | `keynes.package-test.sdk-measurement/v1` | `artifacts/package-tests/sdk/`        |
| PostgreSQL package | `keynes.package-test.postgresql/v1`      | `artifacts/package-tests/postgresql/` |
| PostgreSQL system  | `keynes.system-test.postgresql/v1`       | `artifacts/system-tests/postgresql/`  |
| Cloud system       | `keynes.system-test.cloud/v1`            | `artifacts/system-tests/cloud/`       |

## Common requirements

- Identify the exact source revision and whether it was clean before and after the run.
- Identify every tested archive by SHA-256 and include the logical contract digest when relevant.
- Record exact Node.js, OS, architecture, PostgreSQL, SQLite, pnpm, and test-runner versions used by the subject.
- Record an exact required scenario inventory and outcome.
- Refuse to overwrite an existing record.
- Remove credentials and private database state before publication.
- List unavailable provider, managed, recovery, security, fault, performance, registry, adopter, and production evidence as `NOT RUN` where relevant.
- Never use one subject's record to qualify another subject or a different revision.

Existing records under `artifacts/local-preview`, `artifacts/platform`, and `artifacts/cloud` retain their original schemas, paths, and vocabulary.
