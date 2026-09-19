import type {
  ContractClientOptions,
  ContractTestHost,
  FixturePrincipal,
  RemoteContractTestHost,
} from "@keynes/contracts/contract-tests";
import { createContractClient } from "@keynes/contracts/contract-tests";

import {
  createKeynesClient,
  createRemoteKeynesClient,
  type RemoteCommandExecutor,
} from "../../src/generated/client.js";
import type { PgliteDatabase } from "../../src/local/install.js";
import { PgliteCommandExecutor } from "../../src/local/pglite-command-executor.js";
import { CommittedResponseLostError } from "../../src/replay.js";
import { openPgliteHost } from "../unit/support/pglite-host.js";

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

export async function openPgliteContractTestHost(): Promise<ContractTestHost> {
  const host = await openPgliteHost();
  try {
    await installFixturePermissions(host.database);
  } catch (error: unknown) {
    try {
      await host.close();
    } catch (cleanupFailure: unknown) {
      throw new AggregateError(
        [error, cleanupFailure],
        "PGlite fixture initialization and cleanup failed",
        { cause: error },
      );
    }
    throw error;
  }

  return {
    async inspectState() {
      const result = await host.database.query<
        Awaited<ReturnType<ContractTestHost["inspectState"]>>
      >(`
        select
          (select count(*)::integer from keynes_internal.resource_types) as resources,
          (select count(*)::integer from keynes_internal.commands where result is not null) as commands,
          (select count(*)::integer from keynes_internal.budgets) as budgets,
          (select count(*)::integer from keynes_internal.budget_resources) as holdings,
          (select count(*)::integer from keynes_internal.budget_history_entries) as history,
          (select coalesce(sum(allocated_amount), 0)::double precision from keynes_internal.budget_resources) as quantity
      `);
      const state = result.rows[0];
      if (state === undefined)
        throw new Error("Missing authority state counts");
      return state;
    },
    clientFor(fixture, options) {
      const executor = new PgliteCommandExecutor(host.database, {
        tenantId: FIXTURE_TENANT_ID,
        principalId: FIXTURE_PRINCIPALS[fixture],
        checkpoint: options?.checkpoint,
      });
      let forbidResourceWrites = options?.forbidResourceWrites ?? false;
      const caller = loseCommittedResponseOnce(
        {
          async execute(operation, input) {
            if (forbidResourceWrites) {
              await installResourceWriteProhibition(host.database);
              forbidResourceWrites = false;
            }
            return executor.execute(operation, input);
          },
        },
        options,
      );
      return createContractClient(caller);
    },
    close: host.close,
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

async function installFixturePermissions(
  database: PgliteDatabase,
): Promise<void> {
  for (const principal of FIXTURE_INSTALLATION.principals) {
    for (const permission of principal.permissions) {
      await database.query(
        `insert into keynes_internal.principal_permissions
           (tenant_id, principal_id, permission)
         values ($1, $2, $3)
         on conflict do nothing`,
        [FIXTURE_TENANT_ID, principal.principalId, permission],
      );
    }
  }
}

async function installResourceWriteProhibition(
  database: PgliteDatabase,
): Promise<void> {
  await database.exec(`
    create function keynes_internal.forbid_resource_write_test()
    returns trigger language plpgsql as $test$
    begin raise exception 'private Resource write prohibition'; end;
    $test$;
    create trigger forbid_resource_write_test before insert or update or delete
    on keynes_internal.resource_types for each statement
    execute function keynes_internal.forbid_resource_write_test();
  `);
}
