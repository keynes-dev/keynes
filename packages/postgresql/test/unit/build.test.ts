import { createHash } from "node:crypto";
import contract from "../../../contracts/contract.json" with { type: "json" };
import installationRecord from "../../generated/installation-record.json" with { type: "json" };

import { mkdirSync, writeFileSync } from "node:fs";
import {
  mkdir,
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

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("PostgreSQL package build promotion", () => {
  it("publishes independent definition procedures with generation two compatibility", () => {
    expect(contract.remote.semanticGeneration).toBe(2);
    expect(contract.remote.minimumSdkGeneration).toBe(2);
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
        revision: 2,
      }),
    );
    expect(installationRecord.expectedTargets).toContain(
      "keynes.define_resources",
    );
    expect(installationRecord.expectedObjects).toContain(
      "function:keynes.remote_define_resources(input jsonb)",
    );
  });

  it("preserves every historical migration byte while adding Resource definitions", async () => {
    const expectedHashes = [
      "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
      "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
      "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
      "d354c351b1144fe069def514c4700bcc92864f181079a6194cb832049bc4f28c",
      "bcb0c5f2b68a39bf2256935042f70e11e01cf967776006109e316a8174bd12c7",
      "7ecbfbf95851f68678f8660d258b2021c0f62bf4cc0d7ce55a7b7157e54c7927",
    ];
    for (const [index, migration] of installationRecord.migrations
      .slice(0, 6)
      .entries()) {
      const bytes = await readFile(
        new URL(`../../migrations/${migration.path}`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        expectedHashes[index],
      );
      expect(migration.sha256).toBe(expectedHashes[index]);
    }
    expect(installationRecord.migrations.map(({ id }) => id)).toEqual([
      "0001-storage",
      "0002-budget",
      "0003-public",
      "0004-policy",
      "0005-resource-bound-budget",
      "0006-remote-access",
      "0007-resource-definitions",
    ]);
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
