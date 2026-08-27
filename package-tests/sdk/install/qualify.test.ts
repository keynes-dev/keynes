import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertOutsideRepository,
  inspectArchive,
  parseArguments,
  qualifyArchive,
  validatePackageFilePaths,
  validateSizes,
  writeQualificationResult,
} from "./qualify.js";
import { CONTRACT_DIGEST } from "../../../packages/sdk/src/generated/client.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const runnerPath = fileURLToPath(new URL("qualify.ts", import.meta.url));
const distRoot = resolve(repositoryRoot, "packages/sdk/dist");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

let suiteRoot: string;
let archivePath: string;
let firstBuild: Map<string, Buffer>;
let secondBuild: Map<string, Buffer>;
let archiveEntries: Map<string, Buffer>;

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
  archiveEntries = readArchiveEntries(await readFile(archivePath));
});

afterAll(async () => {
  if (suiteRoot !== undefined)
    await rm(suiteRoot, { recursive: true, force: true });
});

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

describe("SDK package-test runner", () => {
  it("builds the production tree deterministically", () => {
    expect(secondBuild).toEqual(firstBuild);
  });

  it("accepts one archive and one caller-selected output", () => {
    expect(() => parseArguments([])).toThrow("--archive");
    expect(parseArguments(["--", "--archive", "sdk.tgz"])).toEqual({
      archivePath: resolve(repositoryRoot, "sdk.tgz"),
    });
    expect(
      parseArguments(["--archive", "sdk.tgz", "--output", "records/sdk.json"]),
    ).toEqual({
      archivePath: resolve(repositoryRoot, "sdk.tgz"),
      outputPath: resolve(repositoryRoot, "records/sdk.json"),
    });
    expect(() => parseArguments(["--archive", "sdk.tgz", "--extra"])).toThrow(
      "Unknown argument --extra",
    );
    expect(() =>
      parseArguments(["--archive", "first.tgz", "--archive", "second.tgz"]),
    ).toThrow("once");
  });

  it("writes an immutable secret-safe evidence record", async () => {
    const outputPath = resolve(suiteRoot, "records", "sdk.json");
    const result = await qualifyArchive({ archivePath });

    expect(result).not.toHaveProperty("archivePath");
    await writeQualificationResult(outputPath, result);
    await expect(
      writeQualificationResult(outputPath, result),
    ).rejects.toThrow();

    const retained: unknown = JSON.parse(await readFile(outputPath, "utf8"));
    expect(retained).toEqual(result);
    expect(JSON.stringify(retained)).not.toContain(suiteRoot);
  }, 30_000);

  it("rejects PGlite and copied database files", () => {
    expect(() =>
      validatePackageFilePaths(["package/dist/local/pglite-database.js"]),
    ).toThrow("package/dist/local/pglite-database.js");
    expect(() =>
      validatePackageFilePaths([
        "package/dist/database/migrations/0001-storage.sql",
      ]),
    ).toThrow("package/dist/database/migrations/0001-storage.sql");
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

  it("packs the exact supported Node lines with no production dependency", () => {
    const manifestBytes = archiveEntries.get("package/package.json");
    expect(manifestBytes).toBeDefined();
    const manifest: unknown = JSON.parse(
      manifestBytes?.toString("utf8") ?? "null",
    );
    expect(manifest).toMatchObject({
      name: "@keynes/sdk",
      license: "Apache-2.0",
      engines: { node: ">=24 <25 || >=26 <27" },
    });
    if (!isRecord(manifest)) throw new Error("package manifest is invalid");
    expect(
      manifest.dependencies === undefined ||
        (isRecord(manifest.dependencies) &&
          Object.keys(manifest.dependencies).length === 0),
    ).toBe(true);
  });

  it("contains no PGlite or copied database archive path", () => {
    const paths = [...archiveEntries.keys()];
    expect(paths.filter((path) => /pglite/i.test(path))).toEqual([]);
    expect(
      paths.filter((path) => path.startsWith("package/dist/database/")),
    ).toEqual([]);
  });

  it("reads the contract digest from the packaged generated client", async () => {
    const client = archiveEntries
      .get("package/dist/generated/client.js")
      ?.toString("utf8");
    expect(client).toBeDefined();
    const packagedDigest = client?.match(
      /export const CONTRACT_DIGEST\s*=\s*"([a-f0-9]{64})"/,
    )?.[1];
    expect(packagedDigest).toBe(CONTRACT_DIGEST);

    const inspection = await inspectArchive(archivePath);
    expect(inspection.contractDigest).toBe(CONTRACT_DIGEST);
    expect(inspection).not.toHaveProperty("pgliteVersion");
  });

  it("rejects archive paths outside the public package tree", () => {
    expect(() =>
      validatePackageFilePaths(["package/dist/local/postgres-database.js"]),
    ).toThrow("package/dist/local/postgres-database.js");
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

  it("accepts equivalent repository license text with CRLF line endings", async () => {
    const licensePath = resolve(repositoryRoot, "LICENSE");
    const licenseSource = await readFile(licensePath, "utf8");
    const crlfLicense = Buffer.from(
      licenseSource.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    );
    vi.doMock("node:fs/promises", async () => {
      const actual =
        await vi.importActual<typeof import("node:fs/promises")>(
          "node:fs/promises",
        );
      return {
        ...actual,
        async readFile(path: string) {
          if (path === licensePath) return crlfLicense;
          return actual.readFile(path);
        },
      };
    });
    vi.resetModules();
    const { inspectArchive: inspectWithCrlfLicense } =
      await import("./qualify.js");

    await expect(inspectWithCrlfLicense(archivePath)).resolves.toMatchObject({
      contractDigest: CONTRACT_DIGEST,
    });
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
      schemaVersion: "keynes.package-test.sdk/v1",
      subject: "@keynes/sdk",
      archive: {
        sha256: createHash("sha256")
          .update(await readFile(archivePath))
          .digest("hex"),
        compressedBytes: expect.any(Number),
        productionBytes: expect.any(Number),
        contractDigest: CONTRACT_DIGEST,
      },
      checks: [
        "budget-loop",
        "isolation",
        "closure",
        "process-loss",
        "deep-imports-blocked",
      ],
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
  return (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name));
}

function readArchiveEntries(bytes: Buffer): Map<string, Buffer> {
  const archive = gunzipSync(bytes);
  const entries = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarText(header.subarray(0, 100));
    const prefix = readTarText(header.subarray(345, 500));
    const path = prefix === "" ? name : `${prefix}/${name}`;
    const sizeText = readTarText(header.subarray(124, 136)).trim();
    const size = sizeText === "" ? 0 : Number.parseInt(sizeText, 8);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    entries.set(path, archive.subarray(bodyStart, bodyEnd));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function readTarText(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
