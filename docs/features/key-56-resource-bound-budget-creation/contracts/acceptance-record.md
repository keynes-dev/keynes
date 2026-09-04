# Acceptance evidence contract

The accepted record must identify the exact source revision, contract digest, migration-set digest, package archive digests, tool versions, host, and attempt or workflow URL for every retained result.

## Required lanes

| Lane                   | Required evidence                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Provider-free contract | Generated schema, types, validators, fixtures, and source agreement                                                    |
| Provider-free SDK      | Public type contract, local lifecycle, atomic root behavior, replay, rollback, Policy attachment, and package consumer |
| Shared behavior        | The same root-binding cases through local and native PostgreSQL hosts                                                  |
| Native PostgreSQL      | Clean install, exact recheck, permissions, transactions, contention, replay, rollback, and final state                 |
| PostgreSQL package     | One self-contained archive and its consumer result                                                                     |
| SDK package            | One self-contained archive and its consumer result                                                                     |
| Pull-request gate      | `CI=true pnpm test:pr` at the accepted revision                                                                        |

The record must not use a provider-free result as native PostgreSQL evidence or a local archive as hosted compatibility evidence.

## Required `NOT RUN` boundaries

Unless an explicit task runs a named lane, record remote database access, TLS, credentials, private administration, operation recovery, remote reopen, migration upgrade, downgrade, rolling deployment, uninstall, backup, restoration, failover, self-hosted operations, managed Cloud, hostile-role security, fault injection outside the local and native transaction fixtures, benchmarks, hosted compatibility, and production readiness as `NOT RUN`.
