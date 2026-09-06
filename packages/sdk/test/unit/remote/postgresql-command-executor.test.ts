import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTRACT_DIGEST,
  REMOTE_CONTRACT,
  REMOTE_PROCEDURES_DIGEST,
} from "../../../src/generated/client.js";
import { POLICY_PROFILE_DIGEST } from "../../../src/generated/policy-profile.js";
import type { GetCompatibilityResult } from "../../../src/generated/types.js";
import {
  POSTGRESQL_INSTALLATION_ID,
  POSTGRESQL_WAITING_CALLERS_MAXIMUM,
  openPostgresqlCommandExecutor,
} from "../../../src/remote/postgresql-command-executor.js";

const pgMock = vi.hoisted(() => ({ constructPool: vi.fn() }));

vi.mock("pg", () => ({
  Pool: function Pool(config: PoolConfig): unknown {
    return pgMock.constructPool(config);
  },
}));

const poolConfig = Object.freeze({ host: "db.example.test", max: 10 });
const createBudgetProcedure = REMOTE_CONTRACT.procedures[1];
const getBudgetProcedure = REMOTE_CONTRACT.procedures[4];
const operationKey = `kop_v1_${"a".repeat(43)}`;

beforeEach(() => {
  pgMock.constructPool.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PostgreSQL remote command executor", () => {
  it("verifies compatibility before returning a ready executor", async () => {
    const pool = createFakePool(async () => compatibilityResponse());
    pgMock.constructPool.mockReturnValue(pool);

    const executor = await openPostgresqlCommandExecutor(poolConfig);

    expect(pgMock.constructPool).toHaveBeenCalledOnce();
    expect(pgMock.constructPool).toHaveBeenCalledWith(poolConfig);
    expect(pool.connect).toHaveBeenCalledOnce();
    expect(pool.client.query).toHaveBeenCalledExactlyOnceWith({
      text: "select keynes.remote_get_compatibility($1::jsonb) as response",
      values: [JSON.stringify({})],
    });
    expect(pool.client.release).toHaveBeenCalledOnce();
    await executor.close();
  });

  it("rejects an incompatible authority and closes its only pool", async () => {
    const incompatible = compatibilityResult();
    incompatible.contractDigest = "0".repeat(64);
    const pool = createFakePool(async () =>
      compatibilityResponse(incompatible),
    );
    pgMock.constructPool.mockReturnValue(pool);

    await expect(
      openPostgresqlCommandExecutor(poolConfig),
    ).rejects.toMatchObject({
      name: "KeynesError",
      code: "compatibility_error",
      details: { category: "command_contract" },
    });

    expect(pgMock.constructPool).toHaveBeenCalledOnce();
    expect(pool.connect).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("executes only the generated procedure target with one JSON parameter", async () => {
    const command = {
      operationKey,
      resources: [
        {
          definition: {
            canonicalName: "workUnits",
            unit: "unit",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ],
    };
    const response = { ok: true, result: { kind: "created" } };
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : queryResponse(response),
    );
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);

    await expect(
      executor.execute(createBudgetProcedure, command),
    ).resolves.toBe(response);

    expect(pool.client.query).toHaveBeenNthCalledWith(2, {
      text: "select keynes.remote_create_budget($1::jsonb) as response",
      values: [JSON.stringify(command)],
    });
    expect(pool.connect).toHaveBeenCalledTimes(2);
    expect(pool.client.release).toHaveBeenCalledTimes(2);
    await executor.close();
  });

  it("fails unavailable startup without trying another pool or authority", async () => {
    const unavailable = Object.assign(new Error("secret endpoint refused"), {
      code: "ECONNREFUSED",
    });
    const pool = createFakePool(async () => compatibilityResponse());
    pool.connect.mockRejectedValueOnce(unavailable);
    pgMock.constructPool.mockReturnValue(pool);

    let failure: unknown;
    try {
      await openPostgresqlCommandExecutor(poolConfig);
    } catch (error: unknown) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: "KeynesError",
      code: "unavailable",
      details: {},
    });
    expect(JSON.stringify(failure)).not.toContain("secret endpoint refused");
    expect(pgMock.constructPool).toHaveBeenCalledOnce();
    expect(pool.connect).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it.each([
    "timeout exceeded when trying to connect",
    "Connection terminated due to connection timeout",
  ])("projects pg pool acquisition timeout: %s", async (message) => {
    const pool = createFakePool(async () => compatibilityResponse());
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);
    pool.connect.mockRejectedValueOnce(new Error(message));

    await expect(
      executor.execute(getBudgetProcedure, {
        budgetReference: `kbr_v1_${"b".repeat(43)}`,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "timeout",
        details: { operation: "getBudget" },
      },
    });
    await executor.close();
  });

  it("keeps serving after pg removes a failed idle client", async () => {
    const response = { ok: true, result: {} };
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : queryResponse(response),
    );
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);

    pool.emitError(new Error("idle client connection reset"));

    await expect(
      executor.execute(getBudgetProcedure, {
        budgetReference: `kbr_v1_${"b".repeat(43)}`,
      }),
    ).resolves.toBe(response);
    expect(pool.connect).toHaveBeenCalledTimes(2);
    await executor.close();
  });

  it("does not treat a recoverable idle-client failure as close", async () => {
    const pool = createFakePool(async ({ text }) => {
      if (text.includes("remote_get_compatibility")) {
        return compatibilityResponse();
      }
      pool.emitError(new Error("idle client connection reset"));
      throw new Error("driver failure");
    });
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);

    await expect(
      executor.execute(createBudgetProcedure, { operationKey, resources: [] }),
    ).resolves.toEqual({
      ok: false,
      error: { kind: "error", code: "unknown", details: {} },
    });
    await executor.close();
  });

  it("preserves mutation uncertainty for an uncoded node-postgres disconnect", async () => {
    const pool = createFakePool(async ({ text }) => {
      if (text.includes("remote_get_compatibility")) {
        return compatibilityResponse();
      }
      throw new Error("Connection terminated unexpectedly");
    });
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);

    await expect(
      executor.execute(createBudgetProcedure, { operationKey, resources: [] }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "uncertain_outcome",
        details: { operation: "createBudget", operationKey },
      },
    });
    await executor.close();
  });

  it("rejects the 101st waiting caller without acquiring a connection", async () => {
    const pool = createFakePool(async () => compatibilityResponse());
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);
    pool.waitingCount = POSTGRESQL_WAITING_CALLERS_MAXIMUM;

    await expect(executor.execute(createBudgetProcedure, {})).resolves.toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "limit_exceeded",
        details: {
          limit: "waiting_callers",
          maximum: 100,
        },
      },
    });
    expect(pool.connect).toHaveBeenCalledOnce();
    await executor.close();
  });

  it("projects query timeouts without returning driver messages or SQL", async () => {
    const timeout = Object.assign(
      new Error("Query read timeout password=secret select private_table"),
      { code: "ETIMEDOUT" },
    );
    const pool = createFakePool(async ({ text }) => {
      if (text.includes("remote_get_compatibility")) {
        return compatibilityResponse();
      }
      throw timeout;
    });
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);

    const result = await executor.execute(getBudgetProcedure, {
      budgetReference: `kbr_v1_${"b".repeat(43)}`,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "timeout",
        details: { operation: "getBudget" },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /password|private_table|select/iu,
    );
    expect(pool.client.release).toHaveBeenCalledTimes(2);
    await executor.close();
  });

  it("shares close, drains admitted work, and rejects work after close starts", async () => {
    const commandResult = deferred<QueryResponse>();
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : commandResult.promise,
    );
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);
    const executing = executor.execute(createBudgetProcedure, {
      operationKey,
      resources: [],
    });
    await vi.waitFor(() => expect(pool.client.query).toHaveBeenCalledTimes(2));

    const firstClose = executor.close();
    expect(executor.close()).toBe(firstClose);
    await expect(executor.execute(getBudgetProcedure, {})).resolves.toEqual({
      ok: false,
      error: { kind: "error", code: "client_closed", details: {} },
    });
    expect(pool.end).not.toHaveBeenCalled();

    commandResult.resolve(queryResponse({ ok: true, result: {} }));
    await expect(executing).resolves.toEqual({ ok: true, result: {} });
    await firstClose;
    expect(pool.end).toHaveBeenCalledOnce();
    expect(pool.client.release).toHaveBeenCalledTimes(2);
  });

  it("bounds close at ten seconds and destroys an unfinished lease", async () => {
    vi.useFakeTimers();
    const unfinished = deferred<QueryResponse>();
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : unfinished.promise,
    );
    pgMock.constructPool.mockReturnValue(pool);
    const executor = await openPostgresqlCommandExecutor(poolConfig);
    const executing = executor.execute(createBudgetProcedure, {
      operationKey,
      resources: [],
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(pool.client.query).toHaveBeenCalledTimes(2);

    const closing = executor.close();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(closing).resolves.toBeUndefined();

    await expect(executing).resolves.toEqual({
      ok: false,
      error: {
        kind: "error",
        code: "uncertain_outcome",
        details: { operation: "createBudget", operationKey },
      },
    });

    expect(pool.client.release).toHaveBeenCalledWith(true);
    expect(pool.end).toHaveBeenCalledOnce();
    await expect(
      executor.execute(getBudgetProcedure, {}),
    ).resolves.toMatchObject({ error: { code: "client_closed" } });
  });
});

interface QueryConfig {
  readonly text: string;
  readonly values?: readonly unknown[];
}

interface QueryResponse {
  readonly rows: readonly { readonly response: unknown }[];
}

function createFakePool(
  query: (config: QueryConfig) => Promise<QueryResponse>,
) {
  let errorListener: ((error: Error) => void) | undefined;
  const client = {
    query: vi.fn(query),
    release: vi.fn(),
  };
  return {
    waitingCount: 0,
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
    on: vi.fn((event: string, listener: (error: Error) => void) => {
      if (event === "error") errorListener = listener;
    }),
    emitError(error: Error): void {
      errorListener?.(error);
    },
    client,
  };
}

function compatibilityResponse(
  result: GetCompatibilityResult = compatibilityResult(),
): QueryResponse {
  return queryResponse({ ok: true, result });
}

function queryResponse(response: unknown): QueryResponse {
  return { rows: [{ response }] };
}

function compatibilityResult(): GetCompatibilityResult {
  return {
    installationId: POSTGRESQL_INSTALLATION_ID,
    contractDigest: CONTRACT_DIGEST,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    remoteProceduresDigest: REMOTE_PROCEDURES_DIGEST,
    semanticGeneration: REMOTE_CONTRACT.semanticGeneration,
    minimumSdkGeneration: REMOTE_CONTRACT.minimumSdkGeneration,
    procedures: [
      {
        name: "defineResources",
        target: "keynes.remote_define_resources",
        revision: 1,
      },
      {
        name: "createBudget",
        target: "keynes.remote_create_budget",
        revision: 2,
      },
      {
        name: "requestBudget",
        target: "keynes.remote_request",
        revision: 1,
      },
      {
        name: "settleBudget",
        target: "keynes.remote_settle",
        revision: 1,
      },
      {
        name: "getBudget",
        target: "keynes.remote_get_budget",
        revision: 1,
      },
      {
        name: "getBudgetHistoryPage",
        target: "keynes.remote_get_budget_history_page",
        revision: 1,
      },
      {
        name: "openBudget",
        target: "keynes.remote_open_budget",
        revision: 1,
      },
      {
        name: "recoverOperation",
        target: "keynes.remote_recover_operation",
        revision: 1,
      },
      {
        name: "getCompatibility",
        target: "keynes.remote_get_compatibility",
        revision: 1,
      },
    ],
  };
}

function deferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((accept) => {
    resolve = accept;
  });
  if (resolve === undefined) {
    throw new Error("deferred promise did not expose its resolver");
  }
  return { promise, resolve };
}
