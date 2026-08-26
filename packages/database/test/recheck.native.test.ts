import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { install, recheckInstallation } from "../src/install.ts";
import type { InstallationConfig } from "../src/profile.ts";
import { Client } from "pg";
import installationRecord from "../generated/installation-record.json" with { type: "json" };
import fixtureSource from "../../../packages/contracts/fixtures/source.json" with { type: "json" };
import { PLATFORM_CONTEXT_ENV } from "../../../packages/sdk/src/private/run-platform-tests.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const principalId = "00000000-0000-4000-8000-000000000101";

const expectedObjects = installationRecord.expectedObjects;
const expectedFunctions = installationRecord.functions;
const config: InstallationConfig = {
  ownerRole: `keynes_owner_${randomUUID().replaceAll("-", "")}`,
  applicationRole: `keynes_app_${randomUUID().replaceAll("-", "")}`,
  tenantId,
  principalId,
};

interface NativeTarget {
  readonly administratorUrl: string;
  readonly databaseName: string;
  readonly databaseUrl: string;
  readonly applicationUrl: string;
}

describe.skipIf(process.env[PLATFORM_CONTEXT_ENV] === undefined)(
  "PostgreSQL exact recheck and application-role conformance",
  () => {
    let target: NativeTarget;

    beforeAll(async () => {
      target = await createExactShapeTarget();
    });

    afterAll(async () => {
      const administrator = new Client({
        connectionString: target.administratorUrl,
      });
      await administrator.connect();
      try {
        await administrator.query(
          `drop database if exists ${quoteIdentifier(target.databaseName)} with (force)`,
        );
        await administrator.query(
          `drop role if exists ${quoteIdentifier(config.applicationRole)}`,
        );
        await administrator.query(
          `drop role if exists ${quoteIdentifier(config.ownerRole)}`,
        );
      } finally {
        await administrator.end();
      }
    });

    it("rechecks the exact graph read-only", async () => {
      const client = new Client({ connectionString: target.databaseUrl });
      await client.connect();
      try {
        const before = await installationState(client);
        await recheckInstallation({ client, config });
        expect(await installationState(client)).toEqual(before);
      } finally {
        await client.end();
      }
    });

    it("checks the server, checksums, contract, and complete object inventory", async () => {
      const client = await connect(target.databaseUrl);
      try {
        expect(
          await scalar(
            client,
            "select current_setting('server_version_num') as value",
          ),
        ).toBe("180006");

        const migrations = await client.query<{
          readonly migration_id: string;
          readonly byte_checksum: string;
          readonly contract_digest: string | null;
        }>(
          `select migration_id, byte_checksum, contract_digest
             from keynes_internal.schema_migrations
            order by migration_id`,
        );
        expect(migrations.rows).toEqual(
          installationRecord.migrations.map((migration) => ({
            migration_id: migration.id,
            byte_checksum: migration.sha256,
            contract_digest: migration.contractDigest ?? null,
          })),
        );

        const objects = await client.query<{ readonly object_name: string }>(
          `select 'schema:' || nspname as object_name
             from pg_namespace
            where nspname in ('keynes', 'keynes_internal')
           union all
           select 'table:' || n.nspname || '.' || c.relname
             from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('keynes', 'keynes_internal')
              and c.relkind in ('r', 'p')
           union all
           select 'function:' || n.nspname || '.' || p.proname || '(' ||
                  replace(pg_get_function_identity_arguments(p.oid), ', ', ',') || ')'
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('keynes', 'keynes_internal')
           order by object_name`,
        );
        expect(objects.rows.map(({ object_name }) => object_name)).toEqual(
          [...expectedObjects].sort(),
        );
        expect(
          await scalar(
            client,
            "select contract_digest as value from keynes_internal.installation_identity",
          ),
        ).toBe(installationRecord.contractDigest);
      } finally {
        await client.end();
      }
    });

    it("checks owners, bodies, languages, security, and fixed search paths", async () => {
      const client = await connect(target.databaseUrl);
      try {
        const owners = await client.query<{ readonly owner: string }>(
          `select distinct owner
             from (
               select pg_get_userbyid(nspowner) as owner
                 from pg_namespace
                where nspname in ('keynes', 'keynes_internal')
               union all
               select pg_get_userbyid(c.relowner)
                 from pg_class c
                 join pg_namespace n on n.oid = c.relnamespace
                where n.nspname in ('keynes', 'keynes_internal')
               union all
               select pg_get_userbyid(p.proowner)
                 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                where n.nspname in ('keynes', 'keynes_internal')
             ) owned(owner)
            order by owner`,
        );
        expect(owners.rows).toEqual([{ owner: config.ownerRole }]);

        const functions = await client.query<{
          readonly target: string;
          readonly language: string;
          readonly returns: string;
          readonly security_definer: boolean;
          readonly search_path: string[] | null;
          readonly body: string;
        }>(
          `select n.nspname || '.' || p.proname as target,
                  l.lanname as language,
                  pg_get_function_result(p.oid) as returns,
                  p.prosecdef as security_definer,
                  coalesce(
                    string_to_array(
                      replace(replace(cfg, 'search_path=', ''), '"', ''),
                      ', '
                    ),
                    '{}'::text[]
                  ) as search_path,
                  pg_get_functiondef(p.oid) as body
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             join pg_language l on l.oid = p.prolang
             left join lateral unnest(p.proconfig) as config(cfg) on config.cfg like 'search_path=%'
            where n.nspname = 'keynes'
              and p.proargtypes = '3802'::oidvector
            order by target`,
        );

        expect(functions.rows).toHaveLength(expectedFunctions.length);
        for (const expected of expectedFunctions) {
          const actual = functions.rows.find(
            ({ target }) => target === expected.target,
          );
          expect(actual).toMatchObject({
            target: expected.target,
            language: expected.language,
            returns: expected.returnType,
            security_definer: expected.securityDefiner,
            search_path: expected.searchPath,
          });
          expect(actual?.body).toContain(
            `keynes_internal.${expected.operation === "getBudget" ? "get_budget" : "apply_command"}`,
          );
        }
      } finally {
        await client.end();
      }
    });

    it("checks bootstrap permissions and schema and function ACLs", async () => {
      const client = await connect(target.databaseUrl);
      try {
        const bootstrap = await client.query<{
          readonly tenant_id: string;
          readonly principal_id: string;
          readonly permission: string;
        }>(
          `select tenant_id::text, principal_id::text, permission
             from keynes_internal.principal_permissions
            where tenant_id = $1 and principal_id = $2
            order by permission`,
          [tenantId, principalId],
        );
        expect(bootstrap.rows.map(({ permission }) => permission)).toEqual([
          "create_root_budget",
          "define_resource_type",
          "read_budget",
          "request_budget",
          "settle_budget",
        ]);

        const acl = await client.query<{
          readonly public_schema: boolean;
          readonly application_schema: boolean;
          readonly private_schema: boolean;
          readonly public_execute: boolean;
          readonly application_execute: boolean;
        }>(
          `select has_schema_privilege('public', 'keynes', 'USAGE') as public_schema,
                  has_schema_privilege($1, 'keynes', 'USAGE') as application_schema,
                  has_schema_privilege($1, 'keynes_internal', 'USAGE') as private_schema,
                  bool_and(has_function_privilege('public', p.oid, 'EXECUTE')) as public_execute,
                  bool_and(has_function_privilege($1, p.oid, 'EXECUTE')) as application_execute
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'keynes'`,
          [config.applicationRole],
        );
        expect(acl.rows[0]).toEqual({
          public_schema: false,
          application_schema: true,
          private_schema: false,
          public_execute: false,
          application_execute: true,
        });
      } finally {
        await client.end();
      }
    });

    it("allows the application role to call exactly the five public functions", async () => {
      const client = await connect(target.applicationUrl);
      try {
        await client.query("begin");
        await client.query("select set_config('keynes.tenant_id', $1, true)", [
          tenantId,
        ]);
        await client.query(
          "select set_config('keynes.principal_id', $1, true)",
          [principalId],
        );
        await expect(
          client.query("select keynes.define_resource_type($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.defineConsumable),
          ]),
        ).resolves.toBeDefined();
        await expect(
          client.query("select keynes.create_budget($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.createRoot),
          ]),
        ).resolves.toBeDefined();
        await expect(
          client.query("select keynes.request($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.requestChild),
          ]),
        ).resolves.toBeDefined();
        await expect(
          client.query("select keynes.settle($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.settleChild),
          ]),
        ).resolves.toBeDefined();
        await expect(
          client.query("select keynes.get_budget($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.getChild),
          ]),
        ).resolves.toBeDefined();
        await client.query("rollback");
      } finally {
        await client.end();
      }
    });

    it("denies private and unsupported function access without changing state", async () => {
      const client = await connect(target.applicationUrl);
      try {
        const before = await stateDigest(target.databaseUrl);
        await expect(
          client.query(
            "select count(*) from keynes_internal.schema_migrations",
          ),
        ).rejects.toThrow();
        await expect(
          client.query(
            "select keynes_internal.apply_command($1::text, $2::jsonb)",
            [
              "requestBudget",
              JSON.stringify(fixtureSource.commands.requestChild),
            ],
          ),
        ).rejects.toThrow();
        await expect(
          client.query("select keynes_internal.get_budget($1::jsonb)", [
            JSON.stringify(fixtureSource.commands.getChild),
          ]),
        ).rejects.toThrow();
        expect(await stateDigest(target.databaseUrl)).toBe(before);
      } finally {
        await client.end();
      }
    });
  },
);

async function createExactShapeTarget(): Promise<NativeTarget> {
  const context = JSON.parse(process.env[PLATFORM_CONTEXT_ENV] ?? "") as {
    readonly administratorUrl: string;
  };
  const databaseName = `keynes_recheck_${randomUUID().replaceAll("-", "")}`;
  const administrator = new Client({
    connectionString: context.administratorUrl,
  });
  await administrator.connect();
  try {
    await administrator.query(
      `create role ${quoteIdentifier(config.ownerRole)} nologin`,
    );
    await administrator.query(
      `create role ${quoteIdentifier(config.applicationRole)} login password ${quoteLiteral("recheck-test-password")}`,
    );
    await administrator.query(
      `create database ${quoteIdentifier(databaseName)}`,
    );
    await administrator.query(
      `grant connect on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(config.applicationRole)}`,
    );
    await administrator.query(
      `grant create on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(config.ownerRole)}`,
    );
  } finally {
    await administrator.end();
  }

  const databaseUrl = new URL(context.administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  await install({ connectionString: databaseUrl.toString(), config });

  const applicationUrl = new URL(databaseUrl);
  applicationUrl.username = config.applicationRole;
  applicationUrl.password = "recheck-test-password";
  return {
    administratorUrl: context.administratorUrl,
    databaseName,
    databaseUrl: databaseUrl.toString(),
    applicationUrl: applicationUrl.toString(),
  };
}

async function connect(connectionString: string): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function scalar(client: Client, statement: string): Promise<string> {
  const result = await client.query<{ readonly value: string }>(statement);
  const value = result.rows[0]?.value;
  if (value === undefined)
    throw new Error(`Missing scalar result: ${statement}`);
  return value;
}

async function installationState(client: Client): Promise<unknown> {
  const migrations = await client.query(
    "select * from keynes_internal.schema_migrations order by migration_id",
  );
  const permissions = await client.query(
    "select * from keynes_internal.principal_permissions order by tenant_id, principal_id, permission",
  );
  const identity = await client.query(
    "select * from keynes_internal.installation_identity",
  );
  return {
    migrations: migrations.rows,
    permissions: permissions.rows,
    identity: identity.rows,
  };
}

async function stateDigest(connectionString: string): Promise<string> {
  const client = await connect(connectionString);
  try {
    const state = await installationState(client);
    return JSON.stringify(state);
  } finally {
    await client.end();
  }
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("unsafe test identifier");
  }
  return `"${value}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
