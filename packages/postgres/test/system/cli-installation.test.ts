import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import {
  providerFreeEnvironment,
  runInstalledCommand,
} from "@keynes/testkit/package";
import {
  preparePostgresInstallation,
  dropPostgresFixture,
} from "./support/postgres-database.ts";
import {
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemCli,
} from "./support/test-keynes.ts";

async function withTarget(
  run: (
    client: Client,
    invoke: () => ReturnType<typeof runInstalledCommand>,
  ) => Promise<void>,
): Promise<void> {
  const prepared = await preparePostgresInstallation(
    requirePostgresqlSystemAdministratorUrl(),
    {
      tenantId: "00000000-0000-4000-8000-000000000001",
      principalId: "00000000-0000-4000-8000-000000000101",
    },
  );
  let directory: string | undefined;
  const client = new Client({ connectionString: prepared.databaseUrl });
  try {
    directory = await mkdtemp(join(tmpdir(), "keynes-native-cli-"));
    const configPath = join(directory, "config.json");
    await writeFile(configPath, JSON.stringify(prepared.config));
    await client.connect();
    const url = new URL(prepared.databaseUrl);
    const invoke = () =>
      runInstalledCommand(
        requirePostgresqlSystemCli().commandPath,
        ["install", "--config", configPath],
        {
          ...providerFreeEnvironment(process.env),
          PGHOST: url.hostname,
          PGPORT: url.port,
          PGDATABASE: url.pathname.slice(1),
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
        },
      );
    await run(client, invoke);
  } finally {
    try {
      await client.end();
    } finally {
      try {
        await dropPostgresFixture(
          prepared.administrator,
          prepared.databaseName,
          prepared.roles,
        );
      } finally {
        await Promise.all([
          prepared.administrator.end(),
          directory === undefined
            ? undefined
            : rm(directory, { recursive: true, force: true }),
        ]);
      }
    }
  }
}
async function snapshot(client: Client) {
  return (
    await client.query(`select jsonb_build_object(
    'migrations',(select jsonb_agg(to_jsonb(row) order by migration_id) from keynes_internal.schema_migrations row),
    'identity',(select to_jsonb(row) from keynes_internal.installation_identity row),
    'resources',(select jsonb_agg(to_jsonb(row)) from keynes_internal.resource_types row),
    'commands',(select jsonb_agg(to_jsonb(row)) from keynes_internal.commands row),
    'budgets',(select jsonb_agg(to_jsonb(row)) from keynes_internal.budgets row),
    'holdings',(select jsonb_agg(to_jsonb(row)) from keynes_internal.budget_resources row),
    'history',(select jsonb_agg(to_jsonb(row)) from keynes_internal.budget_history_entries row)
  ) as snapshot`)
  ).rows;
}
function expectSuccess(
  result: ReturnType<typeof runInstalledCommand>,
  outcome: string,
): void {
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, outcome });
  expect(result.stderr).toBe("");
}
function expectFailure(
  result: ReturnType<typeof runInstalledCommand>,
  check: string,
): void {
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toEqual({
    ok: false,
    error: {
      kind: "postgresql_installation_error",
      code: "incompatible_target",
      check,
    },
  });
  expect(result.stderr).toBe(`keynes installation failed: ${check}\n`);
}
describe("packed keynes installation CLI", () => {
  it("installs and rechecks an exact target without changing authority", async () => {
    await withTarget(async (client, invoke) => {
      expectSuccess(invoke(), "installed");
      await seedAuthority(client);
      const before = await snapshot(client);
      expectSuccess(invoke(), "already-installed");
      expect(await snapshot(client)).toEqual(before);
    });
  });
  it("refuses a partial target without repair and emits sanitized errors", async () => {
    await withTarget(async (client, invoke) => {
      await client.query("create schema keynes");
      expectFailure(invoke(), "target");
      expect(
        (
          await client.query(
            "select to_regnamespace('keynes') is not null as public_schema, to_regnamespace('keynes_internal') is null as absent_private_schema",
          )
        ).rows,
      ).toEqual([{ public_schema: true, absent_private_schema: true }]);
    });
  });
  it.each([
    {
      name: "migration drift",
      sql: "update keynes_internal.schema_migrations set byte_checksum=repeat('0',64)",
      check: "migration:0001-baseline",
    },
    {
      name: "profile mismatch",
      sql: "update keynes_internal.installation_identity set profile_id='incompatible-profile'",
      check: "profile-id",
    },
  ])("refuses $name without changing authority", async ({ sql, check }) => {
    await withTarget(async (client, invoke) => {
      expectSuccess(invoke(), "installed");
      await client.query(sql);
      const before = await snapshot(client);
      expectFailure(invoke(), check);
      expect(await snapshot(client)).toEqual(before);
    });
  });
});

async function seedAuthority(client: Client): Promise<void> {
  await client.query(
    "select set_config('keynes.tenant_id',$1,false), set_config('keynes.principal_id',$2,false)",
    [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000101",
    ],
  );
  const definitions = {
    tokens: { unit: "token", accountingBehavior: "consumable" },
  };
  for (const [procedure, input] of [
    [
      "define_resources",
      { commandId: "00000000-0000-4000-8000-000000000201", definitions },
    ],
    [
      "create_budget",
      {
        commandId: "00000000-0000-4000-8000-000000000202",
        definitions,
        amounts: { tokens: 7 },
      },
    ],
  ] as const) {
    const first = await client.query(
      `select keynes.${procedure}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    expect(first.rows[0]?.result).toMatchObject({ ok: true, replayed: false });
    const beforeReplay = await snapshot(client);
    const replay = await client.query(
      `select keynes.${procedure}($1::jsonb) as result`,
      [JSON.stringify(input)],
    );
    expect(replay.rows[0]?.result).toMatchObject({ ok: true, replayed: true });
    expect(await snapshot(client)).toEqual(beforeReplay);
  }
}
