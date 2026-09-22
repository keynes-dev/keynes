import { afterEach, describe, expect, it } from "vitest";

import { loadPublicPostgresql } from "../support/packed-package.js";
import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import { openInstalledPostgresDatabase } from "./support/postgres-database.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemInstallation,
  requirePostgresqlSystemTlsRootCertificate,
} from "./support/test-keynes.js";
import {
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

const resources = {
  modelTokens: { unit: "token", accountingBehavior: "consumable" },
} as const;

describe("Remote Policy middleware", () => {
  let fixture: RemoteIdentityFixture | undefined;
  let closeKeynes: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeKeynes?.();
    closeKeynes = undefined;
    await fixture?.close();
    fixture = undefined;
  });

  async function openPublicFixture() {
    const modules = await loadPublicPostgresql(
      requirePostgresqlSystemInstallation(),
    );
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const bootstrap = await fixture.connect(fixture.primary);
    try {
      await queryResponse(bootstrap, "keynes.remote_define_resources", {
        operationKey: modules.createOperationKey(),
        definitions: resources,
      });
    } finally {
      await bootstrap.end();
    }
    const url = new URL(fixture.databaseUrl);
    url.username = fixture.primary.role;
    url.password = fixture.primary.password;
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.set(
      "sslrootcert",
      requirePostgresqlSystemTlsRootCertificate(),
    );
    const keynes = await modules.createKeynes({
      resources,
      runtime: modules.postgres({ databaseUrl: url.toString() }),
    });
    closeKeynes = () => keynes.close();
    return { keynes, createOperationKey: modules.createOperationKey };
  }

  it("rejects a Remote Policy plus operation key before proposal capture or callback invocation", async () => {
    const { keynes, createOperationKey } = await openPublicFixture();
    const root = await keynes.createBudget({ modelTokens: 10 });
    expect(root).not.toHaveProperty("prepareRequest");
    let proposalReads = 0;
    let policyCalls = 0;
    const proposal = new Proxy(
      { modelTokens: 1 },
      {
        ownKeys(target) {
          proposalReads += 1;
          return Reflect.ownKeys(target);
        },
      },
    );

    await expect(
      Reflect.apply(root.request, root, [
        proposal,
        {
          operationKey: createOperationKey(),
          policy() {
            policyCalls += 1;
            return { kind: "prepared", request: { modelTokens: 1 } };
          },
        },
      ]),
    ).rejects.toMatchObject({
      code: "invalid_configuration",
      details: { field: "operationKey" },
    });
    expect(proposalReads).toBe(0);
    expect(policyCalls).toBe(0);
  });

  it("replays a retained prepared command exactly, rejects changed input, and does not rerun Policy", async () => {
    const { keynes, createOperationKey } = await openPublicFixture();
    const root = await keynes.createBudget({ modelTokens: 10 });
    let policyCalls = 0;
    const policy = () => {
      policyCalls += 1;
      return { kind: "prepared" as const, request: { modelTokens: 3 } };
    };
    const prepared = await policy();
    const key = createOperationKey();

    const first = await root.request(prepared.request, { operationKey: key });
    const replay = await root.request(prepared.request, { operationKey: key });
    expect(first.status).toBe("approved");
    expect(replay.status).toBe("approved");
    expect(policyCalls).toBe(1);
    expect((await root.inspect()).history.entries).toHaveLength(2);
    await expect(
      root.request({ modelTokens: 2 }, { operationKey: key }),
    ).rejects.toMatchObject({ code: "command_conflict" });
    expect(policyCalls).toBe(1);
  });

  it("replays a retained prepared denial without rerunning Policy", async () => {
    const { keynes, createOperationKey } = await openPublicFixture();
    const root = await keynes.createBudget({ modelTokens: 1 });
    let policyCalls = 0;
    const policy = () => {
      policyCalls += 1;
      return { kind: "prepared" as const, request: { modelTokens: 2 } };
    };
    const prepared = await policy();
    const key = createOperationKey();

    await expect(
      root.request(prepared.request, { operationKey: key }),
    ).resolves.toMatchObject({ status: "denied" });
    await expect(
      root.request(prepared.request, { operationKey: key }),
    ).resolves.toMatchObject({ status: "denied" });
    expect(policyCalls).toBe(1);
    expect((await root.inspect()).history.entries).toHaveLength(2);
  });
});

describe("borrowed PostgreSQL Policy middleware", () => {
  it("leaves a Policy-submitted command for the caller to roll back", async () => {
    const modules = await loadPublicPostgresql(
      requirePostgresqlSystemInstallation(),
    );
    const database = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemInstallation(),
    );
    const application = await database.createApplicationRole();
    const connection = new modules.Client({
      connectionString: application.connectionString,
    });
    await connection.connect();
    try {
      await connection.query(
        "select set_config('keynes.tenant_id',$1,false), set_config('keynes.principal_id',$2,false)",
        [FIXTURE_TENANT_ID, FIXTURE_PRINCIPALS["product-fixture"]],
      );
      await connection.query("select keynes.define_resources($1::jsonb)", [
        JSON.stringify({
          commandId: "10000000-0000-4000-8000-000000000001",
          definitions: resources,
        }),
      ]);
      const before = (
        await database.database.query<{ readonly count: number }>(
          "select count(*)::integer as count from keynes_internal.commands",
        )
      ).rows;
      await connection.query("begin");
      await connection.query(
        "select set_config('keynes.tenant_id',$1,true), set_config('keynes.principal_id',$2,true)",
        [FIXTURE_TENANT_ID, FIXTURE_PRINCIPALS["product-fixture"]],
      );
      const keynes = await modules.createKeynes({
        resources,
        runtime: modules.postgres({ connection }),
      });
      try {
        const root = await keynes.createBudget({ modelTokens: 2 });
        let policyCalls = 0;

        await expect(
          Reflect.apply(root.request, root, [
            { modelTokens: 1 },
            {
              policy() {
                policyCalls += 1;
                return { kind: "prepared", request: { modelTokens: 1 } };
              },
            },
          ]),
        ).resolves.toMatchObject({
          status: "submitted",
          allocation: { status: "approved" },
        });
        expect(policyCalls).toBe(1);
      } finally {
        await keynes.close();
      }
      await connection.query("rollback");
      expect(
        (
          await database.database.query<{ readonly count: number }>(
            "select count(*)::integer as count from keynes_internal.commands",
          )
        ).rows,
      ).toEqual(before);
    } finally {
      await connection.query("rollback");
      await connection.end();
      await database.close();
    }
  });
});
