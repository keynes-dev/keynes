import type {
  ContractClientOptions,
  ContractTestHost,
  FixturePrincipal,
  RemoteContractTestHost,
  RollbackCheckpoint,
} from "@keynes/database/contract-tests";
import { createContractClient } from "@keynes/database/contract-tests";

import {
  createKeynesClient,
  createRemoteKeynesClient,
  type RemoteCommandExecutor,
} from "../../src/generated/client.js";
import { SqliteCommandExecutor } from "../../src/local/sqlite-command-executor.js";
import { SqliteStore } from "../../src/local/sqlite-store.js";
import { CommittedResponseLostError } from "../../src/replay.js";

const FIXTURE_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const FIXTURE_PRINCIPALS = {
  "definer-fixture": "00000000-0000-4000-8000-000000000101",
  "allocator-fixture": "00000000-0000-4000-8000-000000000102",
  "root-fixture": "00000000-0000-4000-8000-000000000108",
  "requester-fixture": "00000000-0000-4000-8000-000000000103",
  "settlement-fixture": "00000000-0000-4000-8000-000000000104",
  "reader-fixture": "00000000-0000-4000-8000-000000000105",
  "product-fixture": "00000000-0000-4000-8000-000000000106",
  "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
} as const satisfies Record<FixturePrincipal, string>;

const FIXTURE_INSTALLATION = {
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
      principalId: FIXTURE_PRINCIPALS["root-fixture"],
      permissions: ["define_resource_type", "create_root_budget"],
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
} as const;

export async function openSqliteContractTestHost(): Promise<ContractTestHost> {
  let armedCheckpoint: RollbackCheckpoint | undefined;
  const store = SqliteStore.open(FIXTURE_INSTALLATION);
  const executor = new SqliteCommandExecutor(
    store,
    {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    },
    (stage) => {
      if (stage === armedCheckpoint) {
        armedCheckpoint = undefined;
        throw new Error(`private rollback checkpoint: ${stage}`);
      }
    },
  );

  return {
    clientFor(fixture, options) {
      if (options?.forbidResourceWrites) store.forbidResourceWrites();
      const caller = loseCommittedResponseOnce(
        {
          async execute(operation, input) {
            armedCheckpoint = options?.checkpoint;
            try {
              return await executor.executeFor(
                {
                  tenantId: FIXTURE_TENANT_ID,
                  principalId: FIXTURE_PRINCIPALS[fixture],
                },
                operation,
                input,
              );
            } finally {
              armedCheckpoint = undefined;
            }
          },
        },
        options,
      );
      return {
        ...createKeynesClient(caller),
        defineResources: createContractClient(caller).defineResources,
        validateResources: createContractClient(caller).validateResources,
        createBudget: createContractClient(caller).createBudget,
      };
    },
    inspectState: async () => store.inspectState(),
    close: async () => executor.close(),
  };
}

export async function openRemoteContractTestHost(
  executor: RemoteCommandExecutor,
  closeExecutor: () => Promise<void> = async () => undefined,
): Promise<RemoteContractTestHost> {
  const client = createRemoteKeynesClient(executor);
  return {
    clientFor: () => client,
    close: closeExecutor,
  };
}

function loseCommittedResponseOnce(
  executor: Parameters<typeof createKeynesClient>[0],
  options: ContractClientOptions | undefined,
): Parameters<typeof createKeynesClient>[0] {
  let pending = options?.dropResponseAfterCommitOnce ?? false;
  return {
    async execute(operation, input) {
      const result = await executor.execute(operation, input);
      if (pending) {
        pending = false;
        throw new CommittedResponseLostError();
      }
      return result;
    },
  };
}
