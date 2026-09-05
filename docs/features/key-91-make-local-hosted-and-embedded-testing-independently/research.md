# KEY-91 design decisions after scope correction

## Why the design changed

The original issue asks for independent commands using existing runners and thin
root orchestration. Implementation through `a50ee5b` added 5,969 net code/test
lines against `5b294f4`. Per-phase complexity reviews did not challenge the total
cost of the new orchestration, manifests, TLS fixture system and consumer driver.
The user rejected that expansion and chose separate feedback and acceptance.

This decision supersedes the earlier selected-evidence, TLS-provisioning, and
consumer-composition decisions. Their original rationale remains in Git at
`a50ee5b`. Current target behavior is defined in spec.md and plan.md; the reduced
commands are implemented through T059, with final acceptance pending T060-T061.

## Reuse and removal decisions

| Decision                                                                | Reason                                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Use existing SDK source groups for Local                                | Contributors need source feedback without packaging or services. Existing installed qualification remains separate.                    |
| Select modes/files in the native runner                                 | Startup and cleanup already exist. A second deployment orchestrator duplicates their ownership.                                        |
| Remove selected manifests and copied Local/shared assertion inventories | Full acceptance already owns durable evidence validation. Feedback can use existing suite registration and ordinary results.           |
| Remove separate TLS provisioning and remote consumer protocol           | Those systems expanded KEY-91 beyond test selection. Their removal leaves an explicit installed remote acceptance gap.                 |
| Keep simple product-unavailable messages                                | Missing Hosted and installed Embedded products do not need a manifest system to explain their absence.                                 |
| Retain demonstrated existing-runner repairs                             | Package preparation races, child termination and container/network cleanup failures remain correctness problems for surviving callers. |
| Review cumulative changes per phase                                     | A locally simple component can still be an unnecessary addition to the whole design.                                                   |

## Assertion disposition before deletion

The seven case names below come from
`packages/sdk/test/package/remote-consumer.mts` at `a50ee5b`. Paths in the retained
coverage column are repository-relative. They identify code to retain, not a
claim that those tests prove the removed installed-consumer boundary. T055 and
T058 must check this map against the actual deletion diff before removing tests.

| Affected case              | Retained coverage                                                                                                                            | Explicitly deferred proof and owner                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified-budget-workflow` | Canonical Budget registrars exercised by SDK/native Budget aggregates; `packages/postgresql/test/system/remote-budget.test.ts`               | Complete Budget workflow through an installed SDK against a real verified remote endpoint. SDK remote delivery owns this consumer proof.           |
| `tenant-isolation`         | `packages/postgresql/test/system/remote-security.test.ts` derives identity from authenticated roles and checks tenant scope                  | Installed SDK tenant isolation against that endpoint. SDK remote delivery owns the consumer proof; PostgreSQL retains role/tenant authority tests. |
| `reconnect-exact-replay`   | `packages/postgresql/test/system/remote-recovery.test.ts`, canonical replay cases, and `packages/sdk/test/unit/remote/recovery.test.ts`      | Installed SDK reconnect and exact replay over a real connection. SDK remote delivery owns it.                                                      |
| `operation-conflict`       | Canonical replay/conflict cases and `packages/postgresql/test/system/remote-recovery.test.ts`                                                | Conflicting command reuse through the installed SDK endpoint. SDK remote delivery owns it.                                                         |
| `unavailable-endpoint`     | SDK `test/unit/remote/postgresql-command-executor.test.ts` startup failure and `test/unit/remote/errors.test.ts` error mapping               | A real unavailable endpoint returning the expected error through the installed SDK. SDK remote delivery owns it.                                   |
| `wrong-ca`                 | SDK `test/unit/remote/connection-options.test.ts` verified TLS configuration and `test/unit/remote/errors.test.ts` certificate error mapping | Real handshake rejection of an untrusted CA through the installed SDK. SDK remote delivery owns it.                                                |
| `wrong-hostname`           | The same SDK TLS configuration/error tests                                                                                                   | Real certificate hostname mismatch rejection through the installed SDK. SDK remote delivery owns it.                                               |

Configuration validation, simulated errors, canonical semantics and native SQL
behavior do not establish end-to-end installed TLS acceptance. Removing the
consumer system explicitly defers all seven installed-endpoint cases, while
retaining their existing lower-level coverage. Historical successful executions
remain observations of their recorded implementation only. Hosted delivery may
reuse the eventual remote consumer behavior against a real product target; this
does not create an additional implementation task in KEY-91.

| Other affected tests                                                        | Disposition                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local semantic, lifecycle, isolation and Policy assertions                  | Retain the existing source groups and separate installed package qualification. Removing Local orchestration removes no product assertion from those owners. |
| Embedded transaction assertions                                             | Retain all existing fixture assertions. KEY-10 supplies supported installation/grants; KEY-11 retains and extends composition proof as those products land.  |
| Selected manifest, hash, stage-record and consumer-protocol tests           | Remove when their only subject is deleted infrastructure. Existing full/package evidence validation stays covered.                                           |
| Package-lock, process termination and container/network cleanup regressions | Retain behavior required by surviving callers. Trim only observations or callbacks exclusive to removed runners.                                             |
| Hosted refusal                                                              | Keep minimal unavailable/no-external-work behavior; remove its evidence-only tests. Hosted operating proof remains owned by Hosted delivery.                 |

If a deletion exposes an assertion absent from this map, classify it before
removal. Do not label a product guarantee an infrastructure test because its
current implementation happens to live in the removed harness. Do not relocate
the whole harness under a new name to avoid making the disposition explicit.

## Existing evidence and product limits

The completed [study](testing-strategy.md) adopted removal of duplicate contracts
execution in `test:pr`, retained the standalone alias and verified failure
propagation through Turbo. Its timings and coverage apply to its recorded source.
No new measurement campaign is required for the correction. Preserve its files
and evidence index unchanged; do not claim a new speedup from historical timing.

Installer recheck removal, packaging CI restructuring, unused remote registrar
activation, and broad Policy migration remain deferred. Preserve shared and
boundary-specific assertions in their current owners.

The last recorded KEY-10/KEY-11 read found both unfinished, and current fixtures
provide application grants beyond a supported Embedded profile. Their phase
observations remain in acceptance.md. Fixture success cannot establish installed
Embedded support. Hosted product delivery must provide its environment and
operating contract before live acceptance. The authorized-database walkthrough
is not a substitute for either missing product contract.
