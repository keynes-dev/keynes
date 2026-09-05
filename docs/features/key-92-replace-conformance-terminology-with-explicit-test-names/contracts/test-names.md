# Test naming contract

| Existing name                           | New name                                    |
| --------------------------------------- | ------------------------------------------- |
| Root test:conformance                   | test:sqlite-postgres                        |
| scripts/run-conformance.ts and .test.ts | scripts/run-sqlite-postgres.ts and .test.ts |
| CI job conformance                      | sqlite-postgres                             |
| SQLite and PostgreSQL conformance       | SQLite and PostgreSQL behavior tests        |
| packages/contracts/conformance          | packages/contracts/contract-tests           |
| @keynes/contracts/conformance           | @keynes/contracts/contract-tests            |
| packages/sdk/test/conformance           | packages/sdk/test/contract                  |
| SDK test:conformance                    | test:contract                               |
| conformance-client.test.ts              | contract-client.test.ts                     |
| Contracts policy-conformance.test.ts    | policy-cases.test.ts                        |
| SDK source-conformance.test.ts          | source-behavior.test.ts                     |
| PostgreSQL policy-conformance.test.ts   | policy-runtime.test.ts                      |
| runConformance                          | runSqlitePostgresTests                      |
| qualifyConformance                      | verifySqlitePostgresResults                 |
| validateConformanceReport               | validateTestReport                          |
| ConformanceSnapshot                     | SqlitePostgresSnapshot                      |
| PolicyConformanceCase / Category        | PolicyTestCase / PolicyTestCategory         |
| PolicySourceConformanceInput            | PolicySourceTestInput                       |
| PolicyRuntimeConformanceCase            | PolicyRuntimeTestCase                       |
| POLICY_CONFORMANCE_CASES                | POLICY_TEST_CASES                           |
| POLICY_RUNTIME_CONFORMANCE_CASES        | POLICY_RUNTIME_TEST_CASES                   |
| application-role conformance            | application-role permissions                |
| keynes.conformance/v1                   | keynes.sqlite-postgres/v1                   |

All listed old names are historical mapping entries, not supported aliases. Output directories and CI artifact prefixes use sqlite-postgres. Existing evidence filenames within each attempt remain unchanged. Validation accepts only the new schema. Required native scenario names track changed test descriptions exactly.
