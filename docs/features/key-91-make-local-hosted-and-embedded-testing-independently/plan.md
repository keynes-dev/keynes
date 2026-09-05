# Implementation plan: reduce KEY-91 to existing runners

**Branch**: `key-91-make-local-hosted-and-embedded-testing-independently`

**Specification**: [spec.md](spec.md), scope correction of 2026-09-05.

## Resume boundary

The next implementation begins at T055 in [tasks.md](tasks.md). T013-T049 describe
historical work now subject to reduction; T050-T054 are superseded. This planning
checkpoint changes no runtime behavior. `a50ee5b` is the expanded implementation
reference; `5b294f4` is the pre-implementation comparison baseline.

The user selected separate feedback and installed acceptance. Reuse existing tests
and runners. Remove the orchestration introduced to make every feedback run an
acceptance record. Keep the [completed study](testing-strategy.md) and its measured
duplicate-contracts removal; do not repeat its timing campaign.

## Target design

| Owner                      | Implementation boundary                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK Local                  | Package script or small existing entrypoint invokes the fixed SDK test groups in the command contract. No packing, external consumer, archive flag, or selected manifest.                                       |
| PostgreSQL remote/Embedded | Select existing files/modes inside `test/system/run.ts`; reuse its PostgreSQL startup, fixture installation, pooler configuration, report checks, and cleanup. Full remains the default native runner behavior. |
| SDK Hosted                 | Minimal unavailable entrypoint prints the fixed reason and exits 1. Standalone help is allowed. No snapshot capture or evidence files.                                                                          |
| Existing acceptance        | SDK package qualification and full native/paired commands remain separate, with current schemas and artifact/source validation.                                                                                 |
| Root                       | Aliases delegate to package owners. No added lifecycle or report construction.                                                                                                                                  |

Native selected runs must not write the existing full acceptance record. Ordinary
Vitest results and a concise scope/limitations message are sufficient. Reuse the
existing native required-scenario map for selected native-only assertions; use
the canonical Budget registrar directly. Do not freeze another copy of shared
or Local assertion names. Preserve selected-file presence and skip checks through
existing report parsing, without a second evidence schema.

Local retains the existing 18 source files as suite groups, not the copied
244-name inventory. Remote retains the currently selected native suite groups;
Embedded retains Budget and transaction fixtures. The exact groups and supported
flags are defined once in [the command contract](contracts/deployment-checks.md).

## Remove and retain

Remove SDK Local orchestration for package preparation, consumer execution,
snapshots, stage records, selected manifests, and their dedicated validators.
Delete the Local copied assertion inventory. Reduce Hosted to its unavailable
behavior and remove its evidence machinery and evidence-only tests.

Remove the new native deployment orchestrator, separate TLS fixture/provisioner,
and SDK remote-consumer driver/program. Remove the selected-manifest validators,
archive ledgers, dirty-input support, and tests used only by those deleted paths.
Move only required selection/refusal behavior into the existing native runner.
Do not port the removed architecture under smaller filenames.

Retain canonical and boundary-specific semantic tests, full required inventories,
explicit missing-context failures, and native mode selection. Retain the measured
contracts invocation fix. Keep the demonstrated package preparation race and
process/container cleanup fixes needed by existing full/package callers. Trim
callbacks, exports, and helpers that only served the removed orchestration; keep
shared mechanics already needed by surviving callers without further extraction.
Do not discard a correctness repair merely because it was introduced in a
superseded phase.

Remote installed SDK/TLS acceptance is a documented gap after this reduction.
Existing native remote tests remain feedback through the current fixtures. Do
not substitute the authorized-database walkthrough or raw SQL tests for installed
SDK acceptance. Installed Embedded and actual Hosted remain NOT RUN.

## Delivery and guardrails

1. T055-T056 reduce Local and Hosted. Their commands and relevant tests must work before committing the phase.
2. T057-T059 reduce native selection and delete its TLS/consumer orchestration together. Keep intermediate commits usable; do not leave aliases pointing at deleted runners.
3. T060-T061 validate preserved acceptance and reconcile documentation, then commit the final phase.

After each phase, run ponytail-review and review the cumulative code/test diff
against `5b294f4`, including untracked files. Compare the result with `a50ee5b` to
show actual reduction. A locally tidy abstraction does not justify a new subsystem.
Require each retained addition to map to an active requirement. Resolve review
findings, run affected checks, and commit before advancing.

No new runner framework, selected evidence schema, TLS/certificate infrastructure,
consumer protocol, or generic scenario registry is permitted. Do not extract a
helper to preserve machinery scheduled for removal. If existing paths cannot meet
a requirement, record the missing capability as deferred and reconcile the plan;
do not implement infrastructure to fill it during this correction.

## Validation

Use focused runner tests for suite/mode selection, missing context, nonzero test
results, unexpected skips, unavailable commands, and retained cleanup behavior.
Reuse existing negative report, source/artifact, and package-lock regressions.
Remove tests solely about deleted manifests/protocols. Avoid replacing them with
a new regression framework or exhaustive subprocess matrix.

Run Local, remote default-all and explicit modes, and Embedded against their
existing fixtures. Confirm dependency startup and explicit scope. Run the
unchanged full paired gate and separate provider-free SDK package qualification
on the final candidate. Run `pnpm test:pr` and `pnpm format`. Record command
results and source/artifact identity through existing acceptance output and a
short update to acceptance.md. No repeat study, new evidence index format, hosted
run, OS matrix, publication, or required-check investigation is a prerequisite
for this local correction.

## Governing constraints

Preserve existing TypeScript/Node/pnpm conventions and package ownership.
Contracts owns shared scenarios; SDK/PostgreSQL own their tests; root coordinates.
The constitution's Budget semantics, transaction boundaries, and evidence
requirements for acceptance are unchanged. Focused feedback makes narrower claims.
No product, installer, migration, CI check, or Spec Kit customization is planned.
Historical study and phase evidence remain immutable and revision-scoped.
