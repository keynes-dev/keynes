# KEY-80 acceptance evidence

Implementation is authorized phase by phase. This record begins with the Phase 1
baseline only; it does not qualify the journal behavior.

## Phase 1: baseline and compatibility owners

- Branch: `key-80-make-the-journal-authoritative-for-quantities`
- Source revision: `3f5792fcff5a257b07a368866badce9d593750f3`
- Checkout: clean before Phase 1 documentation changes
- KEY-76 merge `70beb791bb81dd07438d69f7f80766ee97b79318`: ancestor verified
- KEY-96 merge `3c47555e124a35844b448ba221f01f8a199109df`: ancestor verified
- Host: Darwin 25.5.0 arm64; Node v25.9.0; pnpm 11.21.0; Docker 29.6.2

`packages/database/contract.json` is the canonical contract source. Its
generated PostgreSQL installation identity is
`packages/postgres/generated/installation-record.json`; the PostgreSQL package
generator copies that record from `packages/database/postgres/generated/`.
The installer reads the package copy and exact recheck compares its recorded
contract, migration, and procedure identities. These are the compatibility
owners for this feature.

| Input                                                  | SHA-256 or generated identity                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `packages/database/contract.json`                      | `17c11670dbaf042f29a8f546beab401a3c76b920c4100cf07b01c26164b18e5d` |
| Canonical command contract digest                      | `046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766` |
| Remote procedures digest                               | `b72a9058b6f827d859168932e6f8c04fedc312f79bef7cb59ebb685478d4eedd` |
| Migration-set digest                                   | `71a32dd66d2397ac75f4d2e4af8328d15e2fbc7843b15c5105bbbe0b275f48ed` |
| `packages/postgres/generated/installation-record.json` | `697d33397996f6f38a860a4e50e5105d753b82f068a0bfe8d903e2c8689f60b9` |
| `pnpm-lock.yaml`                                       | `8b41bae2ceb5a512d858f0eeabe6738ae8b43117c5db9392a3c85720a4cb2235` |

The generated installation record specifies profile
`embedded-postgresql-18.6-preview`, server version `180006`, and migration
`0001-baseline` with SHA-256
`87536ca5a29dbd6569440644bf8f6e9e64483836f571496dc07fbc62343c4fca`.

| Command                                                                               | Outcome                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` | PASS: selected the KEY-80 feature directory; `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `tasks.md` present. No extension hooks. |
| Feature checklist                                                                     | PASS: 15 checked, 0 unchecked.                                                                                                                          |
| `pnpm install --frozen-lockfile`                                                      | PASS.                                                                                                                                                   |
| `pnpm generate:check`                                                                 | PASS.                                                                                                                                                   |
| `pnpm --filter @keynes/node-sqlite test`                                              | Initial setup failure before behavioral assertions: the baseline checkout lacked built `@keynes/sdk` exports. This is not RED evidence.                 |
| `pnpm build:sdk && pnpm --filter @keynes/node-sqlite test`                            | PASS: 5 files, 194 existing baseline tests. This is setup confirmation, not KEY-80 behavioral qualification.                                            |
| `pnpm test:ci:postgresql`                                                             | PASS: 12 files, 274 existing baseline tests; test process and cleanup passed. This is setup confirmation, not KEY-80 behavioral qualification.          |

## Phase 1 review

Parent correctness review: PASS, setup evidence is explicitly distinguished from feature qualification. Ponytail review: Lean already. No implementation was included in this phase.

## Phase 2: private fault support

Source revision before this phase: `51d9f70`. Added the private
`after_quantity_movement` and `after_ancestor_finalization` fault stages, and
passed `ContractClientOptions` into native caller-owned attempts. The stages
are declarations only until the real SQLite and PostgreSQL journal paths emit
them in T012 and T013. Concrete journal facts also wait for those real rows;
this phase adds no empty, optional, or legacy-derived journal observation.

| Command                                                 | Outcome                           |
| ------------------------------------------------------- | --------------------------------- |
| `pnpm generate`                                         | PASS                              |
| `pnpm generate:check`                                   | PASS                              |
| `pnpm --filter @keynes/database typecheck`              | PASS                              |
| `pnpm --filter @keynes/node-sqlite typecheck`           | PASS                              |
| `pnpm --filter @keynes/postgres typecheck`              | PASS                              |
| `pnpm --filter @keynes/node-sqlite test -- --runInBand` | PASS: 5 files, 194 existing tests |

The SQLite suite checks that the new stage declarations preserve the current
host and shared behavior. It does not qualify journal accounting or cascade
rollback, which remain **NOT RUN** until the journal implementation and
behavioral tests land.

Parent correctness review: PASS. Ponytail review removed one redundant object spread from the native caller context; no remaining complexity findings.

## Runtime evidence

All KEY-80 behavioral and runtime qualification lanes are **NOT RUN** at this
revision: SQLite shared scenarios, native PostgreSQL system scenarios,
replay/conflict/rollback, contention, permissions and tenant isolation,
remote recovery, Embedded caller transactions, SDK/public types, clean package
consumers, paired SQLite/PostgreSQL comparison, and the final `test:pr`,
`test:sqlite-postgres`, `test:embedded`, and `test:package:split` commands.

Hosted and Embedded release readiness, live providers, cross-authority recovery,
Node/OS matrices, managed-provider qualification, performance qualification,
registry publication, and production operations are also **NOT RUN**. Historical
KEY-76 and KEY-96 evidence remains revision-scoped and does not qualify KEY-80.
