import { afterEach, describe, expect, it } from "vitest";

import {
  createContractClient,
  KeynesError,
  type ContractClient,
} from "@keynes/contracts/contract-tests";
import { openInstalledPostgresDatabase } from "./support/postgres-database.js";
import type { PostgresTransaction } from "./support/postgres-database.js";
import type { TransactionalDatabase } from "./support/database.js";
import { createTransactionProcedureCaller } from "./support/procedure-caller.js";
import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  FIXTURE_INSTALLATION,
  FIXTURE_PRINCIPALS,
  FIXTURE_TENANT_ID,
  requirePostgresqlSystemAdministratorUrl,
  requirePostgresqlSystemCommandPath,
} from "./support/test-keynes.js";

const ROOT_BUDGET_ID = "21000000-0000-4000-8000-000000000001";
const REQUEST_COMMAND_ID = "31000000-0000-4000-8000-000000000001";
const OUTBOX_ID = "41000000-0000-4000-8000-000000000001";
const BOUND_ROOT_ID = "22000000-0000-4000-8000-000000000001";
const REDEFINITION_ID = "12000000-0000-4000-8000-000000000001";

type RequestBudgetCommand = Parameters<ContractClient["requestBudget"]>[0];

interface EmbeddedFixture {
  readonly database: TransactionalDatabase;
  beginTransaction(): Promise<PostgresTransaction>;
  close(): Promise<void>;
}

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("embedded PostgreSQL caller-owned transactions", () => {
  let database: EmbeddedFixture;

  afterEach(async () => {
    await database?.close();
  });

  it("commits an approved request and application outbox row together", async () => {
    database = await openFixture();
    const { resourceTypeId, budgetId } = await seedRoot(database);
    const transaction = await database.beginTransaction();
    const client = createContractClient(
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

  it("leaves neither Budget state nor outbox state after explicit rollback", async () => {
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
    const client = createContractClient(
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

  it("rolls back a Resource-bound root with caller-owned application work", async () => {
    database = await openFixture();
    const transaction = await database.beginTransaction();
    const created = await createResourceBoundBudget(
      createTransactionClient(transaction),
      BOUND_ROOT_ID,
      "rollback_tokens",
    );

    await transaction.connection.query(
      `insert into application_outbox
          (outbox_id, command_id, child_budget_id)
         values ($1::uuid, $2::uuid, $3::uuid)`,
      [OUTBOX_ID, BOUND_ROOT_ID, created.budget.budgetId],
    );
    await transaction.rollback();

    const state = await database.database.query<{
      readonly commands: string;
      readonly resources: string;
      readonly budgets: string;
      readonly holdings: string;
      readonly streams: string;
      readonly history: string;
      readonly outbox: string;
    }>(
      `select
           (select count(*)::text from keynes_internal.commands
             where command_id = $1::uuid) as commands,
           (select count(*)::text from keynes_internal.resource_types
             where canonical_name = 'rollback_tokens') as resources,
           (select count(*)::text from keynes_internal.budgets
             where budget_id = $1::uuid) as budgets,
           (select count(*)::text from keynes_internal.budget_resources
             where budget_id = $1::uuid) as holdings,
           (select count(*)::text from keynes_internal.budget_history_streams
             where stream_id = $1::uuid) as streams,
           (select count(*)::text from keynes_internal.budget_history_entries
             where command_id = $1::uuid) as history,
           (select count(*)::text from application_outbox
             where command_id = $1::uuid) as outbox`,
      [BOUND_ROOT_ID],
    );
    expect(state.rows[0]).toEqual({
      commands: "0",
      resources: "0",
      budgets: "0",
      holdings: "0",
      streams: "0",
      history: "0",
      outbox: "0",
    });
  });

  it("preserves the original definition provenance for later definition", async () => {
    database = await openFixture();
    const transaction = await database.beginTransaction();
    const created = await createResourceBoundBudget(
      createTransactionClient(transaction),
      BOUND_ROOT_ID,
      "provenance_tokens",
    );
    await transaction.commit();

    const resource = created.budget.resources[0]?.resourceType;
    expect(resource).toBeDefined();
    if (resource === undefined) return;
    expect(resource.resourceTypeId).not.toBe(BOUND_ROOT_ID);

    const provenance = await database.database.query<{
      readonly definition_command_id: string;
    }>(
      `select definition_command_id::text
           from keynes_internal.resource_types
          where resource_type_id = $1::uuid`,
      [resource.resourceTypeId],
    );
    expect(provenance.rows[0]?.definition_command_id).toBe(BOUND_ROOT_ID);

    const redefineTransaction = await database.beginTransaction();
    const redefined = await createTransactionClient(
      redefineTransaction,
    ).defineResource({
      commandId: REDEFINITION_ID,
      definition: resourceDefinition("provenance_tokens"),
    });
    await redefineTransaction.commit();
    expect(redefined).toMatchObject({
      resourceType: { resourceTypeId: resource.resourceTypeId },
      definitionEvidence: { commandId: BOUND_ROOT_ID },
      replayed: false,
    });
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
});

function createTransactionClient(transaction: PostgresTransaction) {
  return createContractClient(
    createTransactionProcedureCaller(transaction.connection, {
      tenantId: FIXTURE_TENANT_ID,
      principalId: FIXTURE_PRINCIPALS["product-fixture"],
    }),
  );
}

function createResourceBoundBudget(
  client: ContractClient,
  commandId: string,
  canonicalName: string,
): ReturnType<ContractClient["createBudget"]> {
  return Reflect.apply(client.createBudget, client, [
    {
      commandId,
      resources: [
        { definition: resourceDefinition(canonicalName), amount: 10 },
      ],
    },
  ]);
}

function resourceDefinition(canonicalName: string) {
  return {
    canonicalName,
    unit: "token",
    accountingBehavior: "consumable" as const,
  };
}

async function openFixture(): Promise<EmbeddedFixture> {
  const owner = await openInstalledPostgresDatabase(
    requirePostgresqlSystemAdministratorUrl(),
    FIXTURE_INSTALLATION,
    requirePostgresqlSystemCommandPath(),
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
        {
          definition: {
            canonicalName: "model_tokens",
            unit: "token",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
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
