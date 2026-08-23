import { PGlite } from "@electric-sql/pglite";

import { createKeynesClient, type KeynesClient } from "../generated/client.js";
import { installDatabase } from "./migrations.js";
import {
  PGliteOwner,
  PGliteProcedureCaller,
  type RollbackCheckpoint,
} from "./procedure-caller.js";

const FIXTURE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const FIXTURE_PRINCIPALS = {
  "definer-fixture": "00000000-0000-4000-8000-000000000101",
  "allocator-fixture": "00000000-0000-4000-8000-000000000102",
  "requester-fixture": "00000000-0000-4000-8000-000000000103",
  "settlement-fixture": "00000000-0000-4000-8000-000000000104",
  "reader-fixture": "00000000-0000-4000-8000-000000000105",
  "product-fixture": "00000000-0000-4000-8000-000000000106",
  "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
} as const;

export type FixturePrincipal = keyof typeof FIXTURE_PRINCIPALS;

export interface ClientFixtureOptions {
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export interface LocalKeynes {
  clientFor(
    fixture: FixturePrincipal,
    options?: ClientFixtureOptions,
  ): KeynesClient;
  close(): Promise<void>;
}

export async function openLocalKeynes(): Promise<LocalKeynes> {
  const database = await PGlite.create("memory://");
  const owner = new PGliteOwner(database);

  try {
    await installDatabase(database, {
      tenantId: FIXTURE_TENANT_ID,
      principals: FIXTURE_PRINCIPALS,
    });
  } catch (error: unknown) {
    await owner.close();
    throw error;
  }

  return {
    clientFor(fixture, options) {
      return createKeynesClient(
        new PGliteProcedureCaller(owner, {
          tenantId: FIXTURE_TENANT_ID,
          principalId: FIXTURE_PRINCIPALS[fixture],
          checkpoint: options?.checkpoint,
          dropResponseAfterCommitOnce: options?.dropResponseAfterCommitOnce,
        }),
      );
    },
    close() {
      return owner.close();
    },
  };
}
