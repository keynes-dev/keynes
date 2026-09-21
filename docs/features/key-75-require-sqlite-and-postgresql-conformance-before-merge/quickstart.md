# Quickstart: validate required shared behavior tests

Terminology updated by KEY-92. Historical execution evidence remains unchanged.

This guide specifies implementation acceptance. The paired command and runner regressions are implemented locally. See [acceptance evidence](evidence/acceptance.md) for exact executed revisions and outstanding demonstrations.

## Prerequisites

Use a clean checkout of the implementation revision, Node.js 24 or 26 as permitted by the current packages, pnpm 11.21.0, and working Docker. CI uses Node.js 24 on `ubuntu-24.04`. Docker may pull the existing digest-pinned PostgreSQL and PgBouncer images. This is local disposable database execution, not hosted provider qualification.

Run from the repository root:

```sh
git rev-parse HEAD
git status --porcelain
node --version
pnpm --version
pnpm install --frozen-lockfile
```

An evidence-producing run requires an empty Git status. Planning documents must be committed as part of the implementation revision before qualifying it. Do not claim the current dirty planning checkout is qualified.

## Provider-free gate

Before authorized external or live acceptance work:

```sh
pnpm test:pr
pnpm format
```

During implementation, first observe the new fail-closed gate regressions failing for the intended reasons. Then implement them and run:

```sh
pnpm exec vitest run scripts/run-sqlite-postgres.test.ts packages/postgresql/test/system/run.test.ts --maxWorkers=1
```

These focused tests use controlled runner/report fixtures and prove qualification logic only. Wire them into the provider-free PR gate so later changes cannot bypass these regressions.

## Existing runtime reproduction

The current commands remain useful for diagnosis:

```sh
pnpm --filter @keynes/sdk test:contract
pnpm test:system:postgresql
```

The SDK command also includes executor tests; those are not additional SQLite Budget scenarios. The current native command without output does not establish retained qualification. Neither command alone proves protected-branch enforcement.

## Paired evidence after implementation

Run the new command with a fresh output directory:

```sh
sqlite_postgres_attempt_id="$(node -p 'crypto.randomUUID()')"
pnpm test:sqlite-postgres -- --output ".artifacts/sqlite-postgres/$sqlite_postgres_attempt_id"
```

Expected outcome: zero exit status, separately identified SQLite and PostgreSQL results for the actual checkout, the same nonempty complete shared scenario set, full native-only coverage, observed environment metadata, matching input/file digests, and successful cleanup. The aggregate currently has 37 shared scenarios, including the five Resource-bound root cases. Both authorities use the shared registration; future additions increase the count together.

Inspect the attempt record and runtime files using [the evidence model](data-model.md). Verify both file hashes against the manifest. Confirm that the manifest candidate commit equals `git rev-parse HEAD` and status remains clean. Missing values, skipped scenarios, or partial results must exit nonzero.

For native-only diagnosis with the existing acceptance record and sanitized report:

```sh
native_attempt_id="$(node -p 'crypto.randomUUID()')"
pnpm test:system:postgresql -- --output ".artifacts/system-tests/postgresql/$native_attempt_id.json"
```

The sanitized report is retained at `<output>.vitest.json` when available, including on failure; the acceptance record exists only on success. A native-only pass does not qualify the paired check.

## Negative acceptance matrix

Use disposable demonstration revisions and runner-test fixtures. Record exact commands, changed assertion or controlled failure, revision, exit status, check result, and artifact identity. Never leave deliberate failures in the accepted implementation, and never weaken shared assertions to make a demonstration pass.

| Demonstration                            | Required observation                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intentional native assertion failure     | Make the native aggregate fail after a real shared assertion, while SQLite runs unchanged. SQLite passes, native fails, paired check fails, sanitized native failure result is retained. Use a committed disposable revision for attributable CI evidence. |
| Missing Docker or database startup       | Use the runner's controlled failure regression first, then a disposable execution environment without available Docker. Native tests are NOT RUN, attempt exits nonzero, safe startup diagnostics survive.                                                 |
| Skipped required scenario                | Mark a shared scenario skipped in a disposable revision. Neither skipped result nor matching reduced discovery may qualify.                                                                                                                                |
| Empty or missing corpus                  | Exercise empty selection/report regression fixtures and a disposable empty-entrypoint demonstration. The command rejects empty execution even if the child reports success.                                                                                |
| Missing or corrupt evidence              | Delete or corrupt a required result in controlled verification tests. Qualification fails. On a disposable CI revision, use an empty upload target to prove retention failure fails the job.                                                               |
| Old revision, attempt, or changed digest | Supply controlled stale/mismatched records to the validator tests. None qualifies the current invocation.                                                                                                                                                  |
| Cleanup failure                          | Inject a cleanup failure using runner tests. Original failure and cleanup failure remain visible; no pass is emitted.                                                                                                                                      |

The production qualification command has no bypass or fault-injection switches. Provider-free fixtures must not be described as real native runs. Keep each negative demonstration revision distinct from the final passing revision.

## Concurrent and interrupted execution

Prepare two separate clean checkouts of the same implementation commit. Run paired qualification concurrently with different attempt directories. Do not run overlapping package builds in one checkout.

Retain both attempts' IDs and results. Verify no artifact/fixture collision, distinct container/network IDs, and no remaining attempt-owned containers/networks after success and after an ordinary failure. Use the exact IDs from sanitized diagnostics with `docker container inspect <id>` and `docker network inspect <id>`; unrelated Docker resources must remain untouched.

Interrupt a native attempt after startup with SIGTERM. Verify bounded child termination, fixture/container/network cleanup where the process can run it, and nonzero/interrupted outcome. Separately cancel a disposable hosted attempt. Its check must remain nonpassing. Retain available diagnostics and the hosted cancellation record; VM disposal is the forced-termination cleanup boundary. Do not claim final artifacts exist if the runner was terminated before retention.

## Hosted check and protected branch

After provider-free checks pass and hosted/policy work is authorized, retain a successful PR run and the intentional native-failure run. For each, capture tested merge commit separately from PR head, run ID/attempt, check-run URL/conclusion, both runtime files, artifact ID/digest, and upload outcome. Download and verify the bundle so hidden-path exclusions or partial upload cannot be mistaken for complete retention.

Read effective policy:

```sh
gh api repos/keynes-dev/keynes/branches/main/protection
gh api repos/keynes-dev/keynes/rules/branches/main
gh pr checks <demonstration-pr-number>
gh pr view <demonstration-pr-number> --json headRefOid,baseRefName,mergeStateStatus,statusCheckRollup
```

See [research.md](research.md#required-policy-is-an-independent-acceptance-condition) for dated policy observations. Refresh policy readback during acceptance. Configure the observed check context according to [the operational contract](contracts/sqlite-postgres-check.md), preserving existing requirements. Retain policy readback and evidence that the native failure specifically blocks the covered merge path. A draft PR alone is not proof that the database behavior check blocks merging. Do not merge as a test.

## Acceptance record

After implementation, retain a feature-local acceptance record under `evidence/` with exact revision(s), commands, outcomes, environment versions, input and artifact digests, test/check links, policy observation, and cleanup demonstrations. Record artifact expiration and retain durable copies of the required acceptance evidence before the 14-day CI artifacts expire.

Keep failed, canceled, skipped, and `NOT RUN` observations distinct. Hosted providers, verified TLS qualification, backup/failover, production readiness, performance campaigns, and general package qualification remain outside this feature's claims. Existing relevant native tests are preserved, but do not establish those broader claims.

FR-004/SC-006 remain unaccepted until required-check policy is configured and enforcement is demonstrated. Feature acceptance requires every in-scope scenario in the specification; a passing paired command alone is insufficient.
