# Data model: Repository organization

## Ownership area

An ownership area is one repository directory with one responsibility.

| Field            | Meaning                                                          | Validation                               |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `path`           | Canonical repository path                                        | Unique; no transitional alias            |
| `responsibility` | Product, source, tooling, package test, system test, or evidence | Exactly one                              |
| `workspace`      | Whether pnpm builds it as a product workspace                    | True only for SDK, PostgreSQL, and Cloud |
| `allowedInputs`  | Source or artifact dependencies                                  | Must preserve the declared direction     |
| `outputs`        | Product, generated files, or evidence records                    | Must stay under named owners             |

## Product distribution

A product distribution is one packed SDK archive or PostgreSQL command archive.

| Field                    | Meaning                           | Validation                             |
| ------------------------ | --------------------------------- | -------------------------------------- |
| `subject`                | `sdk` or `postgresql`             | Closed set                             |
| `archivePath`            | Tested tarball                    | One archive per attempt                |
| `sha256`                 | Archive identity                  | Recomputed before each consumer        |
| `files`                  | Exact archive inventory           | No undeclared file                     |
| `exports`                | Supported JavaScript import paths | SDK root only; PostgreSQL none         |
| `bin`                    | Installed executable              | PostgreSQL only, executable after pack |
| `productionDependencies` | Installed production graph        | SDK none; PostgreSQL `pg` only         |

## Test lane

| Field           | Meaning                                                                            | Validation                                           |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `kind`          | `unit`, `package-test`, `system-test`, or `measurement`                            | Closed set                                           |
| `subject`       | Repository, SDK, PostgreSQL, or Cloud                                              | Required                                             |
| `command`       | Canonical root command                                                             | No compatibility alias                               |
| `inputs`        | Source revision, archive, database profile, or environment                         | Explicit per lane                                    |
| `externalState` | Whether the lane starts Docker, uses hosted runners, or mutates an external target | Determines authorization and evidence classification |
| `output`        | Optional retained record path                                                      | Must match lane and subject                          |

## Evidence record

| Field            | Meaning                                                             | Validation                                                             |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `schemaVersion`  | Subject-specific schema identity                                    | Package-test and system-test schemas cannot substitute for one another |
| `sourceRevision` | Git commit and cleanliness                                          | Exact and rechecked after cleanup                                      |
| `artifact`       | Archive and contract/install digests                                | Required when an archive is tested                                     |
| `environment`    | Node, OS, architecture, PostgreSQL, and tool versions as applicable | Exact values                                                           |
| `scenarios`      | Required scenario names and results                                 | Exact inventory for retained acceptance                                |
| `exclusions`     | Explicit `NOT RUN` claims                                           | Secret-free and complete                                               |
| `outcome`        | Passed or failed                                                    | Failed attempts cannot look accepted                                   |

## Distribution publication

| State       | Meaning                                          | Allowed transition                          |
| ----------- | ------------------------------------------------ | ------------------------------------------- |
| `current`   | Previous complete `dist`, if any                 | To `backed-up` only after staging validates |
| `staged`    | Complete new compilation outside `dist`          | To `published` after validation             |
| `backed-up` | Previous `dist` held under a unique sibling path | To `published` or `restored`                |
| `published` | Complete staging tree promoted to `dist`         | Terminal after cleanup                      |
| `restored`  | Previous tree returned after publication failure | Terminal after cleanup                      |

Compilation or validation failure never leaves `current`. Publication failure must reach `restored`. Successful publication must reach `published` and remove staging and backup paths.
