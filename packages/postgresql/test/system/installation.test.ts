import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransactionalDatabase } from "./support/database.js";
import { openPostgresDatabase } from "./support/postgres-database.js";
import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import { requirePostgresqlSystemAdministratorUrl } from "./support/test-keynes.js";

const DATABASE_ROOT = new URL("../../", import.meta.url);
const MIGRATIONS_ROOT = new URL("migrations/", DATABASE_ROOT);
const INSTALLATION_RECORD_URL = new URL(
  "generated/installation-record.json",
  DATABASE_ROOT,
);

const EXPLICIT_INSTALLATION = {
  tenantId: "00000000-0000-4000-8000-000000000011",
  principals: [
    {
      principalId: "00000000-0000-4000-8000-000000000111",
      permissions: ["define_resource_type", "read_budget"],
    },
    {
      principalId: "00000000-0000-4000-8000-000000000112",
      permissions: ["request_budget"],
    },
  ],
} as const;

const MIGRATIONS = [
  {
    id: "0001-storage",
    path: "0001-storage.sql",
    tableName: "keynes_internal.commands",
    procedureName: null,
  },
  {
    id: "0002-budget",
    path: "0002-budget.sql",
    tableName: null,
    procedureName: "keynes_internal.apply_command(text,jsonb)",
  },
  {
    id: "0003-public",
    path: "0003-public.generated.sql",
    tableName: null,
    procedureName: "keynes.define_resource_type(jsonb)",
  },
  {
    id: "0004-policy",
    path: "0004-policy.sql",
    tableName: null,
    procedureName: "keynes_internal.validate_policy_program(jsonb)",
  },
  {
    id: "0005-resource-bound-budget",
    path: "0005-resource-bound-budget.sql",
    tableName: null,
    procedureName: null,
  },
  {
    id: "0006-remote-access",
    path: "0006-remote-access.sql",
    tableName: "keynes_internal.remote_role_mappings",
    procedureName: "keynes.remote_get_compatibility(jsonb)",
  },
] as const;

type FileContents = string | Buffer;
type FileMutation = (path: URL, contents: FileContents) => FileContents;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(path: URL): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readContractDigest(): Promise<string> {
  const record = await readJson(INSTALLATION_RECORD_URL);
  if (!isRecord(record) || typeof record.contractDigest !== "string") {
    throw new Error("installation record has no contract digest");
  }
  return record.contractDigest;
}

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

async function loadInstallerWith(mutate: FileMutation) {
  vi.resetModules();
  vi.doMock("node:fs/promises", async () => {
    const actual =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
    return {
      ...actual,
      async readFile(path: URL, encoding?: "utf8") {
        const contents =
          encoding === undefined
            ? await actual.readFile(path)
            : await actual.readFile(path, encoding);
        return mutate(path, contents);
      },
    };
  });
  return import("./support/migrations.js");
}

async function withFreshDatabase(
  run: (database: TransactionalDatabase) => Promise<void>,
): Promise<void> {
  const opened = await openPostgresDatabase(
    requirePostgresqlSystemAdministratorUrl(),
  );
  try {
    await run(opened.database);
  } finally {
    await opened.close();
  }
}

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("PostgreSQL installation", () => {
  it("installs explicit principal permission records", async () => {
    const { installDatabase } = await import("./support/migrations.js");
    await withFreshDatabase(async (database) => {
      await installDatabase(database, EXPLICIT_INSTALLATION);
      const permissions = await database.query<{
        readonly principal_id: string;
        readonly permission: string;
      }>(
        `select principal_id::text, permission
           from keynes_internal.principal_permissions
          order by principal_id, permission`,
      );
      expect(permissions.rows).toEqual([
        {
          principal_id: EXPLICIT_INSTALLATION.principals[0].principalId,
          permission: "define_resource_type",
        },
        {
          principal_id: EXPLICIT_INSTALLATION.principals[0].principalId,
          permission: "read_budget",
        },
        {
          principal_id: EXPLICIT_INSTALLATION.principals[1].principalId,
          permission: "request_budget",
        },
      ]);
    });
  });

  it("installs the current graph and rechecks it without changes", async () => {
    const { installDatabase } = await import("./support/migrations.js");
    await withFreshDatabase(async (database) => {
      await installDatabase(database, EXPLICIT_INSTALLATION);
      const before = await installationState(database);
      await installDatabase(database, EXPLICIT_INSTALLATION);
      expect(await installationState(database)).toEqual(before);
      expect(before.migrations.rows).toEqual([
        { migration_id: "0001-storage" },
        { migration_id: "0002-budget" },
        { migration_id: "0003-public" },
        { migration_id: "0004-policy" },
        { migration_id: "0005-resource-bound-budget" },
        { migration_id: "0006-remote-access" },
      ]);
    });
  });

  it("rejects a contract digest mismatch before installation", async () => {
    const contractDigest = await readContractDigest();
    const mismatchedDigest = "0".repeat(64);
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("installation-record.json")) return contents;
      if (typeof contents !== "string") throw new Error("record must be text");
      return contents.replace(contractDigest, mismatchedDigest);
    });

    await withFreshDatabase(async (database) => {
      await expect(
        installDatabase(database, EXPLICIT_INSTALLATION),
      ).rejects.toMatchObject({
        code: "contract_mismatch",
        details: {
          clientDigest: contractDigest,
          installedDigest: mismatchedDigest,
        },
      });
    });
  });

  it("rejects migration byte drift before applying it", async () => {
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("0001-storage.sql")) return contents;
      if (typeof contents === "string") return `${contents}\n-- drift\n`;
      return Buffer.concat([contents, Buffer.from("\n-- drift\n")]);
    });

    await withFreshDatabase(async (database) => {
      await expect(
        installDatabase(database, EXPLICIT_INSTALLATION),
      ).rejects.toMatchObject({
        code: "installation_drift",
        details: { migrationId: "0001-storage" },
      });
    });
  });

  it("rejects an installed-object mismatch after fresh migration", async () => {
    const missingTarget = "keynes.missing_definition_target";
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("installation-record.json")) return contents;
      if (typeof contents !== "string") throw new Error("record must be text");
      return contents.replace("keynes.define_resource_type", missingTarget);
    });

    await withFreshDatabase(async (database) => {
      await expect(
        installDatabase(database, EXPLICIT_INSTALLATION),
      ).rejects.toThrow(
        `Installed database object does not match ${missingTarget}(jsonb)`,
      );
    });
  });

  it.each(MIGRATIONS)(
    "rolls back $id atomically when its final statement fails",
    async (migration) => {
      const { installDatabase } = await loadFailingInstaller(migration);
      await withFreshDatabase(async (database) => {
        await expect(
          installDatabase(database, EXPLICIT_INSTALLATION),
        ).rejects.toThrow();

        const objects = await database.query<{
          readonly migration_object_exists: boolean;
          readonly probe_exists: boolean;
          readonly ledger_exists: boolean;
        }>(
          `select
             (to_regclass($1) is not null or to_regprocedure($2) is not null)
               as migration_object_exists,
             to_regclass('keynes_internal.rollback_probe') is not null as probe_exists,
             to_regclass('keynes_internal.schema_migrations') is not null as ledger_exists`,
          [migration.tableName, migration.procedureName],
        );
        expect(objects.rows[0]).toMatchObject({
          migration_object_exists: false,
          probe_exists: false,
        });
        if (objects.rows[0]?.ledger_exists === true) {
          const record = await database.query<{ readonly recorded: boolean }>(
            `select exists(
               select 1 from keynes_internal.schema_migrations where migration_id = $1
             ) as recorded`,
            [migration.id],
          );
          expect(record.rows[0]?.recorded).toBe(false);
        }
      });
    },
  );
});

async function installationState(database: TransactionalDatabase) {
  const migrations = await database.query<{ readonly migration_id: string }>(
    "select migration_id from keynes_internal.schema_migrations order by migration_id",
  );
  const permissions = await database.query<{ readonly state: unknown }>(
    `select jsonb_build_object(
       'permissionCount', count(*),
       'principalCount', count(distinct principal_id)
     ) as state from keynes_internal.principal_permissions`,
  );
  return { migrations, permissions };
}

async function loadFailingInstaller(migration: (typeof MIGRATIONS)[number]) {
  const original = await readFile(new URL(migration.path, MIGRATIONS_ROOT));
  const failing = Buffer.concat([
    original,
    Buffer.from(
      "\nCREATE TABLE keynes_internal.rollback_probe (id integer);\n" +
        "SELECT * FROM keynes_internal.deliberate_migration_failure;\n",
    ),
  ]);
  const originalChecksum = createHash("sha256").update(original).digest("hex");
  const failingChecksum = createHash("sha256").update(failing).digest("hex");

  return loadInstallerWith((path, contents) => {
    if (path.pathname.endsWith(migration.path)) {
      return typeof contents === "string" ? failing.toString("utf8") : failing;
    }
    if (path.pathname.endsWith("installation-record.json")) {
      if (typeof contents !== "string") throw new Error("record must be text");
      return contents.replace(originalChecksum, failingChecksum);
    }
    return contents;
  });
}
