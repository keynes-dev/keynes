import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sdkRoot = resolve(repositoryRoot, "packages/sdk");
const distRoot = resolve(sdkRoot, "dist");
const databaseRoot = resolve(repositoryRoot, "packages/database");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const productionModules = [
  "sdk/src/generated/client",
  "sdk/src/generated/types",
  "sdk/src/generated/validators",
  "sdk/src/index",
  "sdk/src/keynes",
  "sdk/src/private/database",
  "sdk/src/private/local-runtime",
  "sdk/src/private/migrations",
  "sdk/src/private/pglite-database",
  "sdk/src/private/procedure-caller",
  "sdk/src/private/resource-catalog",
  "sdk/src/sdk-errors",
] as const;

const databaseFiles = [
  "README.md",
  "generated/installation-record.json",
  "migrations/0001-storage.sql",
  "migrations/0002-budget.sql",
  "migrations/0003-public.generated.sql",
  "migrations/manifest.json",
] as const;

const expectedDistFiles = [
  ...productionModules.flatMap((path) => [`${path}.d.ts`, `${path}.js`]),
  ...databaseFiles.map((path) => `database/${path}`),
].sort();

describe("SDK package layout", () => {
  it("builds the production graph and canonical database tree deterministically", async () => {
    buildPackage();
    const firstBuild = await readTree(distRoot);

    expect([...firstBuild.keys()].sort()).toEqual(expectedDistFiles);
    for (const path of databaseFiles) {
      await expect(
        readFile(resolve(distRoot, "database", path)),
      ).resolves.toEqual(await readFile(resolve(databaseRoot, path)));
    }

    buildPackage();
    expect(await readTree(distRoot)).toEqual(firstBuild);
  });

  it("declares one private ESM package root and packs only allowed files", () => {
    const packageJson = readJson(resolve(sdkRoot, "package.json"));
    expect(packageJson).toMatchObject({
      name: "@keynes/sdk",
      version: "0.0.0",
      private: true,
      type: "module",
      license: "MIT",
      engines: { node: ">=24 <27" },
      files: ["dist", "README.md"],
      exports: {
        ".": {
          types: "./dist/sdk/src/index.d.ts",
          import: "./dist/sdk/src/index.js",
        },
      },
    });

    const packedFiles = packDryRun();
    expect(packedFiles).toEqual(
      [
        "LICENSE",
        "README.md",
        "package.json",
        ...expectedDistFiles.map((path) => `dist/${path}`),
      ].sort(),
    );
    expect(packedFiles).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/(?:^|\/)src\//),
        expect.stringMatching(/(?:test|fixture|qualification|credential)/i),
        expect.stringMatching(/\.(?:node|dll|dylib|exe|so)$/i),
      ]),
    );
  });
});

function buildPackage(): void {
  const result = spawnSync(pnpm, ["--filter", "@keynes/sdk", "build"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

async function readTree(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const path of await walk(root)) {
    files.set(relative(root, path), await readFile(path));
  }
  return files;
}

async function walk(root: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

function readJson(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(value)) throw new Error("package.json is not an object");
  return value;
}

function packDryRun(): string[] {
  const result = spawnSync(pnpm, ["pack", "--dry-run", "--json"], {
    cwd: sdkRoot,
    encoding: "utf8",
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  const value: unknown = JSON.parse(result.stdout);
  if (!isRecord(value) || !Array.isArray(value.files)) {
    throw new Error("pnpm pack returned an invalid file list");
  }
  return value.files
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.path !== "string") {
        throw new Error("pnpm pack returned an invalid file entry");
      }
      return entry.path;
    })
    .sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
