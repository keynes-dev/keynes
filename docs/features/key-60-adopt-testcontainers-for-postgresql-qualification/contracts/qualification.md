# Native testing command and evidence compatibility

This preserves developer commands and existing acceptance records. No product API,
migration, deployment contract, or evidence schema is introduced.

## Commands

| Invocation from repository root                         | Behavior after simplification                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm test:remote` or `pnpm test:remote -- --mode all`  | Source feedback, direct and both pooled modes, two poolers, zero packaging                 |
| `pnpm test:remote -- --mode direct`                     | Source feedback, zero poolers, zero packaging                                              |
| `pnpm test:remote -- --mode session-pool`               | Source feedback, one session pooler, zero packaging                                        |
| `pnpm test:remote -- --mode transaction-pool`           | Source feedback, one transaction pooler, zero packaging                                    |
| `pnpm test:embedded`                                    | Existing source Budget/transaction selection, zero poolers, zero packaging                 |
| `pnpm test:embedded -- --installed`                     | Existing unavailable refusal, nonzero exit and zero acquisition                            |
| `pnpm test:system:postgresql`                           | Full native inventory, existing archive preparation and installed-path proof, both poolers |
| `pnpm test:system:postgresql -- --output <new-file>`    | Full checks and existing immutable acceptance record plus sidecars                         |
| `pnpm test:sqlite-postgres -- --output <new-directory>` | Existing paired SQLite/PostgreSQL acceptance and manifest                                  |

Preserve current help, invalid-mode and unsupported-combination refusals. Selected
feedback cannot accept full evidence options or emit full acceptance. Local feedback
and the Hosted unavailable command retain their behavior. CI keeps `Repository and
tests` and `SQLite and PostgreSQL behavior tests` names.

## Service and fixture contract

- One PostgreSQL startup per invocation, only selected poolers, existing image digests,
  PostgreSQL version probe and usable SQL endpoints.
- For Testcontainers adoption, standard Vitest setup/context/teardown and enabled Ryuk.
  Controlled Docker defaults and observed bindings must keep PostgreSQL, poolers, and
  active Ryuk on loopback, with no wildcard IPv4/IPv6 exposure.
- Fresh invocation resources and per-test database/role state; stopping one concurrent
  invocation cannot interrupt another. No persistent reuse or template databases.
- Ordinary fixtures install once. Dedicated installer tests retain no-op/recheck/drift
  and rollback proof. Multi-session behavior and caller-owned transactions remain real.
- Normal startup/test/cleanup failures produce nonzero results. Cancellation cannot
  qualify. Forced loss has no custom bounded resource-absence guarantee.
- Adopt exactly one lifecycle. If the pilot fails its gates, remove it and retain the
  existing Docker implementation with the verified preparation reductions.

## Evidence contract

Preserve `keynes.system-test.postgresql/v1`, `<output>.vitest.json`,
`<output>.observations.json`, and the paired manifest/report formats.

Only full passing coverage from the unchanged candidate, exact prepared archive,
successful test completion and cleanup, and safe validated content may qualify.
Retain package allowlists, production dependency boundaries, source-drift checks and
exclusive writes. Missing, skipped, failed, duplicate or incomplete results fail.
Existing output files are never overwritten.

Feedback is source-test evidence. Full acceptance retains each test's existing
source or installed-artifact scope; using a packed PostgreSQL CLI is not proof of
installed SDK or additional installed Embedded consumers. Record the distinction in
the acceptance narrative without inventing a new schema.

Keep existing safe environment/image observations. Credentials, private URLs,
environment dumps, raw inspect output and library errors containing secrets must
not reach logs or retained records. Verify with secret sentinels, including debug
settings. The focused binding check retains only binding addresses and safe identity.

External TLS, additional installed-consumer coverage, Hosted, backup, failover and
production qualification remain outside KEY-60 and `NOT RUN`.
