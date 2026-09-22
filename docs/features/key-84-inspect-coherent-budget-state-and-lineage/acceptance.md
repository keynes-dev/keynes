# KEY-84 acceptance evidence

Implementation is in progress. This record distinguishes setup checks from behavioral qualification. No setup result establishes coherent inspection, lineage, deployment readiness, or release acceptance.

## Phase 1: setup baseline

Source baseline: `542e6812afde4c45916cdcaaae5a255c47277125` on `key-84-inspect-coherent-budget-state-and-lineage` (`2026-09-22T18:12:46Z`). The checkout was clean before the listed commands. `origin/key-84-inspect-coherent-budget-state-and-lineage` pointed at the same revision.

`git merge-base --is-ancestor 208873c HEAD` and `git merge-base --is-ancestor 3c47555 HEAD` passed, proving the merged KEY-80 and KEY-96 implementations are ancestors. Their later feature-branch evidence commits (`8e792fc` and `760b163`) are not ancestors; they are not used as KEY-84 qualification.

`package.json` declares Node `>=24` and exact pnpm `11.21.0` (`packageManager: pnpm@11.21.0`). The observed host uses Node `v26.5.0` and pnpm `11.21.0`; Node satisfies the declared range. The repository does not declare an exact Node patch pin.

| Command                                                                                                                                                                                       | Attempt   | Result                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SPECIFY_FEATURE_DIRECTORY=docs/features/key-84-inspect-coherent-budget-state-and-lineage .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` | `setup-1` | PASS, exit 0; resolved this exact feature directory and found research, data model, contracts, quickstart, and tasks artifacts. |
| `pnpm install --frozen-lockfile`                                                                                                                                                              | `setup-1` | PASS, exit 0; all 8 workspace projects were already up to date in 148 ms using pnpm 11.21.0.                                    |
| `pnpm build:sdk`                                                                                                                                                                              | `setup-1` | PASS, exit 0; ran `pnpm --filter @keynes/sdk build` and `node scripts/build.ts`.                                                |

## Attempts, source, and cleanup

`setup-1` is a local prerequisite attempt at the source baseline above. It has no retained artifact directory because it starts no native runner, package archive consumer, external service, or behavioral test. No cleanup action was required. The final phase check must confirm the documentation-only diff and a clean process state before review and commit.

## Phase 2: foundational schemas

Source base: `f889191934b6efe29aa22ac9ffcd92a3b94a27ad`, clean on `key-84-inspect-coherent-budget-state-and-lineage`. The initial focused command observed the intended absent-contract failure before schema edits:

| Command                                                                                 | Result                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run packages/database/test/generate-contracts.test.ts --maxWorkers=1` | FAIL, exit 1; 33 passed and 2 failed. `HistoryCursor` rejected the required `khc_v2_<32 lowercase hex>_257` form because the source still required `khc_v1`; `LineageBudgetId` was absent.                                                                          |
| `pnpm generate`                                                                         | First attempt FAIL, exit 1; the new inspection-state field order formed a global generated result-field cycle. Reordering only the new state fields to align with the remote inspection projection removed the cycle; no renderer or field-order algorithm changed. |
| `pnpm generate`                                                                         | PASS, exit 0 after the schema-only order correction.                                                                                                                                                                                                                |
| `pnpm exec vitest run packages/database/test/generate-contracts.test.ts --maxWorkers=1` | PASS, 35 tests, exit 0.                                                                                                                                                                                                                                             |
| `pnpm generate:check`                                                                   | PASS, exit 0.                                                                                                                                                                                                                                                       |

The canonical schema now reserves positive safe lineage IDs, positive inspection movement amounts, direct and remote inspection-only state, command/automatic-finalization causes, and exact initial-allocation, transfer, and consumption/release endpoint variants. `LineageEvidence` identifies movements solely by their zero-based array index; it accepts no synthetic index field. `HistoryCursor` now accepts only canonical `khc_v2_<32 lowercase hex>_<positive decimal>` values up to 56 characters, so pre-feature `khc_v1` page fixtures are rejected.

The new definitions are staged: `GetBudgetResult`, `GetBudgetHistoryPageResult`, existing direct/remote history entries, and every mutation result still reference their pre-feature shapes. The cursor grammar is the sole active existing reference. `pnpm generate` produced every derived schema, type, validator, digest, SDK client, and installation record; no generated output was authored. SQL, runtime projection, operation revisions, semantic generations, and behavioral/native checks remain unimplemented and NOT RUN.

Parent review covered the Phase 2 diff based on `f889191934b6efe29aa22ac9ffcd92a3b94a27ad`. It corrected `automatic_finalization.eventSequence` to an inline positive safe integer because an event sequence is not a Budget lineage ID. Read-only Ponytail review accepted one `delete` finding: the test's array-map assertion only proved that JavaScript uses zero-based indices, while the ordered fixture and rejection of a synthetic `index` field already cover the contract. The correction removed eight lines. Re-review: Lean already. Ship. The focused generator test passes 35 tests; `pnpm generate:check`, `pnpm format:docs`, and `git diff --check` pass. T004-T007 are complete at the Phase 2 commit.

## Behavioral lanes

| Lane                                                                                                                                       | Status                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Foundational inspection schema, generator, and cursor validation                                                                           | STAGED; focused generator checks PASS; runtime behavior NOT RUN |
| SQLite inspection state and root-tree lineage projection                                                                                   | NOT RUN                                                         |
| Direct PostgreSQL coherent inspection and caller-owned transaction behavior                                                                | NOT RUN                                                         |
| Remote captured projection, repeatable paging, retention, and cleanup                                                                      | NOT RUN                                                         |
| Remote authorization, tenant/principal isolation, revocation, and private metadata protection                                              | NOT RUN                                                         |
| SDK remote mapping, hostile-page rejection, deadline, and page-limit handling                                                              | NOT RUN                                                         |
| Journal movement ownership, causality, replay, conflict, rollback, and finalization lineage                                                | NOT RUN                                                         |
| Independent concurrent remote readers and failure-survivor behavior                                                                        | NOT RUN                                                         |
| Fresh install, compatibility, generated output, and clean archive consumers                                                                | NOT RUN                                                         |
| Paired SQLite/native PostgreSQL, Embedded, full PR, and documentation qualification                                                        | NOT RUN                                                         |
| Hosted/Embedded release readiness, durable Local, providers, cross-authority behavior, performance, publication, and production operations | NOT RUN                                                         |

The quickstart's focused SDK, Node SQLite, and native PostgreSQL checks remain NOT RUN. Its final `pnpm generate:check`, `pnpm test:pr`, paired, Embedded, package-split, and documentation-format commands remain NOT RUN. No behavioral failure has been observed, so no implementation task may treat this setup evidence as test-first evidence.

Parent correctness review found no setup error. Read-only Ponytail review: Lean already. Ship. `pnpm format:docs` and `git diff --check` pass; no simplification or follow-up edit was needed. T001-T003 are complete at the Phase 1 commit.
