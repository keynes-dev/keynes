import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { install as installPostgres } from "../../src/installer/install.ts";
import { installPostgresFixture } from "../system/support/postgres-database.js";
import {
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemInstallation,
} from "../system/support/test-keynes.js";

const POSTGRESQL_SYSTEM_CONTEXT_ENV = "KEYNES_POSTGRESQL_SYSTEM_CONTEXT";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const PRINCIPAL_ID = "00000000-0000-4000-8000-000000000101";

interface InstallationConfig {
  readonly ownerRole: string;
  readonly executionRole: string;
  readonly administrationRole: string;
  readonly applicationRole: string;
  readonly tenantId: string;
  readonly principalId: string;
}

interface InstallationResult {
  readonly ok: true;
  readonly outcome: "installed" | "already-installed";
}

interface Target {
  readonly administratorUrl: string;
  readonly databaseUrl: string;
  readonly databaseName: string;
  readonly ownerRole: string;
  readonly executionRole: string;
  readonly administrationRole: string;
  readonly applicationRole: string;
  readonly applicationPassword: string;
  readonly operatorRole: string;
  readonly operatorPassword: string;
  readonly administrator: InstanceType<typeof Client>;
  readonly config: InstallationConfig;
}

const targets: Target[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(targets.splice(0).map((target) => closeTarget(target)));
});

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("native PostgreSQL installation", () => {
  it("installs a fresh target atomically", async () => {
    const target = await openTarget();
    const result = await install(target);

    expect(result).toMatchObject({ ok: true, outcome: "installed" });
    const state = await query(
      target,
      `
        select
          to_regnamespace('keynes') is not null as public_schema,
          to_regnamespace('keynes_internal') is not null as private_schema,
          exists (
            select 1 from keynes_internal.installation_identity
            where singleton = true
          ) as identity
      `,
    );
    expect(state.rows[0]).toEqual({
      public_schema: true,
      private_schema: true,
      identity: true,
    });
  });

  it("returns an exact no-op result without changing installed state", async () => {
    const target = await openTarget();
    await install(target);
    const before = await installationSnapshot(target);

    const result = await install(target);
    await installPostgresFixture(
      target.databaseUrl,
      target.config,
      requirePostgresqlSystemInstallation(),
      "already-installed",
    );
    const after = await installationSnapshot(target);

    expect(result).toMatchObject({
      ok: true,
      outcome: "already-installed",
    });
    expect(after).toEqual(before);
  });

  it("installs configured-creation migration 0008 after immutable history", async () => {
    const target = await openTarget();
    await install(target);

    const migrations = await query(
      target,
      `select migration_id, contract_digest
           from keynes_internal.schema_migrations
          order by migration_id`,
    );
    expect(migrations.rows.map(({ migration_id }) => migration_id)).toEqual([
      "0001-storage",
      "0002-budget",
      "0003-public",
      "0004-policy",
      "0005-resource-bound-budget",
      "0006-remote-access",
      "0007-resource-definitions",
      "0008-configured-creation",
    ]);
    expect(migrations.rows).toHaveLength(8);
    expect(migrations.rows.at(-3)?.contract_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(migrations.rows.at(-2)?.contract_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(migrations.rows.at(-1)?.contract_digest).toMatch(/^[0-9a-f]{64}$/);
    expect(migrations.rows.at(-1)?.contract_digest).not.toBe(
      migrations.rows.at(-2)?.contract_digest,
    );
  });

  it("moves Resource provenance to the defining command", async () => {
    const target = await openTarget();
    await install(target);

    const provenance = await query(
      target,
      `select
           exists (
             select 1
               from information_schema.columns
              where table_schema = 'keynes_internal'
                and table_name = 'resource_types'
                and column_name = 'definition_command_id'
                and is_nullable = 'NO'
           ) as definition_command_id,
           exists (
             select 1
               from pg_constraint
              where conrelid = 'keynes_internal.resource_types'::regclass
                and contype = 'f'
                and pg_get_constraintdef(oid) like
                  'FOREIGN KEY (tenant_id, definition_command_id) REFERENCES keynes_internal.commands%'
           ) as definition_command_reference,
           not exists (
             select 1
               from pg_constraint
              where conrelid = 'keynes_internal.resource_types'::regclass
                and contype = 'f'
                and pg_get_constraintdef(oid) like
                  'FOREIGN KEY (tenant_id, resource_type_id) REFERENCES keynes_internal.commands%'
           ) as independent_resource_identity`,
    );
    expect(provenance.rows[0]).toEqual({
      definition_command_id: true,
      definition_command_reference: true,
      independent_resource_identity: true,
    });
  });

  it("rejects an unsupported PostgreSQL version before mutation", async () => {
    const target = await openTarget();
    mockServerVersion("170000");

    await expect(install(target)).rejects.toMatchObject({
      code: "unsupported_postgresql",
      check: "server-version",
    });
    expect(await schemasExist(target)).toBe(false);
  });

  it("rejects an operator without installation privilege before mutation", async () => {
    const target = await openTarget();
    const operatorUrl = new URL(target.databaseUrl);
    operatorUrl.username = target.operatorRole;
    operatorUrl.password = target.operatorPassword;

    await expect(
      install({
        ...target,
        connectionString: operatorUrl.toString(),
      }),
    ).rejects.toMatchObject({
      code: "insufficient_privilege",
    });
    expect(await schemasExist(target)).toBe(false);
  });

  it("rejects missing prepared owner, execution, administration, and application roles", async () => {
    const target = await openTarget({ createRoles: false });

    await expect(install(target)).rejects.toMatchObject({
      code: "missing_role",
    });
    expect(await schemasExist(target)).toBe(false);
  });

  it("rejects role login and database privilege contract violations", async () => {
    const cases = [
      {
        check: "owner-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.ownerRole)} login`,
          ),
      },
      {
        check: "owner-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `revoke create on database ${identifier(target.databaseName)} from ${identifier(target.ownerRole)}`,
          ),
      },
      {
        check: "execution-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.executionRole)} login`,
          ),
      },
      {
        check: "execution-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.executionRole)} inherit`,
          ),
      },
      {
        check: "administration-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.administrationRole)} nologin`,
          ),
      },
      {
        check: "administration-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.administrationRole)} inherit`,
          ),
      },
      {
        check: "application-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.applicationRole)} nologin`,
          ),
      },
      {
        check: "application-role",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.applicationRole)} inherit`,
          ),
      },
      {
        check: "application-role",
        mutate: async (target: Target) => {
          await target.administrator.query(
            `revoke connect on database ${identifier(target.databaseName)} from public`,
          );
          await target.administrator.query(
            `revoke connect on database ${identifier(target.databaseName)} from ${identifier(target.applicationRole)}`,
          );
        },
      },
      {
        check: "application-private-access",
        mutate: (target: Target) =>
          target.administrator.query(
            `alter role ${identifier(target.applicationRole)} superuser`,
          ),
      },
    ] as const;

    for (const candidate of cases) {
      const target = await openTarget();
      await candidate.mutate(target);
      await expect(install(target)).rejects.toMatchObject({
        code: "insufficient_privilege",
        check: candidate.check,
      });
      expect(await schemasExist(target)).toBe(false);
    }
  });

  it("rejects an application role with membership in any privileged role", async () => {
    for (const privilegedRole of [
      "ownerRole",
      "executionRole",
      "administrationRole",
    ] as const) {
      const target = await openTarget();
      await target.administrator.query(
        `grant ${identifier(target[privilegedRole])} to ${identifier(target.applicationRole)}`,
      );

      await expect(install(target)).rejects.toMatchObject({
        code: "insufficient_privilege",
        check: "application-private-access",
      });
      expect(await schemasExist(target)).toBe(false);
    }
  });

  it("rejects an incompatible partial target without repairing it", async () => {
    const target = await openTarget();
    await query(target, "create schema keynes");

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
    });
    expect(await schemasExist(target)).toBe(true);
    expect(await privateSchemaExists(target)).toBe(false);
  });

  it("classifies two empty Keynes schemas as incompatible live state", async () => {
    const target = await openTarget();
    await query(target, "create schema keynes; create schema keynes_internal");

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
      check: "object-inventory",
    });
    expect(await schemasExist(target)).toBe(true);
    expect(await privateSchemaExists(target)).toBe(true);
  });

  it("rejects a migration-byte mismatch without changing the target", async () => {
    const target = await openTarget();
    await install(target);
    const before = await installationSnapshot(target);
    await query(
      target,
      `update keynes_internal.schema_migrations
         set byte_checksum = repeat('0', 64)
         where migration_id = '0001-storage'`,
    );

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
      check: "migration:0001-storage",
    });
    expect(await installationSnapshot(target)).not.toEqual(before);
    expect(await migrationChecksum(target, "0001-storage")).toBe(
      "0".repeat(64),
    );
  });

  it("rejects a migration contract-digest mismatch", async () => {
    const target = await openTarget();
    await install(target);
    await query(
      target,
      `update keynes_internal.schema_migrations
         set contract_digest = repeat('0', 64)
         where migration_id = '0003-public'`,
    );

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
      check: "migration:0003-public",
    });
  });

  it("rejects a contract mismatch without changing the target", async () => {
    const target = await openTarget();
    await install(target);
    await query(
      target,
      `update keynes_internal.installation_identity
         set contract_digest = repeat('0', 64)
         where singleton = true`,
    );
    const before = await installationSnapshot(target);

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
      check: "contract-digest",
    });
    expect(await installationSnapshot(target)).toEqual(before);
  });

  it("rejects a changed live function body during exact recheck", async () => {
    const target = await openTarget();
    await install(target);
    await query(
      target,
      `create or replace function keynes.request(input jsonb)
         returns jsonb
         language sql
         security definer
         set search_path = pg_catalog, keynes_internal
         as $$ select '{}'::jsonb $$`,
    );

    await expect(install(target)).rejects.toMatchObject({
      code: "incompatible_target",
      check: "function:keynes.request(input jsonb)",
    });
  });

  it("rejects changed live function security properties", async () => {
    const target = await openTarget();
    await install(target);
    await query(
      target,
      "alter function keynes.request(jsonb) security invoker",
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "function:keynes.request(input jsonb)",
    });

    await query(
      target,
      `alter function keynes.request(jsonb) security definer;
         alter function keynes.request(jsonb) reset all`,
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "function:keynes.request(input jsonb)",
    });
  });

  it("rejects live object, permission, ownership, and ACL drift", async () => {
    const target = await openTarget();
    await install(target);

    await query(target, "create view keynes.unexpected as select 1 as value");
    await expect(install(target)).rejects.toMatchObject({
      check: "object-inventory",
    });
    await query(target, "drop view keynes.unexpected");

    await query(
      target,
      `delete from keynes_internal.principal_permissions
          where tenant_id = $1 and principal_id = $2 and permission = 'read_budget'`,
      [TENANT_ID, PRINCIPAL_ID],
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "bootstrap-permissions",
    });
    await query(
      target,
      `insert into keynes_internal.principal_permissions
          (tenant_id, principal_id, permission)
         values ($1, $2, 'read_budget')`,
      [TENANT_ID, PRINCIPAL_ID],
    );

    await query(
      target,
      `alter function keynes.request(jsonb) owner to ${identifier(target.operatorRole)}`,
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "object-owners",
    });
    await query(
      target,
      `alter function keynes.request(jsonb) owner to ${identifier(target.ownerRole)}`,
    );

    await query(
      target,
      `alter function keynes.remote_get_budget(jsonb) owner to ${identifier(target.operatorRole)}`,
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "object-owners",
    });
    await query(
      target,
      `alter function keynes.remote_get_budget(jsonb) owner to ${identifier(target.executionRole)}`,
    );

    await query(
      target,
      `grant usage on schema keynes_internal to ${identifier(target.applicationRole)}`,
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "access-boundary",
    });
    await query(
      target,
      `revoke usage on schema keynes_internal from ${identifier(target.applicationRole)}`,
    );
    await query(
      target,
      "grant execute on function keynes_internal.get_budget(jsonb) to public",
    );
    await expect(install(target)).rejects.toMatchObject({
      check: "access-boundary",
    });
  });

  it("rolls back every migration after an injected failure", async () => {
    const target = await openTarget();
    const failure = new Error("injected migration failure");
    let injectionReached = false;
    const originalQuery = Client.prototype.query;
    const querySpy = vi.spyOn(Client.prototype, "query");
    querySpy.mockImplementation(async function (
      this: InstanceType<typeof Client>,
      ...args
    ) {
      const statement = args[0];
      if (
        typeof statement === "string" &&
        statement.includes("CREATE FUNCTION keynes_internal.raise_domain_error")
      ) {
        injectionReached = true;
        throw failure;
      }
      return await originalQuery.apply(this, args);
    });

    await expect(install(target)).rejects.toBe(failure);
    querySpy.mockRestore();
    expect(injectionReached).toBe(true);
    expect(await schemasExist(target)).toBe(false);
  });
});

async function install(
  input: Target & { readonly connectionString?: string },
): Promise<InstallationResult> {
  return installPostgres({
    connectionString: input.connectionString ?? input.databaseUrl,
    config: input.config,
  });
}

async function openTarget(options: { readonly createRoles?: boolean } = {}) {
  const administratorUrl = requirePostgresqlSystemAdministratorUrl();
  const administrator = new Client({ connectionString: administratorUrl });
  await administrator.connect();

  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `keynes_install_${suffix}`;
  const ownerRole = `keynes_owner_${suffix}`;
  const executionRole = `keynes_execution_${suffix}`;
  const administrationRole = `keynes_admin_${suffix}`;
  const applicationRole = `keynes_app_${suffix}`;
  const operatorRole = `keynes_operator_${suffix}`;
  const applicationPassword = randomUUID();
  const operatorPassword = randomUUID();
  await administrator.query(`create database ${identifier(databaseName)}`);
  if (options.createRoles !== false) {
    await administrator.query(`create role ${identifier(ownerRole)} nologin`);
    await administrator.query(
      `create role ${identifier(executionRole)} nologin noinherit`,
    );
    await administrator.query(
      `create role ${identifier(administrationRole)} login noinherit password ${literal(randomUUID())}`,
    );
    await administrator.query(
      `create role ${identifier(applicationRole)} login noinherit password ${literal(applicationPassword)}`,
    );
    await administrator.query(
      `create role ${identifier(operatorRole)} login password ${literal(operatorPassword)}`,
    );
    await administrator.query(
      `grant connect on database ${identifier(databaseName)} to ${identifier(administrationRole)}, ${identifier(applicationRole)}, ${identifier(operatorRole)}`,
    );
    await administrator.query(
      `grant create on database ${identifier(databaseName)} to ${identifier(ownerRole)}`,
    );
  }

  const databaseUrl = new URL(administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const target: Target = {
    administratorUrl,
    databaseUrl: databaseUrl.toString(),
    databaseName,
    ownerRole,
    executionRole,
    administrationRole,
    applicationRole,
    applicationPassword,
    operatorRole,
    operatorPassword,
    administrator,
    config: {
      ownerRole,
      executionRole,
      administrationRole,
      applicationRole,
      tenantId: TENANT_ID,
      principalId: PRINCIPAL_ID,
    },
  };
  targets.push(target);
  return target;
}

async function closeTarget(target: Target): Promise<void> {
  try {
    await target.administrator.query(
      `drop database if exists ${identifier(target.databaseName)} with (force)`,
    );
    for (const role of [
      target.applicationRole,
      target.administrationRole,
      target.executionRole,
      target.operatorRole,
      target.ownerRole,
    ]) {
      await target.administrator.query(
        `drop role if exists ${identifier(role)}`,
      );
    }
  } finally {
    await target.administrator.end();
  }
}

async function query(
  target: Target,
  statement: string,
  parameters?: readonly unknown[],
): Promise<{ readonly rows: readonly Record<string, unknown>[] }> {
  const client = new Client({ connectionString: target.databaseUrl });
  await client.connect();
  try {
    return await client.query<Record<string, unknown>>(
      statement,
      parameters === undefined ? undefined : [...parameters],
    );
  } finally {
    await client.end();
  }
}

async function installationSnapshot(target: Target) {
  return query(
    target,
    `select jsonb_build_object(
       'migrations', (select jsonb_agg(to_jsonb(row) order by migration_id)
         from keynes_internal.schema_migrations row),
       'identity', (select to_jsonb(row) from keynes_internal.installation_identity row)
     ) as snapshot`,
  );
}

async function migrationChecksum(target: Target, migrationId: string) {
  const result = await query(
    target,
    "select byte_checksum from keynes_internal.schema_migrations where migration_id = $1",
    [migrationId],
  );
  return result.rows[0]?.byte_checksum;
}

async function schemasExist(target: Target): Promise<boolean> {
  const result = await query(
    target,
    "select to_regnamespace('keynes') is not null or to_regnamespace('keynes_internal') is not null as present",
  );
  return result.rows[0]?.present === true;
}

async function privateSchemaExists(target: Target): Promise<boolean> {
  const result = await query(
    target,
    "select to_regnamespace('keynes_internal') is not null as present",
  );
  return result.rows[0]?.present === true;
}

function mockServerVersion(version: string): void {
  const originalQuery = Client.prototype.query;
  vi.spyOn(Client.prototype, "query").mockImplementation(async function (
    this: InstanceType<typeof Client>,
    statement,
    ...parameters
  ) {
    if (
      typeof statement === "string" &&
      statement.includes("server_version_num")
    ) {
      return { rows: [{ server_version_num: version }] };
    }
    return originalQuery.call(this, statement, ...parameters);
  });
}

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) throw new Error("invalid identifier");
  return `"${value}"`;
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
