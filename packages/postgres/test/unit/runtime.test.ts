import { describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { KeynesError } from "@keynes/sdk";
import * as executors from "../../src/remote/postgresql-command-executor.js";
import { postgres } from "../../src/index.js";

const driver = vi.hoisted(() => ({
  pool: vi.fn(function () {
    return { on() {} };
  }),
}));
vi.mock("pg", () => ({ Pool: driver.pool }));

describe("PostgreSQL runtime descriptor", () => {
  it("captures the URL without opening a pool or reading a certificate", () => {
    const runtime = postgres({
      databaseUrl:
        "postgresql://u:p@host/db?sslmode=verify-full&sslrootcert=/missing",
    });
    expect(runtime.kind).toBe("remote");
    expect(driver.pool).not.toHaveBeenCalled();
  });
  it("returns runtime bindings only after database validation", async () => {
    const executor = new executors.PostgresqlCommandExecutor(new Pool());
    const execute = vi.spyOn(executor, "execute").mockResolvedValue({
      ok: true,
      replayed: false,
      result: { valid: true },
    });
    const close = vi.spyOn(executor, "close").mockResolvedValue();
    const open = vi
      .spyOn(executors, "openPostgresqlCommandExecutor")
      .mockResolvedValue(executor);
    try {
      const definition = { unit: "token", accountingBehavior: "consumable" };
      const session = await postgres({
        databaseUrl: "postgresql://u:p@host/db?sslmode=verify-full",
      }).initialize({ modelTokens: definition });
      expect(session).toMatchObject({
        resources: [
          { key: "modelTokens", canonicalName: "model_tokens", ...definition },
        ],
      });
      expect(execute).toHaveBeenCalledTimes(1);
      const prepared = await session.prepareResources({
        otherTokens: definition,
      });
      expect(prepared).toEqual([
        { key: "otherTokens", canonicalName: "other_tokens", ...definition },
      ]);
      await expect(
        session.prepareResources({ invalid_name: definition }),
      ).rejects.toMatchObject({
        code: "invalid_command",
        details: { operation: "validateResources" },
      });
      expect(execute).toHaveBeenCalledTimes(1);
      await session.close();
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      open.mockRestore();
    }
  });
  it("preserves validation and cleanup failures during initialization", async () => {
    const validationFailure = new KeynesError({
      kind: "error",
      code: "unauthorized",
      details: {
        operation: "validateResources",
        requiredPermission: "remote_access",
      },
    });
    const cleanupFailure = new KeynesError({
      kind: "error",
      code: "unknown",
      details: {},
    });
    const executor = new executors.PostgresqlCommandExecutor(new Pool());
    vi.spyOn(executor, "execute").mockRejectedValue(validationFailure);
    vi.spyOn(executor, "close").mockRejectedValue(cleanupFailure);
    const open = vi
      .spyOn(executors, "openPostgresqlCommandExecutor")
      .mockResolvedValue(executor);
    try {
      await expect(
        postgres({
          databaseUrl: "postgresql://u:p@host/db?sslmode=verify-full",
        }).initialize({}),
      ).rejects.toMatchObject({
        errors: [validationFailure, cleanupFailure],
        cause: validationFailure,
      });
    } finally {
      open.mockRestore();
    }
  });
  it("rejects missing, ambiguous, and extra options", () => {
    for (const options of [
      {},
      { databaseUrl: "url", connection: {} },
      { databaseUrl: "url", extra: true },
      {
        get databaseUrl() {
          throw new Error("accessor invoked");
        },
      },
      { databaseUrl: "url", [Symbol()]: true },
    ]) {
      // @ts-expect-error Exercise JavaScript configuration validation.
      expect(() => postgres(options)).toThrow("invalid_configuration");
    }
  });
});
