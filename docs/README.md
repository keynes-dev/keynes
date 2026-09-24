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
| Contributor delivery and Spec Kit retention            | [Workflow](workflow.md)                                  |
| Release procedure and retained release evidence        | [Releases](releases/README.md)                           |
| Accepted cross-package decisions                       | [Architectural decisions](adr/)                          |
| Internal contract generation and shared scenarios      | [Database package](../packages/database/README.md)       |
| Internal package qualification utilities               | [Testkit package](../packages/testkit/README.md)         |

## Repository records

Each record has a narrow purpose:

| Source                                | Owns                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Current references and package guides | Implemented behavior, public and internal contracts, rationale and supported procedures                  |
| `docs/adr/`                           | Current cross-package architectural decisions                                                            |
| `docs/features/`                      | Active branch-scoped Spec Kit work and exact-revision evidence before reviewed finalization              |
| Main Git history                      | Byte-exact finalized feature records retained at their evidence commits after they leave the latest tree |
| GitHub issues and pull requests       | Current discussion, review, CI, merge status, and full-commit navigation to finalized records            |

Do not copy mutable GitHub fields into repository documents. A feature may start
from one GitHub issue, but its branch and explicit Spec Kit directory identify
the work in a checkout. Internal task phases stay in `tasks.md`; they are not
mirrored as issues. See the [contributor workflow](workflow.md).

Historical feature artifacts are revision-scoped records, not current reference.
Git history retains their exact bytes after the
[workflow's finalization gates](workflow.md#publish-and-finalize-feature-artifacts)
permit branch-scoped copies to be removed.

Documentation describes the target system. It does not make unverified work
implemented by describing it.

## Contributor workflow

The [engineering workflow](workflow.md) defines how a branch moves through Spec
Kit, GitHub review, CI, and merge. Existing engineering skills supply focused
investigation, design, review, and verification without a separate lifecycle.

## Source policy

Mark proposed, implemented, verified, failed, skipped, and `NOT RUN` evidence
honestly. Accepted evidence in Git must identify its source revision and
boundary. A GitHub issue or PR may link to the full evidence commit, but mutable
issue or branch state is not the engineering claim.

Local archives, measurements, and test records are transient output under the
ignored `.artifacts/` tree. CI owns uploaded run artifacts. Pre-deletion feature
evidence is committed at E before its directory leaves the latest tree. Later CI
and review results belong in pull-request or CI metadata. Release evidence that
must outlive CI belongs under `docs/releases/`, not in a duplicate feature
archive.
