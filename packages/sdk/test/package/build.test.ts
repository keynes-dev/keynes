import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSdk } from "../../scripts/build.js";
import { SDK_PRODUCTION_MODULES } from "../../scripts/production-modules.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("SDK staged build", () => {
  it("includes remote handle modules in the production manifest", () => {
    expect(SDK_PRODUCTION_MODULES).toEqual(
      expect.arrayContaining([
        "remote/budget",
        "remote/public-types",
        "remote/references",
      ]),
    );
  });

  it("preserves the prior distribution after compilation fails", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "keynes-sdk-build-test-"));
    temporaryRoots.push(root);
    const dist = resolve(root, "dist");
    await mkdir(dist);
    await writeFile(resolve(dist, "sentinel"), "previous distribution\n");

    await expect(
      buildSdk({
        root,
        compileDistribution() {
          throw new Error("deliberate compilation failure");
        },
      }),
    ).rejects.toThrow("deliberate compilation failure");

    expect(await readFile(resolve(dist, "sentinel"), "utf8")).toBe(
      "previous distribution\n",
    );
    expect((await readdir(root)).sort()).toEqual(["dist"]);
  });

  it("preserves the prior distribution when staged output is missing", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "keynes-sdk-build-test-"));
    temporaryRoots.push(root);
    const dist = resolve(root, "dist");
    await mkdir(dist);
    await writeFile(resolve(dist, "sentinel"), "previous distribution\n");

    await expect(
      buildSdk({
        root,
        async compileDistribution(outDir) {
          await mkdir(outDir, { recursive: true });
        },
      }),
    ).rejects.toThrow("SDK distribution is missing required files");

    expect(await readFile(resolve(dist, "sentinel"), "utf8")).toBe(
      "previous distribution\n",
    );
    expect((await readdir(root)).sort()).toEqual(["dist"]);
  });

  it("preserves the prior distribution when staged output has an extra file", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "keynes-sdk-build-test-"));
    temporaryRoots.push(root);
    const dist = resolve(root, "dist");
    await mkdir(dist);
    await writeFile(resolve(dist, "sentinel"), "previous distribution\n");

    await expect(
      buildSdk({
        root,
        async compileDistribution(outDir) {
          await writeProductionFiles(outDir);
          await writeFile(resolve(outDir, "unexpected.js"), "export {};\n");
        },
      }),
    ).rejects.toThrow("Unexpected SDK distribution files");

    expect(await readFile(resolve(dist, "sentinel"), "utf8")).toBe(
      "previous distribution\n",
    );
    expect((await readdir(root)).sort()).toEqual(["dist"]);
  });
});

async function writeProductionFiles(root: string): Promise<void> {
  for (const module of SDK_PRODUCTION_MODULES) {
    for (const extension of ["d.ts", "js"] as const) {
      const path = resolve(root, `${module}.${extension}`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, extension === "js" ? "export {};\n" : "");
    }
  }
}
