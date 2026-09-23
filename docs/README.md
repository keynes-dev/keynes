# Documentation

- **Owner:** `@shubsharan`

## Find the owner

Each current topic has one normative owner. Other pages link to that owner instead of restating its rules.

| Topic                                                  | Owner                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| Product thesis, outcomes and commitments               | [Product](product.md)                                                |
| Components, authority and trust boundaries             | [Architecture](architecture.md)                                      |
| Resource, Budget, quantity and settlement behavior     | [Accounting reference](reference/accounting.md)                      |
| Commands, validation, atomicity, replay and inspection | [Command reference](reference/commands.md)                           |
| TypeScript SDK API and adapter bindings                | [SDK package](../packages/sdk/README.md)                             |
| Ephemeral Local runtime                                | [Node SQLite package](../packages/node-sqlite/README.md)             |
| PostgreSQL installation and runtime                    | [PostgreSQL package](../packages/postgres/README.md)                 |
| Optional customer-owned Policy tools                   | [Policy package](../packages/policy/README.md)                       |
| Developer CLI                                          | [CLI app](../apps/cli/README.md)                                     |
| Repository verification                                | `docs/testing.md` (added by this migration)                          |
| Contributor delivery and Spec Kit retention            | [Workflow](workflow.md)                                              |
| Release procedure and retained release evidence        | `docs/releases/README.md` (added by this migration)                  |
| Accepted cross-package decisions                       | Existing records in `docs/adr/`; an index is added by this migration |
| Internal contract generation and shared scenarios      | [Database package](../packages/database/README.md)                   |
| Internal package qualification utilities               | [Testkit package](../packages/testkit/README.md)                     |

## Repository records

Each record has a narrow purpose:

| Source                                | Owns                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Current references and package guides | Implemented behavior, public and internal contracts, rationale and supported procedures                                     |
| `docs/adr/`                           | Accepted architectural decisions and their supersession chain                                                               |
| `docs/features/`                      | Branch-scoped Spec Kit work and exact-revision evidence retained only until its permanent owners and history are sufficient |
| GitHub issues and pull requests       | Current discussion, review, CI, and merge status                                                                            |

Do not copy mutable GitHub fields into repository documents. A feature may start from one GitHub issue, but its branch and explicit Spec Kit directory identify the work in a checkout. Internal task phases stay in `tasks.md`; they are not mirrored as issues. See [the upstream Spec Kit workflow](adr/0010-upstream-spec-kit-workflow.md).

Historical feature artifacts are revision-scoped records, not current reference. Git history retains their decisions after the finalization gates in [the workflow](workflow.md) permit branch-scoped copies to be removed.

Documentation describes the target system. It does not make unverified work implemented by describing it.

## Contributor workflow

The [engineering workflow](workflow.md) defines how a branch moves through Spec Kit, GitHub review, CI, and merge. Existing engineering skills supply focused investigation, design, review, and verification without a separate lifecycle.

## Source policy

Mark proposed, implemented, verified, failed, skipped, and `NOT RUN` evidence honestly. Accepted evidence in Git must identify its source revision and boundary. A GitHub issue or PR may link to that evidence, but the feature artifact remains authoritative for the engineering claim.

Local archives, measurements, and test records are transient output under the ignored `.artifacts/` tree. CI owns uploaded run artifacts. When an accepted record supports a durable feature claim, retain only that record beside the owning feature documentation.
