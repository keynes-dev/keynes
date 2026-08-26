import { afterEach, describe, expect, it } from "vitest";

import { createKeynesClient, KeynesError } from "./generated/client.js";
import type { RequestBudgetCommand } from "./generated/types.js";
import { openInstalledPostgresDatabase } from "./private/postgres-database.js";
import { createTransactionProcedureCaller } from "./private/procedure-caller.js";
import { PLATFORM_CONTEXT_ENV } from "./private/run-platform-tests.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  requirePlatformAdministratorUrl,
} from "./private/test-keynes.js";

const ROOT_BUDGET_ID = "21000000-0000-4000-8000-000000000001";
const REQUEST_COMMAND_ID = "31000000-0000-4000-8000-000000000001";
const OUTBOX_ID = "41000000-0000-4000-8000-000000000001";

describe.skipIf(process.env[PLATFORM_CONTEXT_ENV] === undefined)(
  "embedded PostgreSQL caller-owned transactions",
  () => {
    let database: Awaited<ReturnType<typeof openInstalledPostgresDatabase>>;

    afterEach(async () => {
      await database?.close();
    });

    it("commits an approved request and application outbox row together", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createKeynesClient(
        createTransactionProcedureCaller(transaction.connection, {
          tenantId: FIXTURE_TENANT_ID,
          principalId: FIXTURE_PRINCIPALS["product-fixture"],
        }),
      );

      const approved = await client.requestBudget({
        commandId: REQUEST_COMMAND_ID,
        parentBudgetId: budgetId,
        resources: [{ resourceTypeId, amount: 3 }],
      });
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;

      await transaction.connection.query(
        `insert into application_outbox
          (outbox_id, command_id, child_budget_id)
         values ($1::uuid, $2::uuid, $3::uuid)`,
        [OUTBOX_ID, REQUEST_COMMAND_ID, approved.childBudgetId],
      );
      await transaction.commit();

      const state = await readState(database, approved.childBudgetId);
      expect(state).toEqual({ budget: true, outbox: true });
    });

    it("leaves neither authority state nor outbox state after explicit rollback", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const approved = await client.requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await transaction.connection.query(
        `insert into application_outbox
          (outbox_id, command_id, child_budget_id)
         values ($1::uuid, $2::uuid, $3::uuid)`,
        [OUTBOX_ID, REQUEST_COMMAND_ID, approved.childBudgetId],
      );
      await transaction.rollback();

      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: false,
        outbox: false,
      });
    });

    it("rolls back Keynes when the application write fails after approval", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const approved = await client.requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await expect(
        transaction.connection.query(
          `insert into application_outbox
            (outbox_id, command_id, child_budget_id)
           values ($1::uuid, $2::uuid, $3::uuid),
                  ($1::uuid, $2::uuid, $3::uuid)`,
          [OUTBOX_ID, REQUEST_COMMAND_ID, approved.childBudgetId],
        ),
      ).rejects.toThrow();
      await transaction.rollback();

      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: false,
        outbox: false,
      });
    });

    it("commits a denial without creating application work", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const denied = await client.requestBudget({
        commandId: REQUEST_COMMAND_ID,
        parentBudgetId: budgetId,
        resources: [{ resourceTypeId, amount: 11 }],
      });
      expect(denied).toMatchObject({ kind: "denied", replayed: false });
      await transaction.commit();

      expect(await readState(database, REQUEST_COMMAND_ID)).toEqual({
        budget: false,
        outbox: false,
      });
    });

    it("returns invalid_command for malformed input without opening application work", async () => {
      database = await openFixture();
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      await expect(
        Reflect.apply(client.requestBudget, client, [
          { commandId: REQUEST_COMMAND_ID, parentBudgetId: null },
        ]),
      ).rejects.toMatchObject({ code: "invalid_command" });
      await transaction.commit();

      const outbox = await database.database.query<{ readonly count: string }>(
        "select count(*)::text as count from application_outbox",
      );
      expect(outbox.rows[0]?.count).toBe("0");
    });

    it("uses the caller-owned transaction lifecycle", async () => {
      database = await openFixture();
      const transaction = await database.beginTransaction();
      const statements: string[] = [];
      const client = createKeynesClient(
        createTransactionProcedureCaller(
          {
            query: async (statement, parameters) => {
              statements.push(statement);
              return transaction.connection.query(statement, parameters);
            },
            exec: (statement) => transaction.connection.exec(statement),
          },
          {
            tenantId: FIXTURE_TENANT_ID,
            principalId: FIXTURE_PRINCIPALS["product-fixture"],
          },
        ),
      );

      await expect(
        client.getBudget({ budgetId: ROOT_BUDGET_ID }),
      ).rejects.toBeInstanceOf(KeynesError);
      await transaction.rollback();

      expect(statements.join("\n")).not.toMatch(/\b(begin|commit|rollback)\b/i);
    });
  },
);

function createTransactionClient(
  transaction: Awaited<
    ReturnType<
      Awaited<
        ReturnType<typeof openInstalledPostgresDatabase>
      >["beginTransaction"]
    >
  >,
) {
  return createKeynesClient(
    createTransactionProcedureCaller(transaction.connection, {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    }),
  );
}

async function openFixture() {
  const database = await openInstalledPostgresDatabase(
    requirePlatformAdministratorUrl(),
    FIXTURE_INSTALLATION,
  );
  await database.database.exec(
    `create table application_outbox (
       outbox_id uuid primary key,
       command_id uuid not null unique,
       child_budget_id uuid not null
     )`,
  );
  return database;
}

async function seedRoot(
  database: Awaited<ReturnType<typeof openInstalledPostgresDatabase>>,
): Promise<{ resourceTypeId: string; budgetId: string }> {
  const transaction = await database.beginTransaction();
  try {
    const client = createTransactionClient(transaction);
    const resource = await client.defineResource({
      commandId: "10000000-0000-4000-8000-000000000001",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    });
    const root = await client.createBudget({
      commandId: "20000000-0000-4000-8000-000000000001",
      resources: [
        { resourceTypeId: resource.resourceType.resourceTypeId, amount: 10 },
      ],
    });
    await transaction.commit();
    return {
      resourceTypeId: resource.resourceType.resourceTypeId,
      budgetId: root.budget.budgetId,
    };
  } catch (error: unknown) {
    await transaction.rollback();
    throw error;
  }
}

function request(
  resourceTypeId: string,
  parentBudgetId: string,
): RequestBudgetCommand {
  return {
    commandId: REQUEST_COMMAND_ID,
    parentBudgetId,
    resources: [{ resourceTypeId, amount: 3 }],
  };
}

async function readState(
  database: Awaited<ReturnType<typeof openInstalledPostgresDatabase>>,
  childBudgetId: string,
): Promise<{ budget: boolean; outbox: boolean }> {
  const result = await database.database.query<{
    readonly budget: boolean;
    readonly outbox: boolean;
  }>(
    `select
       exists(select 1 from keynes_internal.budgets where budget_id = $1::uuid) as budget,
       exists(select 1 from application_outbox where child_budget_id = $1::uuid) as outbox`,
    [childBudgetId],
  );
  const state = result.rows[0];
  if (state === undefined) throw new Error("state query returned no row");
  return state;
}
