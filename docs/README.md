# Documentation

- **Owner:** `@shubsharan`

## Find the owner

Each current topic has one normative owner. Other pages link to that owner
instead of restating its rules.

| Topic                                                  | Owner                                                    |
| ------------------------------------------------------ | -------------------------------------------------------- |
| Product thesis, outcomes and commitments               | [Product](product.md)                                    |
| Components, authority and trust boundaries             | [Architecture](architecture.md)                          |
| Resource, Budget, quantity and settlement behavior     | [Accounting reference](reference/accounting.md)          |
| Commands, validation, atomicity, replay and inspection | [Command reference](reference/commands.md)               |
| TypeScript SDK API and adapter bindings                | [SDK package](../packages/sdk/README.md)                 |
| Ephemeral Local runtime                                | [Node SQLite package](../packages/node-sqlite/README.md) |
| PostgreSQL installation and runtime                    | [PostgreSQL package](../packages/postgres/README.md)     |
| Optional customer-owned Policy tools                   | [Policy package](../packages/policy/README.md)           |
| Developer CLI                                          | [CLI app](../apps/cli/README.md)                         |
| Repository verification                                | [Testing](testing.md)                                    |
| Contribution and documentation cleanup                 | [Workflow](workflow.md)                                  |
| Release procedure and retained release evidence        | [Releases](releases/README.md)                           |
| Accepted cross-package decisions                       | [Architectural decisions](adr/)                          |
| Internal contract generation and shared scenarios      | [Database package](../packages/database/README.md)       |
| Internal package qualification utilities               | [Testkit package](../packages/testkit/README.md)         |

## Repository records

Current references and package guides own implemented behavior and supported
procedures. `docs/adr/` records lasting architectural decisions. GitHub issues
and pull requests own proposals, exploratory discussion, review and ordinary
verification results.

Temporary plans, including optional Spec Kit work under `docs/features/`, may
exist locally or on a feature branch. Promote useful conclusions into current
documentation and remove temporary files before merge. Existing historical
records remain context for their recorded revisions, not current reference. See
the [pre-merge checklist](workflow.md#before-merge).

Do not copy mutable GitHub status into repository documents. Documentation must
distinguish implemented behavior from proposals; describing a target does not
make it available.

## Evidence

Report checks honestly, including failures and `NOT RUN` lanes, with the tested
revision and relevant environment. Local archives, measurements and test records
are transient output under the ignored `.artifacts/` tree. Ordinary test and
review results belong in the PR or CI.

Release qualification that must outlive CI retains actual reports, exact source
revisions and archive digests under `docs/releases/` according to the
[release procedure](releases/README.md). Temporary feature plans need no
separate archive, evidence commit or special merge method.
