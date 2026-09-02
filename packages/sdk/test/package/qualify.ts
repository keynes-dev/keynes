import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { readPackageArchiveBytes } from "@keynes/testkit/archive";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const installRoot = fileURLToPath(new URL(".", import.meta.url));
const compatibilityRoot = resolve(installRoot, "compatibility");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export const ARCHIVE_LIMIT_BYTES = 1024 * 1024;
export const PRODUCTION_LIMIT_BYTES = 35 * 1024 * 1024;

const productionModules = [
  "budget-projection",
  "budget-request-options",
  "budget",
  "command-executor",
  "generated/client",
  "generated/policy-profile",
  "generated/policy-types",
  "generated/types",
  "generated/validators",
  "index",
  "keynes",
  "local/resource-catalog",
  "local/runtime",
  "local/sqlite-command-executor",
  "policy/authoring",
  "policy/canonicalize",
  "policy/compile",
  "policy/decimal",
  "policy/evaluate",
  "policy/normalize-expression",
  "policy/normalize",
  "policy/parse",
  "policy/validate",
  "replay",
  "resources",
  "sdk-errors",
] as const;

const expectedProductionDependencies = {
  "@pgsql/types": "18.0.0",
  "decimal.js": "10.6.0",
  kysely: "0.29.5",
  "libpg-query": "18.1.4",
} as const;
const expectedBundledDependencies = Object.keys(
  expectedProductionDependencies,
).sort();
const bundledPackageRoots = expectedBundledDependencies.map(
  (name) => `package/node_modules/${name}`,
);
const requiredBundledPackageFiles = [
  "package/node_modules/@pgsql/types/package.json",
  "package/node_modules/decimal.js/package.json",
  "package/node_modules/kysely/package.json",
  "package/node_modules/libpg-query/package.json",
  "package/node_modules/libpg-query/wasm/index.cjs",
  "package/node_modules/libpg-query/wasm/index.js",
  "package/node_modules/libpg-query/wasm/libpg-query.js",
  "package/node_modules/libpg-query/wasm/libpg-query.wasm",
] as const;

const allowedPackageFiles = [
  "package/LICENSE",
  "package/README.md",
  "package/package.json",
  ...productionModules.flatMap((path) => [
    `package/dist/${path}.d.ts`,
    `package/dist/${path}.js`,
  ]),
].sort();

export interface QualificationArguments {
  readonly archivePath: string;
  readonly outputPath?: string;
}

export interface QualificationResult {
  readonly schemaVersion: "keynes.package-test.sdk/v1";
  readonly subject: "@keynes/sdk";
  readonly sourceRevision: {
    readonly commit: string;
    readonly cleanBefore: boolean;
    readonly cleanAfter: boolean;
  };
  readonly archive: {
    readonly sha256: string;
    readonly compressedBytes: number;
    readonly productionBytes: number;
    readonly packageVersion: string;
    readonly contractDigest: string;
  };
  readonly environment: {
    readonly node: string;
    readonly pnpm: string;
    readonly os: string;
    readonly osRelease: string;
    readonly architecture: string;
  };
  readonly checks: readonly [
    "parser-wasm",
    "public-types",
    "package-root-import",
    "budget-loop",
    "policy-runtime",
    "isolation",
    "closure",
    "process-loss",
    "deep-imports-blocked",
  ];
  readonly outcome: "passed";
  readonly exclusions: {
    readonly hostedMatrix: "NOT RUN";
    readonly registry: "NOT RUN";
    readonly securityQualification: "NOT RUN";
    readonly productionReadiness: "NOT RUN";
  };
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
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const { tokens } = parseArgs({
    args: normalized,
    options: { archive: { type: "string" }, output: { type: "string" } },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  for (const token of tokens) {
    if (token.kind === "positional")
      throw new Error(`Unknown argument ${token.value}`);
    if (token.kind !== "option") continue;
    if (token.name !== "archive" && token.name !== "output")
      throw new Error(`Unknown argument ${token.rawName}`);
    if (token.inlineValue === true)
      throw new Error(`Unknown argument ${normalized[token.index]}`);
    if (token.value === undefined || token.value.startsWith("--"))
      throw new Error(`${token.rawName} requires a path`);
  }
  const optionTokens = tokens.filter((token) => token.kind === "option");
  const archiveTokens = optionTokens.filter(
    (token) => token.name === "archive",
  );
  const outputTokens = optionTokens.filter((token) => token.name === "output");
  if (archiveTokens.length > 1)
    throw new Error("--archive may be provided only once");
  if (outputTokens.length > 1)
    throw new Error("--output may be provided only once");
  const archive = archiveTokens[0]?.value;
  const output = outputTokens[0]?.value;
  if (archive === undefined) throw new Error("--archive is required");
  return {
    archivePath: resolve(repositoryRoot, archive),
    ...(output === undefined
      ? {}
      : { outputPath: resolve(repositoryRoot, output) }),
  };
}

export function validatePackageFilePaths(paths: readonly string[]): void {
  const actual = [...paths].sort();
  const unknown = actual.find(
    (path) =>
      path.split("/").includes("..") ||
      (!allowedPackageFiles.includes(path) &&
        !bundledPackageRoots.some((root) => path.startsWith(`${root}/`))),
  );
  if (unknown !== undefined)
    throw new Error(`Archive contains forbidden file ${unknown}`);
  const missing = allowedPackageFiles.find((path) => !actual.includes(path));
  if (missing !== undefined)
    throw new Error(`Archive is missing required file ${missing}`);
  const missingBundledFile = requiredBundledPackageFiles.find(
    (path) => !actual.includes(path),
  );
  if (missingBundledFile !== undefined) {
    throw new Error(`Archive is missing required file ${missingBundledFile}`);
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error("Archive contains duplicate file paths");
  }
}

export function validateSizes(sizes: {
  readonly compressedBytes: number;
  readonly productionBytes: number;
}): void {
  if (sizes.compressedBytes > ARCHIVE_LIMIT_BYTES) {
    throw new Error("SDK archive exceeds 1 MiB");
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
  const sourceBefore = readSourceRevision();
  const archive = await inspectArchive(args.archivePath);
  validateSizes({
    compressedBytes: archive.compressedBytes,
    productionBytes: 0,
  });

  const external = await installExternalConsumer(
    args.archivePath,
    archive.compressedBytes,
  );
  let productionBytes: number | undefined;
  try {
    runExpectedPackagePathFailure(
      resolve(external.root, "build/private-imports.mjs"),
      external.root,
    );
    const consumer = resolve(external.root, "build/consumer.mjs");
    run(process.execPath, [consumer, "budget-loop"], external.root);
    run(process.execPath, [consumer, "policy-runtime"], external.root);
    run(process.execPath, [consumer, "isolation"], external.root);
    run(process.execPath, [consumer, "closure"], external.root);
    assertProcessState(
      run(process.execPath, [consumer, "write-then-exit"], external.root),
    );
    run(process.execPath, [consumer, "read-after-restart"], external.root);

    productionBytes = external.productionBytes;
  } finally {
    await external.close();
  }
  if (productionBytes === undefined) {
    throw new Error("SDK package test produced no installation result");
  }
  const sourceAfter = readSourceRevision();
  if (
    sourceAfter.commit !== sourceBefore.commit ||
    sourceAfter.status !== sourceBefore.status
  ) {
    throw new Error("SDK package-test source revision changed");
  }
  return {
    schemaVersion: "keynes.package-test.sdk/v1",
    subject: "@keynes/sdk",
    sourceRevision: {
      commit: sourceBefore.commit,
      cleanBefore: sourceBefore.status === "",
      cleanAfter: sourceAfter.status === "",
    },
    archive: {
      sha256: archive.sha256,
      compressedBytes: archive.compressedBytes,
      productionBytes,
      packageVersion: archive.packageVersion,
      contractDigest: archive.contractDigest,
    },
    environment: {
      node: process.version,
      pnpm: run(pnpm, ["--version"], repositoryRoot).trim(),
      os: platform(),
      osRelease: release(),
      architecture: arch(),
    },
    checks: [
      "parser-wasm",
      "public-types",
      "package-root-import",
      "budget-loop",
      "policy-runtime",
      "isolation",
      "closure",
      "process-loss",
      "deep-imports-blocked",
    ],
    outcome: "passed",
    exclusions: {
      hostedMatrix: "NOT RUN",
      registry: "NOT RUN",
      securityQualification: "NOT RUN",
      productionReadiness: "NOT RUN",
    },
  };
}

export async function writeQualificationResult(
  outputPath: string,
  result: QualificationResult,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const handle = await open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function readSourceRevision(): {
  readonly commit: string;
  readonly status: string;
} {
  return {
    commit: run("git", ["rev-parse", "HEAD"], repositoryRoot).trim(),
    status: run("git", ["status", "--porcelain"], repositoryRoot).trim(),
  };
}

export async function installExternalConsumer(
  archivePath: string,
  compressedBytes: number,
): Promise<ExternalConsumer> {
  await mkdir(tmpdir(), { recursive: true });
  const root = await mkdtemp(resolve(tmpdir(), "keynes-sdk-package-test-"));
  assertOutsideRepository(repositoryRoot, root);
  try {
    await cp(
      resolve(installRoot, "consumer.mts"),
      resolve(root, "consumer.mts"),
    );
    await cp(
      resolve(installRoot, "tsconfig.json"),
      resolve(root, "tsconfig.json"),
    );
    await cp(
      resolve(compatibilityRoot, "private-imports.mts"),
      resolve(root, "private-imports.mts"),
    );
    await mkdir(resolve(root, "compatibility"));
    await cp(
      resolve(compatibilityRoot, "policy-api.mts"),
      resolve(root, "compatibility/policy-api.mts"),
    );
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
    const isolatedStore = resolve(root, ".pnpm-store");
    run(
      pnpm,
      [
        "install",
        "--prod",
        "--offline",
        "--ignore-scripts",
        "--store-dir",
        isolatedStore,
      ],
      root,
    );

    const installedPackage = await realpath(
      resolve(root, "node_modules/@keynes/sdk"),
    );
    const installedRequire = createRequire(
      resolve(installedPackage, "package.json"),
    );
    const installedParserEntry = installedRequire.resolve("libpg-query");
    const installedParserRoot = await realpath(
      resolve(installedPackage, "node_modules/libpg-query"),
    );
    const installedParserTypes = await realpath(
      installedRequire.resolve("@pgsql/types"),
    );
    const installedParserWasm = await realpath(
      resolve(dirname(installedParserEntry), "libpg-query.wasm"),
    );
    assertOutsideRepository(repositoryRoot, installedPackage);
    const externalRoot = await realpath(root);
    assertWithin(externalRoot, installedPackage);
    assertWithin(installedParserRoot, installedParserEntry);
    assertWithin(installedParserRoot, installedParserWasm);
    assertWithin(
      await realpath(resolve(installedPackage, "node_modules/@pgsql/types")),
      installedParserTypes,
    );
    assertWithin(externalRoot, installedParserWasm);
    const parserWasmStat = await stat(installedParserWasm);
    if (!parserWasmStat.isFile() || parserWasmStat.size === 0) {
      throw new Error("Installed libpg-query parser WASM is missing or empty");
    }
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
  const entries = readPackageArchiveBytes(bytes);
  validatePackageFilePaths(entries.map((entry) => entry.path));
  const license = entries.find((entry) => entry.path === "package/LICENSE");
  const repositoryLicense = await readFile(resolve(repositoryRoot, "LICENSE"));
  if (
    license === undefined ||
    normalizeLineEndings(license.body) !==
      normalizeLineEndings(repositoryLicense)
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
    hasInvalidPackageDependencies(value)
  ) {
    throw new Error("Archive package metadata does not match @keynes/sdk");
  }
  for (const [name, version] of Object.entries(
    expectedProductionDependencies,
  )) {
    const dependencyManifest = entries.find(
      (entry) => entry.path === `package/node_modules/${name}/package.json`,
    );
    if (dependencyManifest === undefined) {
      throw new Error(`Archive bundled dependency ${name} is missing`);
    }
    const dependencyValue: unknown = JSON.parse(
      dependencyManifest.body.toString("utf8"),
    );
    if (
      !isRecord(dependencyValue) ||
      dependencyValue.name !== name ||
      dependencyValue.version !== version
    ) {
      throw new Error(`Archive bundled dependency ${name} is invalid`);
    }
  }
  const generatedClient = entries.find(
    (entry) => entry.path === "package/dist/generated/client.js",
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

function normalizeLineEndings(bytes: Buffer): string {
  return bytes.toString("utf8").replaceAll("\r\n", "\n");
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

function assertProcessState(source: string): void {
  const value: unknown = JSON.parse(source);
  if (
    !isRecord(value) ||
    value.resource !== "processMemory" ||
    value.unit !== "item" ||
    value.allocated !== 1
  ) {
    throw new Error("write-then-exit returned invalid public Budget state");
  }
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

function runExpectedPackagePathFailure(modulePath: string, cwd: string): void {
  const result = spawnSync(process.execPath, [modulePath], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
    timeout: 60_000,
  });
  if (result.error !== undefined) throw result.error;
  if (
    result.status === 0 ||
    !`${result.stderr}${result.stdout}`.includes(
      "ERR_PACKAGE_PATH_NOT_EXPORTED",
    )
  ) {
    throw new Error("Unsupported SDK deep import did not fail as expected");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasInvalidPackageDependencies(
  manifest: Record<string, unknown>,
): boolean {
  const dependencies = manifest.dependencies;
  if (!isRecord(dependencies)) return true;
  const expectedNames = Object.keys(expectedProductionDependencies).sort();
  const actualNames = Object.keys(dependencies).sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    return true;
  }
  for (const [name, version] of Object.entries(
    expectedProductionDependencies,
  )) {
    if (dependencies[name] !== version) {
      return true;
    }
  }
  for (const field of ["optionalDependencies", "peerDependencies"]) {
    const value = manifest[field];
    if (
      value !== undefined &&
      (!isRecord(value) || Object.keys(value).length > 0)
    ) {
      return true;
    }
  }
  if (manifest.bundleDependencies !== undefined) return true;
  const bundledDependencies = manifest.bundledDependencies;
  if (
    !Array.isArray(bundledDependencies) ||
    bundledDependencies.some((value) => typeof value !== "string") ||
    [...bundledDependencies]
      .sort()
      .some((name, index) => name !== expectedBundledDependencies[index]) ||
    bundledDependencies.length !== expectedBundledDependencies.length
  ) {
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  try {
    const args = parseArguments(process.argv.slice(2));
    const result = await qualifyArchive(args);
    if (args.outputPath !== undefined) {
      await writeQualificationResult(args.outputPath, result);
    }
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
