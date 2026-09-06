# ADR-0011: Configure Resource declarations before Budget creation

- **Status:** Target decision recorded by the revised KEY-78 brief; implementation unverified
- **Date:** 2026-09-05
- **Feature:** [KEY-78](https://linear.app/keynes/issue/KEY-78/create-budgets-from-resource-definitions-or-bindings)
- **Supersedes in part:** [ADR-0007](0007-direct-postgresql-remote-access.md), only its connection-only factory and per-Budget Resource binding direction

## Context

KEY-77 delivered explicit Resource definition and a transitional creation path
that consumes definitions or bindings. KEY-78's revised brief configures Resource
declarations once, then creates Budgets from amounts. It also separates durable
catalog provisioning from application initialization.

## Decision

The target client forms are `createKeynes({ resources })` for private local
SQLite and `createKeynes({ resources, databaseUrl })` for one durable PostgreSQL
authority. `keynes.createBudget({ usdCents: 1_000, reviewSeats: 0 })` creates a
Budget with exactly those two Resource members. An omitted key excludes a
Resource; explicit zero includes it without funding. Non-empty all-zero amounts
are valid. Funding stays fixed at creation.

Local initialization establishes an ephemeral catalog from declarations. Durable
initialization validates every supplied definition against the persisted tenant
catalog. Missing or conflicting definitions fail; additional persisted names
remain compatible. Initialization and creation never persist shared definitions.
Explicit provisioning retains that responsibility, including the existing
independent Resource definition operation where authorized.

Declarations provide inferred names and runtime compatibility information.
They do not grant permission or create a second catalog authority. Unknown amount
keys reject statically and dynamically, including separately declared variables.
Creation resolves and validates declared Resources under authority-owned
authorization, atomicity, and replay rules.

Read-only catalog generation can produce declarations. KEY-6 owns Hosted
generation; discovery commands, generated-file layout, and new provisioning
interfaces are outside this feature. Local declarations and explicitly provisioned
test catalogs can demonstrate the contract independently.

## Consequences and limits

Per-Budget raw definitions, Resource bindings, and a nested `initial` field are
superseded creation inputs. Adding unused client declarations cannot expand
Budget membership or change exact creation replay. Existing Policy and recovery
capabilities retain their semantics; their precise integration belongs in the
KEY-78 plan and must not add non-Resource fields to the amounts object.

ADR-0007's direct PostgreSQL access, TLS, authentication, tenant mapping, pool
ownership, no-fallback rule, and single durable authority remain in force.
Fixed funding and the constitution are unchanged. No Hosted readiness or new
provisioning product is implied.

## Alternatives displaced by the revised brief

- Reconciling raw definitions during creation would let ordinary Budget creation
  mutate shared schema and make application startup responsible for provisioning.
- Per-Budget bindings repeat Resource selection at each creation despite an
  application already having typed declarations.
- Membership inferred from all client declarations would silently add members
  when an application expands its schema.

## Evidence boundary

[The specification](../features/key-78-create-budgets-from-resource-definitions-or-bindings/spec.md)
owns detailed acceptance. This record reconciles target documents only. Runtime
implementation, type acceptance, and real SQLite/native PostgreSQL verification
are NOT RUN for this decision. Historical ADRs, KEY-77 artifacts, and retained
evidence keep their original revision-specific meaning.
