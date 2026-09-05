# Research: SQLite and PostgreSQL conformance before merge

## Evidence baseline

Inspected revision `9395d298041a0fd2237e1c9f441d4cc838dc35eb` on the exact KEY-75 branch. The initial checkout was clean. Live Linear intake confirms the linked spec and no prerequisites. Source research does not qualify runtime behavior.

## One job owns both authority results

**Decision**: Add one independent `SQLite and PostgreSQL conformance` job to PR CI. A small repository script runs both authorities and validates results. Preserve the provider-free job and full native runner.

**Rationale**: One job owns the checkout and attempt. Rerunning it reruns both authorities, preventing mixed attempts. Sequential execution avoids concurrent builds within one checkout. Ordinary test failure must not prevent collecting the other authority's result.

**Alternatives considered**: A matrix plus aggregate job adds artifact/attempt coordination. A required manual workflow does not establish PR execution. Adding Docker to `test:pr` changes its provider-free contract.

GitHub accepts some skipped checks as successful. The required job therefore has no conditional skip route; setup failure fails the job, and diagnostic upload does not replace failure. Merge queue, if later enabled, also requires `merge_group` triggers. This plan does not enable a queue. See [GitHub required-check troubleshooting](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## Reuse aggregate registration and execution JSON

**Decision**: Both hosts register `registerBudgetContractTests`. Compare their complete nonempty sets of unique `fullName` assertion identities. Keep native-only coverage validation separately.

**Rationale**: The SDK aggregate runs lifecycle 4, replay 9, denial 7, Resource-bound root 5, rollback 4, and settlement 8, totaling 37. Native split files register 32. The native-only Resource-bound rollback/authorization cases do not replace the missing five shared tests.

The native aggregate replaces shared registrations in lifecycle, replay, denial, rollback, and settlement entrypoints. Preserve the three native-only rollback cases and the full installation, Policy, remote, recovery, connection, transaction, and contention suites. SDK remote executor tests are not SQLite Budget evidence. Existing Policy case tables remain exercised by their current tests, which iterate cases inside a single Vitest assertion; this feature does not claim individual Budget-scenario reports for those cases.

**Alternatives considered**: A copied shared-name inventory duplicates registration. Keeping split native registration plus a report comparison could detect future omissions, but aggregate registration prevents them. A new conformance DSL or trace comparator is unnecessary because the shared assertions already check results, errors, replay flags, history, and final state against identical expectations.

Use execution JSON and process exit status. Reject pending/todo/skipped assertions, duplicate identities, failed files, unhandled errors, inconsistent counts, and empty results. Do not use `vitest list --json` as the expected corpus: installed Vitest 4.1.11 collection formatting excludes skipped tests. Disable `.only` and expose no selection passthrough. See [Vitest JSON reporter](https://vitest.dev/guide/reporters.html#json-reporter).

## Retain failed attempts without accepting them

**Decision**: Evolve native `--output` to `keynes.system-test.postgresql/v2`, distinguishing success, failure, and unavailable execution metadata. Add a conformance attempt record referencing each runtime result and its digest. Sanitize before retention and return nonzero on qualification/write failure.

**Rationale**: Current `run.ts` writes v1 only after test and cleanup success, then deletes temporary JSON even on failure. The manual workflow uploads only under `success()`. Extend the existing owner and reuse its revision, archive, installation, image, contract, and cleanup checks. Active v1 references are the runner and its tests; historical artifacts are not rewritten.

Record observed runtime/dependency versions, host and attempt identity, contract and shared source digests, scenario identity digest, lockfile hash, native distribution digest, and retained file digests. Missing required version observations cannot qualify a pass. Startup failures mark observations unavailable and tests `NOT RUN`.

**Alternatives considered**: Unrestricted raw logs can expose credentials or private fixture data. Success-shaped failure records defeat the gate. Parallel v1-success and new-failure formats add branching; use one explicitly versioned result model.

Upload an allowlisted bundle under a unique name and require confirmed upload success. Stage hosted upload files under a non-hidden directory in `RUNNER_TEMP` to avoid hidden `.artifacts` exclusions. Reuse the pinned action and verify its inputs during implementation. See [upload-artifact documentation](https://github.com/actions/upload-artifact).

## Isolation and cleanup

**Decision**: Preserve random runner IDs/passwords, disposable databases/roles, unique containers/networks, temporary directories, and ephemeral loopback ports. Overlapping acceptance attempts use separate clean checkouts and exclusive output paths. Add bounded signal handling; forced hosted termination relies on disposal of the GitHub-hosted VM.

**Rationale**: Database fixtures are isolated already. Package archives and consumers are temporary, but `pnpm pack` invokes `prepack` and writes `packages/postgresql/dist`. Unique artifact paths alone do not isolate concurrent builds. The runner cleans up normal success/failure but lacks parent SIGINT/SIGTERM handling.

Record cleanup failure without discarding the original failure and attempt all cleanup actions. Retain only safe run IDs and stage diagnostics, never URLs, runner context, pooler user files, credentials, or private Budget data. A hard kill may prevent final diagnostics; that attempt stays canceled/nonpassing. Do not promise upload after loss of the runner.

**Alternatives considered**: A lease service or global cleanup daemon is unnecessary. Normal cleanup does not prove cancellation cleanup. Shared-checkout concurrent package builds are outside scope.

## Required policy is an independent acceptance condition

**Decision**: Require the observed GitHub Actions context `SQLite and PostgreSQL conformance` on `main`, preserve existing requirements including `Repository and tests`, and require up-to-date candidate checks. Read back effective policy and demonstrate blocked merging after authorized configuration.

**Rationale**: Planning readbacks of `repos/keynes-dev/keynes/branches/main/protection` and `repos/keynes-dev/keynes/rules/branches/main` both returned HTTP 403 with `Upgrade to GitHub Pro or make this repository public to enable this feature.` Neither returned an effective policy. GitHub documents private-repository protection as plan-dependent. See [protected branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

**Follow-up observation**: The owner upgraded keynes-dev to Team. A fresh organization API read confirms `plan.name: team`. The protection endpoint now returns HTTP 404 with `Branch not protected`, and effective branch rules return `[]`. The plan restriction is resolved; main has no observed enforcement policy. No repository settings were changed by this planning command.

**Alternatives considered**: A maintainer convention or green job without policy cannot meet FR-004. Configure and demonstrate the required checks during acceptance; do not narrow the spec silently.

Design unknowns are resolved. The platform restriction is resolved; required-check configuration and enforcement proof remain outstanding. Runtime, hosted, cancellation, concurrency, and policy-mutation demonstrations remain `NOT RUN`.
