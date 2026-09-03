# Data model: Remote PostgreSQL SDK

This document maps each contract entity to its owner. The linked contracts define fields, validation, and exposure.

| Entity                     | Contract owner                                                                                       | Authority and lifetime                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Remote configuration       | [TypeScript SDK](contracts/typescript-sdk.md) and [identity and TLS](contracts/identity-and-tls.md)  | SDK-only secret input; discarded when the client closes                     |
| Connection profile         | [Identity and TLS](contracts/identity-and-tls.md)                                                    | SDK pool configuration; not Budget state or semantic identity               |
| Authenticated role mapping | [Identity and TLS](contracts/identity-and-tls.md)                                                    | Private PostgreSQL administrative state                                     |
| Procedure capability set   | [PostgreSQL procedures](contracts/postgresql-procedures.md)                                          | Installed PostgreSQL compatibility facts                                    |
| Operation key              | [Remote operation](contracts/remote-operation.md)                                                    | Public command recovery value backed by PostgreSQL retention                |
| Budget reference           | [Remote operation](contracts/remote-operation.md)                                                    | Remote-only durable lookup value for one authorized Budget                  |
| Resource binding           | [FEAT-0014](../0014-resource-bound-budget/spec.md) and [TypeScript SDK](contracts/typescript-sdk.md) | Bound atomically to a root Budget and checked during reopen                 |
| Recovery result            | [Remote operation](contracts/remote-operation.md)                                                    | Read-only view of a PostgreSQL-owned operation record                       |
| History page               | [PostgreSQL procedures](contracts/postgresql-procedures.md)                                          | Bounded internal read; projected into the existing public inspection result |
| Public remote error        | [TypeScript SDK](contracts/typescript-sdk.md)                                                        | Detached safe value with no credential or private database detail           |

## Credential lifecycle

```text
issued -> enabled -> rotating -> revoked
                 `-> disabled -> enabled
```

Private admin procedures own the transition. Rotation creates a new mapping and disables the old mapping atomically. A call that completed identity checking before the transaction commits may finish. Every later call fails on the disabled mapping, including calls using an existing pooled session.

## Remote operation lifecycle

```text
admitted -> pending -> committed
                   `-> known failure
         `-> unresolved -> committed | known failure | expired
```

PostgreSQL owns the operation record and canonical result. The SDK creates or accepts the public operation key before dispatch, then only reuses or observes it.

## Client lifecycle

```text
opening -> ready -> closing -> closed
        `-> failed
```

Closing rejects new calls. Admitted calls drain for at most 10 seconds. An unfinished mutation returns an uncertain outcome with its unchanged operation key.
