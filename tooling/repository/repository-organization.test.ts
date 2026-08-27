/// <reference types="node" />

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

const targetDirectories = [
  "contracts",
  "packages/sdk",
  "packages/postgresql",
  "services/cloud",
  "system-tests/support",
  "system-tests/postgresql",
  "system-tests/cloud",
  "package-tests/sdk/install",
  "package-tests/sdk/compatibility",
  "package-tests/sdk/performance",
  "package-tests/postgresql",
  "tooling/contracts",
  "tooling/repository",
] as const;

const transitionalPaths = [
  "packages/contracts",
  "packages/database",
  "packages/cloud",
  "scripts/generate-contracts.ts",
  "scripts/generate-contracts.test.ts",
  "scripts/feature-identity.mjs",
  "scripts/feature-identity.test.mjs",
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
  "test:system:cloud",
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
  it("materializes every target owner", () => {
    for (const directory of targetDirectories) {
      expect(existsSync(join(repositoryRoot, directory)), directory).toBe(true);
    }
  });

  it("keeps exactly the three shipped products as workspaces", () => {
    const workspaceSource = readFile("pnpm-workspace.yaml");
    const workspaces = workspaceSource
      .split("\n")
      .map((line) => /^\s{2}-\s+(.+)$/u.exec(line)?.[1])
      .filter((entry): entry is string => entry !== undefined)
      .sort();

    expect(workspaces).toEqual(
      ["packages/sdk", "packages/postgresql", "services/cloud"].sort(),
    );
  });

  it("removes every transitional source and tooling path", () => {
    for (const path of transitionalPaths) {
      expect(existsSync(join(repositoryRoot, path)), path).toBe(false);
    }

    const activeSpecKitFiles = listFiles(join(repositoryRoot, ".specify"));
    for (const path of activeSpecKitFiles) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toContain("scripts/feature-identity.mjs");
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
      "ARCHIVE_PATH: artifacts/package-tests/sdk/keynes-sdk-0.0.0.tgz",
    );
    expect(
      workflow.match(/^\s+path: artifacts\/package-tests\/sdk\s*$/gmu) ?? [],
    ).toHaveLength(2);
  });

  it("writes hosted SDK measurements to a run-specific path", () => {
    const workflow = readFile(".github/workflows/sdk-package.yml");
    expect(workflow).toContain(
      "MEASUREMENT_PATH: artifacts/package-tests/sdk/attempts/${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}.json",
    );
    expect(workflow).toContain('--output "${{ env.MEASUREMENT_PATH }}"');
    expect(workflow).toContain("path: ${{ env.MEASUREMENT_PATH }}");
  });

  it("keeps production products independent", () => {
    const subjects = [
      ["packages/sdk", {}],
      ["packages/postgresql", { pg: "8.23.0" }],
      ["services/cloud", { pg: "8.23.0" }],
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
