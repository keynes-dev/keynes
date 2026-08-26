import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);
const databaseRoot = join(repositoryRoot, "packages/database");
const sdkRoot = join(repositoryRoot, "packages/sdk");
const expectedFiles = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/cli.d.ts",
  "package/dist/cli.js",
  "package/dist/config.d.ts",
  "package/dist/config.js",
  "package/dist/install.d.ts",
  "package/dist/install.js",
  "package/dist/profile.d.ts",
  "package/dist/profile.js",
  "package/dist/private/run-installation.d.ts",
  "package/dist/private/run-installation.js",
  "package/generated/installation-record.json",
  "package/migrations/0001-storage.sql",
  "package/migrations/0002-budget.sql",
  "package/migrations/0003-public.generated.sql",
  "package/migrations/manifest.json",
  "package/package.json",
].sort();
const migrationFiles = [
  "0001-storage.sql",
  "0002-budget.sql",
  "0003-public.generated.sql",
] as const;

interface ArchiveEntry {
  readonly mode: number;
  readonly path: string;
  readonly body: Buffer;
}

describe("@keynes/postgresql archive", () => {
  let archiveRoot: string;
  let entries: readonly ArchiveEntry[];
  let archivePath: string;
  let sdkEntries: readonly ArchiveEntry[];

  beforeAll(async () => {
    archiveRoot = await mkdtemp(join(tmpdir(), "keynes-postgresql-archive-"));
    const result = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["pack", "--pack-destination", archiveRoot],
      { cwd: databaseRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(`${result.stdout}\n${result.stderr}`);
    }
    archivePath = join(archiveRoot, "keynes-postgresql-0.0.0.tgz");
    entries = readTar(gunzipSync(await readFile(archivePath)));

    const sdkPack = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["pack", "--pack-destination", archiveRoot],
      { cwd: sdkRoot, encoding: "utf8" },
    );
    if (sdkPack.status !== 0) {
      throw new Error(`${sdkPack.stdout}\n${sdkPack.stderr}`);
    }
    sdkEntries = readTar(
      gunzipSync(await readFile(join(archiveRoot, "keynes-sdk-0.0.0.tgz"))),
    );
  });

  afterAll(async () => {
    await rm(archiveRoot, { recursive: true, force: true });
  });

  it("contains exactly the declared archive files", () => {
    expect(entries.map(({ path }) => path).sort()).toEqual(expectedFiles);
  });

  it("keeps migration and generated assets byte-identical to canonical sources", async () => {
    for (const path of migrationFiles) {
      const canonical = await readFile(join(databaseRoot, "migrations", path));
      expect(entry(`package/migrations/${path}`).body).toEqual(canonical);
    }

    expect(entry("package/migrations/manifest.json").body).toEqual(
      await readFile(join(databaseRoot, "migrations/manifest.json")),
    );
    expect(entry("package/generated/installation-record.json").body).toEqual(
      await readFile(join(databaseRoot, "generated/installation-record.json")),
    );
  });

  it("publishes the supported installation identity", () => {
    const identity = JSON.parse(
      entry("package/generated/installation-record.json").body.toString("utf8"),
    ) as Record<string, unknown>;

    expect(identity).toMatchObject({
      profileId: "embedded-postgresql-18.6-preview",
      serverVersionNum: "180006",
      contractDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      migrations: expect.any(Array),
      expectedTargets: [
        "keynes.define_resource_type",
        "keynes.create_budget",
        "keynes.request",
        "keynes.settle",
        "keynes.get_budget",
      ],
    });
  });

  it("ships an executable CLI with package documentation and license", async () => {
    const cli = entry("package/dist/cli.js");
    expect(cli.mode & 0o111).not.toBe(0);
    expect(cli.body.toString("utf8")).toContain("keynes-postgresql");
    expect(entry("package/README.md").body).toEqual(
      await readFile(join(databaseRoot, "README.md")),
    );
    expect(entry("package/LICENSE").body).toEqual(
      await readFile(join(repositoryRoot, "LICENSE")),
    );
  });

  it("contains no credentials or SDK-owned SQL", () => {
    const content = Buffer.concat(
      entries
        .filter(
          ({ path }) =>
            path !== "package/LICENSE" && path !== "package/README.md",
        )
        .map(({ body }) => body),
    ).toString("utf8");
    expect(entries.every(({ path }) => !path.includes("sdk"))).toBe(true);
    expect(content).not.toMatch(
      /(?:postgres(?:ql)?:\/\/|PGPASSWORD|password\s*[:=])/i,
    );
    expect(content).not.toContain("packages/sdk");
    expect(content).not.toContain("@keynes/sdk");
  });

  it.skipIf(process.env.KEYNES_PLATFORM_CONTEXT === undefined)(
    "installs fresh and exact targets from the packed artifact",
    async () => {
      const context = parsePlatformContext(process.env.KEYNES_PLATFORM_CONTEXT);
      const target = await createTarget(context.administratorUrl);
      const extractedRoot = await mkdtemp(
        join(tmpdir(), "keynes-postgresql-packed-"),
      );
      try {
        const packageRoot = join(extractedRoot, "package");
        const extracted = spawnSync(
          "tar",
          ["-xzf", archivePath, "-C", extractedRoot],
          { encoding: "utf8" },
        );
        if (extracted.status !== 0) {
          throw new Error(`${extracted.stdout}\n${extracted.stderr}`);
        }
        await symlink(
          join(databaseRoot, "node_modules"),
          join(packageRoot, "node_modules"),
        );

        const configPath = join(extractedRoot, "installation.json");
        await writeFile(
          configPath,
          `${JSON.stringify(
            {
              ownerRole: target.ownerRole,
              applicationRole: target.applicationRole,
              tenantId: "00000000-0000-4000-8000-000000000001",
              principalId: "00000000-0000-4000-8000-000000000101",
            },
            null,
            2,
          )}\n`,
        );

        const environment = postgresEnvironment(target.databaseUrl);
        const fresh = runPackedInstall(packageRoot, configPath, environment);
        expect(fresh).toMatchObject({ ok: true, outcome: "installed" });

        const exact = runPackedInstall(packageRoot, configPath, environment);
        expect(exact).toMatchObject({
          ok: true,
          outcome: "already-installed",
        });
      } finally {
        await rm(extractedRoot, { recursive: true, force: true });
        await target.close();
      }
    },
  );

  it("keeps PostgreSQL migrations out of the packed SDK archive", () => {
    expect(
      sdkEntries.some(
        ({ path }) =>
          path.includes("migrations/") ||
          path.includes("database/") ||
          path.endsWith("installation-record.json"),
      ),
    ).toBe(false);
    expect(
      Buffer.concat(sdkEntries.map(({ body }) => body)).toString("utf8"),
    ).not.toContain("0001-storage.sql");
  });

  function entry(path: string): ArchiveEntry {
    const found = entries.find((candidate) => candidate.path === path);
    if (found === undefined) throw new Error(`Missing archive entry ${path}`);
    return found;
  }
});

interface PlatformContext {
  readonly administratorUrl: string;
}

interface InstallationTarget {
  readonly applicationRole: string;
  readonly databaseUrl: string;
  readonly ownerRole: string;
  readonly close: () => Promise<void>;
}

function parsePlatformContext(source: string): PlatformContext {
  const value: unknown = JSON.parse(source);
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof value.administratorUrl !== "string"
  ) {
    throw new Error("invalid platform context");
  }
  return { administratorUrl: value.administratorUrl };
}

async function createTarget(
  administratorUrl: string,
): Promise<InstallationTarget> {
  const { Client } = await import("pg");
  const ownerRole = `keynes_t033_owner_${randomUUID().replaceAll("-", "")}`;
  const applicationRole = `keynes_t033_app_${randomUUID().replaceAll("-", "")}`;
  const databaseName = `keynes_t033_${randomUUID().replaceAll("-", "")}`;
  const applicationPassword = randomUUID();
  const administrator = new Client({ connectionString: administratorUrl });
  await administrator.connect();
  try {
    await administrator.query(`create role ${identifier(ownerRole)} nologin`);
    await administrator.query(
      `create role ${identifier(applicationRole)} login password '${applicationPassword}'`,
    );
    await administrator.query(`create database ${identifier(databaseName)}`);
    await administrator.query(
      `grant ${identifier(ownerRole)} to ${identifier(
        new URL(administratorUrl).username,
      )}`,
    );
    await administrator.query(
      `grant create on database ${identifier(databaseName)} to ${identifier(
        ownerRole,
      )}`,
    );
  } finally {
    await administrator.end();
  }

  const databaseUrl = new URL(administratorUrl);
  databaseUrl.pathname = `/${databaseName}`;
  return {
    applicationRole,
    databaseUrl: databaseUrl.toString(),
    ownerRole,
    async close() {
      const cleanup = new Client({ connectionString: administratorUrl });
      await cleanup.connect();
      try {
        await cleanup.query(`drop database ${identifier(databaseName)}`);
        await cleanup.query(`drop role ${identifier(applicationRole)}`);
        await cleanup.query(`drop role ${identifier(ownerRole)}`);
      } finally {
        await cleanup.end();
      }
    },
  };
}

function postgresEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
}

function runPackedInstall(
  packageRoot: string,
  configPath: string,
  environment: NodeJS.ProcessEnv,
): unknown {
  const result = spawnSync(
    process.execPath,
    [join(packageRoot, "dist/cli.js"), "install", "--config", configPath],
    { env: environment, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout) as unknown;
}

function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function readTar(bytes: Buffer): ArchiveEntry[] {
  const result: ArchiveEntry[] = [];
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarText(header.subarray(0, 100));
    const prefix = tarText(header.subarray(345, 500));
    const path = prefix === "" ? name : `${prefix}/${name}`;
    const mode = Number.parseInt(tarText(header.subarray(100, 108)).trim(), 8);
    const size = Number.parseInt(tarText(header.subarray(124, 136)).trim(), 8);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (header[156] === 0 || header[156] === 48) {
      result.push({ mode, path, body: bytes.subarray(bodyStart, bodyEnd) });
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return result;
}

function tarText(bytes: Buffer): string {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString("utf8");
}
