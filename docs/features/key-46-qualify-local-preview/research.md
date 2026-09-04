# Research: Qualify local preview

This record resolves the technical choices needed to plan KEY-46. It qualifies one unpublished local ESM archive and does not design a general release system.

## R1. Package construction

**Decision**: Emit JavaScript and declarations from `packages/sdk/src/index.ts` with the existing TypeScript compiler, use an explicit `files` allowlist and root `exports` entry, and create a local archive with `pnpm pack`. Keep `private: true` and add no bundler.

**Rationale**: The public graph is ordinary Node.js ESM and already imports `.js` paths. TypeScript can emit it without another build dependency. npm's package format uses the `files` field to control archive contents, and `npm pack` exposes the exact file list and archive metadata without publishing ([package.json files](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files), [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/)).

**Alternatives considered**: A bundler adds code transformation and asset rules that the SDK does not need. Publishing to a registry adds namespace, credential, and immutability decisions outside this preview. Packing TypeScript source would make consumers execute repository compiler assumptions.

## R2. Database files

**Decision**: Compile with `packages/` as the build root, preserve the existing SDK-to-database directory relationship in `packages/sdk/dist/`, and use `node:fs.cp` in `scripts/build-sdk-package.ts` to copy `packages/database/` to `packages/sdk/dist/database/`. Compare every copied file with its canonical source before packing.

**Rationale**: The emitted installer can retain its existing relative lookup, checksum validation, migration order, and contract checks when the package layout preserves the source relationship. Node.js supplies the cross-platform copy operation, so the build needs no asset generator or runtime fallback.

**Alternatives considered**: A runtime repository-path fallback can load the wrong adjacent directory and hide missing package contents. A generated base64 module duplicates canonical bytes and adds generator drift. A custom archive transform adds machinery that the preserved directory layout does not need.

## R3. Clean-consumer proof

**Decision**: Install the exact archive into a temporary project outside the repository, use an explicit file dependency, change the child process working directory to that project, and compile and execute one package-root `consumer.mts`. Run package construction once and pass the archive path into every check.

**Rationale**: npm treats a tarball path as an installable package spec, so the same archive can be installed without a registry publication ([package specs](https://docs.npmjs.com/cli/v11/using-npm/package-spec/)). An external temporary project prevents workspace linking and repository-relative resolution from making a broken archive look valid.

**Alternatives considered**: A workspace consumer can resolve source files or symlinks. Repacking in each test loses exact-archive identity. Installing a package name from a registry would test a different artifact and require publication.

## R4. Support matrix

**Decision**: Qualify Node.js 24 and 26 ESM consumers on Linux x64, macOS arm64, and Windows x64. Use `ubuntu-24.04`, `macos-15`, and `windows-2025` in one explicit GitHub Actions matrix. Build the archive once, then download and digest-check it in every job.

**Rationale**: The repository already supports Node.js 24 through 26, but preview release claims should use the two long-lived lines rather than the intervening line. GitHub currently documents those runner labels and architectures, including arm64 for `macos-15` and x64 for the Linux and Windows labels ([GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). One archive avoids confusing cross-platform build reproducibility with consumer compatibility.

**Alternatives considered**: One Linux job cannot support macOS or Windows. Building separately on every runner can hide nondeterministic archives. Browser, bundler, CommonJS, Bun, Deno, Linux arm64, macOS x64, and Windows arm64 expand the preview without adopter evidence.

## R5. Measurement method

**Decision**: Use fresh Node.js child processes for cold creation and first-request samples, `performance.now()` for elapsed time, and `process.memoryUsage.rss()` for resident memory. Exclude three fresh-process warmups before collecting the 30 cold samples so host and file-cache initialization does not become application latency. Use one ready runtime for warm steady requests, retain all measured samples, and compute the nearest-rank p95 required by the acceptance limits.

**Rationale**: Node.js documents RSS as the process's resident memory and provides a direct `memoryUsage.rss()` reading ([Node.js process memory](https://nodejs.org/api/process.html#processmemoryusagerss)). Fresh processes isolate cold initialization from module and WebAssembly reuse. Fixed fixtures and a stated percentile rule make threshold failures reproducible enough for one named reference runner.

**Alternatives considered**: In-process cold loops reuse loaded code. Heap-only measurements omit WebAssembly and native allocations. A benchmark dependency adds a framework for four direct measurements. Dropping outliers after the run makes the evidence impossible to audit. Post-hoc retries select favorable evidence; a fixed pre-sampling warmup is declared before collection and applies identically to every run.

The initial hosted attempt measured 774,340,608 bytes p95 against the original 192 MiB ceiling. The preview ceiling was temporarily raised to 1 GiB so qualification can proceed without presenting the current footprint as the desired result. [GitHub issue #6](https://github.com/shubsharan/keynes/issues/6) owns profiling and the decision between upstream work, a reproducible Keynes-specific PGlite build, and a maintained fork; its required target is 512 MiB p95 and its stretch target is 384 MiB p95.

## R6. Evidence retention

**Decision**: Write one fixed-shape JSON measurement record and one workflow summary for each manual attempt, upload the archive and record as workflow artifacts, and add the accepted run URL plus its evidence boundary to `docs/roadmap.md`. Keep thresholds in checked-in tests and scripts. Do not add a schema version, generic summary map, redundant status field, checked-in feature report, or evidence service.

**Rationale**: The workflow run already binds the commit, jobs, runner logs, action versions, and attempt. The record adds the archive and contract digests, versions, raw samples, and derived percentiles needed to reproduce the claim. The roadmap remains the delivery-state authority.

**Alternatives considered**: A repository evidence database adds lifecycle and promotion rules before a second qualification consumer exists. CI logs alone are awkward for numerical review. A prose-only result loses machine-checkable samples and digests.

## R7. Verification lanes

**Decision**: Put generation drift, emitted graph tests, archive contents, and one clean Linux consumer in `pnpm verify`. Keep the six-environment matrix and performance measurements in a manual `workflow_dispatch` lane with read-only permissions and pinned actions.

**Rationale**: Every pull request should prevent a broken package, while cross-platform jobs and benchmarks are slower and have host variance. An explicit lane preserves the constitution's evidence classification and matches the repository's existing manual Platform qualification policy.

**Alternatives considered**: Running all six jobs and benchmarks on every pull request spends hosted capacity and turns noisy measurements into the default correctness loop. A local-only acceptance run cannot earn the declared operating-system support matrix.
