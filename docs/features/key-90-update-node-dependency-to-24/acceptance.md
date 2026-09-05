# KEY-90 local verification

Implementation is local and uncommitted on `main`, based on
`6dba2517580da18a088a22f0b05c95bdf594ea0a`. See
[source file hashes](evidence/source-files.json) for the changed implementation.
These results describe that working tree, not the unchanged base commit.
Artifacts are local-only; no Linear artifact links were published.

## Results

| Check                                                                                                           | Runtime                 | Result                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| Focused regression tests before implementation                                                                  | 26.5.0                  | Expected failure: Node 25 and 27 preflight, packed engine range; 3 failed, 85 passed |
| `pnpm install --frozen-lockfile`                                                                                | 25.4.0                  | PASS, pnpm 11.21.0, engine enforcement enabled                                       |
| `pnpm exec vitest run scripts/run-conformance.test.ts packages/sdk/test/package/qualify.test.ts --maxWorkers=1` | 25.4.0                  | PASS, 88 tests                                                                       |
| `pnpm test:pr`                                                                                                  | 25.4.0                  | PASS, provider-free tests, generation, formatting, lint, types, and boundaries       |
| `pnpm build:sdk` and `pnpm pack:sdk`                                                                            | 24.11.0                 | PASS                                                                                 |
| Clean consumer of the same packed archive                                                                       | 24.11.0, 25.4.0, 26.5.0 | PASS on macOS arm64                                                                  |

For each of the three installed runtimes, with its binary directory first on PATH:

```sh
node packages/sdk/test/package/qualify.ts \
  --archive .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz \
  --output .artifacts/key-90/consumer-nodeVERSION.json
```

The retained records are [Node 24](evidence/consumer-node24.11.0.json),
[Node 25](evidence/consumer-node25.4.0.json), and
[Node 26](evidence/consumer-node26.5.0.json). They cover installation outside the
workspace, public types, parser loading, Budget and Policy operations, isolation,
closure, process loss, and rejected private imports. Their common archive SHA-256 is
`671ccf4fb973eb421a3ccf6bf0dcef3e503c3bda55a8e53fe5d085e94320341e`.

Raw local command logs are under `.artifacts/key-90/`. Node 27 in the unit fixture
proves that the major-version guard has no upper bound; it is not a Node 27 runtime run.

## Evidence boundaries

Hosted Linux, Windows, and the complete minimum/latest matrix are **NOT RUN**.
The workflow now selects `latest` and retains per-consumer JSON alongside the
existing common archive. Local Node 26.5.0 is an installed test target, not a claim
that it is the latest release available upstream.

Native PostgreSQL conformance, external database qualification, and performance
measurement are **NOT RUN**. No Budget or database behavior changed. Existing
provider-free regression and consumer tests do not replace those independent lanes.
No source revision was committed or published, so full hosted acceptance and issue
completion remain outstanding.

Spec, plan, and tasks were checked together before implementation: all four
requirements had task coverage, with no unresolved ambiguity or conflicting
acceptance criteria. The requirements checklist passed. The user explicitly
requested implementation on `main` instead of the usual issue branch.
