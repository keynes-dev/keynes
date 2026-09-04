# Data model: Define runtime and deployment model

This feature changes documentation, metadata, and the current local constructor call shape, not stored runtime data. These concepts define the relationships that the governing documents must describe consistently.

## Budget placement

| Field            | Meaning                                       | Rule                                                                        |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Budget identity  | Stable public identifier                      | Identifies one Budget, not a deployment choice or permission                |
| Runtime kind     | SQLite or PostgreSQL                          | SQLite is process-local; PostgreSQL is durable                              |
| Access path      | Local facade, embedded SQL, or remote SDK     | Constructor shape selects local or remote; embedded code calls SQL directly |
| Storage location | One in-memory database or PostgreSQL database | Exactly one location for the live Budget                                    |
| Lifecycle        | Active, settling, or settled                  | Uses the same accounting meaning in both implementations                    |
| Command history  | Recorded command inputs and results           | Supports exact replay and conflicting-reuse rejection                       |

## Deployment profile

| Profile             | Budget storage                                       | Caller boundary          | Operator         | Lifetime        |
| ------------------- | ---------------------------------------------------- | ------------------------ | ---------------- | --------------- |
| Local               | Private in-memory SQLite runtime                     | `Keynes.create()`        | Application team | Runtime/process |
| Embedded PostgreSQL | Application's PostgreSQL database                    | Supported `keynes.*` SQL | Application team | Durable         |
| Self-hosted Keynes  | Keynes-specific PostgreSQL behind the Keynes service | Remote SDK               | Customer         | Durable         |
| Keynes Cloud        | Keynes-specific PostgreSQL behind the Keynes service | Remote SDK               | Keynes           | Durable         |

An application using MySQL, MongoDB, or another database can use either remote profile. That choice does not change Keynes durable storage from PostgreSQL.

The future `Keynes.create({ apiKey })` overload selects remote discovery. The service resolves self-hosted versus Cloud metadata. An omitted API key inside a supplied configuration is invalid and does not select local SQLite.

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
