import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);
const databaseRoot = join(repositoryRoot, "packages/database");
const expectedFiles = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/cli.d.ts",
  "package/dist/cli.js",
  "package/dist/config.d.ts",
  "package/dist/config.js",
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
    const archivePath = join(archiveRoot, "keynes-postgresql-0.0.0.tgz");
    entries = readTar(gunzipSync(await readFile(archivePath)));
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

  function entry(path: string): ArchiveEntry {
    const found = entries.find((candidate) => candidate.path === path);
    if (found === undefined) throw new Error(`Missing archive entry ${path}`);
    return found;
  }
});

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
