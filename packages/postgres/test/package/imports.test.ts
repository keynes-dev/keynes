import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  installPostgresqlArchive,
  requirePostgresqlPackageArchive,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
let packed: PackedPostgresqlPackage;

beforeAll(async () => {
  packed = await installPostgresqlArchive(requirePostgresqlPackageArchive());
}, 60_000);
afterAll(async () => packed.close());

describe("@keynes/postgres public entrypoint and blocked deep imports", () => {
  it("imports the runtime from the installed archive without opening PostgreSQL", () => {
    const result = node([
      "--input-type=module",
      "--eval",
      'import { postgres } from "@keynes/postgres"; import { KeynesSdkError } from "@keynes/sdk"; if (postgres({databaseUrl:"unused"}).kind !== "remote") throw new Error("wrong runtime"); try { postgres({}); throw new Error("accepted invalid options"); } catch (error) { if (!(error instanceof KeynesSdkError)) throw error; }',
    ]);
    expect(result.status, result.stderr).toBe(0);
  });
  for (const specifier of ["@keynes/postgres/installer/install"]) {
    it(`blocks ESM import of ${specifier}`, () => {
      const result = node([
        "--input-type=module",
        "--eval",
        `import(${JSON.stringify(specifier)})`,
      ]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
    });

    it(`blocks CommonJS require of ${specifier}`, () => {
      const result = node(["--eval", `require(${JSON.stringify(specifier)})`]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
    });
  }

  it("blocks TypeScript deep imports", async () => {
    await Promise.all([
      writeFile(
        join(packed.consumerRoot, "blocked.ts"),
        'import "@keynes/postgres/installer/install";\n',
      ),
      writeFile(
        join(packed.consumerRoot, "tsconfig.json"),
        `${JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", noEmit: true }, files: ["blocked.ts"] })}\n`,
      ),
    ]);
    const result = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["exec", "tsc", "--project", join(packed.consumerRoot, "tsconfig.json")],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Cannot find module",
    );
  });
});

function node(arguments_: readonly string[]) {
  return spawnSync(process.execPath, [...arguments_], {
    cwd: packed.consumerRoot,
    encoding: "utf8",
  });
}
