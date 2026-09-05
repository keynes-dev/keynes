# Contributor contract: deployment checks

The Local command is implemented. Remote, Embedded and Hosted entrypoints remain planned until their implementation phases. These commands are contributor interfaces, not public SDK additions.

The [required testing-strategy study](../plan.md#required-study-before-downstream-implementation) may refine command composition and focused-feedback invocations before downstream implementation. It must preserve default-all remote coverage, installed-consumer acceptance, unavailable product boundaries, and the full gate. Update this contract with any adopted design changes; a focused feedback result cannot replace deployment acceptance.

## Commands

Run from the repository root. Every selected command requires `--output <new-directory>`. Paths resolve from the repository root, including when a root alias delegates to a package. Existing output destinations are refused.

| Root command                                            | Package owner     | Selection and options                                                                                                                  |
| ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:local -- --output <dir>`                     | SDK               | Local source tests and installed consumer; optional `--sdk-archive <file>`                                                             |
| `pnpm test:remote -- --output <dir>`                    | PostgreSQL        | All remote modes; optional `--mode all\|direct\|session-pool\|transaction-pool`, `--sdk-archive <file>`, `--postgresql-archive <file>` |
| `pnpm test:embedded -- --output <dir>`                  | PostgreSQL        | Embedded fixtures; optional `--postgresql-archive <file>`; `--installed` requests unavailable installed-profile acceptance             |
| `pnpm test:hosted -- --output <dir>`                    | SDK               | Unavailable Hosted product acceptance; no database target option is supported in this feature                                          |
| `pnpm test:system:postgresql -- --output <new-file>`    | PostgreSQL        | Existing complete native execution, unchanged                                                                                          |
| `pnpm test:sqlite-postgres -- --output <new-directory>` | Root coordination | Existing full paired gate, unchanged                                                                                                   |

Reject unknown options, repeated options, empty values, unsupported modes, and incompatible selection options before fixture creation. The optional pnpm `--` separator is normalized once. `--help` succeeds without creating an attempt. No command reads ambient service credentials to choose or change a deployment.

Archives omitted by a caller are built and packed into per-attempt locations under the shared preparation lock. Supplied archives are inspected, hashed, and installed outside the repository. Their source provenance is not inferred from the working checkout.

## Required inventories

### Local

Run `packages/sdk/test/contract/budget.test.ts`, `test/unit/local`, `test/unit/policy`, and these public tests under the SDK owner: `local.test.ts`, `policy-api.test.ts`, `budget-projection.test.ts`, `generated-client.test.ts`, and `public-exports.test.ts`.

The fixed inventory in `packages/sdk/test/system/required-scenarios.ts` contains 244 assertions across 18 files and is validated independently of the observed report. Reuse `registerBudgetContractTests`; do not copy shared Budget assertions. Run the existing installed archive qualifier without `--authorized-database`. Its provider-free packaging/export checks are part of Local acceptance and do not require a remote service.

### Remote PostgreSQL

The fixture inventory contains the canonical native Budget aggregate; integration `installation`, `recheck`, and `remote-identity`; and system `remote-connections`, `remote-budget`, `remote-recovery`, and `remote-security`. The baseline default contains 68 named native assertions plus the shared aggregate.

`all` resolves to direct, session-pool, and transaction-pool. Other modes require an explicit selection. Preserve the original full/default-all connection assertions. Narrower runs materialize only their mode-specific assertions and pooler probes. Unselected modes are exclusions, not skipped assertions. A missing selected mode fails; no fallback is allowed.

The separate installed SDK phase runs declared consumer cases for every selected mode. Cases cover successful verified connection and Budget workflow, distinct identity/tenant isolation, reconnect and exact replay, conflicting reuse, unavailable endpoint, wrong CA, and wrong hostname. SQL fixtures cannot substitute for these consumer cases. Consumer setup uses the installed PostgreSQL CLI and supported administration; tested calls use the installed SDK package root.

Direct-only starts no pooler. A selected pool mode starts its pooler and the PostgreSQL backend. Default all starts both poolers. The plaintext fixture and TLS consumer phases run sequentially and each owns its cleanup.

### Embedded

Run the canonical native Budget aggregate and all 14 `embedded-transactions` scenarios. No remote pooler or remote SDK credentials are required. Report existing application-role grants as fixture-provided. Supported installed-profile permission and transaction acceptance remains NOT RUN pending its owner implementations.

`--installed` returns non-success with that prerequisite reason before provisioning. A supplied PostgreSQL archive alone does not establish Embedded support or enable this option.

### Full native and paired checks

Keep all 16 native files, 171 explicitly named native-only assertions, and the canonical Budget aggregate at the research baseline. The original full validator must reject every selected report that omits any full scope. Inventory growth must preserve baseline coverage; no existing assertion may disappear because it belongs to neither smaller selection. Keep Policy, contention, rollback, installation, and remote security coverage.

## Outcome and evidence

Selected commands write `keynes.deployment-test/v1` manifests as defined in [data-model.md](../data-model.md). Exit 0 requires exact passing requested coverage, stable source inputs, valid evidence, and successful cleanup. Exit 1 covers invalid requests, execution/validation failures, and unavailable requested acceptance. No required skipped or unexecuted test can produce exit 0.

A passing Embedded fixture selection explicitly excludes installed-profile acceptance. A passing narrower remote run excludes the other modes. Neither result qualifies full acceptance. Existing full records retain `keynes.system-test.postgresql/v1` and `keynes.sqlite-postgres/v1` and their current stricter clean-source rules.

SIGINT/SIGTERM stop new work and begin bounded cleanup. Preserve the native runner's existing termination/readiness limits. Forced termination may leave incomplete evidence; it cannot qualify. An existing output path is never overwritten. Failed cleanup records failure even when all assertions passed.

## Hosted boundary

This feature's Hosted entrypoint always reports `NOT RUN: supported Hosted product runner unavailable`, exits 1, and performs zero provisioning or database mutation. It must behave the same when ambient database credentials are set. It cannot redirect to a local fixture or the authorized-database SDK walkthrough.

Hosted delivery must establish all of the following before enabling actual execution:

- The product environment identifier, endpoint ownership, deployed source/artifact identity, and supported connection modes.
- A provisioning owner, pre-existing target or authorized provisioning procedure, and isolated disposable test scope.
- Credential delivery through an approved secret boundary; ordinary scoped credentials for consumer calls and separate administration where required.
- Verified TLS using the supported SDK configuration, with no insecure fallback.
- Explicit authorization binding the plan, inputs, target, credential scope, spend/mutation ceiling, and retained evidence location.
- Cleanup ownership for success, failure, cancellation, and runner loss, including any resource that cannot be automatically removed.

The later product feature must supply concrete values and tests for those boundaries. This document does not authorize live execution or claim that product support exists.

## Study disposition and ownership

The completed [study](../testing-strategy.md) removes only duplicate contracts
execution in `test:pr`. The standalone `test:generator` alias remains; all 51
contracts assertions run through Turbo. Existing SDK `test:unit` and
`test:contract` commands remain source-feedback entrypoints. None qualifies
installed deployment acceptance. No new feedback registry or discovery is needed.

Local is implemented. The other independent commands remain pending. Their
runners own schema construction, expected coverage and exclusions. Shared testkit
helpers own only neutral mechanics. Full evidence validation, native fixture
installation/recheck, the 171 native-only names and 37 shared names remain
unchanged by the pilot. Packaging and broad Policy-test consolidation are deferred.
