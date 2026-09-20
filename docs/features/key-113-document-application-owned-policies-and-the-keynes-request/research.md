# Research: Documentation boundaries and supersession

## Evidence and method

Read-only review used the live KEY-113 issue, base `a203a26d20ed1ecc940d9bca1f05c9d9b81b80b4`, governing documents, current package READMEs and ADRs. A Spec Kit research agent independently inspected documentation conflicts. Earlier KEY-113 artifacts were not reused. No runtime behavior was executed or qualified.

## Decision 1: Separate customer evaluation from allocation

**Decision**: Document a request-or-reject customer boundary. The database still validates supported commands and atomically enforces permissions, exact quantities, Budget constraints, settlement and replay.

**Rationale**: Customer SQL and ordinary code need no shared policy language. Database validation of a request does not establish that evaluation ran or that a valid request can be funded. Evaluation records remain caller claims.

**Alternatives considered**: Keep registered SQL Policies; require an evaluator callback in allocation; accept signed-looking evidence as authority. Each either contradicts the issue or merges evaluation with accounting. Optional helpers may define interfaces without changing allocation.

## Decision 2: Supersede precise requirements, preserve history

**Decision**: Plan ADR-0013 and a major constitution amendment, with minimal forward notices in affected historical ADRs. Do not write them during planning.

| Source                                                 | Conflict or preserved decision                                                                                                                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constitution I, III, IV and Policy/product constraints | Mandatory PGlite, one engine, compiled SQL Policies and in-command evaluation conflict with KEY-113.                                                                                                                                     |
| ADR-0012                                               | Supersede one PostgreSQL implementation, PGlite Local, managed compiler/evaluator and Policy catalog/type-generation/deployment requirements. Keep applicable thin-SDK, explicit selection, borrowed-connection and evidence boundaries. |
| ADR-0007                                               | Supersede durable ownership of Policy decisions only. Preserve direct PostgreSQL access, TLS, authenticated identity, accounting, replay and recovery.                                                                                   |
| ADR-0003                                               | Restore SQLite Local direction without resurrecting obsolete API-key/HTTP routing or old SDK calls. Preserve its original body.                                                                                                          |
| ADR-0006                                               | Update its forward notice so old package decisions are not accidentally reinstated. Exact new distributions belong to KEY-96.                                                                                                            |
| ADR-0011                                               | Keep configured Resource declarations, exact membership and fixed funding. No substantive supersession needed.                                                                                                                           |

**Rationale**: A new feature spec cannot silently override constitutional MUSTs. A documented conflict is honest planning; actual adoption needs the explicit amendment.

**Alternatives considered**: Rewrite old ADR bodies or accept constitution compliance because the Linear issue is approved. Both erase the distinction between requested direction and current governing text.

## Decision 3: Inventory active documentation instead of rewriting every historical feature

**Decision**: Reconcile product status/Policies/ownership/deployments/onboarding, architecture definition/evaluation/command/history/module/verification sections, workflow transition/CLI guidance and affected package READMEs. Review contracts README for ownership wording only.

**Rationale**: `docs/README.md` assigns sequencing and issue disposition to Linear. There is no `docs/roadmap.md` or root README. Reconcile normative release commitments in active docs and reference the live roadmap rather than creating a duplicate. Preserve historical specs, acceptance evidence and unrelated untracked KEY-118 artifacts. Active features must reconcile when resumed.

**Alternatives considered**: Global Policy/PGlite replacement; new repository roadmap; changing task status in peer issues. These exceed scope or destroy historical meaning. No Linear status or sequencing mutation is needed for this planning pass.

## Decision 4: Preserve honest current behavior and migration limits

**Decision**: Existing SDK Policy helpers, context/evidence semantics and examples remain labeled as implemented until KEY-114 replaces them. KEY-96 owns package separation. PostgreSQL installation stays fresh-baseline-only, exact reinstall remains read-only, incompatible targets fail closed, and no automatic upgrade is promised.

**Rationale**: `packages/sdk/README.md` describes Kysely/raw SQL helpers and the bundled compiler. `packages/postgresql/README.md` documents real installer commands and permissions. The target cannot replace executable instructions prematurely.

**Alternatives considered**: Rename package APIs now or remove current Policy examples entirely. Both mislead current consumers. Documentation does not qualify a release.

## Decision 5: Keep release requirements and optional use distinct

**Decision**: Local preview requires KEY-116/117/118 tooling while each workflow can bypass helpers and construct requests directly. Cloud requires KEY-119/120 and the KEY-124 capability under KEY-122. KEY-115 model exploration and later KEY-125 shared HTTP evaluation are separate; neither provider integration nor KEY-125 is a first-release gate.

**Rationale**: Supported optional tooling can be a product delivery requirement without making a policy interface mandatory. Customer ownership does not require a separate process per app or prohibit Keynes Cloud hosting. Hosted evaluation is initially evaluation-only and remains outside the accounting transaction.

**Alternatives considered**: Defer all tooling because policies are optional; make every allocation invoke a hosted evaluator. Both contradict the issue.

## Decision 6: SQLite and PostgreSQL share meaning, not an implementation

**Decision**: Document private in-memory Node SQLite and native PostgreSQL with engine-specific accounting outside SDK, shared contracts and shared conformance scenarios. Keep exact arithmetic, deterministic replay and invalid-input handling. Runtime design must justify numeric ranges and rounding from product needs.

**Rationale**: The issue supersedes ADR-0012. It neither adopts a shared TypeScript accounting engine nor permits weakened database enforcement. First Local remains ephemeral; KEY-122/123/124 own later accounting/durability/delegation work.

**Alternatives considered**: Reuse PostgreSQL numeric constraints as a policy-language standard, implement new numeric semantics here, or design a distributed protocol. All are outside this documentation outcome.

## Resolved scope

No clarification is needed to write the plan. The unresolved constitution conflict is an explicit adoption gate, not an unknown design choice. Runtime, provider, package and deployment qualification remain NOT RUN.

## Implementation intake

KEY-113 was refreshed at implementation intake; its scope and branch are unchanged. Planning commit `f496701072dbe70da6d100ac7287c71aff977e4e` is the starting point. ADR-0013 is available; constitution 11.0.0 requires a major 12.0.0 amendment. Existing ignore rules cover repository artifacts; no package publication or new tooling requires an ignore-file change. The unrelated untracked KEY-118 directory remains untouched.
