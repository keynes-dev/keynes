import { afterEach, describe, expect, it, vi } from "vitest";

const INSTALLATION = {
  tenantId: "00000000-0000-4000-8000-000000000002",
  principals: [
    {
      principalId: "00000000-0000-4000-8000-000000000201",
      permissions: ["read_budget"],
    },
  ],
} as const;

async function openStore() {
  const { SqliteStore } = await import("../../../src/local/sqlite-store.js");
  return SqliteStore.open(INSTALLATION);
}

afterEach(() => {
  vi.doUnmock("node:sqlite");
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("SQLite store", () => {
  it("opens only an in-memory database with extension loading disabled", async () => {
    const exec = vi.fn();
    const close = vi.fn();
    const enableLoadExtension = vi.fn();
    const loadExtension = vi.fn();
    const statement = {
      all: vi.fn(() => []),
      get: vi.fn(),
      run: vi.fn(),
      setReadBigInts: vi.fn(),
    };
    const database = {
      close,
      enableLoadExtension,
      exec,
      isTransaction: false,
      loadExtension,
      prepare: vi.fn(() => statement),
    };
    const DatabaseSyncMock = vi.fn(function () {
      return database;
    });
    vi.doMock("node:sqlite", () => ({ DatabaseSync: DatabaseSyncMock }));

    const store = await openStore();
    try {
      expect(DatabaseSyncMock).toHaveBeenCalledExactlyOnceWith(":memory:", {
        allowExtension: false,
      });
      expect(enableLoadExtension).not.toHaveBeenCalled();
      expect(loadExtension).not.toHaveBeenCalled();
    } finally {
      store.close();
    }
  });

  it("closes the acquired database when schema initialization fails", async () => {
    const startupFailure = new Error("schema initialization failed");
    const close = vi.fn();
    const DatabaseSyncMock = vi.fn(function () {
      return {
        close,
        exec: vi.fn(() => {
          throw startupFailure;
        }),
        prepare: vi.fn(),
      };
    });
    vi.doMock("node:sqlite", () => ({ DatabaseSync: DatabaseSyncMock }));

    await expect(openStore()).rejects.toBe(startupFailure);
    expect(close).toHaveBeenCalledOnce();
  });

  it("fails explicitly when node:sqlite is unavailable", async () => {
    vi.doMock("node:sqlite", () => {
      throw Object.assign(new Error("node:sqlite unavailable"), {
        code: "ERR_UNKNOWN_BUILTIN_MODULE",
      });
    });

    await expect(
      import("../../../src/local/sqlite-store.js"),
    ).rejects.toMatchObject({
      cause: {
        message: "node:sqlite unavailable",
        code: "ERR_UNKNOWN_BUILTIN_MODULE",
      },
    });
  });
});
