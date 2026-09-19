import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import installationRecord from "../../../../postgresql/generated/installation-record.json" with { type: "json" };
import {
  installPglite,
  recheckPgliteInstallation,
} from "../../../src/local/install.ts";
import { openPgliteHost } from "../support/pglite-host.ts";

interface QueryResult<Row> {
  readonly rows: readonly Row[];
}

interface DatabaseConnection {
  query<Row>(
    statement: string,
    parameters?: unknown[],
  ): Promise<QueryResult<Row>>;
}

interface Database extends DatabaseConnection {
  readonly closed: boolean;
  close(): Promise<void>;
  exec(statement: string): Promise<unknown>;
  transaction<Result>(
    callback: (transaction: DatabaseConnection) => Promise<Result>,
  ): Promise<Result>;
}

const databases: Database[] = [];

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async (database) => {
      if (!database.closed) await database.close();
    }),
  );
});

describe("PGlite canonical installation", () => {
  it("installs canonical bytes and exact object and function identity once", async () => {
    const database = await createDatabase();

    await expect(installPglite({ database })).resolves.toMatchObject({
      ok: true,
      outcome: "installed",
    });
    const before = await installationSnapshot(database);

    await expect(
      recheckPgliteInstallation({ database }),
    ).resolves.toBeUndefined();
    await expect(installPglite({ database })).resolves.toMatchObject({
      ok: true,
      outcome: "already-installed",
    });

    expect(await installationSnapshot(database)).toEqual(before);
    expect(before).toMatchObject({
      identity: {
        contract_digest: installationRecord.contractDigest,
        migration_set_digest: installationRecord.migrationSetDigest,
        policy_profile_digest: installationRecord.policyProfileDigest,
        remote_procedures_digest: installationRecord.remoteProceduresDigest,
        server_version_num: installationRecord.serverVersionNum,
      },
      migrations: installationRecord.migrations.map(
        ({ contractDigest, id, sha256 }) => ({
          byte_checksum: sha256,
          contract_digest: contractDigest,
          migration_id: id,
        }),
      ),
    });
    const version = await database.query<{
      readonly server_version_num: string;
    }>("show server_version_num");
    expect(version.rows[0]?.server_version_num).toBe(
      installationRecord.serverVersionNum,
    );
  });

  it("rejects a partial target without repairing it", async () => {
    const database = await createDatabase();
    await database.exec("create schema keynes");

    await expect(installPglite({ database })).rejects.toMatchObject({
      check: "target",
      code: "incompatible_target",
    });
    const state = await database.query<{
      readonly private_schema: boolean;
      readonly public_schema: boolean;
    }>(
      `select to_regnamespace('keynes') is not null as public_schema,
              to_regnamespace('keynes_internal') is not null as private_schema`,
    );
    expect(state.rows[0]).toEqual({
      private_schema: false,
      public_schema: true,
    });
  });

  it("rejects canonical byte and function drift", async () => {
    const database = await createDatabase();
    await installPglite({ database });
    await database.exec(
      "update keynes_internal.schema_migrations set byte_checksum = repeat('0', 64)",
    );

    await expect(recheckPgliteInstallation({ database })).rejects.toMatchObject(
      {
        check: `migration:${installationRecord.migrations[0].id}`,
        code: "incompatible_target",
      },
    );

    const second = await createDatabase();
    await installPglite({ database: second });
    await second.exec(`
      create or replace function keynes.get_budget(input jsonb) returns jsonb
      language sql as 'select ''{}''::jsonb'
    `);

    await expect(
      recheckPgliteInstallation({ database: second }),
    ).rejects.toMatchObject({
      check: "function:keynes.get_budget(jsonb)",
      code: "incompatible_target",
    });
  });

  it("rejects stored digest and version mismatches", async () => {
    const database = await createDatabase();
    await installPglite({ database });
    await database.exec(
      "update keynes_internal.installation_identity set contract_digest = repeat('0', 64)",
    );

    await expect(recheckPgliteInstallation({ database })).rejects.toMatchObject(
      {
        check: "contract-digest",
        code: "incompatible_target",
      },
    );

    const second = await createDatabase();
    await installPglite({ database: second });
    await second.exec(
      "update keynes_internal.installation_identity set server_version_num = '180002'",
    );

    await expect(
      recheckPgliteInstallation({ database: second }),
    ).rejects.toMatchObject({
      check: "stored-server-version",
      code: "incompatible_target",
    });
  });

  it("executes deferred bodies with exact numeric, JSON, and local context behavior", async () => {
    const database = await createDatabase();
    await installPglite({ database });

    await database.transaction(async (transaction) => {
      await transaction.query(
        "select set_config('keynes.tenant_id', $1, true), set_config('keynes.principal_id', $2, true)",
        [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000101",
        ],
      );
      for (const target of installationRecord.expectedTargets) {
        const result = await transaction.query<{ readonly response: unknown }>(
          `select ${target}($1::jsonb) as response`,
          ["{}"],
        );
        expect(result.rows[0]?.response).toEqual(expect.any(Object));
      }

      const behavior = await transaction.query<{
        readonly canonical_json: string;
        readonly numeric_sum: string;
        readonly principal_id: string;
        readonly tenant_id: string;
      }>(
        `select
           keynes_internal.policy_canonical_json($1::jsonb) as canonical_json,
           keynes_internal.policy_sum(array[0.1::numeric, 0.2::numeric])::text as numeric_sum,
           current_setting('keynes.tenant_id') as tenant_id,
           current_setting('keynes.principal_id') as principal_id`,
        ['{"nested":{"z":2,"a":1},"name":"local"}'],
      );
      expect(behavior.rows[0]).toEqual({
        canonical_json: '{"name":"local","nested":{"a":1,"z":2}}',
        numeric_sum: "0.300000000000000000",
        principal_id: "00000000-0000-4000-8000-000000000101",
        tenant_id: "00000000-0000-4000-8000-000000000001",
      });
    });

    const context = await database.query<{ readonly tenant_id: string }>(
      "select current_setting('keynes.tenant_id', true) as tenant_id",
    );
    expect(context.rows[0]?.tenant_id).toBe("");
  });

  it("closes the owned engine when initialization fails", async () => {
    let database: Database | undefined;

    await expect(
      openPgliteHost({
        createDatabase: async () => {
          database = await createDatabase();
          await database.exec("create schema keynes");
          return database;
        },
      }),
    ).rejects.toMatchObject({
      check: "target",
      code: "incompatible_target",
    });
    expect(database?.closed).toBe(true);
  });
});

async function createDatabase(): Promise<Database> {
  const database = await PGlite.create("memory://");
  databases.push(database);
  return database;
}

async function installationSnapshot(database: Database): Promise<unknown> {
  const result = await database.query<{ readonly snapshot: unknown }>(
    `select jsonb_build_object(
       'migrations', (select jsonb_agg(to_jsonb(row) order by migration_id)
         from keynes_internal.schema_migrations row),
       'identity', (select to_jsonb(row)
         from keynes_internal.installation_identity row)
     ) as snapshot`,
  );
  return result.rows[0]?.snapshot;
}
