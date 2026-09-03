import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";

import { runInstalledCommand as runPackedPostgresql } from "@keynes/testkit/package";

import { PROCEDURES } from "../../src/generated/procedures.ts";

const INSTALLATION_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_PRINCIPAL_ID = "00000000-0000-4000-8000-000000000101";

export const CONTROLLED_IDENTITIES = {
  "tenant-a-product": {
    tenantId: "00000000-0000-0000-0000-000000000001",
    principalId: "00000000-0000-0000-0000-000000000016",
  },
  "tenant-a-unauthorized": {
    tenantId: "00000000-0000-0000-0000-000000000001",
    principalId: "00000000-0000-0000-0000-000000000017",
  },
  "tenant-b-product": {
    tenantId: "00000000-0000-0000-0000-000000000002",
    principalId: "00000000-0000-0000-0000-000000000026",
  },
} as const;

export interface CloudSystemDatabaseProvision {
  readonly administratorUrl: string;
  readonly databaseName: string;
  readonly ownerRole: string;
  readonly serviceRole: string;
  readonly servicePassword: string;
}

export interface ProvisionedCloudSystemDatabase {
  readonly serviceUrl: string;
}

export async function provisionCloudSystemDatabase(
  provision: CloudSystemDatabaseProvision,
  postgresqlCommandPath: string,
): Promise<ProvisionedCloudSystemDatabase> {
  requireIdentifier(provision.databaseName);
  requireIdentifier(provision.ownerRole);
  requireIdentifier(provision.serviceRole);

  const administrator = new Client({
    connectionString: provision.administratorUrl,
  });
  await administrator.connect();
  try {
    await administrator.query(
      `create role ${quoteIdentifier(provision.ownerRole)} nologin`,
    );
    await administrator.query(
      `create role ${quoteIdentifier(provision.serviceRole)}
       login password ${quoteLiteral(provision.servicePassword)}`,
    );
    await administrator.query(
      `create database ${quoteIdentifier(provision.databaseName)}`,
    );
    await administrator.query(
      `revoke all on database ${quoteIdentifier(provision.databaseName)} from public`,
    );
    await administrator.query(
      `grant connect on database ${quoteIdentifier(provision.databaseName)}
       to ${quoteIdentifier(provision.serviceRole)}`,
    );
    await administrator.query(
      `grant create on database ${quoteIdentifier(provision.databaseName)}
       to ${quoteIdentifier(provision.ownerRole)}`,
    );
  } finally {
    await administrator.end();
  }

  const ownerUrl = selectDatabase(
    provision.administratorUrl,
    provision.databaseName,
  );
  await installCloudSystemSchema(
    ownerUrl,
    provision.ownerRole,
    provision.serviceRole,
    postgresqlCommandPath,
  );

  return {
    serviceUrl: selectRole(
      ownerUrl,
      provision.serviceRole,
      provision.servicePassword,
    ),
  };
}

export async function installCloudSystemSchema(
  ownerUrl: string,
  ownerRole: string,
  serviceRole: string,
  postgresqlCommandPath: string,
): Promise<void> {
  await installPackedPostgresql(
    ownerUrl,
    ownerRole,
    serviceRole,
    postgresqlCommandPath,
  );
  const owner = new Client({ connectionString: ownerUrl });
  await owner.connect();
  try {
    await installControlledPermissions(owner);
    await configureRuntimeRole(owner, serviceRole);
  } finally {
    await owner.end();
  }
}

export async function dropCloudSystemDatabase(
  provision: CloudSystemDatabaseProvision,
): Promise<void> {
  const administrator = new Client({
    connectionString: provision.administratorUrl,
  });
  await administrator.connect();
  try {
    await administrator.query(
      `drop database if exists ${quoteIdentifier(provision.databaseName)} with (force)`,
    );
    await administrator.query(
      `drop role if exists ${quoteIdentifier(provision.serviceRole)}`,
    );
    await administrator.query(
      `drop role if exists ${quoteIdentifier(provision.ownerRole)}`,
    );
  } finally {
    await administrator.end();
  }
}

async function installPackedPostgresql(
  ownerUrl: string,
  ownerRole: string,
  serviceRole: string,
  postgresqlCommandPath: string,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "keynes-cloud-install-"));
  const configPath = join(directory, "config.json");
  try {
    await writeFile(
      configPath,
      `${JSON.stringify({
        ownerRole,
        applicationRole: serviceRole,
        tenantId: INSTALLATION_TENANT_ID,
        principalId: INSTALLATION_PRINCIPAL_ID,
      })}\n`,
    );
    const connection = new URL(ownerUrl);
    const result = runPackedPostgresql(
      postgresqlCommandPath,
      ["install", "--config", configPath],
      {
        ...process.env,
        PGHOST: connection.hostname,
        PGPORT: connection.port,
        PGDATABASE: connection.pathname.slice(1),
        PGUSER: decodeURIComponent(connection.username),
        PGPASSWORD: decodeURIComponent(connection.password),
      },
    );
    if (result.status !== 0) {
      throw new Error(
        `Packed PostgreSQL installation failed: ${result.stderr || result.stdout}`,
      );
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function installControlledPermissions(client: Client): Promise<void> {
  for (const identity of [
    CONTROLLED_IDENTITIES["tenant-a-product"],
    CONTROLLED_IDENTITIES["tenant-b-product"],
  ]) {
    for (const { permissions } of Object.values(PROCEDURES)) {
      for (const permission of permissions) {
        await client.query(
          `insert into keynes_internal.principal_permissions
             (tenant_id, principal_id, permission)
           values ($1, $2, $3)
           on conflict do nothing`,
          [identity.tenantId, identity.principalId, permission],
        );
      }
    }
  }
}

async function configureRuntimeRole(
  client: Client,
  serviceRole: string,
): Promise<void> {
  const role = quoteIdentifier(serviceRole);
  await client.query("revoke all on schema keynes from public");
  for (const procedure of Object.values(PROCEDURES)) {
    await client.query(
      `revoke all on function ${procedure.target}(jsonb) from public`,
    );
  }
  await client.query(`grant usage on schema keynes to ${role}`);
  await client.query(`grant usage on schema keynes_internal to ${role}`);
  await client.query(
    `grant select on keynes_internal.schema_migrations to ${role}`,
  );
  for (const procedure of Object.values(PROCEDURES)) {
    await client.query(
      `grant execute on function ${procedure.target}(jsonb) to ${role}`,
    );
  }
}

export function selectDatabase(
  connectionUrl: string,
  databaseName: string,
): string {
  const url = new URL(connectionUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export function selectRole(
  connectionUrl: string,
  role: string,
  password: string,
): string {
  const url = new URL(connectionUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}

function requireIdentifier(value: string): void {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("Invalid Cloud system database identifier");
  }
}

function quoteIdentifier(value: string): string {
  requireIdentifier(value);
  return `"${value}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
