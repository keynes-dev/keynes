import type { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";

import { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostgresDatabase } from "../system/support/postgres-database.js";

const state = vi.hoisted(
  (): {
    clients: EventEmitter[];
    statements: string[];
    failApplicationBegin: boolean;
    poolEnds: number;
  } => ({
    clients: [],
    statements: [],
    failApplicationBegin: false,
    poolEnds: 0,
  }),
);

vi.mock("pg", async () => {
  const { EventEmitter } = await import("node:events");
  class Client extends EventEmitter {
    async connect() {}
    async query(statement: string) {
      state.statements.push(statement);
      if (
        state.failApplicationBegin &&
        statement === "begin isolation level read committed"
      ) {
        throw new Error("transaction setup failed");
      }
      return { rows: [{ backend_pid: 1 }] };
    }
    release() {}
    async end() {
      this.emit("end");
    }
  }
  class Pool extends EventEmitter {
    async connect() {
      const client = new Client();
      state.clients.push(client);
      this.emit("connect", client);
      return client;
    }
    async end() {
      state.poolEnds++;
    }
  }
  return { Client, Pool };
});

beforeEach(() => {
  state.clients = [];
  state.statements = [];
  state.failApplicationBegin = false;
  state.poolEnds = 0;
});

describe("native fixture socket cleanup", () => {
  it.each(["root", "application", "failed application"])(
    "waits for the actual %s client end before dropping its database",
    async (source) => {
      const pool = new Pool();
      const fixture = new PostgresDatabase(
        pool,
        "postgresql://localhost/postgres",
        "fixture_database",
        "postgresql://localhost/fixture_database",
      );
      if (source === "root") {
        const client = await pool.connect();
        client.release();
      } else if (source === "application") {
        const transaction = await fixture.beginTransactionAs(
          "role",
          "password",
        );
        await transaction.commit();
      } else {
        state.failApplicationBegin = true;
        await expect(
          fixture.beginTransactionAs("role", "password"),
        ).rejects.toThrow("transaction setup failed");
        expect(state.poolEnds).toBe(1);
      }
      const client = state.clients[0];
      expect(client).toBeDefined();
      const closed = fixture.close();
      await setImmediate();
      expect(state.poolEnds).toBeGreaterThan(0);
      expect(state.statements).not.toContain(
        "drop database if exists fixture_database with (force)",
      );

      client?.emit("end");
      await closed;
      expect(state.statements).toEqual(
        expect.arrayContaining([
          "drop database if exists fixture_database with (force)",
        ]),
      );
    },
  );
});
