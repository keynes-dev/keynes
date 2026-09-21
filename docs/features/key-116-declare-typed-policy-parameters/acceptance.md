# Acceptance evidence: KEY-116

Historical planning evidence is retained below. Source implementation, documentation and review are complete. Qualification remains separate.

## Source verification

Verified source revision: `4d3b27be97659088193c330868348a679917f61e`. Attempt: local source acceptance 1 on 2026-09-21. Host: Darwin arm64, Node v25.9.0, pnpm 11.21.0, TypeScript 7.0.2, Vitest 4.1.11. Dependencies: Ajv 8.20.0, canonicalize 4.0.0, json-schema-to-ts 3.1.1 and optional Zod 4.6.5.

| Lane                                                                       | Result          | Scope                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                           | PASS            | Eight workspace projects; lockfile unchanged.                                                                                                                                                                   |
| `pnpm --filter @keynes/policy-parameters test`                             | PASS            | 81 tests across declaration/JSON validation, snapshots, Zod parity and isolated consumer files.                                                                                                                 |
| `pnpm --filter @keynes/policy-parameters typecheck`                        | PASS            | Inferred schema/Zod types, dynamic fallback, arrays, readonly values and compile-time rejection cases.                                                                                                          |
| `pnpm test:pr`                                                             | PASS            | 1,002 tests: repository 64, runner 200, database 51, SDK 241, SQLite 194, PostgreSQL provider-free 169, CLI 2 and parameters 81. Generation, formatting, lint, all typechecks and dependency boundaries passed. |
| Isolated consumer without Zod                                              | PASS            | Offline copied core dependencies, no ancestor node_modules; source runtime/type resolution and Zod-authored snapshot restoration.                                                                               |
| Fixed fixture and fresh process                                            | PASS            | Canonical bytes and SHA-256 identities reproduced in a separate Node process.                                                                                                                                   |
| Native PostgreSQL behavior                                                 | NOT RUN locally | No Budget command or runtime implementation change. PR CI evidence must identify its own revision.                                                                                                              |
| Installed archive, full paired qualification and Local preview publication | NOT RUN         | KEY-117 owns tooling distribution; KEY-88/KEY-105 own qualification/publication.                                                                                                                                |
| Cloud, providers, editor, performance, durability and migration            | NOT RUN         | Outside this feature's contract.                                                                                                                                                                                |

The provider-free gate reported three pre-existing lint warnings outside this feature and zero errors. They concern an unused PostgreSQL test import, an intentional sparse-array SDK fixture and an escaped slash in the database generator. No unrelated warning cleanup is included.

Fixture `packages/policy-parameters/test/fixtures/snapshot.json` SHA-256: `c983c1bd204d023c38f4dde5374310ed514e7865f67fde3a5fc0f6eacd9bdb92`. The final documentation commit leaves this verified source unchanged; the draft PR records final-head CI and any subsequent checks. Source tests do not qualify a public archive or a deployment.

## Historical planning candidate

Base revision: `dc58120`, containing landed KEY-113 governance, KEY-114 request retirement, KEY-96 package separation and KEY-85 asynchronous SDK failures. The planning commit and exact CI results are recorded in the draft PR. The final commit cannot contain its own hash; its Git tree identifies these documents.

Scope: only `docs/features/key-116-declare-typed-policy-parameters/`. No runtime code, dependency, managed Spec Kit file or governing product contract changes.

## Planning validation

Validated on 2026-09-21 on Darwin arm64 with Node v25.9.0, pnpm 11.21.0 and Spec Kit 1.0.4. Local planning attempt 1 at `0df344de354ee748a1fb68a2406f8f6bbdcede98`, based on the revision above. These results assess document consistency and repository organization only.

| Command or review                                                                                                                                                                    | Result                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                                                                     | PASS; existing lockfile unchanged.                                                                                                                                                                    |
| `SPECIFY_FEATURE_DIRECTORY=docs/features/key-116-declare-typed-policy-parameters .specify/scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` | PASS; exact selected directory and all required artifacts present.                                                                                                                                    |
| `specify integration status --json`                                                                                                                                                  | PASS; zero missing or modified managed files.                                                                                                                                                         |
| `pnpm exec oxfmt --check docs/features/key-116-declare-typed-policy-parameters`                                                                                                      | PASS; nine documents.                                                                                                                                                                                 |
| `pnpm test:repository`                                                                                                                                                               | PASS; two files, 64 tests.                                                                                                                                                                            |
| `git diff --check`                                                                                                                                                                   | PASS.                                                                                                                                                                                                 |
| Stock read-only Spec Kit analysis                                                                                                                                                    | PASS; 12 functional requirements and four success criteria covered by 20 unchecked tasks. Zero blocking findings, ambiguity findings, duplication findings, constitution conflicts or unmapped tasks. |
| Prerequisite review                                                                                                                                                                  | PASS; PR #63 merged at `6f765b81cc93824340cfcf2a79a3b4b031af7802`, an ancestor of the planning base.                                                                                                  |

US1 has five tasks, US2 four, US3 four, and setup/foundation/final acceptance seven. Three runtime/type-test pairs can run independently within their phase. US1 is the proposed MVP; full acceptance requires all stories. Checklist syntax and local Markdown links were checked before publication. No extension hooks are installed. Artifacts are published on the issue branch; the draft PR identifies their exact source commit.

## Planning review follow-up

Applied the two Ponytail review findings: use `canonicalize(snapshot)` instead of a separate serialization API, and keep transition/identity rules in the interface contract. Updated the task and validation guide references. Focused formatting, stock prerequisites, local-link/task checks and `git diff --check` pass for this documentation revision; the 64 repository tests above remain evidence for the original planning commit. Feature implementation remains NOT RUN.

## Historical planning-only evidence boundary

| Lane                                            | Result  | Meaning                                                                        |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Declaration/value runtime acceptance            | NOT RUN | No feature implementation exists in this PR.                                   |
| Type inference and Zod parity                   | NOT RUN | Planned type and conversion checks have not run.                               |
| Overrides and reproducible snapshot fixtures    | NOT RUN | No feature fixture or serializer has been implemented.                         |
| Core consumer without Zod                       | NOT RUN | Source dependency isolation remains a future acceptance check.                 |
| Full provider-free implementation gate          | NOT RUN | Planning checks do not substitute for `pnpm test:pr`.                          |
| SQLite/native PostgreSQL behavior               | NOT RUN | No Budget command/runtime change; no cross-deployment claim.                   |
| Package/archive and Local preview qualification | NOT RUN | Distribution belongs to KEY-117; release qualification remains KEY-88/KEY-105. |
| Cloud/provider/editor/HTTP behavior             | NOT RUN | Outside KEY-116.                                                               |
| Performance/recovery/migration qualification    | NOT RUN | No such capability or guarantee is introduced.                                 |

During implementation, retain exact revision, attempt, host/tool versions, selected dependency versions, command exit results and fixture digests here. Never relabel planning checks as behavioral evidence.

## Implementation phases

### Phase 1: setup

T001-T002 complete. The exact branch and landed KEY-113 prerequisite were reconfirmed; the requirements checklist passed 16/16. Existing Git/Docker ignores cover generated files and secrets. No publishing ignore is needed for the private source workspace.

Added private workspace metadata, optional Zod peer and exact dependency pins. `pnpm install --frozen-lockfile`, Turbo test/typecheck dry-run discovery, focused formatting and diff checks passed. Behavior tests/typecheck are NOT RUN because this mechanical phase adds no source or tests. Read-only Ponytail review: Lean already. Ship. Correctness review found no setup issues.

### Phase 2: foundational validation

T003-T004 complete. Before implementation, `pnpm --filter @keynes/policy-parameters test` failed because `src/schema.ts` was absent; no assertions ran in that red attempt. After implementation, all 32 boundary cases pass. The same package typecheck, focused oxlint/oxfmt and diff checks pass. Tests cover strict JSON copying, inert annotations/defaults, malformed/unsupported schemas and sanitized errors. Compiled object schemas are removed from Ajv cache after compilation.

Read-only Ponytail review: Lean already. Ship. Independent correctness review found no actionable issues. Public declarations, snapshots and Zod remain NOT RUN at this checkpoint.

### Phase 3: declarations and provisioning

T005-T009 complete. Initial runtime/type checks failed on absent core exports. Subsequent behavioral red cases exposed invalid-name/error classification and prototype-forged declarations; compile red exposed valid array initials rejected by excess-key checks. All were corrected before acceptance. Private declaration branding prevents prototype forgery. Array inference preserves valid readonly initial inputs.

`pnpm --filter @keynes/policy-parameters test` passes 44 cases; package typecheck, focused lint/format and diff checks pass. The isolated consumer test copies installed core dependencies and TypeScript offline into a temporary directory, verifies no parent dependencies/Zod, runs the core and typechecks it, then removes the directory. It is source-consumer evidence, not an archive claim.

Ponytail review removed redundant shape predicates after validated field extraction. Re-review: Lean already. Ship. Independent correctness re-review verified both regression fixes. Restoration/overrides and Zod remain NOT RUN at this checkpoint.

### Phase 4: overrides and restoration

T010-T013 complete. The red run reported nine failing snapshot tests for missing APIs/fixture; compile checks also failed on absent exports and unused negative assertions. After implementation, 55 package tests and typecheck pass, along with focused lint/format and diff checks. Tests cover whole-value overrides, tampering/error ordering, exact definitions, changed initials, frozen copies, reordered object/schema keys, significant array order, fixed canonical fixture bytes in a fresh Node process, and core-only restoration without Zod.

Read-only Ponytail review: Lean already. Ship. Independent correctness review found no actionable issues. Zod remains NOT RUN at this checkpoint.

### Phase 5: optional Zod authoring

T014-T017 complete. Initial tests/typecheck failed on missing adapter exports. A later compile regression reproduced dynamic combinator arrays inferred as `never`; the conservative fallback now returns JSON-value types while runtime validation remains authoritative, including for impossible schemas.

`pnpm --filter @keynes/policy-parameters test` passes 81 cases, including pinned Zod 4.6.5 parity and rejected nested refinements/defaults/transforms/conditional callbacks/converter hooks, repeated bounds, exact lengths, metadata isolation, opaque-schema forgery and schema replacement. The isolated core consumer restores an actual Zod-authored fixture without Zod installed. Package typecheck, focused lint/format and diff checks pass.

Zod types use an internal opaque schema wrapper; callers cannot retain its type witness while replacing its portable schema. The adapter projects stock converter output to enumerable JSON because Zod attaches a non-enumerable runtime helper. Raw caller schemas still undergo strict JSON capture. Read-only Ponytail review: Lean already. Ship. Independent correctness review found no actionable issues.

### Phase 6: documentation and acceptance

Completed T018-T020. Both README TypeScript examples ran and typechecked; the quickstart Node assertions passed. These documentation checks used temporary files, which were removed. The final documentation changes do not alter the verified source revision above.

Final read-only Spec Kit analysis: 12 functional requirements, four success criteria and 20 tasks; 100% requirement coverage, zero unmapped tasks, zero ambiguity/duplication findings and zero constitution conflicts. The coverage map in tasks.md identifies each mapping. Exact-directory prerequisites passed, with no extension hooks. Managed integration status reports zero missing or modified files.

Independent final correctness and Ponytail reviews found no remaining actionable findings across the complete core, adapter and documentation. Earlier phase findings were fixed and checked before their commits. All six phases received review and separate commits. Linear remains In Progress pending merge; the existing PR remains draft. Native and publication evidence boundaries above still apply.
