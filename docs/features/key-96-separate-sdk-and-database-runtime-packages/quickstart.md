# Validation guide: KEY-96

The APIs and commands below are implemented in this checkout. Final qualification is still tracked in [acceptance.md](acceptance.md); a command listed here is not a claim that it has run successfully. No npm publication is required.

## Prerequisites

Use a clean feature checkout, supported Node >=24, pnpm 11.21.0, frozen dependencies, local Docker and OpenSSL for disposable native PostgreSQL with its verified-TLS fixture. Record source revision, Node/pnpm/OS/architecture and exact archive hashes. Do not use production credentials or external targets.

```sh
pnpm install --frozen-lockfile
pnpm generate:check
pnpm test:repository
pnpm test:pr
pnpm test:ci:postgresql
```

Expected: generation and ownership boundaries pass, Local/shared tests pass, native correctness passes with terminal child/cleanup success. A green assertion count with a failing process is a failure.

## Explicit Local consumer

The following is the implemented public usage. Runtime names and ownership are defined in [package API](contracts/package-api.md).

```typescript
import { createKeynes } from "@keynes/sdk";
import { nodeSqlite } from "@keynes/node-sqlite";

const resources = {
  tokens: { unit: "token", accountingBehavior: "consumable" },
} as const;
const keynes = await createKeynes({ resources, runtime: nodeSqlite() });
try {
  const root = await keynes.createBudget({ tokens: 10 });
  const request = await root.request({ tokens: 3 });
  if (request.status === "approved") {
    await request.budget.settle({ tokens: 2 });
  }
  await root.settle({ tokens: 0 });
  await root.inspect();
} finally {
  await keynes.close();
}
```

Expected: inferred tokens-only handles, preserved approval/settlement/history, no pg/PGlite import, and no persistent database. Repeat with independent instances; verify close drains prior admissions and rejects later calls. Invalid quantities/evidence must reject at the runtime; malformed replies must still reject in SDK mapping.

## PostgreSQL consumer

Use `postgres({ databaseUrl })` for the existing owned remote path. Provision Resources explicitly before initialization; initialization must not write definitions. Retain strict TLS and existing remote references/recovery.

For borrowed integration, obtain a connected `Client` or checked-out `PoolClient`, provision a trusted Embedded role with existing direct procedure grants, and configure the existing tenant/principal context. The application starts its own transaction, sets transaction-local context, then constructs `createKeynes({ resources, runtime: postgres({ connection }) })`. Write an application outbox row and issue Budget commands on that connection. A second session must see neither uncommitted write. Call keynes.close before caller COMMIT or ROLLBACK; both outcomes must leave the connection usable. Repeat with session context and autocommit for single-command atomicity. Missing/wrong context must fail without broadening Hosted grants.

The test records every adapter query/lifecycle action and asserts zero transaction control, context writes, reconnect/release/end calls and automatic retries. Deliberate query failure must remain visible to the caller. Retain the existing real outbox/rollback fixtures, but route new acceptance through the public adapter, not only internal test clients.

```sh
pnpm test:local
pnpm test:remote
pnpm test:embedded
pnpm test:sqlite-postgres -- --output ".artifacts/key-96/$(node -p 'crypto.randomUUID()')"
```

Expected: matched shared results and complete native terminal evidence. Passing these does not establish Hosted readiness or full Embedded recovery.

## Exact archive consumers

```sh
pnpm test:package:split -- --output ".artifacts/key-96-packages/$(node -p 'crypto.randomUUID()')"
```

The split runner builds/packs once per attempt with existing helpers, tests four consumer combinations in clean external directories, installing each exact archive set and its declared dependency closure, then performs the following checks. It must not resolve through workspace symlinks, sibling dist trees or undeclared globally installed packages.

| Consumer                    | Required checks                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK only                    | Root import, ESM/declarations, inference fixtures, no driver/engine/compiler/CLI/provider/private dependency, rejected deep imports                              |
| SDK + SQLite                | Inferred root/child types, request/settle/inspect/replay/errors, close/drain/isolation, no pg/PGlite/server implementation                                       |
| SDK + PostgreSQL            | Public adapter declarations, real owned remote calls and public borrowed commit/rollback/autocommit, no SQLite/CLI; installer subpath import                     |
| CLI + declared dependencies | Executable installation, fresh install, exact recheck, partial/drift/profile refusal, config/connection failures, exit code and both-stream credential redaction |

Record each installed archive's SHA-256 and actual installed realpath. Compare generated asset/contract digests with the central source. Ensure production manifests and declarations do not name @keynes/database, @keynes/contracts or @keynes/testkit. Keep all artifacts private/local; no registry publishing step.

## CLI migration

Replace `keynes-postgresql install --config <path>` with `keynes install --config <path>` from @keynes/cli. Preserve the existing JSON configuration and PostgreSQL environment credentials. No URL argument, catalog command, sync or upgrade is added. The CLI must not duplicate installation SQL or schema definitions.

In a disposable native fixture, run installation twice. First returns installed, second already-installed. Verify the second leaves definition/accounting state unchanged. Exercise mismatch and failure cases in separate fixtures, never by damaging a production database.

## Acceptance record

Maintain `acceptance.md` in this feature directory with source revision, per-archive hashes, contract/baseline identities, host/tool/dependency versions, exact commands and process/cleanup outcomes. Record failed attempts as failed. Preserve previous feature evidence unchanged. Runtime measurements must resolve both the installed SDK and SQLite archive; changing tooling does not claim a new measurement result.

Use the measurement command with both exact archives:

```sh
pnpm measure:package:sdk -- --archive <sdk.tgz> --node-sqlite-archive <sqlite.tgz> --output <new-record.json>
```

SDK-only qualification omits `--node-sqlite-archive`; Local qualification supplies it:

```sh
pnpm test:package:sdk -- --archive <sdk.tgz> --node-sqlite-archive <sqlite.tgz> --output <new-record.json>
```

Explicitly retain NOT RUN for any unsupported host/version, full Embedded recovery, managed Hosted, live provider, production operations and performance lanes not executed. KEY-96 package tests do not replace KEY-88's final release matrix.
