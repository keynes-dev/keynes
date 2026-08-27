# FEAT-0012 post-implementation review

**Baseline**: `c491ae0aa34bf25a29cad7cdadbe3792adcf9fed`
**Base pull request**: [#14](https://github.com/shubsharan/keynes/pull/14)
**Method**: forward-only stacked review with exact-revision evidence

This checklist records review results. It does not replace the feature
specification, plan, tasks, or acceptance record. A checked item means the
named evidence passed at the recorded review revision.

## Logic

- [x] Kysely and raw SQL produce the same program, canonical SQL, source digest,
      and definition digest for equivalent Policies.
- [x] Runtime validation distrusts supplied Policy artifacts and recomputes
      their canonical identity and scope.
- [x] Local and PostgreSQL evaluation agree on nulls, decimals, ordering,
      grouping, aggregation, work limits, failures, and result rows.
- [x] Exact replay returns before current Budget lookup, Policy validation,
      evaluation, availability checks, locking, or mutation.
- [x] Omitted and empty Policy sets are equivalent, declaration order is not
      semantic, and material Context or Policy changes conflict.
- [x] Parent Policies govern the current request; child Policies are explicit
      future state and do not govern their own creation.
- [x] Approval, denial, fail-closed errors, and settlement retain their documented
      transaction and evidence behavior.
- [x] Local `BEGIN IMMEDIATE` and caller-owned PostgreSQL transactions preserve
      command, Budget, holding, history, evidence, and result atomicity.
- [x] PostgreSQL executes only generated SQL with request, availability, and
      Context supplied as parameters.
- [x] No-Policy command, result, history, replay, and Cloud behavior remain
      compatible.

## Cohesion

- [x] Contracts parsing, generation, and conformance fixtures have one named
      responsibility per authored module.
- [ ] The SDK Policy compiler, validator, normalizer, and evaluator retain one
      public facade for each complete operation.
- [ ] Budget projection and request preparation are separate from public types.
- [ ] SQLite mechanics are separate from the transaction coordinator without
      splitting replay or mutation invariants across services.
- [ ] PostgreSQL generation separates output orchestration, Policy rendering,
      Budget runtime generation, and secure wrappers.
- [ ] Generated files and `policy-profile.json` remain generated artifacts or
      one authored semantic source rather than refactor targets.
- [x] Pure refactors leave generated output, canonical programs, SQL, and digests
      byte-identical.

## Test quality

- [ ] The coverage matrix names every node, operator, function, null rule,
      numeric boundary, work branch, source form, and rejection family.
- [ ] Representative approval, denial, invalid Policy, evaluator failure, and
      replay tests assert exact wire results.
- [ ] Malformed Context-schema tests assert exact paths and rules.
- [ ] A curated shared corpus runs through the public request path in both
      authorities where the contract requires parity.
- [ ] Golden expectations do not call the production generator, renderer, or
      canonicalizer that they are intended to check.
- [ ] Count-only, substring-only, partial-object, and duplicate tests are either
      strengthened, classified as drift checks, or removed.
- [ ] Every retained test identifies a distinct failure mode or compatibility
      promise.

## Targeted fault probes

- [ ] PostgreSQL evaluator parameters swapped.
- [ ] One PostgreSQL arithmetic renderer changed.
- [ ] Canonical output ordering removed.
- [ ] Replay moved after parent lookup or evaluation.
- [ ] One rollback checkpoint omitted.
- [ ] One declared Policy input holding left unlocked.
- [ ] One undeclared output Resource accepted.
- [ ] One unexpected evidence field appended.
- [ ] Local lowest-ceiling or tied-reason rule changed.
- [ ] One profile descriptor or backend declaration removed.

Each probe must be recorded as `killed`, `survived`, or `INCONCLUSIVE`. A
surviving in-contract fault blocks completion.

## Final evidence

- [ ] `CI=true pnpm check:repo`
- [ ] `CI=true pnpm test:unit`
- [ ] `CI=true pnpm test:pr`
- [ ] SDK package qualification and measurement use one exact archive.
- [ ] PostgreSQL package and PostgreSQL 18.6 system tests use one exact archive.
- [ ] Private Cloud regression names the exact PostgreSQL subject.
- [ ] The acceptance record names the clean final source revision and every
      executed or `NOT RUN` lane without reusing older evidence.
