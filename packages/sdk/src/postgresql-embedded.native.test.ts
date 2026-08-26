import { afterEach, describe, expect, it } from "vitest";

import { createKeynesClient, KeynesError } from "./generated/client.js";
import type { RequestBudgetCommand } from "./generated/types.js";
import { openInstalledPostgresDatabase } from "./private/postgres-database.js";
import type { PostgresTransaction } from "./private/postgres-database.js";
import type { TransactionalDatabase } from "./private/database.js";
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

interface EmbeddedFixture {
  readonly database: TransactionalDatabase;
  beginTransaction(): Promise<PostgresTransaction>;
  close(): Promise<void>;
}

describe.skipIf(process.env[PLATFORM_CONTEXT_ENV] === undefined)(
  "embedded PostgreSQL caller-owned transactions",
  () => {
    let database: EmbeddedFixture;

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

    it("keeps a pending child and outbox row invisible to another session", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const approved = await client.requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await insertOutbox(database, approved.childBudgetId, transaction);

      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: false,
        outbox: false,
      });
      await transaction.rollback();
    });

    it("makes the child and outbox row visible after the caller commits", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const approved = await client.requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await insertOutbox(database, approved.childBudgetId, transaction);
      await transaction.commit();

      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: true,
        outbox: true,
      });
    });

    it("leaves neither child nor outbox row visible after the caller rolls back", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const client = createTransactionClient(transaction);

      const approved = await client.requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await insertOutbox(database, approved.childBudgetId, transaction);
      await transaction.rollback();

      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: false,
        outbox: false,
      });
    });

    it("allows a rolled-back command identity to be reused and committed", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const first = await database.beginTransaction();
      const firstResult = await createTransactionClient(first).requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(firstResult.kind).toBe("approved");
      await first.rollback();

      const second = await database.beginTransaction();
      const secondResult = await createTransactionClient(second).requestBudget(
        request(resourceTypeId, budgetId),
      );
      await second.commit();

      expect(secondResult).toMatchObject({
        kind: "approved",
        replayed: false,
        childBudgetId: REQUEST_COMMAND_ID,
      });
      expect(await readState(database, REQUEST_COMMAND_ID)).toEqual({
        budget: true,
        outbox: false,
      });
    });

    it("returns the committed result when another session replays exactly", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const command = request(resourceTypeId, budgetId);
      const approved =
        await createTransactionClient(transaction).requestBudget(command);
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await transaction.commit();

      const replayTransaction = await database.beginTransaction();
      const replay =
        await createTransactionClient(replayTransaction).requestBudget(command);
      await replayTransaction.commit();

      expect(replay).toEqual({ ...approved, replayed: true });
      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: true,
        outbox: false,
      });
    });

    it("rejects conflicting command reuse without changing committed state", async () => {
      database = await openFixture();
      const { resourceTypeId, budgetId } = await seedRoot(database);
      const transaction = await database.beginTransaction();
      const approved = await createTransactionClient(transaction).requestBudget(
        request(resourceTypeId, budgetId),
      );
      expect(approved.kind).toBe("approved");
      if (approved.kind !== "approved") return;
      await transaction.commit();

      const conflicting: RequestBudgetCommand = {
        ...request(resourceTypeId, budgetId),
        resources: [{ resourceTypeId, amount: 2 }],
      };
      const conflictTransaction = await database.beginTransaction();
      await expect(
        createTransactionClient(conflictTransaction).requestBudget(conflicting),
      ).rejects.toMatchObject({
        name: "KeynesError",
        code: "command_conflict",
        details: {
          commandId: REQUEST_COMMAND_ID,
          existingOperation: "requestBudget",
          attemptedOperation: "requestBudget",
        },
      });
      await conflictTransaction.rollback();
      expect(await readState(database, approved.childBudgetId)).toEqual({
        budget: true,
        outbox: false,
      });
    });
  },
);

function createTransactionClient(transaction: PostgresTransaction) {
  return createKeynesClient(
    createTransactionProcedureCaller(transaction.connection, {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    }),
  );
}

async function openFixture(): Promise<EmbeddedFixture> {
  const owner = await openInstalledPostgresDatabase(
    requirePlatformAdministratorUrl(),
    FIXTURE_INSTALLATION,
  );
  await owner.database.exec(
    `create table application_outbox (
       outbox_id uuid primary key,
       command_id uuid not null unique,
       child_budget_id uuid not null
     )`,
  );
  const application = await owner.createApplicationRole();
  await owner.database.exec(
    `grant select, insert on application_outbox to "${application.role}"`,
  );
  return {
    database: owner.database,
    beginTransaction: () =>
      owner.beginTransactionAs(application.role, application.password),
    close: () => owner.close(),
  };
}

async function seedRoot(
  database: EmbeddedFixture,
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
  database: EmbeddedFixture,
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

async function insertOutbox(
  database: EmbeddedFixture,
  childBudgetId: string,
  transaction?: PostgresTransaction,
): Promise<void> {
  const connection = transaction?.connection ?? database.database;
  await connection.query(
    `insert into application_outbox
      (outbox_id, command_id, child_budget_id)
     values ($1::uuid, $2::uuid, $3::uuid)`,
    [OUTBOX_ID, REQUEST_COMMAND_ID, childBudgetId],
  );
}
