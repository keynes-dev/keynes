import { randomUUID } from "node:crypto";

import { Client, type QueryResultRow } from "pg";

import {
  install,
  recheckInstallation,
} from "../../../src/installer/install.js";
import type { InstallationConfig } from "../../../src/installer/config.js";
import { requirePostgresqlSystemAdministratorUrl } from "./test-keynes.js";

export const REMOTE_TENANT_A = "00000000-0000-4000-8000-000000000021";
export const REMOTE_PRINCIPAL_A = "00000000-0000-4000-8000-000000000121";
export const REMOTE_TENANT_B = "00000000-0000-4000-8000-000000000022";
export const REMOTE_PRINCIPAL_B = "00000000-0000-4000-8000-000000000122";

export const REMOTE_RUNTIME_PROCEDURES = [
  "keynes.remote_create_budget(jsonb)",
  "keynes.remote_request(jsonb)",
  "keynes.remote_settle(jsonb)",
  "keynes.remote_get_budget(jsonb)",
  "keynes.remote_get_budget_history_page(jsonb)",
  "keynes.remote_open_budget(jsonb)",
  "keynes.remote_recover_operation(jsonb)",
  "keynes.remote_get_compatibility(jsonb)",
] as const;

export const REMOTE_ADMIN_PROCEDURES = [
  "keynes_internal.register_remote_role_v0006(name,uuid,uuid)",
  "keynes_internal.rotate_remote_role_v0006(name,name)",
  "keynes_internal.set_remote_role_enabled_v0006(name,boolean)",
  "keynes_internal.revoke_remote_role_v0006(name)",
  "keynes_internal.inspect_remote_role_v0006(name)",
  "keynes_internal.audit_remote_role_v0006(name,integer)",
] as const;

const BOOTSTRAP_PERMISSIONS = [
  "create_root_budget",
  "define_resource_type",
  "read_budget",
  "request_budget",
  "settle_budget",
] as const;

export interface RemoteLogin {
  readonly role: string;
  readonly password: string;
  readonly tenantId: string;
  readonly principalId: string;
}

export interface RemoteIdentityFixture {
  readonly administrator: Client;
  readonly administratorUrl: string;
  readonly databaseName: string;
  readonly databaseUrl: string;
  readonly ownerRole: string;
  readonly executionRole: string;
  readonly administrationRole: string;
  readonly administrationPassword: string;
  readonly primary: RemoteLogin;
  readonly secondary: RemoteLogin;
  readonly config: InstallationConfig;
  connect(login?: Pick<RemoteLogin, "role" | "password">): Promise<Client>;
  provision(login: RemoteLogin): Promise<void>;
  register(login: RemoteLogin): Promise<unknown>;
  rotate(oldRole: string, newRole: string): Promise<unknown>;
  setEnabled(role: string, enabled: boolean): Promise<void>;
  roleOid(role: string): Promise<number>;
  recreate(login: RemoteLogin): Promise<number>;
  recheck(): Promise<void>;
  close(): Promise<void>;
}

export async function openRemoteIdentityFixture(): Promise<RemoteIdentityFixture> {
  const administratorUrl = requirePostgresqlSystemAdministratorUrl();
  const serverAdministrator = new Client({
    connectionString: administratorUrl,
  });
  await serverAdministrator.connect();

  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `keynes_remote_${suffix}`;
  const ownerRole = `keynes_owner_${suffix}`;
  const executionRole = `keynes_execution_${suffix}`;
  const administrationRole = `keynes_admin_${suffix}`;
  const primary = login(
    `keynes_remote_a_${suffix}`,
    REMOTE_TENANT_A,
    REMOTE_PRINCIPAL_A,
  );
  const secondary = login(
    `keynes_remote_b_${suffix}`,
    REMOTE_TENANT_B,
    REMOTE_PRINCIPAL_B,
  );
  const administrationPassword = randomUUID();
  const createdRoles = [
    primary.role,
    secondary.role,
    administrationRole,
    executionRole,
    ownerRole,
  ] as const;

  try {
    await serverAdministrator.query(
      `create role ${identifier(ownerRole)} nologin`,
    );
    await serverAdministrator.query(
      `create role ${identifier(executionRole)} nologin noinherit`,
    );
    await serverAdministrator.query(
      `create role ${identifier(administrationRole)} login noinherit password ${literal(administrationPassword)}`,
    );
    await createLoginRole(serverAdministrator, primary);
    await createLoginRole(serverAdministrator, secondary);
    await serverAdministrator.query(
      `create database ${identifier(databaseName)}`,
    );
    await serverAdministrator.query(
      `grant ${identifier(ownerRole)} to ${identifier(new URL(administratorUrl).username)}`,
    );
    await serverAdministrator.query(
      `grant create on database ${identifier(databaseName)} to ${identifier(ownerRole)}`,
    );
    await serverAdministrator.query(
      `grant connect on database ${identifier(databaseName)} to ${createdRoles
        .filter((role) => role !== ownerRole && role !== executionRole)
        .map(identifier)
        .join(", ")}`,
    );
  } catch (error: unknown) {
    await dropFixture(serverAdministrator, databaseName, createdRoles);
    await serverAdministrator.end();
    throw error;
  }

  const databaseUrl = databaseUrlFor(administratorUrl, databaseName);
  const config: InstallationConfig = {
    ownerRole,
    executionRole,
    administrationRole,
    applicationRole: primary.role,
    tenantId: primary.tenantId,
    principalId: primary.principalId,
  };
  let databaseAdministrator: Client | undefined;
  const clients = new Set<Client>();
  let closed = false;

  try {
    await install({ connectionString: databaseUrl, config });
    databaseAdministrator = new Client({ connectionString: databaseUrl });
    await databaseAdministrator.connect();
  } catch (error: unknown) {
    await databaseAdministrator?.end();
    await dropFixture(serverAdministrator, databaseName, createdRoles);
    await serverAdministrator.end();
    throw error;
  }

  const administrator = databaseAdministrator;
  const administer = async (
    statement: string,
    values: unknown[],
  ): Promise<unknown> => {
    const client = new Client({
      connectionString: urlFor(databaseUrl, {
        role: administrationRole,
        password: administrationPassword,
      }),
    });
    await client.connect();
    try {
      const result = await client.query<{ readonly response: unknown }>(
        statement,
        values,
      );
      return result.rows[0]?.response;
    } finally {
      await client.end();
    }
  };
  const readRoleOid = async (role: string): Promise<number> => {
    const result = await serverAdministrator.query<{ readonly oid: number }>(
      "select oid from pg_roles where rolname = $1",
      [role],
    );
    const oid = result.rows[0]?.oid;
    if (oid === undefined) throw new Error(`missing fixture role ${role}`);
    return oid;
  };
  return {
    administrator,
    administratorUrl,
    databaseName,
    databaseUrl,
    ownerRole,
    executionRole,
    administrationRole,
    administrationPassword,
    primary,
    secondary,
    config,
    async connect(selected) {
      const client = new Client({
        connectionString:
          selected === undefined ? databaseUrl : urlFor(databaseUrl, selected),
      });
      await client.connect();
      clients.add(client);
      client.once("end", () => clients.delete(client));
      return client;
    },
    async provision(selected) {
      await installPermissions(administrator, selected);
      await grantRuntimeProcedures(administrator, selected.role);
    },
    async register(selected) {
      await installPermissions(administrator, selected);
      await grantRuntimeProcedures(administrator, selected.role);
      return administer(
        "select keynes_internal.register_remote_role_v0006($1::name, $2::uuid, $3::uuid) as response",
        [selected.role, selected.tenantId, selected.principalId],
      );
    },
    rotate(oldRole, newRole) {
      return administer(
        "select keynes_internal.rotate_remote_role_v0006($1::name, $2::name) as response",
        [oldRole, newRole],
      );
    },
    async setEnabled(role, enabled) {
      await administer(
        "select keynes_internal.set_remote_role_enabled_v0006($1::name, $2::boolean) as response",
        [role, enabled],
      );
    },
    roleOid: readRoleOid,
    async recreate(selected) {
      await administrator.query(`drop owned by ${identifier(selected.role)}`);
      await serverAdministrator.query(`drop role ${identifier(selected.role)}`);
      await createLoginRole(serverAdministrator, selected);
      await serverAdministrator.query(
        `grant connect on database ${identifier(databaseName)} to ${identifier(selected.role)}`,
      );
      await grantRuntimeProcedures(administrator, selected.role);
      return readRoleOid(selected.role);
    },
    recheck: () => recheckInstallation({ client: administrator, config }),
    async close() {
      if (closed) return;
      closed = true;
      await Promise.allSettled([...clients].map((client) => client.end()));
      await administrator.end();
      await dropFixture(serverAdministrator, databaseName, createdRoles);
      await serverAdministrator.end();
    },
  };
}

async function installPermissions(
  client: Client,
  selected: RemoteLogin,
): Promise<void> {
  for (const permission of BOOTSTRAP_PERMISSIONS) {
    await client.query(
      `insert into keynes_internal.principal_permissions
         (tenant_id, principal_id, permission)
       values ($1::uuid, $2::uuid, $3)
       on conflict do nothing`,
      [selected.tenantId, selected.principalId, permission],
    );
  }
}

async function grantRuntimeProcedures(
  client: Client,
  role: string,
): Promise<void> {
  await client.query(`grant usage on schema keynes to ${identifier(role)}`);
  for (const procedure of REMOTE_RUNTIME_PROCEDURES) {
    const exists = await client.query<{ readonly present: boolean }>(
      "select to_regprocedure($1) is not null as present",
      [procedure],
    );
    if (exists.rows[0]?.present === true) {
      await client.query(
        `grant execute on function ${procedure} to ${identifier(role)}`,
      );
    }
  }
}

function login(
  role: string,
  tenantId: string,
  principalId: string,
): RemoteLogin {
  return { role, password: randomUUID(), tenantId, principalId };
}

function createLoginRole(
  client: Client,
  selected: RemoteLogin,
): Promise<unknown> {
  return client.query(
    `create role ${identifier(selected.role)} login noinherit password ${literal(selected.password)}`,
  );
}

async function dropFixture(
  administrator: Client,
  databaseName: string,
  roles: readonly string[],
): Promise<void> {
  await administrator.query(
    `drop database if exists ${identifier(databaseName)} with (force)`,
  );
  for (const role of roles) {
    await administrator.query(`drop role if exists ${identifier(role)}`);
  }
}

function databaseUrlFor(
  administratorUrl: string,
  databaseName: string,
): string {
  const url = new URL(administratorUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function urlFor(
  databaseUrl: string,
  login: Pick<RemoteLogin, "role" | "password">,
): string {
  const url = new URL(databaseUrl);
  url.username = login.role;
  url.password = login.password;
  return url.toString();
}

export function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) throw new Error("invalid identifier");
  return `"${value}"`;
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function queryResponse(
  client: Client,
  procedure: string,
  input: unknown,
): Promise<unknown> {
  const result = await client.query<
    { readonly response: unknown } & QueryResultRow
  >(`select ${procedure}($1::jsonb) as response`, [JSON.stringify(input)]);
  return result.rows[0]?.response;
}
