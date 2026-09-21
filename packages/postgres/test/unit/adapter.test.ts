import { Client, Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { postgres } from "../../src/index.js";

const definitions = {
  workUnits: { unit: "unit", accountingBehavior: "consumable" },
};
const validated = {
  command: "SELECT",
  rowCount: 1,
  oid: 0,
  fields: [],
  rows: [{ response: { ok: true, replayed: false, result: { valid: true } } }],
};

function connectedClient() {
  const client = new Client();
  Object.defineProperty(client, "_connected", { value: true });
  return client;
}

function borrowed(connection: Client) {
  return postgres({ connection });
}

describe("borrowed PostgreSQL adapter", () => {
  it("creates a cold embedded descriptor without connection or query activity", () => {
    const connection = new Client();
    const query = vi.spyOn(connection, "query");
    const connect = vi.spyOn(connection, "connect");
    expect(borrowed(connection).kind).toBe("embedded");
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("rejects Pools, arbitrary query providers, ambiguous and extra options", async () => {
    const pool = new Pool();
    const connection = new Client();
    try {
      for (const options of [
        { connection: pool },
        { connection: { query() {} } },
        { connection: { query() {}, connect() {}, end() {} } },
        { connection, databaseUrl: "url" },
        { connection, extra: true },
        { connection, [Symbol()]: true },
        Object.defineProperty({}, "connection", {
          get() {
            throw new Error("getter executed");
          },
        }),
      ]) {
        expect(() => Reflect.apply(postgres, undefined, [options])).toThrow(
          "invalid_configuration",
        );
      }
      expect(() =>
        Reflect.apply(postgres, undefined, [{ connection }, undefined]),
      ).toThrow("invalid_configuration");
    } finally {
      await pool.end();
    }
  });

  it("refuses an unconnected client at initialization without implicitly connecting", async () => {
    const connection = new Client();
    const query = vi.spyOn(connection, "query");
    const connect = vi.spyOn(connection, "connect");
    await expect(
      borrowed(connection).initialize(definitions),
    ).rejects.toMatchObject({ code: "invalid_configuration" });
    expect(query).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(["_ending", "_queryable"])(
    "refuses unusable client state %s without querying",
    async (field) => {
      const connection = connectedClient();
      Object.defineProperty(connection, field, { value: field === "_ending" });
      const query = vi.spyOn(connection, "query");
      await expect(
        borrowed(connection).initialize(definitions),
      ).rejects.toMatchObject({ code: "invalid_configuration" });
      expect(query).not.toHaveBeenCalled();
    },
  );

  it("validates on the supplied client and closes only its handle", async () => {
    const connection = connectedClient();
    const query = vi
      .spyOn(connection, "query")
      .mockImplementation(() => Promise.resolve(validated));
    const connect = vi.spyOn(connection, "connect");
    const end = vi.spyOn(connection, "end");
    const release = vi.fn();
    Object.assign(connection, { release });
    const descriptor = borrowed(connection);
    const session = await descriptor.initialize(definitions);
    expect(session.resources).toEqual([
      {
        key: "workUnits",
        canonicalName: "work_units",
        unit: "unit",
        accountingBehavior: "consumable",
      },
    ]);
    expect(query).toHaveBeenCalledExactlyOnceWith({
      text: "select keynes.validate_resources($1::jsonb) as response",
      values: [JSON.stringify({ definitions })],
    });
    let finish!: () => void;
    const admitted = session.admit(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    const closing = session.close();
    expect(session.close()).toBe(closing);
    expect(session.state).toBe("closing");
    await expect(session.admit(async () => undefined)).rejects.toMatchObject({
      code: "runtime_closed",
    });
    finish();
    await Promise.all([admitted, closing]);
    expect(session.state).toBe("closed");
    expect(query).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    const second = await descriptor.initialize(definitions);
    expect(second.state).toBe("open");
    await second.close();
    expect(query).toHaveBeenCalledTimes(2);
    expect(end).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("dispatches one direct statement and never retries a transport failure", async () => {
    const connection = connectedClient();
    const failure = Object.assign(new Error("private connection detail"), {
      code: "ECONNRESET",
    });
    const query = vi
      .spyOn(connection, "query")
      .mockImplementationOnce(() => Promise.resolve(validated))
      .mockRejectedValueOnce(failure);
    const session = await borrowed(connection).initialize(definitions);
    try {
      const pending = session.admit(() =>
        session.invokeMutation(() =>
          session.client.defineResources({
            commandId: "96000000-0000-4000-8000-000000000001",
            definitions,
          }),
        ),
      );
      await expect(pending).rejects.toMatchObject({
        code: "operation_interrupted",
      });
      await pending.catch((error: unknown) => {
        if (!(error instanceof Error)) throw error;
        expect(error.cause).toBe(failure);
      });
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[1]?.[0]).toMatchObject({
        text: "select keynes.define_resources($1::jsonb) as response",
      });
    } finally {
      await session.close();
    }
  });
});
