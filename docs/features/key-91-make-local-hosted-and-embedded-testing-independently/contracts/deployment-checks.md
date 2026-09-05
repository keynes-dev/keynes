# Contributor command contract

## Status and interface

This is the reduced target approved on 2026-09-05. Local and Hosted now implement it. T057-T061 remain pending. The current native
commands still require their earlier output flags;
see Git at `a50ee5b` for that historical interface. Do not add compatibility
machinery for the superseded feature-branch interface.

| Target command                                | Owner      | Selected feedback                                                                             |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `pnpm test:local`                             | SDK        | Existing Local/public/Policy unit groups and shared Budget aggregate. No package preparation. |
| `pnpm test:remote`                            | PostgreSQL | Existing remote native suite groups, all connection modes.                                    |
| `pnpm test:remote -- --mode direct`           | PostgreSQL | Same relevant remote groups, direct connection selection and no pooler.                       |
| `pnpm test:remote -- --mode session-pool`     | PostgreSQL | Selected session pooler only.                                                                 |
| `pnpm test:remote -- --mode transaction-pool` | PostgreSQL | Selected transaction pooler only.                                                             |
| `pnpm test:embedded`                          | PostgreSQL | Canonical Budget and Embedded transaction fixtures, zero poolers.                             |
| `pnpm test:embedded -- --installed`           | PostgreSQL | NOT RUN with KEY-10/KEY-11 prerequisite reason; exit 1 before setup.                          |
| `pnpm test:hosted`                            | SDK        | NOT RUN: supported Hosted product runner unavailable; exit 1 without work.                    |

Remote also accepts `--mode all`. Native selection and Hosted accept standalone
`--help`. Reject unknown/repeated native or Hosted options before setup. Feedback
has no required output directory and no archive, target, or credential options.
It does not emit `keynes.deployment-test/v1`. The new contributor command surface
is limited to selection; existing full/package commands keep their interfaces.

## Suite ownership

Local selects `test/unit/local`, `test/unit/public`, `test/unit/policy`, and
`test/contract/budget.test.ts` under the SDK. Select all test files in those directories, including provider-free public remote
API tests. Keep canonical registration and test names; do not copy assertion names
into a new registry. Other remote and tooling suites remain in the package's
normal test command.

Remote selects the PostgreSQL Budget aggregate; integration installation,
recheck and remote identity; and system remote connections, Budget, recovery and
security. Register only selected connection profiles. Reuse the existing native
scenario map and fixture setup; no separate TLS phase or SDK consumer is added.
Embedded selects the Budget aggregate and `embedded-transactions.test.ts`, whose
14 transaction assertions retain fixture-provided permissions.

The full native runner keeps its default complete selection: the existing 16
files, canonical Budget aggregate and 171 native-only names at the baseline.
Full paired acceptance retains exact shared-name parity. Feedback prints its
selected files/modes and limitations, uses ordinary test results, and fails for
missing selected suites, unexpected skips, failed tests or cleanup. It cannot
produce the full acceptance record. Do not add another durable validator to
prove this distinction.

## Separate acceptance

Use existing `test:package:sdk` qualification with its archive/output options for
installed SDK proof outside source resolution. Native fixtures retain their
existing installed PostgreSQL CLI setup. Use `test:sqlite-postgres` for complete
paired acceptance with its required output path. These commands retain their
current evidence, source/artifact identity and cleanup requirements.

Remote installed SDK/TLS acceptance is deferred after removal of the new
consumer system. Native SQL fixtures do not replace that proof. Installed
Embedded remains unavailable pending KEY-10/KEY-11. Hosted remains unavailable;
a database URL or a GitHub-hosted job cannot enable it. Existing package OS/Node
and external qualification workflows remain separately owned.

Hosted delivery must later supply its product/target identity, provisioning owner,
isolated scope, approved credentials, verified TLS, explicit mutation/spend
authorization, and cleanup ownership. This feature documents those prerequisites
without implementing or executing them. No automatic fallback is permitted.

See the [development model](../plan.md#development-as-modes-mature) for adding behavior.
Use the [assertion disposition map](../research.md#assertion-disposition-before-deletion) before deleting tests.
