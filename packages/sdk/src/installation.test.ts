import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

const INSTALLATION_RECORD_URL = new URL(
  "../../database/generated/installation-record.json",
  import.meta.url,
);
const OPERATIONS_URL = new URL(
  "../../contracts/generated/operations.json",
  import.meta.url,
);

const FIXTURES = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  principals: {
    "publisher-fixture": "00000000-0000-4000-8000-000000000101",
    "allocator-fixture": "00000000-0000-4000-8000-000000000102",
    "requester-fixture": "00000000-0000-4000-8000-000000000103",
    "settlement-fixture": "00000000-0000-4000-8000-000000000104",
    "reader-fixture": "00000000-0000-4000-8000-000000000105",
    "product-fixture": "00000000-0000-4000-8000-000000000106",
    "unauthorized-fixture": "00000000-0000-4000-8000-000000000107",
  },
} as const;

type FileContents = string | Buffer;
type FileMutation = (path: URL, contents: FileContents) => FileContents;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(path: URL): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readContractDigest(): Promise<string> {
  const record = await readJson(INSTALLATION_RECORD_URL);
  if (!isRecord(record) || typeof record.contractDigest !== "string") {
    throw new Error("installation record has no contract digest");
  }
  return record.contractDigest;
}

async function readOperationTargets(): Promise<string[]> {
  const manifest = await readJson(OPERATIONS_URL);
  if (!isRecord(manifest) || !Array.isArray(manifest.operations)) {
    throw new Error("operation manifest has no operations");
  }
  return manifest.operations.map((operation: unknown) => {
    if (!isRecord(operation) || typeof operation.target !== "string") {
      throw new Error("operation manifest entry has no target");
    }
    return operation.target;
  });
}

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

async function loadInstallerWith(mutate: FileMutation) {
  vi.resetModules();
  vi.doMock("node:fs/promises", async () => {
    const actual =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises",
      );
    return {
      ...actual,
      async readFile(path: URL, encoding?: "utf8") {
        const contents =
          encoding === undefined
            ? await actual.readFile(path)
            : await actual.readFile(path, encoding);
        return mutate(path, contents);
      },
    };
  });
  return import("./private/migrations.js");
}

async function withFreshDatabase(
  run: (database: PGlite) => Promise<void>,
): Promise<void> {
  const database = await PGlite.create("memory://");
  try {
    await run(database);
  } finally {
    await database.close();
  }
}

describe("generated installation record", () => {
  it("resolves every generated binding against a fresh installation", async () => {
    const targets = await readOperationTargets();
    const { installDatabase } = await loadInstallerWith(
      (_path, contents) => contents,
    );

    await withFreshDatabase(async (database) => {
      await installDatabase(database, FIXTURES);

      for (const target of targets) {
        const signature = `${target}(jsonb)`;
        const result = await database.query<{ exists: boolean }>(
          "select to_regprocedure($1) is not null as exists",
          [signature],
        );
        expect(result.rows[0]?.exists, signature).toBe(true);
      }
    });
  });

  it("rejects a contract digest mismatch before installation", async () => {
    const contractDigest = await readContractDigest();
    const mismatchedDigest = "0".repeat(64);
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("installation-record.json")) return contents;
      if (typeof contents !== "string") throw new Error("record must be text");
      return contents.replace(contractDigest, mismatchedDigest);
    });

    await withFreshDatabase(async (database) => {
      await expect(installDatabase(database, FIXTURES)).rejects.toMatchObject({
        code: "contract_mismatch",
        details: {
          clientDigest: contractDigest,
          installedDigest: mismatchedDigest,
        },
      });
    });
  });

  it("rejects migration byte drift before applying it", async () => {
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("0001-storage.sql")) return contents;
      if (typeof contents === "string") return `${contents}\n-- drift\n`;
      return Buffer.concat([contents, Buffer.from("\n-- drift\n")]);
    });

    await withFreshDatabase(async (database) => {
      await expect(installDatabase(database, FIXTURES)).rejects.toMatchObject({
        code: "installation_drift",
        details: { migrationId: "0001-storage" },
      });
    });
  });

  it("rejects an installed-object mismatch after fresh migration", async () => {
    const missingTarget = "keynes.missing_publication_target";
    const { installDatabase } = await loadInstallerWith((path, contents) => {
      if (!path.pathname.endsWith("installation-record.json")) return contents;
      if (typeof contents !== "string") throw new Error("record must be text");
      return contents.replace("keynes.publish_resource_type", missingTarget);
    });

    await withFreshDatabase(async (database) => {
      await expect(installDatabase(database, FIXTURES)).rejects.toThrow(
        `Installed database object does not match ${missingTarget}(jsonb)`,
      );
    });
  });
});
