# Compatibility and qualification contract

## Gate order

1. Confirm KEY-76 is landed, align native target/profile/image to PostgreSQL 18.3 with failing tests first, and freeze candidate source/lockfile/SQL identities. Assert both actual engines report 180003. Preserve native exact-version rejection.
2. Test fresh canonical install, exact recheck, identity drift and partial-target failure on PGlite. Exercise procedure bodies, not only schema installation.
3. Retain the unchanged SQLite archive and fresh baseline measurements before switching Local; measure fresh PGlite startup, memory, footprint and throughput using the compatibility host.
4. Prove shared commands/Policy/errors/replay/conflict/rollback on PGlite and native PostgreSQL, Local public journeys, isolation and lifecycle, plus an installed interim SDK smoke.
5. Retain passing replacement evidence, then delete SQLite and alternate runtime evaluation. Re-run relevant checks and repeat final measurements on the packed candidate.
6. Complete the final same-host SQLite-versus-PGlite archive comparison, then verify final CI applicability, required contexts, native coverage and full retained evidence. Only the combined outcome accepts KEY-109.

Compatibility failure stops steps 3-6 that depend on successful installation. A failed attempt retains its cause and any observations already available; missing costs are NOT RUN, never fabricated. No alternate Local rule implementation bypasses failure.

## Measurement method

Use the existing explicit performance runner and a provider-free child-process environment. Extend it with `--observations` to separate engine observations from legacy SQLite envelope enforcement. This is a planned option, not an available command at planning time.

- Record exact PGlite dependency, actual PostgreSQL version, SQL/contract/lockfile identity, source revision/dirty state, Node, pnpm, OS/architecture and reference host.
- Run three discarded cold warmup processes, then 30 fresh processes. Measure engine/bootstrap readiness and configured public create separately where available, first successful request, ready RSS, sampled peak RSS, heap/external/ArrayBuffer memory and shutdown. Record peak sampling interval and avoid double-counting overlapping memory categories as a total.
- For a ready instance, run ten warmup requests followed by 100 sequential successful request/settle pairs. Record individual request latency and elapsed measured batch duration. Throughput is 200 completed commands divided by elapsed seconds; count neither warmup nor failed operations. Use adequate root funding so depletion cannot distort the workload.
- Record raw samples, sample counts, median and nearest-rank p95. Compare engine-bootstrap measurements with final public initialization measurements only when the measured boundaries match.
- Measure the exact SDK archive compressed bytes and isolated installed production tree, including engine/WASM/data assets and dependencies. Before replacement, measure the compatibility artifact/dependency closure and label it as such; it is not the final SDK archive.
- Missing/invalid samples, child exit failures and failed cleanup fail the run. Retain raw failures. Report existing SQLite ceiling results separately; observations mode does not claim they pass or change them silently.

No numeric PGlite SLA is adopted here. KEY-109 includes the requested SQLite-versus-PGlite comparison; KEY-87 owns the complete operating envelope. Historical engine measurements remain background. KEY-88 owns final archives after KEY-96. This feature must still prove canonical asset inclusion and a working isolated interim consumer.

## SQLite-versus-PGlite comparison

Compare the current SQLite Local implementation with the replacement PGlite Local implementation. This is separate from the PGlite/native PostgreSQL behavior comparison.

- Before switching the default, pack the unchanged SQLite SDK and retain its source, lockfile, archive and engine identities. Reuse that immutable artifact after SQLite source removal; do not preserve a second production engine for benchmarking.
- Use the same reference host, Node version, pnpm version, workload inputs and measurement worker for both archives. Run each archive in its own clean external consumer with only its production dependencies. Record unavoidable build/source differences. Exclude Node itself from both installed sizes; SQLite's built-in engine has no additional npm payload, not zero total runtime cost.
- Report SDK archive bytes, total compressed dependency payload and installed production bytes, including PGlite WASM/data assets. Measure engine-added payload separately where attributable. Do not compare a dual-engine transition package against the final SQLite archive as if it were the final replacement.
- Measure installation time over five fresh consumer installs per engine using an isolated, prefilled package cache and the same install command. Exclude download time and state that boundary. Retain elapsed samples and process exits; network conditions must not masquerade as engine speed differences.
- Apply the startup/memory method above to both archives. For steady speed, repeat the measured request/settle batch five times in fresh instances, with identical funding and Resource definitions. Run one workload without Policy and one with the same compiled Policy/context. Verify equivalent successful results; record request latency, batch throughput and shutdown separately.
- Alternate engine order between trials and run one measured process at a time. Retain all samples and median/p95 with sample counts; five-trial p95 is the maximum, not a tail-latency guarantee.
- Retain one comparison table with metric, unit, SQLite value, PGlite value, absolute delta and percent delta, computed as `(PGlite - SQLite) / SQLite * 100`. A zero baseline yields N/A for the percentage. Lower is better for bytes, memory and elapsed time; higher is better for throughput. Report observed variation without claiming statistical significance or a performance improvement in advance.

Store the raw records and comparison beside the feature acceptance evidence. Missing either engine's required measurements leaves comparative acceptance incomplete. Initial compatibility-host costs remain separately labeled; the final decision uses comparable public SDK workloads and exact archives.

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
