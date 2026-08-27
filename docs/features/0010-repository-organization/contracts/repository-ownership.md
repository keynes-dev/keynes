# Repository ownership contract

## Canonical owners

| Path                       | Responsibility                                                                                      | Workspace |
| -------------------------- | --------------------------------------------------------------------------------------------------- | --------- |
| `contracts`                | Canonical contract sources, fixtures, and contract digest                                           | No        |
| `packages/sdk`             | Public TypeScript SDK and private SQLite runtime                                                    | Yes       |
| `packages/postgresql`      | PostgreSQL migrations and installer command                                                         | Yes       |
| `services/cloud`           | Private Keynes Cloud service                                                                        | Yes       |
| `tooling/contracts`        | Contract generation and drift tests                                                                 | No        |
| `tooling/repository`       | Feature identity and repository structural checks                                                   | No        |
| `package-tests/sdk`        | Packed SDK installation, compatibility, and measurement                                             | No        |
| `package-tests/postgresql` | Packed PostgreSQL command behavior                                                                  | No        |
| `system-tests/support`     | Host-neutral behavior definitions, packed artifact support, Docker, cleanup, and record publication | No        |
| `system-tests/postgresql`  | PostgreSQL parity, installation, transaction, rollback, and contention                              | No        |
| `system-tests/cloud`       | Cloud authentication, isolation, restart, recovery, and database behavior                           | No        |
| `artifacts/package-tests`  | New package-test records                                                                            | No        |
| `artifacts/system-tests`   | New system-test records                                                                             | No        |

## Dependency rules

- Production SDK imports Node built-ins and SDK-owned source only.
- Production PostgreSQL imports `pg` and PostgreSQL-owned source only.
- Production Cloud imports `pg` and Cloud-owned source only.
- No production Keynes package imports another Keynes package, root tooling, tests, or artifacts.
- Generated output is written into an owner but does not create a runtime dependency on tooling.
- Package tests consume archives and generic root test support, not private product source.
- System tests may use explicitly enumerated product test seams and generic root support. They must not expose those seams through a product package.
- Historical feature docs, research, ADR bodies, and retained artifacts are excluded from active path and vocabulary enforcement.
