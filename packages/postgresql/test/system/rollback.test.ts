import { afterEach, describe, expect, it } from "vitest";

import {
  createContractClient,
  type ContractClient,
  type ContractTestHost,
} from "@keynes/contracts/contract-tests";

import { openInstalledPostgresDatabase } from "./support/postgres-database.js";
import { createTransactionProcedureCaller } from "./support/procedure-caller.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  openPostgresqlContractTestHost,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemCommandPath,
} from "./support/test-keynes.js";

const ROOT_COMMAND_ID = "26000000-0000-4000-8000-000000000001";
const RETRY_DEFINITION_ID = "16000000-0000-4000-8000-000000000001";
const MALFORMED_PROJECTION_ROOT_ID = "26000000-0000-4000-8000-000000000002";

describe("PostgreSQL Resource-bound root authorization and rollback", () => {
  let keynes: ContractTestHost;

  afterEach(async () => {
    await keynes?.close();
  });

  it("requires definition then root-allocation permission", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "permission_tokens");

    await expect(
      keynes.clientFor("allocator-fixture").createBudget(command),
    ).rejects.toMatchObject({
      code: "unauthorized",
      details: {
        operation: "createBudget",
        requiredPermission: "define_resource_type",
      },
    });
    await expect(
      keynes.clientFor("definer-fixture").createBudget(command),
    ).rejects.toMatchObject({
      code: "unauthorized",
      details: {
        operation: "createBudget",
        requiredPermission: "create_root_budget",
      },
    });
  });

  it("rolls back an inserted Resource at its private checkpoint", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "checkpoint_tokens");
    const product = keynes.clientFor("product-fixture", {
      checkpoint: "after_resource_insertion",
    });

    await expect(product.createBudget(command)).rejects.toThrow(
      "private rollback checkpoint: after_resource_insertion",
    );

    const defined = await keynes.clientFor("definer-fixture").defineResource({
      commandId: RETRY_DEFINITION_ID,
      definition: command.resources[0].definition,
    });
    expect(defined).toMatchObject({
      definitionEvidence: { commandId: RETRY_DEFINITION_ID },
      replayed: false,
    });
  });

  it("rejects a malformed root projection without committing authority state", async () => {
    const owner = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemCommandPath(),
    );
    try {
      await owner.database.exec(
        `create or replace function keynes_internal.budget_projection(
           selected_tenant uuid,
           selected_budget uuid
         ) returns jsonb
         language sql
         stable
         as $projection$ select '{}'::jsonb $projection$`,
      );
      const application = await owner.createApplicationRole();
      const transaction = await owner.beginTransactionAs(
        application.role,
        application.password,
      );
      try {
        const client = createContractClient(
          createTransactionProcedureCaller(transaction.connection, {
            tenantId: FIXTURE_TENANT_ID,
            principalId: FIXTURE_PRINCIPALS["product-fixture"],
          }),
        );
        await expect(
          client.createBudget(
            resourceBoundRoot(
              MALFORMED_PROJECTION_ROOT_ID,
              "malformed_projection_tokens",
            ),
          ),
        ).rejects.toThrow("invalid CreateBudget result");
        await transaction.commit();
      } finally {
        await transaction.close();
      }

      const state = await owner.database.query<{
        readonly commands: string;
        readonly resources: string;
        readonly budgets: string;
        readonly holdings: string;
        readonly streams: string;
        readonly history: string;
      }>(
        `select
           (select count(*)::text from keynes_internal.commands
             where command_id = $1::uuid) as commands,
           (select count(*)::text from keynes_internal.resource_types
             where canonical_name = 'malformed_projection_tokens') as resources,
           (select count(*)::text from keynes_internal.budgets
             where budget_id = $1::uuid) as budgets,
           (select count(*)::text from keynes_internal.budget_resources
             where budget_id = $1::uuid) as holdings,
           (select count(*)::text from keynes_internal.budget_history_streams
             where stream_id = $1::uuid) as streams,
           (select count(*)::text from keynes_internal.budget_history_entries
             where command_id = $1::uuid) as history`,
        [MALFORMED_PROJECTION_ROOT_ID],
      );
      expect(state.rows[0]).toEqual({
        commands: "0",
        resources: "0",
        budgets: "0",
        holdings: "0",
        streams: "0",
        history: "0",
      });
    } finally {
      await owner.close();
    }
  });
});

type ResourceBoundRootCommand = Parameters<ContractClient["createBudget"]>[0];

function resourceBoundRoot(
  commandId: string,
  canonicalName: string,
): ResourceBoundRootCommand {
  return {
    commandId,
    resources: [
      {
        definition: {
          canonicalName,
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 10,
      },
    ],
  };
}
