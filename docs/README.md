# Documentation

- **Owner:** `@shubsharan`
- **Planning workspace:** [Keynes in Linear](https://linear.app/keynes)

## Responsibility

The repository and Linear have separate, explicit responsibilities:

| Source                              | Owns                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/product.md`                   | Product thesis and commitments                                                                                            |
| `docs/architecture.md`              | Runtime semantics and boundaries                                                                                          |
| `docs/adr/`                         | Accepted architectural decisions                                                                                          |
| `docs/features/`                    | Spec Kit specifications, plans, tasks, contracts, and retained evidence                                                   |
| [Linear](https://linear.app/keynes) | Projects, sequencing, current status, priority, assignment, dependencies, research studies, and current issue disposition |

Do not copy mutable Linear fields into repository documents. Do not move engineering contracts or retained exact-revision evidence into Linear. A feature specification uses one Linear issue as its identity. Internal task phases stay on that feature branch; they are not published as sub-issues. Each issue links to its specification and PR. See [the upstream Spec Kit workflow](adr/0010-upstream-spec-kit-workflow.md).

Historical feature artifacts remain revision-scoped records. Their old references to superseded planning files describe the workflow at that revision and do not restore those files as current sources of truth.

Documentation describes the target system. It does not make unverified work implemented by describing it.

## Contributor workflow

The [engineering workflow](workflow.md) defines how Linear selects and tracks work while Spec Kit owns durable feature delivery artifacts. Existing engineering skills supply focused investigation, design, review, and verification without a separate lifecycle.

## Source policy

Mark proposed, implemented, verified, failed, skipped, and `NOT RUN` evidence honestly. Accepted evidence in Git must identify its source revision and boundary. Linear may summarize or link to that evidence, but the feature artifact remains authoritative for the engineering claim.

Local archives, measurements, and test records are transient output under the ignored `.artifacts/` tree. CI owns uploaded run artifacts. When an accepted record supports a durable feature claim, retain only that record beside the owning feature documentation.
