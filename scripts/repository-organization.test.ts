/// <reference types="node" />

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { generateNodeSqlite } from "../packages/node-sqlite/scripts/generate.ts";
import { generateSdk } from "../packages/sdk/scripts/generate.ts";
import { generatePostgresql } from "../packages/postgres/scripts/generate.ts";
import { loadContract } from "../packages/database/src/load.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");

const targetDirectories = [
  "packages/database",
  "packages/database/src/sqlite",
  "packages/database/postgres/migrations",
  "packages/sdk",
  "packages/node-sqlite",
  "packages/postgres",
  "packages/testkit",
  "apps/cli",
  "packages/sdk/test/contract",
  "packages/sdk/test/package",
  "packages/sdk/test/performance",
  "packages/postgres/test/integration",
  "packages/postgres/test/package",
  "packages/postgres/test/system",
  "scripts",
  ".specify/scripts",
] as const;

const removedRootOwners = [
  "packages/contracts",
  "artifacts",
  "contracts",
  "package-tests",
  "services",
  "system-tests",
  "tooling",
] as const;

const requiredCommands = [
  "build:sdk",
  "pack:sdk",
  "test:package:sdk",
  "measure:package:sdk",
  "build:postgresql",
  "pack:postgresql",
  "test:package:postgresql",
  "test:system:postgresql",
  "build:cli",
  "pack:cli",
  "test:package:cli",
] as const;

const removedCommands = [
  "build:package",
  "pack:package",
  "test:qualification",
  "test:package",
  "qualify:local",
  "test:platform",
  "test:cloud",
] as const;

describe("repository organization", () => {
  it("generates each distribution without writing the source owner or sibling consumer", async () => {
    const root = mkdtempSync(join(tmpdir(), "keynes-generation-"));
    try {
      const owner = join(root, "packages/database");
      mkdirSync(owner, { recursive: true });
      for (const path of [
        "src",
        "postgres",
        "generated",
        "contract.json",
        "schema.json",
      ]) {
        cpSync(
          join(repositoryRoot, "packages/database", path),
          join(owner, path),
          { recursive: true },
        );
      }
      const snapshot = (directory: string) =>
        readdirSync(directory, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => join(entry.parentPath, entry.name))
          .sort()
          .map((path) => [path, readFileSync(path, "utf8")]);
      const before = snapshot(owner);
      await generateSdk({
        check: false,
        contract: loadContract(join(repositoryRoot, "packages/database")),
        repositoryRoot: root,
      });
      expect(readdirSync(join(root, "packages")).sort()).toEqual([
        "database",
        "sdk",
      ]);
      expect(snapshot(owner)).toEqual(before);
      const sdk = snapshot(join(root, "packages/sdk"));
      await generateNodeSqlite({
        check: false,
        repositoryRoot: root,
      });
      expect(snapshot(owner)).toEqual(before);
      expect(snapshot(join(root, "packages/sdk"))).toEqual(sdk);
      const sqlite = snapshot(join(root, "packages/node-sqlite"));
      await generatePostgresql({ check: false, repositoryRoot: root });
      expect(snapshot(join(root, "packages/node-sqlite"))).toEqual(sqlite);
      expect(snapshot(owner)).toEqual(before);
      expect(snapshot(join(root, "packages/sdk"))).toEqual(sdk);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("pins the reviewed command contract, schema, and PostgreSQL baseline", () => {
    const database = readJsonObject(
      join(repositoryRoot, "packages/database/package.json"),
    );
    expect(database.private).toBe(true);
    expect(Object.keys(requireObject(database, "dependencies"))).not.toContain(
      "@keynes/sdk",
    );
    for (const [path, digest] of [
      [
        "contract.json",
        "cfd417e018910406b28e996a5560a5f869b5c1c68acd307bb6e5b47d44c9e0c9",
      ],
      [
        "schema.json",
        "3e8e7aabd52e667b20eacdfacea60d92467ea6da307849ce7043278a024ad38c",
      ],
      [
        "postgres/migrations/0001-baseline.sql",
        "bbea1fe935a793cc1cfcf6712e3932cc77969c1bf464aed43d28d8fd92cc9d34",
      ],
    ]) {
      expect(
        createHash("sha256")
          .update(readFile(`packages/database/${path}`))
          .digest("hex"),
        path,
      ).toBe(digest);
    }
    for (const path of [
      "migrations/0001-baseline.sql",
      "migrations/manifest.json",
      "generated/installation-record.json",
    ]) {
      expect(readFile(`packages/postgres/${path}`), path).toBe(
        readFile(`packages/database/postgres/${path}`),
      );
    }
  });

  it("runs checks before sequential package tests without a duplicate generator test invocation", () => {
    const scripts = requireObject(
      readJsonObject(join(repositoryRoot, "package.json")),
      "scripts",
    );
    expect(scripts["test:pr"]).not.toContain("pnpm test:generator");
    expect(scripts["test:pr"]).toContain(
      "pnpm test:pr:checks && turbo run typecheck && turbo run test --concurrency=1",
    );
    expect(scripts["test:generator"]).toBe(
      "pnpm --filter @keynes/database test",
    );
  });

  it("keeps package qualification out of routine SDK tests", () => {
    const scripts = requireObject(
      readJsonObject(join(repositoryRoot, "packages/sdk/package.json")),
      "scripts",
    );
    expect(scripts.test).not.toContain("test/package");
    expect(scripts["test:package:unit"]).toContain("vitest run test/package");
    expect(readFile(".github/workflows/sdk-package.yml")).toContain(
      "pnpm --filter @keynes/sdk test:package:unit",
    );
  });

  it("materializes every target owner", () => {
    for (const directory of targetDirectories) {
      expect(existsSync(join(repositoryRoot, directory)), directory).toBe(true);
    }
  });

  it("uses the package workspace glob", () => {
    const workspaceSource = readFile("pnpm-workspace.yaml");
    const packagesBlock = /^packages:\n((?: {2}- .+\n)+)/mu.exec(
      workspaceSource,
    )?.[1];
    const workspaces = (packagesBlock ?? "")
      .split("\n")
      .map((line) => /^\s{2}-\s+(.+)$/u.exec(line)?.[1])
      .filter((entry): entry is string => entry !== undefined)
      .sort();

    expect(workspaces).toEqual(['"apps/*"', '"packages/*"']);
  });

  it("owns command interaction in the CLI workspace and keeps PostgreSQL a library", () => {
    const cli = readJsonObject(join(repositoryRoot, "apps/cli/package.json"));
    const postgres = readJsonObject(
      join(repositoryRoot, "packages/postgres/package.json"),
    );
    expect(cli.name).toBe("@keynes/cli");
    expect(cli.dependencies).toEqual({ "@keynes/postgres": "workspace:*" });
    expect(requireObject(cli, "bin")).toEqual({ keynes: "dist/cli.js" });
    expect(postgres).not.toHaveProperty("bin");
    expect(Object.keys(requireObject(postgres, "exports")).sort()).toEqual([
      ".",
      "./install",
    ]);
    const rootScripts = requireObject(
      readJsonObject(join(repositoryRoot, "package.json")),
      "scripts",
    );
    expect(rootScripts.format).toContain(" apps ");
    expect(rootScripts["format:fix"]).toContain(" apps ");
    expect(rootScripts["test:unit"]).toContain(
      "pnpm --filter @keynes/cli test",
    );
    const scripts = requireObject(cli, "scripts");
    expect(scripts.test).toContain("vitest run");
    expect(scripts.test).not.toContain("test/package/run.ts");
    expect(scripts["test:package"]).toContain("test/package");
  });

  it("removes every obsolete root owner", () => {
    for (const path of removedRootOwners) {
      expect(existsSync(join(repositoryRoot, path)), path).toBe(false);
    }

    const activeSpecKitFiles = listFiles(join(repositoryRoot, ".specify"));
    for (const path of activeSpecKitFiles) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toContain("tooling/repository");
    }
  });

  it("publishes only responsibility-named active commands", () => {
    const manifest = readJsonObject(join(repositoryRoot, "package.json"));
    const scripts = requireObject(manifest, "scripts");

    for (const command of requiredCommands) {
      expect(scripts, command).toHaveProperty(command);
    }
    for (const command of removedCommands) {
      expect(scripts, command).not.toHaveProperty(command);
    }
  });

  it("downloads the SDK archive into the path used by every hosted consumer", () => {
    const workflow = readFile(".github/workflows/sdk-package.yml");
    expect(workflow).toContain(
      "ARCHIVE_PATH: .artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz",
    );
    expect(
      workflow.match(/^\s+path: \.artifacts\/package-tests\/sdk\s*$/gmu) ?? [],
    ).toHaveLength(2);
  });

  it("writes hosted SDK measurements to a run-specific path", () => {
    const workflow = readFile(".github/workflows/sdk-package.yml");
    expect(workflow).toContain(
      "MEASUREMENT_PATH: .artifacts/package-tests/sdk/attempts/${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}.json",
    );
    expect(workflow).toContain('--output "${{ env.MEASUREMENT_PATH }}"');
    expect(workflow).toContain("path: ${{ env.MEASUREMENT_PATH }}");
  });

  it("keeps production products independent", () => {
    const subjects = [
      ["packages/sdk", {}],
      ["packages/node-sqlite", {}],
      [
        "packages/postgres",
        {
          "@types/pg": "8.23.1",
          pg: "8.23.0",
          "pg-connection-string": "2.14.0",
        },
      ],
    ] as const;

    for (const [directory, expectedDependencies] of subjects) {
      const manifest = readJsonObject(
        join(repositoryRoot, directory, "package.json"),
      );
      expect(manifest.dependencies ?? {}, directory).toEqual(
        expectedDependencies,
      );

      for (const sourcePath of listFiles(
        join(repositoryRoot, directory, "src"),
      )) {
        const source = readFileSync(sourcePath, "utf8");
        const imports = [
          ...source.matchAll(/(?:from\s+|import\s*)["'](@keynes\/[^"']+)/gu),
        ].map((match) => match[1]);
        expect(
          imports.filter(
            (name) => directory === "packages/sdk" || name !== "@keynes/sdk",
          ),
          sourcePath,
        ).toEqual([]);
      }
    }
  });

  it("keeps shared test mechanics product-neutral", () => {
    for (const sourcePath of listFiles(
      join(repositoryRoot, "packages/testkit/src"),
    )) {
      const source = readFileSync(sourcePath, "utf8");
      expect(source, sourcePath).not.toMatch(
        /@keynes\/|\bBudget\b|PostgreSQL|evidence|schemaVersion/u,
      );
    }
  });
});

function readFile(path: string): string {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

function readJsonObject(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isObject(value)) throw new Error(`Expected an object in ${path}`);
  return value;
}

function requireObject(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const child = value[key];
  if (!isObject(child)) throw new Error(`Expected ${key} to be an object`);
  return child;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        !entry.isDirectory() &&
        [".json", ".md", ".mjs", ".ps1", ".sh", ".ts", ".yml"].includes(
          extname(entry.name),
        ),
    )
    .map((entry) => join(entry.parentPath, entry.name));
}
