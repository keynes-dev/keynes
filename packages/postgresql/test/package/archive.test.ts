import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { requirePostgresqlPackageArchive } from "../support/packed-package.ts";
import { readPackageArchive, type ArchiveEntry } from "@keynes/testkit/archive";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const expectedFiles = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/cli.d.ts",
  "package/dist/cli.js",
  "package/dist/installer/config.d.ts",
  "package/dist/installer/config.js",
  "package/dist/installer/install.d.ts",
  "package/dist/installer/install.js",
  "package/dist/installer/run-installation.d.ts",
  "package/dist/installer/run-installation.js",
  "package/generated/installation-record.json",
  "package/migrations/0001-storage.sql",
  "package/migrations/0002-budget.sql",
  "package/migrations/0003-public.generated.sql",
  "package/migrations/manifest.json",
  "package/package.json",
] as const;

let entries: ArchiveEntry[];

beforeAll(async () => {
  entries = await readPackageArchive(requirePostgresqlPackageArchive());
});

describe("@keynes/postgresql packed archive", () => {
  it("contains exactly the declared public artifact", () => {
    expect(entries.map(({ path }) => path).sort()).toEqual(expectedFiles);
  });

  it("keeps generated and migration bytes identical to canonical sources", async () => {
    for (const path of expectedFiles.filter(
      (candidate) =>
        candidate.startsWith("package/migrations/") ||
        candidate.startsWith("package/generated/"),
    )) {
      expect(entry(path).body).toEqual(
        await readFile(join(packageRoot, path.slice("package/".length))),
      );
    }

    const record = JSON.parse(
      entry("package/generated/installation-record.json").body.toString("utf8"),
    ) as {
      readonly migrations: readonly {
        readonly path: string;
        readonly sha256: string;
      }[];
    };
    for (const migration of record.migrations) {
      expect(
        createHash("sha256")
          .update(entry(`package/migrations/${migration.path}`).body)
          .digest("hex"),
      ).toBe(migration.sha256);
    }
  });

  it("publishes only the CLI and pg production dependency", () => {
    const manifest = JSON.parse(
      entry("package/package.json").body.toString("utf8"),
    ) as Record<string, unknown>;
    expect(manifest.exports).toEqual({});
    expect(manifest.bin).toEqual({ "keynes-postgresql": "dist/cli.js" });
    expect(manifest.dependencies).toEqual({ pg: "8.23.0" });
    expect(entry("package/dist/cli.js").mode & 0o111).not.toBe(0);
  });

  it("contains no SDK production import or credential material", () => {
    const content = Buffer.concat(
      entries
        .filter(
          ({ path }) =>
            path !== "package/LICENSE" && path !== "package/README.md",
        )
        .map(({ body }) => body),
    ).toString("utf8");
    expect(content).not.toContain("@keynes/sdk");
    expect(content).not.toContain("packages/sdk");
    expect(content).not.toMatch(
      /postgres(?:ql)?:\/\/|PGPASSWORD|password\s*[:=]/iu,
    );
  });
});

function entry(path: string): ArchiveEntry {
  const found = entries.find((candidate) => candidate.path === path);
  if (found === undefined) throw new Error(`Missing archive entry ${path}`);
  return found;
}
