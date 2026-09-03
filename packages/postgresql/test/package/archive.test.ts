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
  "package/migrations/0004-policy.sql",
  "package/migrations/0005-resource-bound-budget.sql",
  "package/migrations/0006-remote-access.sql",
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

  it("publishes six ordered migrations with historical and current contracts", () => {
    const manifest: unknown = JSON.parse(
      entry("package/migrations/manifest.json").body.toString("utf8"),
    );
    expect(manifest).toEqual({
      migrations: [
        { id: "0001-storage", path: "0001-storage.sql" },
        { id: "0002-budget", path: "0002-budget.sql" },
        { id: "0003-public", path: "0003-public.generated.sql" },
        {
          id: "0004-policy",
          path: "0004-policy.sql",
          contractDigest:
            "f0aae48573f0c2e2fc017223d0762a43eb3cbc553924faa783eb963c9eed71a7",
        },
        {
          id: "0005-resource-bound-budget",
          path: "0005-resource-bound-budget.sql",
          contractDigest:
            "cb9e2a1744efb693b83daeaf7dea92673518cf9d3809b19688355a7a73ec78c5",
        },
        {
          id: "0006-remote-access",
          path: "0006-remote-access.sql",
          contract: true,
        },
      ],
    });

    const record = JSON.parse(
      entry("package/generated/installation-record.json").body.toString("utf8"),
    ) as {
      readonly migrations: readonly {
        readonly id: string;
        readonly path: string;
        readonly contractDigest?: string;
      }[];
    };
    expect(
      record.migrations.map(({ id, path, contractDigest }) => [
        id,
        path,
        contractDigest ?? null,
      ]),
    ).toEqual([
      ["0001-storage", "0001-storage.sql", null],
      ["0002-budget", "0002-budget.sql", null],
      ["0003-public", "0003-public.generated.sql", null],
      [
        "0004-policy",
        "0004-policy.sql",
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ],
      [
        "0005-resource-bound-budget",
        "0005-resource-bound-budget.sql",
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ],
      [
        "0006-remote-access",
        "0006-remote-access.sql",
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ],
    ]);
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

  it("documents the current six-key, four-role installation and eight remote procedures", () => {
    const readme = entry("package/README.md").body.toString("utf8");

    for (const key of [
      "ownerRole",
      "executionRole",
      "administrationRole",
      "applicationRole",
      "tenantId",
      "principalId",
    ]) {
      expect(readme).toContain(`\`${key}\``);
    }
    for (const procedure of [
      "remote_create_budget",
      "remote_request",
      "remote_settle",
      "remote_get_budget",
      "remote_get_budget_history_page",
      "remote_open_budget",
      "remote_recover_operation",
      "remote_get_compatibility",
    ]) {
      expect(readme).toContain(`keynes.${procedure}(jsonb)`);
    }
    expect(readme).not.toContain("exactly the five supported functions");
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
