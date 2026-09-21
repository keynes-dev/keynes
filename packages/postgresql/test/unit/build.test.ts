import { createHash } from "node:crypto";
import { loadContract } from "@keynes/database";
import { fileURLToPath } from "node:url";
import installationRecord from "../../generated/installation-record.json" with { type: "json" };
import migrationManifest from "../../migrations/manifest.json" with { type: "json" };

import { mkdirSync, writeFileSync } from "node:fs";
import {
  mkdir,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildPostgresqlPackage } from "../../scripts/build.ts";
import { generatePostgresql } from "@keynes/database/postgres-generation";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("PostgreSQL package build promotion", () => {
  it("publishes configured creation with generation four compatibility", () => {
    const { source: contract } = loadContract(
      fileURLToPath(new URL("../../../database/", import.meta.url)),
    );
    expect(contract.remote.semanticGeneration).toBe(4);
    expect(contract.remote.minimumSdkGeneration).toBe(4);
    expect(contract.operations).toContainEqual(
      expect.objectContaining({
        method: "validateResources",
        target: "keynes.validate_resources",
        permissions: ["create_root_budget"],
        replay: false,
      }),
    );
    expect(contract.remote.procedures).toContainEqual(
      expect.objectContaining({
        method: "validateResources",
        target: "keynes.remote_validate_resources",
        revision: 1,
      }),
    );
    expect(contract.operations).toContainEqual(
      expect.objectContaining({
        method: "defineResources",
        target: "keynes.define_resources",
        permissions: ["define_resource_type"],
        replay: true,
      }),
    );
    expect(contract.remote.procedures).toContainEqual(
      expect.objectContaining({
        method: "defineResources",
        target: "keynes.remote_define_resources",
        revision: 1,
      }),
    );
    expect(contract.remote.procedures).toContainEqual(
      expect.objectContaining({
        method: "createBudget",
        revision: 4,
      }),
    );
    expect(installationRecord.expectedTargets).toContain(
      "keynes.define_resources",
    );
    expect(installationRecord.expectedObjects).toContain(
      "function:keynes.remote_define_resources(input jsonb)",
    );
  });

  it("binds installation to one baseline", async () => {
    expect(installationRecord.migrations).toHaveLength(1);
    const migration = installationRecord.migrations[0];
    expect(migration).toEqual({
      id: "0001-baseline",
      path: "0001-baseline.sql",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      contractDigest: installationRecord.contractDigest,
    });
    const bytes = await readFile(
      new URL("../../migrations/0001-baseline.sql", import.meta.url),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      migration?.sha256,
    );
  });

  it("marks the baseline as the only contract migration", () => {
    expect(
      migrationManifest.migrations.filter(
        (migration) => migration.contract === true,
      ),
    ).toEqual([
      {
        id: "0001-baseline",
        path: "0001-baseline.sql",
        contract: true,
      },
    ]);
    const contract = loadContract(
      fileURLToPath(new URL("../../../database/", import.meta.url)),
    );
    expect(
      installationRecord.migrations
        .filter(({ contractDigest }) => contractDigest === contract.digest)
        .map(({ id }) => id),
    ).toEqual(["0001-baseline"]);
  });

  it("generates baseline identity deterministically without rewriting SQL", async () => {
    const repositoryRoot = await mkdtemp(
      join(tmpdir(), "keynes-postgresql-generation-"),
    );
    roots.push(repositoryRoot);
    const packageRoot = join(repositoryRoot, "packages/database/postgres");
    await mkdir(packageRoot, { recursive: true });
    await cp(
      new URL("../../migrations/", import.meta.url),
      join(packageRoot, "migrations"),
      { recursive: true },
    );
    const contractRoot = fileURLToPath(
      new URL("../../../database/", import.meta.url),
    );
    const options = {
      check: false,
      contract: loadContract(contractRoot),
      repositoryRoot,
    };
    const first = await generatePostgresql(options);
    const paths = [
      "generated/installation-record.json",
      ...first.migrations.map(({ path }) => `migrations/${path}`),
    ];
    const before = await Promise.all(
      paths.map((path) => readFile(join(packageRoot, path), "utf8")),
    );
    expect(await generatePostgresql(options)).toEqual(first);
    expect(
      await Promise.all(
        paths.map((path) => readFile(join(packageRoot, path), "utf8")),
      ),
    ).toEqual(before);
    await generatePostgresql({ ...options, check: true });
    expect(first.contractMigrationId).toBe("0001-baseline");
    const baseline = await readFile(
      join(packageRoot, "migrations/0001-baseline.sql"),
      "utf8",
    );
    expect(baseline).toBe(before[1]);
    await writeFile(
      join(packageRoot, "migrations/0002-stale.sql"),
      "select 1;\n",
    );
    await expect(generatePostgresql(options)).rejects.toThrow(
      "migration directory does not match manifest",
    );
    await rm(join(packageRoot, "migrations/0002-stale.sql"));
    await writeFile(
      join(packageRoot, "migrations/manifest.json"),
      JSON.stringify({
        migrations: [
          ...migrationManifest.migrations,
          { id: "0002-extra", path: "0002-extra.sql", contract: false },
        ],
      }),
    );
    await expect(generatePostgresql(options)).rejects.toThrow(
      "migration manifest must declare one contract baseline",
    );
  });

  it("preserves the previous dist when compilation fails", async () => {
    const root = await makePackageRoot();
    await expect(
      buildPostgresqlPackage({
        packageRoot: root,
        compileDistribution: () => {
          throw new Error("compile failed");
        },
      }),
    ).rejects.toThrow("compile failed");
    expect(await readFile(join(root, "dist/marker"), "utf8")).toBe(
      "previous\n",
    );
    expect(
      (await readdir(root)).filter((entry) => entry.startsWith(".dist-")),
    ).toEqual([]);
  });

  it("rejects an incomplete staged tree without touching dist", async () => {
    const root = await makePackageRoot();
    await expect(
      buildPostgresqlPackage({
        packageRoot: root,
        compileDistribution: (outputRoot) => {
          mkdirSync(outputRoot, { recursive: true });
        },
      }),
    ).rejects.toThrow();
    expect(await readFile(join(root, "dist/marker"), "utf8")).toBe(
      "previous\n",
    );
  });

  it("restores the previous dist when promotion fails", async () => {
    const root = await makePackageRoot();
    const promotionFailure = new Error("promotion failed");

    await expect(
      buildPostgresqlPackage({
        packageRoot: root,
        compileDistribution: compileCompleteDistribution,
        fileSystem: {
          async move(source, destination) {
            if (
              String(source).includes(".dist-stage-") &&
              destination === join(root, "dist")
            ) {
              throw promotionFailure;
            }
            await rename(source, destination);
          },
          remove: rm,
        },
      }),
    ).rejects.toBe(promotionFailure);

    expect(await readFile(join(root, "dist/marker"), "utf8")).toBe(
      "previous\n",
    );
    expect(
      (await readdir(root)).filter((entry) => entry.startsWith(".dist-")),
    ).toEqual([]);
  });

  it("restores the previous dist when backup cleanup fails", async () => {
    const root = await makePackageRoot();
    const cleanupFailure = new Error("backup cleanup failed");
    let backupRemovals = 0;

    await expect(
      buildPostgresqlPackage({
        packageRoot: root,
        compileDistribution: compileCompleteDistribution,
        fileSystem: {
          move: rename,
          async remove(path, options) {
            if (String(path).endsWith("dist.previous")) {
              backupRemovals += 1;
              if (backupRemovals === 2) throw cleanupFailure;
            }
            await rm(path, options);
          },
        },
      }),
    ).rejects.toBe(cleanupFailure);

    expect(await readFile(join(root, "dist/marker"), "utf8")).toBe(
      "previous\n",
    );
    expect(
      (await readdir(root)).filter((entry) => entry.startsWith(".dist-")),
    ).toEqual([]);
  });

  it("reports cleanup and restoration failures without losing the promoted dist", async () => {
    const root = await makePackageRoot();
    const cleanupFailure = new Error("backup cleanup failed");
    const restorationFailure = new Error("backup restoration failed");
    let backupRemovals = 0;

    let failure: unknown;
    try {
      await buildPostgresqlPackage({
        packageRoot: root,
        compileDistribution: compileCompleteDistribution,
        fileSystem: {
          async move(source, destination) {
            if (
              String(source).endsWith("dist.previous") &&
              destination === join(root, "dist")
            ) {
              throw restorationFailure;
            }
            await rename(source, destination);
          },
          async remove(path, options) {
            if (String(path).endsWith("dist.previous")) {
              backupRemovals += 1;
              if (backupRemovals === 2) throw cleanupFailure;
            }
            await rm(path, options);
          },
        },
      });
    } catch (error: unknown) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure).toMatchObject({
      errors: [cleanupFailure, restorationFailure],
    });
    expect(await readFile(join(root, "dist/cli.js"), "utf8")).toBe(
      "new distribution\n",
    );
    expect(
      (await readdir(root)).filter((entry) => entry === "dist.previous"),
    ).toHaveLength(1);
  });
});

function compileCompleteDistribution(outputRoot: string): void {
  for (const path of [
    "cli.d.ts",
    "cli.js",
    "installer/config.d.ts",
    "installer/config.js",
    "installer/install.d.ts",
    "installer/install.js",
    "installer/run-installation.d.ts",
    "installer/run-installation.js",
  ]) {
    const destination = join(outputRoot, path);
    mkdirSync(join(destination, ".."), { recursive: true });
    writeFileSync(destination, "new distribution\n");
  }
}

async function makePackageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "keynes-postgresql-build-"));
  roots.push(root);
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist/marker"), "previous\n");
  return root;
}
