import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  installPostgresqlArchive,
  loadPublicPostgresql,
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
  it("loads public modules and matching driver constructors from the exact installed consumer", async () => {
    const installed = await loadPublicPostgresql({
      kind: "packed",
      commandPath: packed.commandPath,
    });
    const source = await loadPublicPostgresql({ kind: "source" });
    expect(installed.postgres).not.toBe(source.postgres);
    expect(installed.createKeynes).not.toBe(source.createKeynes);
    expect(installed.Client).not.toBe(source.Client);
    expect(installed.postgres({ databaseUrl: "unused" }).kind).toBe("remote");
  });

  it("borrows connected-client descriptors without opening or closing caller connections", () => {
    const result = node([
      "--input-type=module",
      "--eval",
      `import { createRequire } from "node:module";
       const { Client, Pool } = createRequire(import.meta.resolve("@keynes/postgres"))("pg");
       import { postgres } from "@keynes/postgres";
       import { KeynesSdkError } from "@keynes/sdk";
       const connection = new Client();
       connection.connect = () => { throw new Error("factory connected"); };
       connection.end = () => { throw new Error("factory closed"); };
       if (postgres({ connection }).kind !== "embedded") throw new Error("wrong borrowed capability");
       for (const options of [{ connection: new Pool() }, { connection, databaseUrl: "unused" }, { connection, extra: true }]) {
         try { postgres(options); throw new Error("accepted invalid options"); }
         catch (error) { if (!(error instanceof KeynesSdkError) || error.code !== "invalid_configuration") throw error; }
       }`,
    ]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("typechecks owned and borrowed capabilities from only the installed dependency closure", async () => {
    await writeFile(
      join(packed.consumerRoot, "capabilities.ts"),
      `
import { createKeynes, type Keynes, type RemoteKeynes } from "@keynes/sdk";
import { postgres, type PostgresConnection } from "@keynes/postgres";
const resources = { tokens: { unit: "token", accountingBehavior: "consumable" } } as const;
declare const connection: Exclude<PostgresConnection, { release: unknown }>;
const borrowed = createKeynes({ resources, runtime: postgres({ connection }) });
const basicType: Promise<Keynes<"tokens">> = borrowed;
declare const poolClient: Extract<PostgresConnection, { release: unknown }>;
poolClient.release();
declare const pool: Pick<PostgresConnection, "query" | "end"> & { connect(): Promise<PostgresConnection> };
const checkedOut: Promise<Keynes<"tokens">> = createKeynes({ resources, runtime: postgres({ connection: poolClient }) });
const owned: Promise<RemoteKeynes<"tokens">> = createKeynes({ resources, runtime: postgres({ databaseUrl: "unused" }) });
async function capabilities() {
  const basic = await borrowed;
  // @ts-expect-error Borrowed sessions expose no remote recovery or references.
  basic.recoverOperation({ operationKey: "unused" });
  // @ts-expect-error A pool is not a single caller-owned connection.
  postgres({ connection: pool });
  // @ts-expect-error Connection ownership modes are mutually exclusive.
  postgres({ connection, databaseUrl: "unused" });
  // @ts-expect-error Unknown factory options are rejected.
  postgres({ connection, extra: true });
}
void basicType; void checkedOut; void owned; void capabilities;
`,
    );
    await writeFile(
      join(packed.consumerRoot, "capabilities-tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        files: ["capabilities.ts"],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        join(repositoryRoot, "node_modules/typescript/bin/tsc"),
        "--project",
        join(packed.consumerRoot, "capabilities-tsconfig.json"),
      ],
      { cwd: packed.consumerRoot, encoding: "utf8" },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
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
