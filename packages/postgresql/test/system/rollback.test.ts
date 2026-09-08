import { rootResources } from "@keynes/contracts/contract-tests";
import { afterEach, describe, expect, it } from "vitest";

import {
  createContractClient,
  type ContractClient,
  type ContractTestHost,
} from "@keynes/contracts/contract-tests";

import { openInstalledPostgresDatabase } from "./support/postgres-database.js";
import {
  createDatabaseProcedureCaller,
  createTransactionProcedureCaller,
} from "./support/procedure-caller.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  openPostgresqlContractTestHost,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemInstallation,
} from "./support/test-keynes.js";

const ROOT_COMMAND_ID = "26000000-0000-4000-8000-000000000001";
const RETRY_DEFINITION_ID = "16000000-0000-4000-8000-000000000001";
const MALFORMED_PROJECTION_ROOT_ID = "26000000-0000-4000-8000-000000000002";
const MALFORMED_PROJECTION_DEFINITION_ID =
  "16000000-0000-4000-8000-000000000002";

describe("PostgreSQL configured root authorization and rollback", () => {
  let keynes: ContractTestHost;

  afterEach(async () => {
    await keynes?.close();
  });

  it("requires a configured catalog and root-allocation permission", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "permission_tokens");

    await keynes.clientFor("root-fixture").defineResources({
      commandId: RETRY_DEFINITION_ID,
      definitions: command.definitions,
    });
    await expect(
      keynes.clientFor("allocator-fixture").createBudget(command),
    ).resolves.toMatchObject({ kind: "created" });
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

  it("removes failed definition receipts and configured-root effects while retaining catalog definitions", async () => {
    const owner = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemInstallation(),
    );
    try {
      const context = {
        tenantId: FIXTURE_TENANT_ID,
        principalId: FIXTURE_PRINCIPALS["product-fixture"],
      };
      const client = createContractClient(
        createDatabaseProcedureCaller(owner.database, context),
      );
      const savedCommand = {
        commandId: "1b000000-0000-4000-8000-000000000001",
        definitions: {
          savedTokens: {
            unit: "token",
            accountingBehavior: "consumable" as const,
          },
        },
      };
      const saved = await client.defineResources(savedCommand);
      const counts = async () =>
        (
          await owner.database.query(`SELECT
        (SELECT count(*)::integer FROM keynes_internal.commands) AS commands,
        (SELECT count(*)::integer FROM keynes_internal.commands WHERE binding_reference IS NOT NULL) AS references,
        (SELECT count(*)::integer FROM keynes_internal.resource_types) AS resources,
        (SELECT count(*)::integer FROM keynes_internal.budgets) AS budgets,
        (SELECT count(*)::integer FROM keynes_internal.budget_resources) AS holdings,
        (SELECT count(*)::integer FROM keynes_internal.budget_history_entries) AS history
      `)
        ).rows;
      const before = await counts();
      const nextCommand = {
        commandId: "1b000000-0000-4000-8000-000000000002",
        definitions: {
          newSeats: { unit: "seat", accountingBehavior: "reusable" },
        },
      };
      const faultingDefinition = createContractClient(
        createDatabaseProcedureCaller(owner.database, {
          ...context,
          checkpoint: "after_result_storage",
        }),
      );
      await expect(
        faultingDefinition.defineResources(nextCommand),
      ).rejects.toThrow("private rollback checkpoint: after_result_storage");
      expect(await counts()).toEqual(before);
      expect(await client.defineResources(savedCommand)).toEqual({
        ...saved,
        replayed: true,
      });
      expect(await client.defineResources(nextCommand)).toMatchObject({
        kind: "defined",
        replayed: false,
      });
      const afterDefinition = await counts();
      expect(afterDefinition).toEqual([
        {
          commands: 2,
          references: 2,
          resources: 2,
          budgets: 0,
          holdings: 0,
          history: 0,
        },
      ]);
      const rootCommand = {
        commandId: "2b000000-0000-4000-8000-000000000001",
        definitions: savedCommand.definitions,
        amounts: { savedTokens: 10 },
      } satisfies ResourceBoundRootCommand;
      const faultingRoot = createContractClient(
        createDatabaseProcedureCaller(owner.database, {
          ...context,
          checkpoint: "after_domain_mutation",
        }),
      );
      await expect(faultingRoot.createBudget(rootCommand)).rejects.toThrow(
        "private rollback checkpoint: after_domain_mutation",
      );
      expect(await counts()).toEqual(afterDefinition);
      expect(await client.defineResources(savedCommand)).toEqual({
        ...saved,
        replayed: true,
      });
      expect(await client.createBudget(rootCommand)).toMatchObject({
        kind: "created",
        replayed: false,
      });
      expect(await counts()).toEqual([
        {
          commands: 3,
          references: 2,
          resources: 2,
          budgets: 1,
          holdings: 1,
          history: 1,
        },
      ]);
    } finally {
      await owner.close();
    }
  });

  it("rolls back a configured root at its private checkpoint", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "checkpoint_tokens");
    await keynes.clientFor("definer-fixture").defineResources({
      commandId: RETRY_DEFINITION_ID,
      definitions: command.definitions,
    });
    const product = keynes.clientFor("product-fixture", {
      checkpoint: "after_domain_mutation",
    });

    await expect(product.createBudget(command)).rejects.toThrow(
      "private rollback checkpoint: after_domain_mutation",
    );

    expect(await keynes.inspectState()).toMatchObject({ budgets: 0 });
  });

  it("rolls back an injected partial configured creation without changing unrelated state", async () => {
    const owner = await openInstalledPostgresDatabase(
      requirePostgresqlSystemAdministratorUrl(),
      FIXTURE_INSTALLATION,
      requirePostgresqlSystemInstallation(),
    );
    try {
      const client = createContractClient(
        createDatabaseProcedureCaller(owner.database, {
          tenantId: FIXTURE_TENANT_ID,
          principalId: FIXTURE_PRINCIPALS["product-fixture"],
        }),
      );
      const unrelated = resourceBoundRoot(ROOT_COMMAND_ID, "unrelated_tokens");
      await client.defineResources({
        commandId: RETRY_DEFINITION_ID,
        definitions: unrelated.definitions,
      });
      await client.createBudget(unrelated);
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
      const command = resourceBoundRoot(
        MALFORMED_PROJECTION_ROOT_ID,
        "malformed_projection_tokens",
      );
      await client.defineResources({
        commandId: MALFORMED_PROJECTION_DEFINITION_ID,
        definitions: command.definitions,
      });
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
        await expect(client.createBudget(command)).rejects.toThrow(
          "invalid CreateBudget result",
        );
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
        readonly unrelated_budgets: string;
        readonly unrelated_holdings: string;
        readonly unrelated_allocated: string;
        readonly unrelated_history: string;
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
             where command_id = $1::uuid) as history,
           (select count(*)::text from keynes_internal.budgets
             where budget_id = $2::uuid) as unrelated_budgets,
           (select count(*)::text from keynes_internal.budget_resources
             where budget_id = $2::uuid) as unrelated_holdings,
           (select coalesce(sum(allocated_amount), 0)::text
             from keynes_internal.budget_resources
             where budget_id = $2::uuid) as unrelated_allocated,
           (select count(*)::text from keynes_internal.budget_history_entries
             where command_id = $2::uuid) as unrelated_history`,
        [MALFORMED_PROJECTION_ROOT_ID, ROOT_COMMAND_ID],
      );
      expect(state.rows[0]).toEqual({
        commands: "0",
        resources: "1",
        budgets: "0",
        holdings: "0",
        streams: "0",
        history: "0",
        unrelated_budgets: "1",
        unrelated_holdings: "1",
        unrelated_allocated: "10",
        unrelated_history: "1",
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
    ...rootResources([
      {
        definition: {
          canonicalName,
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 10,
      },
    ]),
  };
}
