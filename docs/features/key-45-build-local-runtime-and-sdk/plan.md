# Implementation plan: Build local runtime and SDK

**Linear issue**: `KEY-45` | **Branch**: `feat/0004-local-runtime-sdk` | **Date**: August 24, 2026 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `docs/features/key-45-build-local-runtime-and-sdk/spec.md`

## Summary

Add the package-root `Keynes.create({ mode: "local" })` workflow over the existing private PGlite host and generated five-operation client. One identity-only `Budget` handle hides command IDs and host controls. A private Resource catalog maps lower-camel application keys to the generated lower-snake Resource definitions and IDs. Every mutation still passes through the generated client to one installed database RPC function. KEY-45 proves the facade in the source workspace and leaves emitted-package assets, environment compatibility, footprint, startup, memory, latency, and shutdown qualification to `Qualify local preview`.

## Technical context

**Language/Version**: TypeScript 7.0.2 on Node.js `>=24`; Node.js 24.19.0 is the current repository default and primary CI version  
**Primary Dependencies**: Existing `@electric-sql/pglite@0.5.5`; generated `KeynesClient`, validators, and contract types; Node `randomUUID()`; no new production dependency  
**Storage**: One private `memory://` PGlite database per `Keynes.create({ mode: "local" })` runtime; no file-backed persistence  
**Testing**: Vitest 4.1.11 with real installed migrations and procedures; existing generator and SDK regression suites; provider-free root `pnpm verify`  
**Target Platform**: Current source-workspace Node.js development and provider-free Linux CI; package and operating-system qualification remain `NOT RUN`  
**Project Type**: Public TypeScript library facade in the existing private `@keynes/sdk` workspace  
**Performance Goals**: N/A for KEY-45. The next roadmap feature owns startup, latency, memory, and package-size targets and measurements
**Constraints**: No database contract or semantic change; no raw database, command ID, principal, tenant, fixture, storage path, extension, or transaction export; one immediate retry only for a confirmed committed-response-loss sentinel; no Policy, durable host, Cloud, daemon, or package release work  
**Scale/Scope**: One process-local runtime, one private tenant and principal, one serialized database connection, five existing generated operations, four public workflow methods plus close, and no cross-process recovery

## Constitution check

_GATE: Passed before Phase 0 research and passed again after Phase 1 design._

- **Singular authority**: The installed `keynes.define_resource_type`, `keynes.create_budget`, `keynes.request`, `keynes.settle`, and `keynes.get_budget` database RPC functions remain the only owners of Resource identity, Budget changes, conservation, replay, settlement, unresolved usage, deficits, and history. The generated `KeynesClient` remains the only SDK consumer of those functions. The facade converts names, owns invocation IDs, and holds Budget identity but never calculates a transition.
- **Effect boundary**: KEY-45 performs no application effect. The application owns work execution, provider idempotency and retry, usage observation, outcomes, and fallback behavior. An approved `Budget` handle authorizes only the exact committed Resource envelope.
- **Policy and security**: Policy is out of scope because the current five-operation contract has no Policy operation. Local mode installs one fixed private tenant and one fixed private principal with the current five permissions. Public inputs cannot select either identity. The facade exposes no credentials, database access, test controls, or secrets.
- **One cross-host contract**: The feature changes no schema, migration, procedure, generated command, generated result, contract digest, or database behavior. It adds a hand-written local SDK facade over the already qualified PGlite path. Native PostgreSQL remains a regression host for the unchanged core, not acceptance evidence for the local facade. Customer PostgreSQL, Cloud, compatibility, and package qualification remain `NOT RUN`.
- **Evidence-first delivery**: Start with failing package-root tests for `Keynes.create({ mode: "local" })`, invalid creation options, the Budget happy path, Resource-name validation, lost-response replay, close admission, initialization cleanup, two-runtime isolation, and negative exports. Run them through real PGlite and installed functions. Then run the existing SDK corpus, generator checks, feature identity check, and `pnpm verify`. No live, paid, managed-provider, fault-campaign, benchmark, or externally mutating lane is authorized.

The post-design check passes with no exception. [research.md](research.md) keeps lifecycle and Resource mapping in the SDK, [data-model.md](data-model.md) keeps committed authority in the database, and [contracts/sdk.md](contracts/sdk.md) exposes no generated caller, database, fixture, or command ID. The quickstart leaves application work outside Keynes. No Complexity Tracking entry is required.

## Project structure

### Documentation for this feature

```text
docs/features/key-45-build-local-runtime-and-sdk/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sdk.md
└── checklists/
    └── requirements.md
```

`tasks.md` is Phase 2 output from `/speckit-tasks` and is not created by this command.

### Source code

```text
packages/sdk/src/
├── index.ts                         # Package-root facade and existing generated exports
├── keynes.ts                        # Keynes.create, Budget, input mapping, invocation IDs, and result mapping
├── sdk-errors.ts                    # KeynesSdkError and ResourceDefinitionError
├── local.test.ts                    # Public happy path, names, denial, settlement, and inspection
├── local-lifecycle.test.ts          # Startup cleanup, close admission, close repeat, and isolation
├── local-replay.test.ts             # SDK-owned command identity and committed-response replay
├── public-exports.test.ts            # Consumer imports and negative private-export checks
├── generated/
│   ├── client.ts                    # Unchanged generated five-operation client
│   ├── types.ts                     # Unchanged generated domain contract
│   └── validators.ts                # Unchanged generated boundary validation
└── private/
    ├── local-runtime.ts             # Local deployment composition and fixed private authority context
    ├── pglite-database.ts           # PGlite engine lifecycle and serialized database owner
    ├── postgres-database.ts         # PostgreSQL engine lifecycle and native-test owner
    ├── resource-catalog.ts          # Application names and private Resource ID catalog
    ├── test-keynes.ts               # Fixture identities and paired PGlite/PostgreSQL hosts
    ├── migrations.ts                # Host-neutral principal permission installation
    └── procedure-caller.ts          # Host-neutral installed calls and committed-response-loss sentinel
```

The database migrations, contract schema, generator, and generated SDK files receive no semantic change. Tests may extend the existing private lost-response seam, but the seam stays absent from package-root exports.

**Structure decision**: Keep the facade in the existing SDK workspace. `keynes.ts` owns the public `Keynes.create({ mode: "local" })` branch, lifecycle admission, SDK-owned command construction, bounded replay, and Budget handles. `local-runtime.ts` composes the product deployment with PGlite and a fixed private authority context. `pglite-database.ts` and `postgres-database.ts` own their paired engine lifecycles. `resource-catalog.ts` owns the only name-to-ID mapping. The generated client owns contract validation and operation binding. The installed database owns every transition. KEY-45 exports no placeholder `cloud` or `postgres` mode.
