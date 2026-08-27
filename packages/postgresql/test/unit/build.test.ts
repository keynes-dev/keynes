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
