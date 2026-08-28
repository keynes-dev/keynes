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

### Lazy boolean repair evidence

- [x] PostgreSQL 18.6 skips a literal division-by-zero right operand after a
      row-dependent decisive `AND` or `OR` left operand.
- [x] Boolean rendering contains each child once. The depth-10 alternating
      expression stays below four times the rendered bytes at depth 6.
- [x] Detached clean snapshot `d1895bdd78ff2170289b421ea47a6dd7bfb64017`
      passed `CI=true pnpm check:repo`, `CI=true pnpm test:unit`, and
      `CI=true pnpm test:pr`.
- [x] The PostgreSQL package lane passed 21 tests for archive SHA-256
      `f7ddb48d8a19947d1c0e72cbcc7d497e6442d0f644bed9932c6079f7d559ff3a`.
- [x] The PostgreSQL 18.6 system lane passed 146 tests in 28 suites for its
      runner-owned archive SHA-256
      `82d5042ccc17ee65e72cb20f7654c4b984651a1251ec47bdb360212b6c81d7b1`.
- [ ] Private Cloud, managed-provider, cross-platform, upgrade and downgrade,
      security-qualification, and production-readiness lanes: `NOT RUN`.

## Cohesion

- [x] Contracts parsing, generation, and conformance fixtures have one named
      responsibility per authored module.
- [x] The SDK Policy compiler, validator, normalizer, and evaluator retain one
      public facade for each complete operation.
- [x] Budget projection and request preparation are separate from public types.
- [x] SQLite mechanics are separate from the transaction coordinator without
      splitting replay or mutation invariants across services.
- [x] PostgreSQL generation separates output orchestration, Policy rendering,
      Budget runtime generation, and secure wrappers.
- [x] Generated files and `policy-profile.json` remain generated artifacts or
      one authored semantic source rather than refactor targets.
- [x] Pure refactors leave generated output, canonical programs, SQL, and digests
      byte-identical.

## Test quality

- [x] The executable inventory pins every node, operator, function, backend
      responsibility, work declaration, and canonical-vector requirement.
- [x] Representative approval, denial, invalid Policy, evaluator failure, and
      replay tests assert exact wire results.
- [x] Malformed Context-schema tests assert exact paths and rules.
- [x] A curated shared corpus runs through the local interpreter and installed
      PostgreSQL renderer, with input-sensitive public-request oracles for both
      authorities.
- [x] Golden expectations do not call the production generator, renderer, or
      canonicalizer that they are intended to check.
- [x] Count-only, substring-only, partial-object, and duplicate tests are either
      strengthened, classified as drift checks, or removed.
- [x] Every retained test identifies a distinct failure mode or compatibility
      promise.

The executable coverage map is intentionally small: the machine-readable
profile and generation tests own the complete language inventory; generated
scalar vectors exercise the local interpreter; the shared runtime corpus
exercises local evaluation and the installed PostgreSQL renderer; public Budget
tests own request wiring, evidence, replay, and atomicity; rejection and
security suites own fail-closed and rollback behavior. Ten targeted faults
challenge the highest-risk links between those layers.

## Targeted fault probes

- [x] PostgreSQL evaluator parameters swapped: `killed` by the input-sensitive
      public request evidence (`6` became `4`).
- [x] One PostgreSQL arithmetic renderer changed: `killed` by shared runtime
      conformance (expected `10`, received `7`).
- [x] Canonical output ordering removed: `killed` by exact Resource ordering.
- [x] Replay moved after parent lookup or evaluation: `killed` by lock timeout.
- [x] One rollback checkpoint omitted: `killed` by the checkpoint table.
- [x] One declared Policy input holding left unlocked: `killed` by the required
      blocking relationship.
- [x] One undeclared output Resource accepted: `killed` by exact
      `invalid_result` and absent request state.
- [x] One unexpected evidence field appended: `killed` by three exact request
      wire assertions.
- [x] Local lowest-ceiling or tied-reason rule changed: `killed` by the tied
      ceiling denial oracle.
- [x] One profile descriptor or backend declaration removed: `killed` by the
      complete backend-responsibility inventory.

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
