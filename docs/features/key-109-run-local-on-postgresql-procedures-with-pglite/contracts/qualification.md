# Compatibility and qualification contract

## Gate order

1. Confirm KEY-76 is landed, align native target/profile/image to PostgreSQL 18.3 with failing tests first, and freeze candidate source/lockfile/SQL identities. Assert both actual engines report 180003. Preserve native exact-version rejection.
2. Test fresh canonical install, exact recheck, identity drift and partial-target failure on PGlite. Exercise procedure bodies, not only schema installation.
3. Measure fresh startup, memory, footprint and throughput using the compatibility host before changing the default Local runtime.
4. Prove shared commands/Policy/errors/replay/conflict/rollback on PGlite and native PostgreSQL, Local public journeys, isolation and lifecycle, plus an installed interim SDK smoke.
5. Retain passing replacement evidence, then delete SQLite and alternate runtime evaluation. Re-run relevant checks and repeat final measurements on the packed candidate.
6. Verify final CI applicability, required contexts, native coverage and full retained evidence. Only the combined outcome accepts KEY-109.

Compatibility failure stops steps 3-6 that depend on successful installation. A failed attempt retains its cause and any observations already available; missing costs are NOT RUN, never fabricated. No alternate Local rule implementation bypasses failure.

## Measurement method

Use the existing explicit performance runner and a provider-free child-process environment. Extend it with `--observations` to separate engine observations from legacy SQLite envelope enforcement. This is a planned option, not an available command at planning time.

- Record exact PGlite dependency, actual PostgreSQL version, SQL/contract/lockfile identity, source revision/dirty state, Node, pnpm, OS/architecture and reference host.
- Run three discarded cold warmup processes, then 30 fresh processes. Measure engine/bootstrap readiness and configured public create separately where available, first successful request, ready RSS, sampled peak RSS, heap/external/ArrayBuffer memory and shutdown. Record peak sampling interval and avoid double-counting overlapping memory categories as a total.
- For a ready instance, run ten warmup requests followed by 100 sequential successful request/settle pairs. Record individual request latency and elapsed measured batch duration. Throughput is 200 completed commands divided by elapsed seconds; count neither warmup nor failed operations. Use adequate root funding so depletion cannot distort the workload.
- Record raw samples, sample counts, median and nearest-rank p95. Compare engine-bootstrap measurements with final public initialization measurements only when the measured boundaries match.
- Measure the exact SDK archive compressed bytes and isolated installed production tree, including engine/WASM/data assets and dependencies. Before replacement, measure the compatibility artifact/dependency closure and label it as such; it is not the final SDK archive.
- Missing/invalid samples, child exit failures and failed cleanup fail the run. Retain raw failures. Report existing SQLite ceiling results separately; observations mode does not claim they pass or change them silently.

No numeric PGlite SLA is adopted here. KEY-87 owns the full envelope and comparative benchmarking. Historical engine measurements remain background. KEY-88 owns final archives after KEY-96. This feature must still prove canonical asset inclusion and a working isolated interim consumer.

## Behavior inventory

Reuse `packages/contracts/contract-tests/scenarios` and `policy` cases as the minimum inventory. Cover definitions and invalid/conflicting batches, configured creation and zero membership, approved/denied requests, consumable/reusable settlement, missing usage/overage, lineage/history/final state, exact replay/conflict and injected rollback. Keep Policy source rejection tests and execute compiled semantic/security cases through SQL.

Both engines must run the same shared cases. Normalize only predeclared nondeterministic fields such as generated IDs/timestamps consistently with existing comparison helpers; never normalize amounts, errors, replay indicators, Policy evidence or lifecycle differences away. Independently run native contention, privileges, direct remote recovery and caller transaction commit/rollback/connection ownership.

## CI and evidence

Keep the current hosted context names, `Repository and tests` and `SQLite and PostgreSQL behavior tests`, for enforcement continuity. The former executes Local/PGlite source tests; the latter retains native source correctness. Its old name is a compatibility label, not permission to report SQLite as the executed engine.

Classifier tests must cover relevant runtime/canonical SQL/contract/generator/lockfile/workflow changes, renames/deletions and unknown input. Missing, malformed or failed classification cannot select not-applicable. Only an explicit irrelevant decision may take the documentation path. Missing/failed/cancelled engine processes must not yield passing reports.

Routine CI need not upload successful artifacts. Sanitized failure diagnostics must not mask the original exit. Full explicit qualification retains manifest, both engine reports, native startup/cleanup and hashes through the existing workflow retention/upload-receipt contract; update the Local report filename and parsers truthfully. Preserve a durable acceptance copy before expiring hosted artifacts.

Read live branch protection/rulesets and required contexts for the final candidate. Keeping names avoids a rename gap, but YAML alone is insufficient enforcement evidence. If a rename is later chosen, first require both contexts and verify both report, then retire the old requirement. No protection mutation is part of this planning pass.

## Evidence boundaries

All compatibility, performance, runtime, package smoke, native and hosted-enforcement checks are NOT RUN during planning. External managed services, paid providers, publication, full operating-envelope qualification, final split-package archives and Hosted/Embedded product readiness are excluded or NOT RUN. Historical acceptance records are immutable background.
