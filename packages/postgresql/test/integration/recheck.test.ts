import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { install, recheckInstallation } from "../../src/installer/install.ts";
import type { InstallationConfig } from "../../src/installer/config.ts";
import { Client } from "pg";
import installationRecord from "../../generated/installation-record.json" with { type: "json" };

const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

const fixtureSource = {
  commands: {
    defineConsumable: {
      commandId: "10000000-0000-0000-0000-000000000001",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    },
    createRoot: {
      commandId: "20000000-0000-0000-0000-000000000001",
      resources: [
        {
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 100,
        },
      ],
    },
    requestChild: {
      commandId: "30000000-0000-0000-0000-000000000001",
      parentBudgetId: "20000000-0000-0000-0000-000000000001",
      resources: [
        { resourceTypeId: "10000000-0000-0000-0000-000000000001", amount: 40 },
      ],
    },
    settleChild: {
      commandId: "40000000-0000-0000-0000-000000000001",
      budgetId: "30000000-0000-0000-0000-000000000001",
      usage: [
        { resourceTypeId: "10000000-0000-0000-0000-000000000001", amount: 25 },
      ],
    },
    getChild: { budgetId: "30000000-0000-0000-0000-000000000001" },
  },
};

const tenantId = "00000000-0000-4000-8000-000000000001";
const principalId = "00000000-0000-4000-8000-000000000101";

const expectedObjects = installationRecord.expectedObjects;
const expectedFunctions = installationRecord.functions;
const HISTORICAL_MIGRATIONS = [
  {
    id: "0001-storage",
    sha256: "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
    contractDigest: null,
  },
  {
    id: "0002-budget",
    sha256: "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
    contractDigest: null,
  },
  {
    id: "0003-public",
    sha256: "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
    contractDigest: null,
  },
  {
    id: "0004-policy",
    sha256: "d354c351b1144fe069def514c4700bcc92864f181079a6194cb832049bc4f28c",
    contractDigest:
      "f0aae48573f0c2e2fc017223d0762a43eb3cbc553924faa783eb963c9eed71a7",
  },
] as const;
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

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
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
        const querySpy = vi.spyOn(client, "query");
        await recheckInstallation({ client, config });
        expect(querySpy).toHaveBeenCalledWith("begin transaction read only");
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
        expect(
          installationRecord.migrations
            .slice(0, HISTORICAL_MIGRATIONS.length)
            .map((migration) => ({
              id: migration.id,
              sha256: migration.sha256,
              contractDigest: migration.contractDigest ?? null,
            })),
        ).toEqual(HISTORICAL_MIGRATIONS);
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

    it("rejects an otherwise exact target that lacks the final migration", async () => {
      const client = await connect(target.databaseUrl);
      try {
        const removed = await client.query<{
          readonly migration_id: string;
          readonly byte_checksum: string;
          readonly contract_digest: string | null;
        }>(
          `delete from keynes_internal.schema_migrations
            where migration_id = '0005-resource-bound-budget'
            returning migration_id, byte_checksum, contract_digest`,
        );
        const migration = removed.rows[0];
        if (migration === undefined) {
          throw new Error("final migration must be present before recheck");
        }

        try {
          await expect(
            recheckInstallation({ client, config }),
          ).rejects.toMatchObject({
            code: "incompatible_target",
            check: "migration:0005-resource-bound-budget",
          });
        } finally {
          await client.query(
            `insert into keynes_internal.schema_migrations
              (migration_id, byte_checksum, contract_digest)
             values ($1, $2, $3)`,
            [
              migration.migration_id,
              migration.byte_checksum,
              migration.contract_digest,
            ],
          );
        }
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
        await expectPublicSuccess(
          client,
          "keynes.define_resource_type",
          fixtureSource.commands.defineConsumable,
        );
        await expectPublicSuccess(
          client,
          "keynes.create_budget",
          fixtureSource.commands.createRoot,
        );
        await expectPublicSuccess(
          client,
          "keynes.request",
          fixtureSource.commands.requestChild,
        );
        await expectPublicSuccess(
          client,
          "keynes.settle",
          fixtureSource.commands.settleChild,
        );
        await expectPublicSuccess(
          client,
          "keynes.get_budget",
          fixtureSource.commands.getChild,
        );
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
  const context = JSON.parse(
    process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] ?? "",
  ) as {
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

async function expectPublicSuccess(
  client: Client,
  target:
    | "keynes.define_resource_type"
    | "keynes.create_budget"
    | "keynes.request"
    | "keynes.settle"
    | "keynes.get_budget",
  input: unknown,
): Promise<void> {
  const result = await client.query<{ readonly response: unknown }>(
    `select ${target}($1::jsonb) as response`,
    [JSON.stringify(input)],
  );
  expect(result.rows[0]?.response).toMatchObject({ ok: true });
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
