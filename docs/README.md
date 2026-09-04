# Documentation

- **Owner:** `@shubsharan`
- **Status:** Nonfunctional documentation infrastructure
- **Functional status:** Documentation only in FEAT-0001

## Responsibility

`docs/` owns Keynes product, architecture, sequencing, research agenda, decisions, and future contributor guidance. Document ownership remains explicit: `product.md` owns the product thesis and commitments, `architecture.md` owns runtime semantics and boundaries, `roadmap.md` owns implementation order and evidence gates, [research.md](research.md) owns the proposed research program, and accepted ADRs record durable architectural decisions.

`docs/features/` contains the specification, plan, tasks, and supporting design records for each numbered Spec Kit feature. `roadmap.md` groups those features into unnumbered stages with shared outcomes and exit gates. Keynes does not maintain a separate epic artifact or lifecycle.

The roadmap can name planned features before Spec Kit starts them. Planned features have no number, branch, or feature directory.

The [current-system assessment](current-system-assessment.md) is a revision-scoped discovery snapshot. The [current issue register](current-issue-register.md) validates its observations and historical review comments against one mainline revision. Neither document owns a product, architecture, roadmap, or feature decision.

Documentation describes the target system. It does not make unverified work implemented by describing it.

## Contributor workflow

The [engineering workflow](workflow.md) defines how Spec Kit owns feature delivery while pstack supplies focused investigation, design, review, and verification methods inside each phase. The guide is a checked-in workflow contract. The project-local skill files remain workstation-local and ignored by Git.

## Allowed and public edges

The source-of-truth documents and accepted ADRs are the public documentation edge. Other areas may link to them, but runtime code must not depend on Markdown as an executable contract.

Feature specifications refine these documents without silently changing their owned decisions.

## Private internals

Document organization, prose structure, and unpublished working material are not runtime, protocol, or ownership interfaces. An implementation must not infer behavior from a draft or from documentation outside its owning source of truth.

## Source policy

Keep product value, runtime semantics, roadmap sequencing, and decision records in their owning documents. Mark proposed, implemented, verified, failed, skipped, and `NOT RUN` states honestly. Do not report provider, conformance, security, packaging, performance, or runtime evidence that has not executed.

Local archives, measurements, and test records are transient output under the
ignored `.artifacts/` tree. CI owns uploaded run artifacts. When an accepted
record supports a durable feature claim, retain only that record beside the
owning feature documentation and preserve its revision and evidence boundary.

## Deferred work

Generated reference documentation, packaging guides, and host qualification reports arrive with the stages that own their real behavior and evidence. FEAT-0001 adds no generated documentation system.
