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
import { generateSdk } from "../packages/sdk/scripts/generate.ts";
import { generatePostgresql } from "../packages/postgresql/scripts/generate.ts";
import { loadContract } from "../packages/database/src/load.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");

const targetDirectories = [
  "packages/database",
  "packages/database/src/sqlite",
  "packages/database/postgres/migrations",
  "packages/sdk",
  "packages/postgresql",
  "packages/testkit",
  "packages/sdk/test/contract",
  "packages/sdk/test/package",
  "packages/sdk/test/performance",
  "packages/postgresql/test/integration",
  "packages/postgresql/test/package",
  "packages/postgresql/test/system",
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
      for (const path of ["src", "postgres"]) {
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
      await generatePostgresql({ check: false, repositoryRoot: root });
      expect(snapshot(owner)).toEqual(before);
      expect(snapshot(join(root, "packages/sdk"))).toEqual(sdk);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves command and SQL identities under the private database owner", () => {
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
        "17c11670dbaf042f29a8f546beab401a3c76b920c4100cf07b01c26164b18e5d",
      ],
      [
        "schema.json",
        "7d96d41d1eeb87e89b75a13872fcf9f9d7dbea233413d9bb6becbdf6975e83cf",
      ],
      [
        "postgres/migrations/0001-baseline.sql",
        "38822568b10faefe596d98b556576bf7114e2c2c63b4f128c52b906f0ab7e1d9",
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
      expect(readFile(`packages/postgresql/${path}`), path).toBe(
        readFile(`packages/database/postgres/${path}`),
      );
    }
  });

  it("runs contracts through Turbo without a duplicate generator test invocation", () => {
    const scripts = requireObject(
      readJsonObject(join(repositoryRoot, "package.json")),
      "scripts",
    );
    expect(scripts["test:pr"]).not.toContain("pnpm test:generator");
    expect(scripts["test:pr"]).toContain("turbo run quality typecheck test");
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

    expect(workspaces).toEqual(['"packages/*"']);
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
      [
        "packages/sdk",
        {
          pg: "8.23.0",
          "pg-cloudflare": "1.4.0",
          "pg-connection-string": "2.14.0",
          "pg-int8": "1.0.1",
          "pg-pool": "3.14.0",
          "pg-protocol": "1.16.0",
          "pg-types": "2.2.0",
          pgpass: "1.0.5",
          "postgres-array": "2.0.0",
          "postgres-bytea": "1.0.1",
          "postgres-date": "1.0.7",
          "postgres-interval": "1.2.0",
          split2: "4.2.0",
          xtend: "4.0.2",
        },
      ],
      ["packages/postgresql", { pg: "8.23.0" }],
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
        expect(source, sourcePath).not.toMatch(
          /(?:from\s+|import\s*)["']@keynes\//u,
        );
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
