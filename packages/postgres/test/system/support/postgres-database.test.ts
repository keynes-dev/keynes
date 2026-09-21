import { afterEach, expect, it, vi } from "vitest";

import { install } from "../../../src/installer/install.js";
import { loadPublicPostgresql } from "../../support/packed-package.js";
import { FIXTURE_INSTALLATION } from "./test-keynes.js";
import { openInstalledPostgresDatabase } from "./postgres-database.js";

const query = vi.hoisted(() =>
  vi.fn(async (_statement: string) => ({ rows: [] })),
);
vi.mock("pg", () => {
  class Client {
    query = query;
    async connect() {
      return this;
    }
    async end() {}
    release() {}
    on() {}
  }
  return { Client, Pool: Client };
});
vi.mock("../../../src/installer/install.js", () => ({
  install: vi.fn(async () => ({ ok: true, outcome: "installed" })),
}));
vi.mock("../../support/packed-package.js", () => ({
  loadPublicPostgresql: vi.fn(async () => ({
    install: vi.fn(async () => ({ ok: true, outcome: "installed" })),
  })),
}));

afterEach(() => vi.resetAllMocks());

it("removes prepared state when source installation fails", async () => {
  vi.mocked(install).mockRejectedValueOnce(new Error("installation failed"));
  await expect(
    openInstalledPostgresDatabase(
      "postgresql://postgres:fixture@127.0.0.1:5432/postgres",
      FIXTURE_INSTALLATION,
      { kind: "source" },
    ),
  ).rejects.toThrow("installation failed");
  expect(
    query.mock.calls.filter(([sql]) => sql.startsWith("drop role")),
  ).toHaveLength(4);
});

it.each([
  { kind: "source" },
  { kind: "packed", consumerRoot: "/fixture/consumer" },
] as const)(
  "installs an ordinary $kind fixture once and removes its database",
  async (installation) => {
    const owner = await openInstalledPostgresDatabase(
      "postgresql://postgres:fixture@127.0.0.1:5432/postgres",
      FIXTURE_INSTALLATION,
      installation,
    );
    await owner.close();
    expect(install).toHaveBeenCalledTimes(
      installation.kind === "source" ? 1 : 0,
    );
    expect(loadPublicPostgresql).toHaveBeenCalledTimes(
      installation.kind === "packed" ? 1 : 0,
    );
    expect(
      query.mock.calls
        .flat()
        .some((sql) => String(sql).startsWith("drop database")),
    ).toBe(true);
  },
);
