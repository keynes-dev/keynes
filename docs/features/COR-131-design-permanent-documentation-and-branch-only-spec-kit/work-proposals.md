# Bounded writing and removal proposals

These bounded outcomes supply the implementation phases in `tasks.md`. W labels remain design references; the task list owns execution order, review and commit checkpoints.

## W1: Publish the shared Resource, Budget and command references

**Inputs**: KEY-43/54/56/77/78/80/84/113/114 and current canonical source/shared scenarios.

**Owned output**: `docs/reference/accounting.md`, `docs/reference/commands.md`; replace detailed duplicate product/architecture sections with links. Preserve rationale beside its topic or in an existing ADR. W1 owns shared semantics only.

**Acceptance**: Every shared operation, Resource/Budget lifecycle transition, journal projection, validation/error boundary, replay/evidence rule and inspection meaning has one owner. Explicit-zero and omission, overage, ancestor finalization, replayed denials and no external-effect guarantees are covered. Source, accepted contracts and both-engine scenarios agree. No API or runtime behavior changes and no directory deletion.

**Prerequisites**: Approved COR-131 ownership design. Coordinate product-boundary wording with accepted COR-127 reconciliation.

## W2: Reconcile product, architecture and package navigation

**Inputs**: Current product/architecture/index/root README, KEY-44/49/52/53/96, accepted public boundary and COR-129 layout outcome.

**Owned output**: Product vision/commitments, architecture component/dependency explanation, documentation owner index, package inventory, database/testkit contributor guides. Public-safe superseding product/licensing ADR belongs to the separate COR-127 adoption owner; link it without copying internal planning.

**Acceptance**: Every actual package and CLI has one navigation entry and owner; policy is included; database/testkit remain source-visible internal workspaces, not implied published packages. Local/Hosted/Embedded remain distinct from product offering. Product and architecture link to W1's detailed rules. No private implementation dependency or invented package move.

**Prerequisites**: W1 shared destinations and approved package layout. If COR-129 changes paths, revise the destination map before writing.

## W3: Complete SDK, Local and Policy package documentation

**Inputs**: Current manifests/exports/tests; KEY-45/50/85/96/116/117/118/126; W1 reference.

**Owned output**: SDK API/runtime-binding pages, SQLite runtime README, Policy parameter/toolkit/testing pages, concise package entrypoints. Add new docs to archive allowlists when their READMEs depend on local pages. Reuse recorded fixture and Local smoke examples.

**Acceptance**: Every public export/subpath and material validation/error/close rule maps to documentation. No `prepareRequest` or high-level `recoverOperation` advertised as current. Parameter/snapshot identity and error ordering, helper APIs and direct Policy testing are covered. Runnable Local and provider-free Policy examples pass; declaration/package checks validate changed packaging; archive links work. Source test evidence is not release qualification.

**Prerequisites**: W1 and package-layout confirmation. This is one coherent adopter-doc outcome; internal SDK/Policy work stays in its tasks, not phase sub-issues.

## W4: Complete PostgreSQL and CLI adopter references

**Inputs**: KEY-47/51/55/76/84/85/96, canonical SQL/install source, PostgreSQL/CLI guides, W1/W3.

**Owned output**: PostgreSQL runtime and installation references; CLI command/config/output reference. Database implementation rationale remains database-owned.

**Acceptance**: Owned Hosted and borrowed Embedded calls, direct procedures, role/context requirements, verified TLS, retry/uncertainty, receipt expiry, provisional results, connection cleanup and installation/refusal are documented once. Compatibility reads from generation 6 source at this baseline rather than stale README values. Disposable native examples and relevant exact-archive CLI/runtime checks pass where the proposal changes their instructions or packaging. Full Hosted/Embedded operating readiness stays explicitly unqualified unless independently proven.

**Prerequisites**: W1 shared rules, W3 SDK links, approved public-only examples. No private deployment/runbook content.

## W5: Publish testing and release procedures with durable evidence

**Inputs**: KEY-46/48/60/75/90/91/92/93/121, current CI/scripts and archive qualification lanes.

**Owned output**: `docs/testing.md`, `docs/releases/README.md`, concise workflow links, exact retention requirements. Create a release record only for an actual accepted release, not an invented version.

**Acceptance**: Each documented command exists; test ownership and native/source/archive boundaries are clear; Hosted unavailability is honest; support declaration is distinct from tested versions. Essential existing release claims have retrievable reports/source/archive identities before any CI expiry. No raw evidence dump or duplicate roadmap. Mechanical extraction does not claim rerun native qualification.

**Prerequisites**: Approved topic ownership and public evidence disposition. W3/W4 example/packaging references reconcile before removal.

## W6: Adopt permanent-doc closeout and prove history retention

**Inputs**: W1-W5, approved COR-128 public history baseline, current workflow/ADR-0009/0010 and live GitHub configuration.

**Owned output**: Superseding retention ADR; workflow/index/AGENTS/PR template changes; formatter scope and minimal existing-check changes; separately authorized merge configuration and recorded read-back.

**Acceptance**: Local positive/negative pilot passes; a public-safe hosted pilot proves full-clone and pinned-URL retrieval after branch deletion; permanent docs/examples work without feature files. Merge commits retain E; squash/rebase and incompatible queue/linear-history settings are disabled/resolved. Independent approval/required checks remain. Current docs have no private-history dependency. No broad legacy removal bundled here.

**Prerequisites**: Writing coverage and approved retained history, explicit authorization for external setting changes and hosted pilot actions. Keep adoption incomplete if any gate cannot be proven.

## W7: Remove migrated historical feature directories in bounded batches

**Inputs**: The 36-row migration inventory, accepted W1-W6 results, item-level coverage ledger and safe historical pins.

**Owned output**: Only the specifically enumerated feature-directory deletions, repaired historical navigation, and exact retention evidence. Choose a small representative batch first, such as KEY-116/117/118/126 after W3, because their supersession is already mapped.

**Acceptance**: Every selected requirement/rationale/example/evidence item has a reviewed destination or retirement reason. No active link, import, test or package archive depends on removed files. Fresh main-only clone retrieves original bytes; HEAD is free of the selected temporary directories. Final CI/review cover the deletion candidate and full PR diff. Other features stay untouched.

**Prerequisites**: W6 adoption and per-directory W1-W5 coverage. Historical data clearance and publicly reachable retention precede deletion. Batch enumeration is approved before execution; no blanket `docs/features` removal.

## COR-131 closeout

Complete each outcome through the matching task phase, then preserve the final reviewed plan/evidence commit before preparing its deletion. Local completion does not establish hosted settings, publication or merge; record those only when they run against the final candidate.
