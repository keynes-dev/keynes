import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const qualificationRoot = resolve(repositoryRoot, "packages/sdk/qualification");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export const ARCHIVE_LIMIT_BYTES = 512 * 1024;
export const PRODUCTION_LIMIT_BYTES = 35 * 1024 * 1024;

const productionModules = [
  "generated/client",
  "generated/types",
  "generated/validators",
  "index",
  "keynes",
  "private/local-runtime",
  "private/resource-catalog",
  "private/sqlite-command-executor",
  "private/test-controls",
  "sdk-errors",
] as const;

const allowedPackageFiles = [
  "package/LICENSE",
  "package/README.md",
  "package/package.json",
  ...productionModules.flatMap((path) => [
    `package/dist/sdk/src/${path}.d.ts`,
    `package/dist/sdk/src/${path}.js`,
  ]),
].sort();

export interface QualificationArguments {
  readonly archivePath: string;
}

export interface QualificationResult {
  readonly archivePath: string;
  readonly archiveSha256: string;
  readonly compressedBytes: number;
  readonly productionBytes: number;
  readonly packageVersion: string;
  readonly checks: readonly [
    "budget-loop",
    "isolation",
    "closure",
    "process-loss",
  ];
}

interface ArchiveEntry {
  readonly path: string;
  readonly body: Buffer;
}

export interface ArchiveInspection {
  readonly sha256: string;
  readonly compressedBytes: number;
  readonly packageVersion: string;
  readonly contractDigest: string;
}

export interface ExternalConsumer {
  readonly root: string;
  readonly productionBytes: number;
  readonly close: () => Promise<void>;
}

export function parseArguments(
  args: readonly string[],
): QualificationArguments {
  let archive: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (index === 0 && argument === "--") continue;
    if (argument !== "--archive")
      throw new Error(`Unknown argument ${argument}`);
    if (archive !== undefined)
      throw new Error("--archive may be provided only once");
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error("--archive requires a path");
    }
    archive = value;
    index += 1;
  }
  if (archive === undefined) throw new Error("--archive is required");
  return { archivePath: resolve(archive) };
}

export function validatePackageFilePaths(paths: readonly string[]): void {
  const actual = [...paths].sort();
  const unknown = actual.find((path) => !allowedPackageFiles.includes(path));
  if (unknown !== undefined)
    throw new Error(`Archive contains forbidden file ${unknown}`);
  const missing = allowedPackageFiles.find((path) => !actual.includes(path));
  if (missing !== undefined)
    throw new Error(`Archive is missing required file ${missing}`);
  if (new Set(actual).size !== actual.length) {
    throw new Error("Archive contains duplicate file paths");
  }
}

export function validateSizes(sizes: {
  readonly compressedBytes: number;
  readonly productionBytes: number;
}): void {
  if (sizes.compressedBytes > ARCHIVE_LIMIT_BYTES) {
    throw new Error("SDK archive exceeds 512 KiB");
  }
  if (sizes.productionBytes > PRODUCTION_LIMIT_BYTES) {
    throw new Error("Production installation exceeds 35 MiB");
  }
}

export function assertOutsideRepository(root: string, candidate: string): void {
  const path = relative(root, candidate);
  if (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  ) {
    throw new Error(
      `Installed package resolves into the workspace: ${candidate}`,
    );
  }
}

export async function qualifyArchive(
  args: QualificationArguments,
): Promise<QualificationResult> {
  const archive = await inspectArchive(args.archivePath);
  validateSizes({
    compressedBytes: archive.compressedBytes,
    productionBytes: 0,
  });

  const external = await installExternalConsumer(
    args.archivePath,
    archive.compressedBytes,
  );
  try {
    const consumer = resolve(external.root, "build/consumer.mjs");
    run(process.execPath, [consumer, "budget-loop"], external.root);
    run(process.execPath, [consumer, "isolation"], external.root);
    run(process.execPath, [consumer, "closure"], external.root);
    const processState = parseProcessState(
      run(process.execPath, [consumer, "write-then-exit"], external.root),
    );
    run(
      process.execPath,
      [consumer, "read-after-restart", processState.resourceTypeId],
      external.root,
    );

    return {
      archivePath: args.archivePath,
      archiveSha256: archive.sha256,
      compressedBytes: archive.compressedBytes,
      productionBytes: external.productionBytes,
      packageVersion: archive.packageVersion,
      checks: ["budget-loop", "isolation", "closure", "process-loss"],
    };
  } finally {
    await external.close();
  }
}

export async function installExternalConsumer(
  archivePath: string,
  compressedBytes: number,
): Promise<ExternalConsumer> {
  await mkdir(tmpdir(), { recursive: true });
  const root = await mkdtemp(resolve(tmpdir(), "keynes-local-preview-"));
  assertOutsideRepository(repositoryRoot, root);
  try {
    await cp(qualificationRoot, root, { recursive: true });
    await cp(archivePath, resolve(root, "keynes-sdk.tgz"));
    await writeFile(
      resolve(root, "package.json"),
      `${JSON.stringify(
        {
          private: true,
          type: "module",
          dependencies: { "@keynes/sdk": "file:./keynes-sdk.tgz" },
        },
        null,
        2,
      )}\n`,
    );
    run(pnpm, ["install", "--prod", "--offline", "--ignore-scripts"], root);

    const installedPackage = await realpath(
      resolve(root, "node_modules/@keynes/sdk"),
    );
    assertOutsideRepository(repositoryRoot, installedPackage);
    assertWithin(await realpath(root), installedPackage);
    const productionBytes = await directoryBytes(resolve(root, "node_modules"));
    validateSizes({ compressedBytes, productionBytes });

    run(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/typescript/bin/tsc"),
        "--project",
        resolve(root, "tsconfig.json"),
      ],
      root,
    );
    return {
      root,
      productionBytes,
      close: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error: unknown) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export async function inspectArchive(path: string): Promise<ArchiveInspection> {
  const archiveStat = await stat(path);
  if (!archiveStat.isFile()) throw new Error(`Archive is not a file: ${path}`);
  const bytes = await readFile(path);
  const entries = readTar(gunzipSync(bytes));
  validatePackageFilePaths(entries.map((entry) => entry.path));
  const license = entries.find((entry) => entry.path === "package/LICENSE");
  if (
    license === undefined ||
    !license.body.equals(await readFile(resolve(repositoryRoot, "LICENSE")))
  ) {
    throw new Error("Archive license differs from the repository license");
  }

  const manifest = entries.find(
    (entry) => entry.path === "package/package.json",
  );
  if (manifest === undefined)
    throw new Error("Archive package.json is missing");
  const value: unknown = JSON.parse(manifest.body.toString("utf8"));
  if (
    !isRecord(value) ||
    value.name !== "@keynes/sdk" ||
    typeof value.version !== "string" ||
    value.license !== "Apache-2.0" ||
    value.type !== "module" ||
    !isRecord(value.engines) ||
    value.engines.node !== ">=24 <25 || >=26 <27" ||
    hasPackageDependencies(value)
  ) {
    throw new Error("Archive package metadata does not match @keynes/sdk");
  }
  const generatedClient = entries.find(
    (entry) => entry.path === "package/dist/sdk/src/generated/client.js",
  );
  if (generatedClient === undefined)
    throw new Error("Archive generated client is missing");
  const contractDigest = generatedClient.body
    .toString("utf8")
    .match(/export const CONTRACT_DIGEST\s*=\s*"([a-f0-9]{64})"/)?.[1];
  if (contractDigest === undefined) {
    throw new Error("Archive generated client has no valid contract digest");
  }

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    compressedBytes: archiveStat.size,
    packageVersion: value.version,
    contractDigest,
  };
}

function readTar(bytes: Buffer): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = readTarText(header.subarray(0, 100));
    const prefix = readTarText(header.subarray(345, 500));
    const path = prefix === "" ? name : `${prefix}/${name}`;
    const sizeText = readTarText(header.subarray(124, 136)).trim();
    const size = sizeText === "" ? 0 : Number.parseInt(sizeText, 8);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Archive has invalid size for ${path}`);
    }
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > bytes.length)
      throw new Error(`Archive is truncated at ${path}`);
    const type = header[156];
    if (type === 0 || type === 48) {
      if (
        path === "" ||
        path.startsWith("/") ||
        path.split("/").includes("..")
      ) {
        throw new Error(`Archive has invalid path ${path}`);
      }
      entries.push({ path, body: bytes.subarray(bodyStart, bodyEnd) });
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function readTarText(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString("utf8");
}

function assertWithin(root: string, candidate: string): void {
  const path = relative(root, candidate);
  if (path.startsWith(`..${sep}`) || path === ".." || isAbsolute(path)) {
    throw new Error(
      `Installed package escaped the consumer directory: ${candidate}`,
    );
  }
}

async function directoryBytes(root: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) bytes += await directoryBytes(path);
    else if (entry.isFile()) bytes += (await lstat(path)).size;
  }
  return bytes;
}

function parseProcessState(source: string): {
  readonly resourceTypeId: string;
  readonly budgetId: string;
} {
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    typeof value.resourceTypeId !== "string" ||
    typeof value.budgetId !== "string"
  ) {
    throw new Error("write-then-exit returned invalid process state");
  }
  return {
    resourceTypeId: value.resourceTypeId,
    budgetId: value.budgetId,
  };
}

function run(command: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
    timeout: 60_000,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPackageDependencies(manifest: Record<string, unknown>): boolean {
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const value = manifest[field];
    if (
      value !== undefined &&
      (!isRecord(value) || Object.keys(value).length > 0)
    ) {
      return true;
    }
  }
  for (const field of ["bundleDependencies", "bundledDependencies"]) {
    const value = manifest[field];
    if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
      return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  try {
    const result = await qualifyArchive(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error: unknown) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
