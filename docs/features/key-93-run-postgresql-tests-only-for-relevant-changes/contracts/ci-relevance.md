# CI relevance contract

This is the planned KEY-93 applicability contract. It is not implemented or hosted-
qualified at planning time. KEY-75 continues to own complete database execution,
cleanup, and evidence semantics; KEY-60 remains historical native-test context.

## Required result

Every `pull_request` revision produces one job named exactly
`SQLite and PostgreSQL behavior tests`. The workflow, job, and result have no path
filter, job-level skip, manual dispatch, schedule, label override, or alternate
required-check identity.

The job accepts exactly these passing states:

| Disposition      | Routing output        | Database steps | Database evidence                                   | Passing condition                                                        |
| ---------------- | --------------------- | -------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `relevant`       | `run_databases=true`  | All execute    | Existing five files plus confirmed artifact receipt | Existing paired gate and evidence chain succeed                          |
| `not-applicable` | `run_databases=false` | All skip       | None                                                | Complete validated classification and explicit `NOT RUN` summary succeed |

Missing, contradictory, empty, stale, malformed, or failed classification produces
a failed required result. There is no implicit disposition.

## Comparison input

Read `pull_request.base.sha` and `pull_request.head.sha` from the event payload,
validate both commits, and compute their merge base. Preserve the default pull
request merge checkout and validate checked-out `HEAD == GITHUB_SHA`.

Enumerate the complete source change set with:

```sh
git diff --name-status -z --no-renames <merge-base> <head-sha> --
```

The parser accepts well-formed NUL-delimited status/path pairs and valid relative
repository paths. Rename detection is disabled so a move is a deletion plus an
addition. A zero-path result rejects rather than proving irrelevance.

## Approved non-runtime paths

Rules are positive and exact. All unmatched paths are relevant.

| Path rule                          | Category            | Notes                                                                             |
| ---------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `docs/**`                          | documentation       | Includes product, architecture, contributor, ADR, feature, and evidence documents |
| `apps/web/src/**`                  | marketing-site      | Website source, assets, components, pages, and styles only                        |
| `apps/web/tests/**`                | marketing-site      | Website-only tests                                                                |
| `.specify/memory/**`               | spec-kit-record     | Governing Spec Kit records, not executable machinery                              |
| `AGENTS.md`                        | repository-metadata | Contributor and agent instructions                                                |
| `LICENSE`                          | repository-metadata | License text                                                                      |
| `.github/CODEOWNERS`               | repository-metadata | Review ownership only                                                             |
| `.github/PULL_REQUEST_TEMPLATE.md` | repository-metadata | Review template only                                                              |
| `apps/web/AGENTS.md`               | repository-metadata | Website contributor instructions                                                  |
| `apps/web/.gitignore`              | repository-metadata | Website-local ignored output only                                                 |

Explicit relevant examples include all `package.json` files, `pnpm-lock.yaml`,
workspace manifests, website and root toolchain configuration, `.gitignore`,
`.gitattributes`, `.dockerignore`, `.github/workflows/**`, `scripts/**`,
`packages/**`, `.specify` scripts/templates/extensions/integrations/configuration,
new top-level paths, and every other unknown path. One relevant path makes a mixed
revision relevant.

## Structured decision

The TypeScript boundary represents one closed union:

```ts
type ApprovedCategory =
  | "documentation"
  | "marketing-site"
  | "spec-kit-record"
  | "repository-metadata";

type RelevanceDecision =
  | {
      readonly disposition: "relevant";
      readonly paths: readonly ClassifiedPath[];
    }
  | {
      readonly disposition: "not-applicable";
      readonly paths: readonly ApprovedPath[];
    };
```

Pure functions parse diff records, classify paths, validate a complete decision,
and render safe summary data. The CLI owns event reading, Git execution, Actions
outputs, and summary writing. Exceptions exit nonzero and do not emit a successful
`not-applicable` output.

## Summary contract

Every summary identifies the checked-out merge candidate, event base/head, computed
merge base, disposition, and every changed path with its category or execution
reason. Paths are JSON-escaped before Markdown rendering.

A `not-applicable` summary includes these exact claims:

```text
SQLite: NOT RUN
PostgreSQL: NOT RUN
No database evidence was produced for this revision.
```

It creates no database report, manifest, artifact, receipt, reused reference, or
runtime-success statement.

## Relevant execution and failure

For `relevant`, pnpm setup, Node setup for the runner, frozen install, and
`pnpm test:sqlite-postgres -- --output "$RUNNER_TEMP/sqlite-postgres"` execute as
today. Artifact upload and receipt confirmation retain `always()` and also require
`run_databases == 'true'`. Setup, discovery, database startup, execution, cleanup,
evidence, upload, or receipt failure keeps the required result from passing.

This contract does not alter shared scenarios, native-only cases, retries,
cancellation, cleanup, sanitization, artifact paths, retention, public APIs,
database migrations, deployments, branch protection, or historical evidence.
