import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertOutsideRepository,
  inspectArchive,
  parseArguments,
  validatePackageFilePaths,
  validateSizes,
} from "./qualify-local-preview.js";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const runnerPath = resolve(repositoryRoot, "scripts/qualify-local-preview.ts");
const distRoot = resolve(repositoryRoot, "packages/sdk/dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let suiteRoot: string;
let archivePath: string;
let firstBuild: Map<string, Buffer>;
let secondBuild: Map<string, Buffer>;

beforeAll(async () => {
  suiteRoot = await mkdtemp(resolve(tmpdir(), "keynes-package-test-"));
  run(pnpm, ["--filter", "@keynes/sdk", "build"]);
  firstBuild = await readTree(distRoot);
  run(pnpm, ["--filter", "@keynes/sdk", "build"]);
  secondBuild = await readTree(distRoot);
  run(pnpm, [
    "--filter",
    "@keynes/sdk",
    "pack",
    "--pack-destination",
    suiteRoot,
  ]);
  archivePath = resolve(suiteRoot, "keynes-sdk-0.0.0.tgz");
});

afterAll(async () => {
  if (suiteRoot !== undefined)
    await rm(suiteRoot, { recursive: true, force: true });
});

describe("local preview qualification runner", () => {
  it("builds the production tree deterministically", () => {
    expect(secondBuild).toEqual(firstBuild);
  });

  it("requires one known archive argument", () => {
    expect(() => parseArguments([])).toThrow("--archive");
    expect(parseArguments(["--", "--archive", "sdk.tgz"])).toEqual({
      archivePath: resolve(repositoryRoot, "sdk.tgz"),
    });
    expect(() => parseArguments(["--archive", "sdk.tgz", "--extra"])).toThrow(
      "Unknown argument --extra",
    );
    expect(() =>
      parseArguments(["--archive", "first.tgz", "--archive", "second.tgz"]),
    ).toThrow("once");
  });

  it("rejects files outside the package allowlist", () => {
    expect(() =>
      validatePackageFilePaths([
        "package/package.json",
        "package/src/private/database.ts",
      ]),
    ).toThrow("package/src/private/database.ts");
  });

  it("enforces compressed and production size limits", () => {
    expect(() =>
      validateSizes({ compressedBytes: 524_289, productionBytes: 1 }),
    ).toThrow("512 KiB");
    expect(() =>
      validateSizes({ compressedBytes: 1, productionBytes: 36_700_161 }),
    ).toThrow("35 MiB");
  });

  it("rejects a workspace-linked installation target", () => {
    expect(() =>
      assertOutsideRepository(
        repositoryRoot,
        resolve(repositoryRoot, "packages/sdk"),
      ),
    ).toThrow("workspace");
  });

  it("rejects packaged database bytes that differ from the canonical tree", async () => {
    const archive = gunzipSync(await readFile(archivePath));
    const canonical = await readFile(
      resolve(repositoryRoot, "packages/database/README.md"),
    );
    const offset = archive.indexOf(canonical);
    expect(offset).toBeGreaterThanOrEqual(0);
    archive.writeUInt8(archive.readUInt8(offset) ^ 1, offset);

    const tamperedPath = resolve(suiteRoot, "tampered-sdk.tgz");
    await writeFile(tamperedPath, gzipSync(archive));
    await expect(inspectArchive(tamperedPath)).rejects.toThrow(
      "differs from canonical source",
    );
  });

  it("rejects packaged license text that differs from the repository license", async () => {
    const archive = gunzipSync(await readFile(archivePath));
    const canonical = await readFile(resolve(repositoryRoot, "LICENSE"));
    const offset = archive.indexOf(canonical);
    expect(offset).toBeGreaterThanOrEqual(0);
    archive.writeUInt8(archive.readUInt8(offset) ^ 1, offset);

    const tamperedPath = resolve(suiteRoot, "tampered-license-sdk.tgz");
    await writeFile(tamperedPath, gzipSync(archive));
    await expect(inspectArchive(tamperedPath)).rejects.toThrow(
      "differs from the repository license",
    );
  });

  it("retains the exact archive identity, installs externally, and cleans up", async () => {
    const consumerRoot = resolve(suiteRoot, "consumers");
    const result = spawnSync(
      process.execPath,
      [runnerPath, "--archive", archivePath],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          TMPDIR: consumerRoot,
          TMP: consumerRoot,
          TEMP: consumerRoot,
          NODE_DISABLE_COMPILE_CACHE: "1",
        },
      },
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const output: unknown = JSON.parse(result.stdout);
    expect(output).toMatchObject({
      archivePath,
      archiveSha256: createHash("sha256")
        .update(await readFile(archivePath))
        .digest("hex"),
      compressedBytes: expect.any(Number),
      productionBytes: expect.any(Number),
      checks: ["budget-loop", "isolation", "closure", "process-loss"],
    });
    expect(await readdir(consumerRoot)).toEqual([]);
  }, 30_000);
});

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, {
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
