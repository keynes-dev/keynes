import { rootResources } from "@keynes/database/contract-tests";
import type { PoolConfig } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTRACT_DIGEST,
  REMOTE_CONTRACT,
  REMOTE_PROCEDURES_DIGEST,
} from "@keynes/sdk";
import { createKeynes } from "@keynes/sdk";
import { postgres } from "../../src/index.js";
import {
  POSTGRESQL_INSTALLATION_ID,
  POSTGRESQL_WAITING_CALLERS_MAXIMUM,
  openPostgresqlCommandExecutor,
} from "../../src/remote/postgresql-command-executor.js";

const pgMock = vi.hoisted(() => ({ constructPool: vi.fn() }));

vi.mock("pg", async (importOriginal) => ({
  ...(await importOriginal<typeof import("pg")>()),
  Pool: function Pool(config: PoolConfig): unknown {
    return pgMock.constructPool(config);
  },
}));

const poolConfig = Object.freeze({ host: "db.example.test", max: 10 });
const createBudgetProcedure = REMOTE_CONTRACT.procedures[2];
const getBudgetProcedure = REMOTE_CONTRACT.procedures[5];
const operationKey = `kop_v1_${"a".repeat(43)}`;

beforeEach(() => {
  pgMock.constructPool.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PostgreSQL remote command executor", () => {
  const configuredOptions = {
    runtime: postgres({
      databaseUrl:
        "postgresql://application:password@db.example.test/keynes?sslmode=verify-full",
    }),
    resources: {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
      reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
    },
  };

  it("rejects closed malformed public calls before reading input", async () => {
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : queryResponse({ ok: true, result: { valid: true } }),
    );
    pgMock.constructPool.mockReturnValue(pool);
    const keynes = await createKeynes(configuredOptions);
    const closing = keynes.close();
    const malformed = new Proxy(
      { workUnits: NaN },
      {
        ownKeys() {
          throw new Error("closed input accessed");
        },
      },
    );
    let pending: Promise<unknown> | undefined;
    expect(() => {
      pending = keynes.createBudget(malformed);
    }).not.toThrow();
    expect(pending).toBeInstanceOf(Promise);
    await expect(pending).rejects.toMatchObject({ code: "client_closed" });
    await closing;
    expect(pool.client.query).toHaveBeenCalledTimes(2);
  });

  it("validates every configured declaration after compatibility before returning a client", async () => {
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse()
        : queryResponse({ ok: true, result: { valid: true } }),
    );
    pgMock.constructPool.mockReturnValue(pool);
    const keynes = await createKeynes(configuredOptions);
    try {
      expect(pool.client.query.mock.calls.map(([query]) => query.text)).toEqual(
        [
          "select keynes.remote_get_compatibility($1::jsonb) as response",
          "select keynes.remote_validate_resources($1::jsonb) as response",
        ],
      );
      const validation = pool.client.query.mock.calls[1]?.[0];
      const payload = validation?.values?.[0];
      if (typeof payload !== "string")
        throw new Error("Missing validation payload");
      expect(JSON.parse(payload)).toEqual({
        definitions: configuredOptions.resources,
      });
      expect(pool.client.release).toHaveBeenCalledTimes(2);
      expect(pool.end).not.toHaveBeenCalled();
    } finally {
      await keynes.close();
    }
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it.each([
    {
      code: "resource_type_not_found",
      details: {},
    },
    {
      code: "resource_type_conflict",
      details: {},
    },
  ])(
    "closes the configured startup pool when catalog validation returns $code",
    async ({ code, details }) => {
      const pool = createFakePool(async ({ text }) =>
        text.includes("remote_get_compatibility")
          ? compatibilityResponse()
          : queryResponse({
              ok: false,
              error: { kind: "error", code, details },
            }),
      );
      pgMock.constructPool.mockReturnValue(pool);
      await expect(createKeynes(configuredOptions)).rejects.toMatchObject({
        name: "KeynesError",
        code,
        details,
      });
      expect(pgMock.constructPool).toHaveBeenCalledOnce();
      expect(pool.connect).toHaveBeenCalledTimes(2);
      expect(pool.client.release).toHaveBeenCalledTimes(2);
      expect(pool.end).toHaveBeenCalledOnce();
    },
  );

  it("refuses generation two before configured catalog validation and closes the pool", async () => {
    const previousGeneration: Record<string, unknown> = {
      ...compatibilityResult(),
      semanticGeneration: 2,
      minimumSdkGeneration: 2,
    };
    const pool = createFakePool(async () =>
      compatibilityResponse(previousGeneration),
    );
    pgMock.constructPool.mockReturnValue(pool);
    await expect(createKeynes(configuredOptions)).rejects.toMatchObject({
      code: "compatibility_error",
      details: { category: "command_contract" },
    });
    expect(pool.client.query).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("refuses the previous Policy-bearing compatibility contract before catalog validation", async () => {
    const pool = createFakePool(async ({ text }) =>
      text.includes("remote_get_compatibility")
        ? compatibilityResponse(legacyPolicyCompatibilityResult())
        : queryResponse({ ok: true, result: { valid: true } }),
    );
    pgMock.constructPool.mockReturnValue(pool);

    await expect(createKeynes(configuredOptions)).rejects.toMatchObject({
      code: "compatibility_error",
      details: { category: "command_contract" },
    });

    expect(pool.client.query).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("rejects an invalid configured database URL without opening any authority", async () => {
    await expect(
      createKeynes({
        ...configuredOptions,
        runtime: postgres({ databaseUrl: "invalid-url" }),
      }),
    ).rejects.toMatchObject({
      code: "invalid_configuration",
      details: { field: "databaseUrl", reason: "unsupported" },
    });
    expect(pgMock.constructPool).not.toHaveBeenCalled();
  });

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
      ...rootResources([
        {
          definition: {
            canonicalName: "workUnits",
            unit: "unit",
            accountingBehavior: "consumable",
          },
          amount: 10,
        },
      ]),
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
  result: unknown = compatibilityResult(),
): QueryResponse {
  return queryResponse({ ok: true, result });
}

function queryResponse(response: unknown): QueryResponse {
  return { rows: [{ response }] };
}

function compatibilityResult() {
  return {
    installationId: POSTGRESQL_INSTALLATION_ID,
    contractDigest: CONTRACT_DIGEST,
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
        name: "validateResources",
        target: "keynes.remote_validate_resources",
        revision: 1,
      },
      {
        name: "createBudget",
        target: "keynes.remote_create_budget",
        revision: 5,
      },
      {
        name: "requestBudget",
        target: "keynes.remote_request",
        revision: 3,
      },
      {
        name: "settleBudget",
        target: "keynes.remote_settle",
        revision: 2,
      },
      {
        name: "getBudget",
        target: "keynes.remote_get_budget",
        revision: 3,
      },
      {
        name: "getBudgetHistoryPage",
        target: "keynes.remote_get_budget_history_page",
        revision: 4,
      },
      {
        name: "openBudget",
        target: "keynes.remote_open_budget",
        revision: 3,
      },
      {
        name: "recoverOperation",
        target: "keynes.remote_recover_operation",
        revision: 3,
      },
      {
        name: "getCompatibility",
        target: "keynes.remote_get_compatibility",
        revision: 3,
      },
    ],
  };
}

function legacyPolicyCompatibilityResult(): unknown {
  return {
    ...compatibilityResult(),
    semanticGeneration: 3,
    minimumSdkGeneration: 3,
    policyProfileDigest: "0".repeat(64),
    procedures: [
      {
        name: "defineResources",
        target: "keynes.remote_define_resources",
        revision: 1,
      },
      {
        name: "validateResources",
        target: "keynes.remote_validate_resources",
        revision: 1,
      },
      {
        name: "createBudget",
        target: "keynes.remote_create_budget",
        revision: 3,
      },
      { name: "requestBudget", target: "keynes.remote_request", revision: 1 },
      { name: "settleBudget", target: "keynes.remote_settle", revision: 1 },
      { name: "getBudget", target: "keynes.remote_get_budget", revision: 1 },
      {
        name: "getBudgetHistoryPage",
        target: "keynes.remote_get_budget_history_page",
        revision: 1,
      },
      { name: "openBudget", target: "keynes.remote_open_budget", revision: 1 },
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
