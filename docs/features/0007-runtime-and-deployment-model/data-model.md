# Data model: Runtime and deployment model

This feature changes documentation and metadata, not stored runtime data. These concepts define the relationships that the governing documents must describe consistently.

## Budget placement

| Field            | Meaning                                       | Rule                                                                                    |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Budget identity  | Stable public identifier                      | Identifies one Budget, not a deployment choice or permission                            |
| Runtime kind     | Local or PostgreSQL                           | Selected explicitly when the client is created or a supported integration is configured |
| Storage location | One process ledger or one PostgreSQL database | Exactly one location for the live Budget                                                |
| Lifecycle        | Active, settling, or settled                  | Uses the same accounting meaning in both implementations                                |
| Command history  | Recorded command inputs and results           | Supports exact replay and conflicting-reuse rejection                                   |

## Deployment profile

| Profile             | Budget storage                                       | Caller boundary                | Operator         | Lifetime              |
| ------------------- | ---------------------------------------------------- | ------------------------------ | ---------------- | --------------------- |
| Local               | Private in-memory ledger                             | In-process SDK                 | Application team | Ends with the process |
| Embedded PostgreSQL | Application's PostgreSQL database                    | SDK or supported SQL interface | Application team | Durable               |
| Self-hosted Keynes  | Keynes-specific PostgreSQL behind the Keynes service | Remote SDK                     | Customer         | Durable               |
| Keynes Cloud        | Keynes-specific PostgreSQL behind the Keynes service | Remote SDK                     | Keynes           | Durable               |

An application using MySQL, MongoDB, or another database can use either remote profile. That choice does not change Keynes durable storage from PostgreSQL.

## Policy record

| Field                 | Meaning                                      | Rule                                                                          |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Source                | Restricted PostgreSQL-style query            | Produced by the builder or supplied directly within the same supported subset |
| Resource declarations | Resources the query can inspect or constrain | Validated before activation                                                   |
| Context schema        | Fixed fields supplied by the application     | Exact fields and scalar types; no secrets                                     |
| Revision and digest   | Immutable Policy version identity            | Revalidation is required when relevant inputs change                          |
| Recorded context      | Exact facts used for one decision            | Reused by replay; application tables are not queried again                    |

## Evidence claim

| Field       | Meaning                                                                |
| ----------- | ---------------------------------------------------------------------- |
| Revision    | Exact source revision tested                                           |
| Artifact    | Retained output or named repository check                              |
| Environment | Runtime, database, operating system, and package context when relevant |
| Result      | Passed, failed, skipped, or `NOT RUN`                                  |
| Scope       | The deployment and behavior the evidence actually exercised            |

No evidence claim transfers automatically from one deployment profile to another.
