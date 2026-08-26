import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";
import { install as installPostgres } from "../src/install.ts";

const PLATFORM_CONTEXT_ENV = "KEYNES_PLATFORM_CONTEXT";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const PRINCIPAL_ID = "00000000-0000-4000-8000-000000000101";

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
}

interface PgClientConstructor {
  new (options: { readonly connectionString: string }): PgClient;
  readonly prototype: PgClient;
}

const { Client } = createRequire(
  new URL("../../sdk/package.json", import.meta.url),
)("pg") as { readonly Client: PgClientConstructor };

interface InstallationConfig {
  readonly ownerRole: string;
  readonly applicationRole: string;
  readonly tenantId: string;
  readonly principalId: string;
}

interface InstallationResult {
  readonly ok: true;
  readonly outcome: "installed" | "already-installed";
}

interface InstallationError {
  readonly code: string;
  readonly check?: string;
}

interface Target {
  readonly administratorUrl: string;
  readonly databaseUrl: string;
  readonly databaseName: string;
  readonly ownerRole: string;
  readonly applicationRole: string;
  readonly applicationPassword: string;
  readonly operatorRole: string;
  readonly operatorPassword: string;
  readonly administrator: Client;
  readonly config: InstallationConfig;
}

const targets: Target[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(targets.splice(0).map((target) => closeTarget(target)));
});

describe.skipIf(process.env[PLATFORM_CONTEXT_ENV] === undefined)(
  "native PostgreSQL installation",
  () => {
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
      const after = await installationSnapshot(target);

      expect(result).toMatchObject({
        ok: true,
        outcome: "already-installed",
      });
      expect(after).toEqual(before);
    });

    it("rejects an unsupported PostgreSQL version before mutation", async () => {
      const target = await openTarget();
      mockServerVersion("170000");

      await expect(install(target)).rejects.toMatchObject<InstallationError>({
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
      ).rejects.toMatchObject<InstallationError>({
        code: "insufficient_privilege",
      });
      expect(await schemasExist(target)).toBe(false);
    });

    it("rejects missing owner and application roles", async () => {
      const target = await openTarget({ createRoles: false });

      await expect(install(target)).rejects.toMatchObject<InstallationError>({
        code: "missing_role",
      });
      expect(await schemasExist(target)).toBe(false);
    });

    it("rejects an incompatible partial target without repairing it", async () => {
      const target = await openTarget();
      await query(target, "create schema keynes");

      await expect(install(target)).rejects.toMatchObject<InstallationError>({
        code: "incompatible_target",
      });
      expect(await schemasExist(target)).toBe(true);
      expect(await privateSchemaExists(target)).toBe(false);
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

      await expect(install(target)).rejects.toMatchObject<InstallationError>({
        code: "incompatible_target",
        check: "migration:0001-storage",
      });
      expect(await installationSnapshot(target)).not.toEqual(before);
      expect(await migrationChecksum(target, "0001-storage")).toBe(
        "0".repeat(64),
      );
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

      await expect(install(target)).rejects.toMatchObject<InstallationError>({
        code: "incompatible_target",
        check: "contract-digest",
      });
      expect(await installationSnapshot(target)).toEqual(before);
    });

    it("rolls back every migration after an injected failure", async () => {
      const target = await openTarget();
      const failure = new Error("injected migration failure");
      const originalQuery = Client.prototype.query;
      const querySpy = vi.spyOn(Client.prototype, "query");
      querySpy.mockImplementation(async (...args) => {
        const statement = args[0];
        if (typeof statement === "string" && statement.includes("0002")) {
          throw failure;
        }
        return await originalQuery.apply(this, args);
      });

      await expect(install(target)).rejects.toThrow();
      expect(await schemasExist(target)).toBe(false);
    });
  },
);

async function install(
  input: Target & { readonly connectionString?: string },
): Promise<InstallationResult> {
  return installPostgres({
    connectionString: input.connectionString ?? input.databaseUrl,
    config: input.config,
  });
}

async function openTarget(options: { readonly createRoles?: boolean } = {}) {
  const administratorUrl = requireAdministratorUrl();
  const administrator = new Client({ connectionString: administratorUrl });
  await administrator.connect();

  const suffix = randomUUID().replaceAll("-", "");
  const databaseName = `keynes_install_${suffix}`;
  const ownerRole = `keynes_owner_${suffix}`;
  const applicationRole = `keynes_app_${suffix}`;
  const operatorRole = `keynes_operator_${suffix}`;
  const applicationPassword = randomUUID();
  const operatorPassword = randomUUID();
  await administrator.query(`create database ${identifier(databaseName)}`);
  if (options.createRoles !== false) {
    await administrator.query(`create role ${identifier(ownerRole)} nologin`);
    await administrator.query(
      `create role ${identifier(applicationRole)} login password ${literal(applicationPassword)}`,
    );
    await administrator.query(
      `create role ${identifier(operatorRole)} login password ${literal(operatorPassword)}`,
    );
    await administrator.query(
      `grant connect on database ${identifier(databaseName)} to ${identifier(applicationRole)}, ${identifier(operatorRole)}`,
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
    applicationRole,
    applicationPassword,
    operatorRole,
    operatorPassword,
    administrator,
    config: {
      ownerRole,
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
      target.ownerRole,
      target.applicationRole,
      target.operatorRole,
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
) {
  const client = new Client({ connectionString: target.databaseUrl });
  await client.connect();
  try {
    return await client.query(statement, parameters);
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
    this: Client,
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

function requireAdministratorUrl(): string {
  const source = process.env[PLATFORM_CONTEXT_ENV];
  if (source === undefined) {
    throw new Error(
      "native PostgreSQL installation tests require the platform runner",
    );
  }
  const context: unknown = JSON.parse(source);
  if (
    typeof context !== "object" ||
    context === null ||
    !("administratorUrl" in context) ||
    typeof context.administratorUrl !== "string"
  ) {
    throw new Error("invalid platform context");
  }
  return context.administratorUrl;
}

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) throw new Error("invalid identifier");
  return `"${value}"`;
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
