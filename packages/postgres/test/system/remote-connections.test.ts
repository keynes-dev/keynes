import { Client } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  connectWithVerifiedTls,
  openRemoteConnection,
  poolerMode,
  unavailableDatabaseUrl,
  selectedConnectionProfiles,
} from "./support/remote-connections.js";
import {
  openRemoteIdentityFixture,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

const CONNECTION_PROFILES = selectedConnectionProfiles();

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("remote PostgreSQL connection profiles", () => {
  let fixture: RemoteIdentityFixture | undefined;
  let connection: Client | undefined;

  afterEach(async () => {
    await connection?.end();
    connection = undefined;
    await fixture?.close();
    fixture = undefined;
  });

  it.each(CONNECTION_PROFILES)(
    "derives the same identity through the %s profile",
    async (profile) => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      connection = await openRemoteConnection(
        fixture.databaseUrl,
        fixture.primary,
        profile,
      );

      expect(await compatibility(connection)).toMatchObject({ ok: true });
      const identity = await connection.query<{
        readonly session_user: string;
        readonly current_user: string;
      }>("select session_user, current_user");
      expect(identity.rows).toEqual([
        {
          session_user: fixture.primary.role,
          current_user: fixture.primary.role,
        },
      ]);
    },
  );

  if (CONNECTION_PROFILES.length === 3) {
    it("proves the runner routes through the requested PgBouncer modes", async () => {
      expect(await poolerMode("session-pool")).toBe("session");
      expect(await poolerMode("transaction-pool")).toBe("transaction");
    });
  } else {
    for (const profile of CONNECTION_PROFILES)
      if (profile !== "direct") {
        it(`proves the runner routes through the ${profile} mode`, async () => {
          expect(await poolerMode(profile)).toBe(
            profile === "session-pool" ? "session" : "transaction",
          );
        });
      }
  }

  it.each(CONNECTION_PROFILES)(
    "clears transaction-local identity after a %s call",
    async (profile) => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      connection = await openRemoteConnection(
        fixture.databaseUrl,
        fixture.primary,
        profile,
      );

      expect(await compatibility(connection)).toMatchObject({ ok: true });
      const settings = await connection.query<{
        readonly tenant: string | null;
        readonly principal: string | null;
      }>(
        `select nullif(current_setting('keynes.tenant_id', true), '') as tenant,
                  nullif(current_setting('keynes.principal_id', true), '') as principal`,
      );
      expect(settings.rows).toEqual([{ tenant: null, principal: null }]);
    },
  );

  it("rejects the native TLS endpoint without its trusted root", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);

    await expect(
      connectWithVerifiedTls(fixture.databaseUrl, fixture.primary),
    ).rejects.toThrow(/certificate/iu);
  });

  it.each(CONNECTION_PROFILES.filter((profile) => profile !== "direct"))(
    "rejects the plaintext %s endpoint when verified TLS is required",
    async (profile) => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      await expect(
        connectWithVerifiedTls(fixture.databaseUrl, fixture.primary, profile),
      ).rejects.toThrow(/ssl/iu);
    },
  );

  it("fails closed when the database is unavailable", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = new Client({
      connectionString: unavailableDatabaseUrl(fixture.databaseUrl),
      connectionTimeoutMillis: 500,
    });

    await expect(client.connect()).rejects.toThrow();
    await client.end().catch(() => undefined);
  });
});

async function compatibility(connection: Client): Promise<unknown> {
  const result = await connection.query<{ readonly response: unknown }>(
    "select keynes.remote_get_compatibility('{}'::jsonb) as response",
  );
  return result.rows[0]?.response;
}
