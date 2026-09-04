# Governing document contract

## Ownership

| Document                                                    | Owns                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `.specify/memory/constitution.md`                           | Non-negotiable product and delivery principles                                         |
| `docs/product.md`                                           | Buyer-facing product behavior, deployment choices, and product boundaries              |
| `docs/architecture.md`                                      | Runtime components, command flow, state ownership, testing, and operational boundaries |
| `docs/roadmap.md`                                           | Implementation order, feature state, retained evidence, and untested work              |
| `docs/adr/*.md`                                             | Historical decisions and their consequences                                            |
| `docs/features/key-49-define-runtime-and-deployment-model/` | Scope, plan, execution tasks, and acceptance evidence for this change                  |

## Required agreement

All governing documents must agree that:

1. Local mode is selected by `Keynes.create()` and will use `SqliteCommandExecutor`, but PGlite remains the current engine until the next feature ships.
2. PostgreSQL is the only durable database implementation.
3. Embedded SQL, self-hosted remote service, and managed Cloud are access and operating models over the PostgreSQL implementation.
4. Each Budget is stored in one place. Zero arguments select local SQLite; a future API-key configuration selects remote discovery; invalid remote configuration never falls back locally.
5. The local SQLite runtime and PostgreSQL must expose the same Budget behavior through one command contract.
6. Policies use one restricted PostgreSQL-style query format over Keynes-provided request, Budget, and context inputs.
7. Applications own business-data reads and external work.
8. Evidence proves only the deployment, environment, artifact, and revision actually tested.
9. Embedded PostgreSQL transactions belong to application database code; optional generated bindings do not own transaction lifecycle.

## Current-state language

Current-state banners must say that PGlite local mode and the private PostgreSQL service exist. They must not say that the in-memory SQLite runtime, PostgreSQL installation, Policy, public remote access, self-hosted packaging, managed Cloud, recovery, security, or production support has been implemented or proved.

## Change control

- Supporting MySQL, SQLite, or another durable database requires a later constitution change.
- Changing Budget semantics requires shared behavior tests for every implementation.
- Changing Policy context or query support requires comparison tests for builder output, raw SQL, local evaluation, PostgreSQL evaluation, context recording, and replay.
- Changing one deployment's lifecycle, security, recovery, packaging, or operations requires tests for that deployment and creates no claim for another deployment.
