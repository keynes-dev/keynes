# Testkit

- **Owner:** `@shubsharan`
- **Status:** private repository test dependency

`@keynes/testkit` owns utilities used to qualify built and packed Keynes packages. Production packages must not import it.

## Exports

| Export         | Responsibility                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `archive`      | Read and validate gzip-compressed tar package entries                                                       |
| `distribution` | Atomically replace a staged distribution and restore the previous tree on failure                           |
| `package`      | Pack workspaces, install exact archives into clean temporary consumers, run installed commands and clean up |
| `process`      | Wait for or terminate native child-process groups during cancellation                                       |
| `report`       | Reject incomplete Vitest JSON reports and return passed files and assertions                                |

The root export re-exports the supported archive, package, process and report helpers. `distribution` remains a named subpath because build scripts consume it directly.

## Ownership boundaries

Callers choose the package, command, environment and evidence path. Testkit owns temporary workspaces it creates and exposes `close()` for deterministic cleanup. It does not define which verification lanes a package must pass, interpret product behavior, or turn a source test into packed-archive evidence.

Keep package-specific assertions with the package. Add a testkit helper only when multiple qualification paths need the same lifecycle or artifact operation; otherwise use the standard library in the owning test.

See the [testing reference](../../docs/testing.md) for lane selection and evidence meaning.
