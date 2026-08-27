# FEAT-0011 compatibility baseline

**Branch base**: `5e05a950cfcd973010e7b28a944334294463d4a3`
(`main` at feature creation)

## Predecessor order

The branch contains the merged product slices through FEAT-0010, followed by
the intentional simplification commits, in this order:

```text
c6e6f74 Add cloud runtime service package and private RPC contract (#8)
52d4c6f Refine the runtime and deployment model (#9)
a8a4cf6 Replace PGlite with the SQLite local runtime (#10)
79de721 Add PostgreSQL installation and caller-owned transactions (#11)
e0e85a5 Organize repository boundaries, contracts, and package qualification (#12)
2deb20f refactor: remove unused provider-free scenario map
259c45e refactor: simplify provider-free test runner
488a313 refactor: use native recursive directory reads
429ff10 refactor: use native argument parsing
79ae610 refactor: share package archive parsing
5e05a95 refactor: simplify PostgreSQL package build
```

## Frozen identities

- Contract digest: `0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6`
- SDK: `@keynes/sdk@0.0.0`, root ESM export with `dist/index.js` and
  `dist/index.d.ts`, Node.js 24 or 26
- PostgreSQL: `@keynes/postgresql@0.0.0`, empty export map, executable
  `keynes-postgresql` at `dist/cli.js`, Node.js 24 through 26
- Cloud: private `@keynes/cloud@0.0.0`, Node.js 24 through 26
- Workflow names: `CI`, `SDK Package`, and `PostgreSQL System`

## Frozen bytes

The first path is the FEAT-0011 owner. Each SHA-256 equals the file at the
corresponding path on the branch base, including files whose path moved.

| Path                                                       | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/contracts/contract.json`                         | `84af52c20a6a11331dc0e48a001eeb7b2fc481dd4577d9ee1fd0efc749b42aff` |
| `packages/contracts/schema.json`                           | `bbe5a5e6da9040938300be277798faa29909aed9553307d2d5c5854e7607ff4f` |
| `packages/sdk/src/generated/client.ts`                     | `c2d37a56a3ef04a314967ee03d3cdf5652aeb97201a7287439e0856c432fc71e` |
| `packages/sdk/src/generated/types.ts`                      | `fe5bb80eac2cb26281654e51c40c34b019f0764cd000c96bd6607d70c64739f9` |
| `packages/sdk/src/generated/validators.ts`                 | `78e8774d4b9470edd1831cd2dca9f4fd559467dcbb94deb7c645ea00f39d207c` |
| `packages/postgresql/migrations/0001-storage.sql`          | `1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd` |
| `packages/postgresql/migrations/0002-budget.sql`           | `464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b` |
| `packages/postgresql/migrations/0003-public.generated.sql` | `b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753` |
| `packages/postgresql/generated/installation-record.json`   | `a346be3e991fa99a83719442be26efbd532f0ca9919d91266546916047c465bc` |
| `apps/cloud/src/generated/procedures.ts`                   | `c4c1d2c06c0d43009494a6df5876105a0f3b58216d55c159a37f16edd4564a6b` |

Tar archive bytes are not frozen because archive metadata can change. Package
qualification compares the supported file inventory, entry points, behavior,
and generated contents instead.
