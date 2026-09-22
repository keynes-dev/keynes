import { rootResources } from "@keynes/database/contract-tests";
import {
  preparePostgresInstallation,
  dropPostgresFixture,
} from "../system/support/postgres-database.js";
import { requirePostgresqlSystemAdministratorUrl } from "../system/support/test-keynes.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { install, recheckInstallation } from "../../src/installer/install.ts";
import type { InstallationConfig } from "../../src/installer/config.ts";
import { Client } from "pg";
import installationRecord from "../../generated/installation-record.json" with { type: "json" };
import {
  identifier,
  REMOTE_ADMIN_PROCEDURES,
  REMOTE_RUNTIME_PROCEDURES,
} from "../system/support/remote-identity.js";

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
      ...rootResources([
        {
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 100,
        },
      ]),
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
if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("PostgreSQL exact recheck and application-role permissions", () => {
  let target: Awaited<ReturnType<typeof createExactShapeTarget>>;
  let config: InstallationConfig;

  beforeAll(async () => {
    target = await createExactShapeTarget();
    config = target.config;
  });

  afterAll(async () => {
    try {
      await dropPostgresFixture(
        target.administrator,
        target.databaseName,
        target.roles,
      );
    } finally {
      await target.administrator.end();
    }
  });

  it("rechecks the exact baseline read-only", async () => {
    const client = await connect(target.databaseUrl);
    try {
      await client.query("begin");
      await client.query(`set local role ${identifier(config.ownerRole)}`);
      await client.query(
        "select set_config('keynes.tenant_id', $1, true), set_config('keynes.principal_id', $2, true)",
        [tenantId, principalId],
      );
      await client.query("select keynes.define_resource_type($1::jsonb)", [
        JSON.stringify(fixtureSource.commands.defineConsumable),
      ]);
      await client.query("select keynes.create_budget($1::jsonb)", [
        JSON.stringify(fixtureSource.commands.createRoot),
      ]);
      await client.query("commit");
      const before = await installationState(client);
      const querySpy = vi.spyOn(client, "query");
      await recheckInstallation({ client, config });
      expect(querySpy).toHaveBeenCalledWith("begin transaction read only");
      expect(await installationState(client)).toEqual(before);
    } finally {
      await client.end();
    }
  });

  it("rechecks a valid trigger with a restricted session search path", async () => {
    const client = await connect(target.databaseUrl);
    try {
      await client.query("set search_path = pg_catalog");
      await recheckInstallation({ client, config });
    } finally {
      await client.end();
    }
  });

  it("rejects an identity missing a required column before reading it", async () => {
    const client = await connect(target.databaseUrl);
    try {
      await client.query(
        "alter table keynes_internal.installation_identity rename column contract_digest to legacy_contract_digest",
      );
      try {
        const before = await installationState(client);

        await expect(
          recheckInstallation({ client, config }),
        ).rejects.toMatchObject({
          code: "incompatible_target",
          check: "installation-identity",
        });
        expect(await installationState(client)).toEqual(before);
      } finally {
        await client.query(
          "alter table keynes_internal.installation_identity rename column legacy_contract_digest to contract_digest",
        );
      }
    } finally {
      await client.end();
    }
  });

  it("rejects a profile-mismatched target without changing it", async () => {
    const client = await connect(target.databaseUrl);
    try {
      await client.query(
        "update keynes_internal.installation_identity set profile_id = 'legacy-managed-policy-profile' where singleton = true",
      );
      const before = await installationState(client);

      await expect(
        recheckInstallation({ client, config }),
      ).rejects.toMatchObject({
        code: "incompatible_target",
        check: "profile-id",
      });
      expect(await installationState(client)).toEqual(before);

      await client.query(
        "update keynes_internal.installation_identity set profile_id = $1 where singleton = true",
        [installationRecord.profileId],
      );
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
           union all
           select 'trigger:' || trigger_schema.nspname || '.' || t.tgname || ':' ||
                  relation_schema.nspname || '.' || relation.relname || ':' ||
                  trigger_schema.nspname || '.' || trigger_function.proname || '(' ||
                  replace(pg_get_function_identity_arguments(trigger_function.oid), ', ', ',') || ')' ||
                  ':' || t.tgenabled::text || ':' ||
                  t.tgtype::integer || ':' || case when t.tgqual is null then 'none' else 'when' end
             from pg_trigger t
             join pg_class relation on relation.oid = t.tgrelid
             join pg_namespace relation_schema on relation_schema.oid = relation.relnamespace
             join pg_proc trigger_function on trigger_function.oid = t.tgfoid
             join pg_namespace trigger_schema on trigger_schema.oid = trigger_function.pronamespace
            where relation_schema.nspname in ('keynes', 'keynes_internal')
              and not t.tgisinternal
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

  it("rejects an otherwise exact target that lacks the baseline ledger row", async () => {
    const client = await connect(target.databaseUrl);
    try {
      const removed = await client.query<{
        readonly migration_id: string;
        readonly byte_checksum: string;
        readonly contract_digest: string | null;
      }>(
        `delete from keynes_internal.schema_migrations
            where migration_id = '0001-baseline'
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
          check: "migration:0001-baseline",
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

  it("grants configured creation wrappers only to the runtime role", async () => {
    const client = await connect(target.databaseUrl);
    try {
      const privileges = await client.query(
        `select
           bool_and(coalesce(has_function_privilege($1, to_regprocedure(procedure), 'EXECUTE'), false)) as runtime_remote,
           bool_or(coalesce(has_function_privilege('public', to_regprocedure(procedure), 'EXECUTE'), false)) as public_remote,
           bool_or(coalesce(has_function_privilege($2, to_regprocedure(procedure), 'EXECUTE'), false)) as administration_remote,
           coalesce(has_function_privilege($1, to_regprocedure('keynes.validate_resources(jsonb)'), 'EXECUTE'), false) as runtime_canonical
         from unnest($3::text[]) procedure`,
        [
          config.applicationRole,
          config.administrationRole,
          [
            "keynes.remote_define_resources(jsonb)",
            "keynes.remote_validate_resources(jsonb)",
            "keynes.remote_recover_operation(jsonb)",
          ],
        ],
      );
      expect(privileges.rows).toEqual([
        {
          runtime_remote: true,
          public_remote: false,
          administration_remote: false,
          runtime_canonical: false,
        },
      ]);
    } finally {
      await client.end();
    }
  });

  it("rejects a missing definition receipt reference during exact recheck", async () => {
    const client = await connect(target.databaseUrl);
    try {
      const columns = await client.query(
        `select column_name from information_schema.columns where table_schema = 'keynes_internal'
          and table_name = 'commands' and column_name = 'binding_reference'`,
      );
      expect(columns.rows).toHaveLength(1);
      await client.query(
        "alter table keynes_internal.commands rename column binding_reference to drifted_binding_reference",
      );
      try {
        await expect(
          recheckInstallation({ client, config }),
        ).rejects.toMatchObject({ code: "incompatible_target" });
      } finally {
        await client.query(
          "alter table keynes_internal.commands rename column drifted_binding_reference to binding_reference",
        );
      }
      await recheckInstallation({ client, config });
    } finally {
      await client.end();
    }
  });

  it("rejects a missing unique definition receipt index during exact recheck", async () => {
    const client = await connect(target.databaseUrl);
    try {
      const indexes = await client.query<{
        readonly index_name: string;
        readonly definition: string;
      }>(
        `select i.indexrelid::regclass::text as index_name, pg_get_indexdef(i.indexrelid) as definition
          from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
          where i.indrelid = 'keynes_internal.commands'::regclass and i.indisunique
            and i.indnatts = 1 and a.attname = 'binding_reference'`,
      );
      expect(indexes.rows).toHaveLength(1);
      const index = indexes.rows[0];
      if (index === undefined)
        throw new Error("definition receipt index missing");
      await client.query(`drop index ${index.index_name}`);
      try {
        await expect(
          recheckInstallation({ client, config }),
        ).rejects.toMatchObject({ code: "incompatible_target" });
      } finally {
        await client.query(index.definition);
      }
      await recheckInstallation({ client, config });
    } finally {
      await client.end();
    }
  });

  it.each([
    {
      name: "missing quantity-movement trigger",
      mutate:
        "drop trigger quantity_movements_append_only on keynes_internal.quantity_movements",
      restore:
        "create trigger quantity_movements_append_only before insert or update or delete on keynes_internal.quantity_movements for each row execute function keynes_internal.guard_quantity_movement()",
    },
    {
      name: "disabled quantity-movement trigger",
      mutate:
        "alter table keynes_internal.quantity_movements disable trigger quantity_movements_append_only",
      restore:
        "alter table keynes_internal.quantity_movements enable trigger quantity_movements_append_only",
    },
    {
      name: "quantity-movement trigger with changed events",
      mutate: `drop trigger quantity_movements_append_only on keynes_internal.quantity_movements;
        create trigger quantity_movements_append_only before insert on keynes_internal.quantity_movements
        for each row execute function keynes_internal.guard_quantity_movement()`,
      restore:
        "drop trigger quantity_movements_append_only on keynes_internal.quantity_movements; create trigger quantity_movements_append_only before insert or update or delete on keynes_internal.quantity_movements for each row execute function keynes_internal.guard_quantity_movement()",
    },
    {
      name: "rebound quantity-movement trigger",
      mutate: `create function public.drifted_quantity_movement_trigger() returns trigger language plpgsql as $$ begin return new; end $$;
        drop trigger quantity_movements_append_only on keynes_internal.quantity_movements;
        create trigger quantity_movements_append_only before insert or update or delete on keynes_internal.quantity_movements
        for each row execute function public.drifted_quantity_movement_trigger()`,
      restore: `drop trigger quantity_movements_append_only on keynes_internal.quantity_movements;
        create trigger quantity_movements_append_only before insert or update or delete on keynes_internal.quantity_movements
        for each row execute function keynes_internal.guard_quantity_movement();
        drop function public.drifted_quantity_movement_trigger()`,
    },
  ])("rejects a $name during exact recheck", async ({ mutate, restore }) => {
    const client = await connect(target.databaseUrl);
    try {
      await client.query(mutate);
      try {
        await expect(
          recheckInstallation({ client, config }),
        ).rejects.toMatchObject({
          code: "incompatible_target",
          check: "object-inventory",
        });
      } finally {
        await client.query(restore);
      }
      await recheckInstallation({ client, config });
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
      expect(owners.rows).toEqual(
        [config.executionRole, config.ownerRole]
          .sort()
          .map((owner) => ({ owner })),
      );

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
              and p.proname not like 'remote_%' escape '\\'
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
        const delegatedTarget =
          expected.operation === "validateResources"
            ? "validate_resources_v0008"
            : expected.operation === "getBudget"
              ? "get_budget"
              : "apply_command";
        expect(actual?.body).toContain(`keynes_internal.${delegatedTarget}`);
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
        readonly application_remote_execute: boolean;
        readonly application_canonical_execute: boolean;
        readonly administration_execute: boolean;
        readonly administration_remote_execute: boolean;
        readonly execution_owns_remote: boolean;
      }>(
        `select has_schema_privilege('public', 'keynes', 'USAGE') as public_schema,
                  has_schema_privilege($1, 'keynes', 'USAGE') as application_schema,
                  has_schema_privilege($1, 'keynes_internal', 'USAGE') as private_schema,
                  bool_or(has_function_privilege('public', p.oid, 'EXECUTE')) as public_execute,
                  bool_and(coalesce(has_function_privilege($1, to_regprocedure(remote), 'EXECUTE'), false))
                    as application_remote_execute,
                  bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) filter (
                    where n.nspname = 'keynes' and p.proname not like 'remote_%' escape '\\'
                  ) as application_canonical_execute,
                  bool_and(coalesce(has_function_privilege($2, to_regprocedure(admin), 'EXECUTE'), false))
                    as administration_execute,
                  bool_or(has_function_privilege($2, p.oid, 'EXECUTE')) filter (
                    where n.nspname = 'keynes'
                  ) as administration_remote_execute,
                  bool_and(p.proowner = (select oid from pg_roles where rolname = $3)) filter (
                    where n.nspname = 'keynes' and p.proname like 'remote_%' escape '\\'
                  ) as execution_owns_remote
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             cross join unnest($4::text[]) remote
             cross join unnest($5::text[]) admin
            where n.nspname in ('keynes', 'keynes_internal')`,
        [
          config.applicationRole,
          config.administrationRole,
          config.executionRole,
          REMOTE_RUNTIME_PROCEDURES,
          REMOTE_ADMIN_PROCEDURES,
        ],
      );
      expect(acl.rows[0]).toEqual({
        public_schema: false,
        application_schema: true,
        private_schema: false,
        public_execute: false,
        application_remote_execute: true,
        application_canonical_execute: false,
        administration_execute: true,
        administration_remote_execute: false,
        execution_owns_remote: true,
      });
    } finally {
      await client.end();
    }
  });

  it("allows the application role to call exactly the ten remote functions", async () => {
    const client = await connect(target.databaseUrl);
    try {
      const privileges = await client.query<{
        readonly target: string;
        readonly permitted: boolean;
      }>(
        `select target,
                  coalesce(has_function_privilege($2, to_regprocedure(target), 'EXECUTE'), false)
                    as permitted
             from unnest($1::text[]) target
            order by target collate "C"`,
        [
          [...REMOTE_RUNTIME_PROCEDURES, ...REMOTE_ADMIN_PROCEDURES],
          config.applicationRole,
        ],
      );
      expect(privileges.rows).toEqual(
        [...REMOTE_ADMIN_PROCEDURES, ...REMOTE_RUNTIME_PROCEDURES]
          .sort()
          .map((target) => ({
            target,
            permitted: new Set<string>(REMOTE_RUNTIME_PROCEDURES).has(target),
          })),
      );
    } finally {
      await client.end();
    }
  });

  it("denies private and unsupported function access without changing state", async () => {
    const client = await connect(target.applicationUrl);
    try {
      const before = await stateDigest(target.databaseUrl);
      await expect(
        client.query("select keynes.create_budget($1::jsonb)", [
          JSON.stringify(fixtureSource.commands.createRoot),
        ]),
      ).rejects.toThrow();
      await expect(
        client.query("select count(*) from keynes_internal.schema_migrations"),
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
});

async function createExactShapeTarget() {
  const target = await preparePostgresInstallation(
    requirePostgresqlSystemAdministratorUrl(),
    { tenantId, principalId },
  );
  try {
    await install({
      connectionString: target.databaseUrl,
      config: target.config,
    });
    const applicationUrl = new URL(target.databaseUrl);
    applicationUrl.username = target.config.applicationRole;
    applicationUrl.password = target.applicationPassword;
    return { ...target, applicationUrl: applicationUrl.toString() };
  } catch (error: unknown) {
    try {
      await dropPostgresFixture(
        target.administrator,
        target.databaseName,
        target.roles,
      );
    } finally {
      await target.administrator.end();
    }
    throw error;
  }
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
  const resources = await client.query(
    "select * from keynes_internal.resource_types order by tenant_id, resource_type_id",
  );
  const budgets = await client.query(
    "select * from keynes_internal.budgets order by tenant_id, budget_id",
  );
  const commands = await client.query(
    "select * from keynes_internal.commands order by tenant_id, command_id",
  );
  return {
    migrations: migrations.rows,
    permissions: permissions.rows,
    identity: identity.rows,
    resources: resources.rows,
    budgets: budgets.rows,
    commands: commands.rows,
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
