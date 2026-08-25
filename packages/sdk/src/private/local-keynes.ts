import { PGlite } from "@electric-sql/pglite";

import {
  createKeynesClient,
  type KeynesClient,
  type ProcedureCaller,
} from "../generated/client.js";
import { installDatabase, type DatabaseInstallation } from "./migrations.js";
import {
  createPGliteProcedureCaller,
  PGliteOwner,
  type RollbackCheckpoint,
} from "./procedure-caller.js";

export const FIXTURE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

export const FIXTURE_PRINCIPALS = {
  "definer-fixture": "00000000-0000-4000-8000-000000000101",
  "allocator-fixture": "00000000-0000-4000-8000-000000000102",
  "requester-fixture": "00000000-0000-4000-8000-000000000103",
  "settlement-fixture": "00000000-0000-4000-8000-000000000104",
  "reader-fixture": "00000000-0000-4000-8000-000000000105",
  "product-fixture": "00000000-0000-4000-8000-000000000106",
  "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
} as const;

export type FixturePrincipal = keyof typeof FIXTURE_PRINCIPALS;

export const FIXTURE_INSTALLATION = {
  tenantId: FIXTURE_TENANT_ID,
  principals: [
    {
      principalId: FIXTURE_PRINCIPALS["definer-fixture"],
      permissions: ["define_resource_type"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["allocator-fixture"],
      permissions: ["create_root_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["requester-fixture"],
      permissions: ["request_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["settlement-fixture"],
      permissions: ["settle_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["reader-fixture"],
      permissions: ["read_budget"],
    },
    {
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
    {
      principalId: FIXTURE_PRINCIPALS["unauthorized-fixture"],
      permissions: [],
    },
  ],
} as const satisfies DatabaseInstallation;

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

export interface KeynesCallerHost {
  callerFor(
    fixture: FixturePrincipal,
    options?: ClientFixtureOptions,
  ): ProcedureCaller;
  close(): Promise<void>;
}

export interface ProductLocalKeynes {
  readonly client: KeynesClient;
  close(): Promise<void>;
}

const PRODUCT_TENANT_ID = "00000000-0000-4000-8000-000000000002";
const PRODUCT_PRINCIPAL_ID = "00000000-0000-4000-8000-000000000201";
const PRODUCT_INSTALLATION = {
  tenantId: PRODUCT_TENANT_ID,
  principals: [
    {
      principalId: PRODUCT_PRINCIPAL_ID,
      permissions: [
        "define_resource_type",
        "create_root_budget",
        "request_budget",
        "settle_budget",
        "read_budget",
      ],
    },
  ],
} as const satisfies DatabaseInstallation;

export async function openLocalKeynesCallerHost(): Promise<KeynesCallerHost> {
  const owner = await openPGliteOwner(FIXTURE_INSTALLATION);

  return {
    callerFor(fixture, options) {
      return createPGliteProcedureCaller(owner, {
        tenantId: FIXTURE_TENANT_ID,
        principalId: FIXTURE_PRINCIPALS[fixture],
        checkpoint: options?.checkpoint,
        dropResponseAfterCommitOnce: options?.dropResponseAfterCommitOnce,
      });
    },
    close() {
      return owner.close();
    },
  };
}

export async function openProductLocalKeynes(): Promise<ProductLocalKeynes> {
  const owner = await openPGliteOwner(PRODUCT_INSTALLATION);
  return {
    client: createKeynesClient(
      createPGliteProcedureCaller(owner, {
        tenantId: PRODUCT_TENANT_ID,
        principalId: PRODUCT_PRINCIPAL_ID,
      }),
    ),
    close: () => owner.close(),
  };
}

export async function openLocalKeynes(): Promise<LocalKeynes> {
  const host = await openLocalKeynesCallerHost();
  return {
    clientFor: (fixture, options) =>
      createKeynesClient(host.callerFor(fixture, options)),
    close: () => host.close(),
  };
}

async function openPGliteOwner(
  installation: DatabaseInstallation,
): Promise<PGliteOwner> {
  const database = await PGlite.create("memory://");
  const owner = new PGliteOwner(database);
  try {
    await installDatabase(database, installation);
    return owner;
  } catch (error: unknown) {
    try {
      await owner.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "Local Keynes initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }
}
