# Documentation

- **Owner:** `@shubsharan`
- **Status:** Nonfunctional documentation infrastructure
- **Functional status:** Documentation only in Epic 000

## Responsibility

`docs/` owns Keynes product, architecture, sequencing, decisions, and future
contributor guidance. Document ownership remains explicit: `product.md` owns the
product thesis and commitments, `architecture.md` owns runtime semantics and
boundaries, `roadmap.md` owns implementation order and evidence gates, and
accepted ADRs record durable architectural decisions.

Documentation describes the target system. It does not make unverified work
implemented by describing it.

## Allowed and public edges

The source-of-truth documents and accepted ADRs are the public documentation
edge. Other areas may link to them, but runtime code must not depend on Markdown
as an executable contract.

Feature specifications refine these documents without silently changing their
owned decisions.

## Private internals

Document organization, prose structure, and unpublished working material are
not runtime, protocol, or authority interfaces. An implementation must not infer
behavior from a draft or from documentation outside its owning source of truth.

## Source policy

Keep product value, runtime semantics, roadmap sequencing, and decision records
in their owning documents. Mark proposed, implemented, verified, failed,
skipped, and `NOT RUN` states honestly. Do not report provider, conformance,
security, packaging, performance, or runtime evidence that has not executed.

## Deferred work

Contributor guides, generated reference documentation, packaging guides, and
host qualification reports arrive with the epics that own their real behavior
and evidence. Epic 000 adds no generated documentation system.
