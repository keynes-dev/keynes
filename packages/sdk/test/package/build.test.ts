import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSdk } from "../../scripts/build.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("SDK staged build", () => {
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

  it("preserves the prior distribution when staged output is invalid", async () => {
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
          await writeFile(resolve(outDir, "unexpected.js"), "export {};\n");
        },
      }),
    ).rejects.toThrow("Unexpected SDK distribution");

    expect(await readFile(resolve(dist, "sentinel"), "utf8")).toBe(
      "previous distribution\n",
    );
    expect((await readdir(root)).sort()).toEqual(["dist"]);
  });
});
