import { spawnSync } from "node:child_process";
import { access, copyFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPackedPostgresqlWalkthrough } from "../qualification/packed-walkthrough.ts";

import {
  installPostgresqlArchive,
  loadPublicPostgresql,
  requirePostgresqlPackageArchive,
  requireSdkPackageArchive,
  type PackedPostgresqlPackage,
} from "../support/packed-package.ts";

const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
let packed: PackedPostgresqlPackage;

beforeAll(async () => {
  packed = await installPostgresqlArchive(
    requirePostgresqlPackageArchive(),
    requireSdkPackageArchive(),
    { ...process.env, KEYNES_SDK_PACKAGE_ARCHIVE: "/wrong-ambient-sdk.tgz" },
  );
}, 60_000);
afterAll(async () => packed.close());

describe("@keynes/postgres public entrypoint and blocked deep imports", () => {
  it("uses the explicit SDK archive despite a conflicting ambient path", () => {
    expect(packed.installedArchives?.map(({ name }) => name)).toEqual([
      "@keynes/sdk",
      "@keynes/postgres",
    ]);
  });

  it.each(["missing credentials", "wrong target"])(
    "rejects walkthrough %s before connecting",
    async (scenario) => {
      const script = join(packed.consumerRoot, "negative-walkthrough.mjs");
      await copyFile(
        new URL("../qualification/consumer.mjs", import.meta.url),
        script,
      );
      const result = spawnSync(process.execPath, [script], {
        cwd: packed.consumerRoot,
        encoding: "utf8",
        env:
          scenario === "missing credentials"
            ? { CI: "true" }
            : {
                CI: "true",
                KEYNES_DATABASE_URL:
                  "postgresql://user:secret@127.0.0.1:1/db?sslmode=verify-full",
                KEYNES_QUALIFICATION_TARGET: "wrong-target",
              },
        timeout: 5_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("walkthrough passed");
      expect(result.stderr).toContain(
        scenario === "missing credentials"
          ? "credentials and qualification target are required"
          : "does not match",
      );
      expect(result.stderr).not.toContain("secret");
    },
  );

  it("fails and sanitizes the packed walkthrough when PostgreSQL is unreachable", async () => {
    await expect(
      runPackedPostgresqlWalkthrough(
        packed.consumerRoot,
        new URL(
          "postgresql://user:private-password@127.0.0.1:1/db?sslmode=verify-full",
        ),
      ),
    ).rejects.toThrow(/^PostgreSQL archive walkthrough failed$/);
  });

  it("imports the runtime from the installed archive without opening PostgreSQL", () => {
    const result = node([
      "--input-type=module",
      "--eval",
      'import { postgres } from "@keynes/postgres"; import { KeynesSdkError } from "@keynes/sdk"; if (postgres({databaseUrl:"unused"}).kind !== "remote") throw new Error("wrong runtime"); try { postgres({}); throw new Error("accepted invalid options"); } catch (error) { if (!(error instanceof KeynesSdkError)) throw error; }',
    ]);
    expect(result.status, result.stderr).toBe(0);
  });
  it("exposes the reusable installation API and installs no CLI", async () => {
    const loaded = await loadPublicPostgresql({
      kind: "packed",
      consumerRoot: packed.consumerRoot,
    });
    expect(typeof loaded.install).toBe("function");
    expect(packed.commandPath).toBeUndefined();
    for (const executable of ["keynes", "keynes-postgresql"]) {
      await expect(
        access(join(packed.consumerRoot, "node_modules/.bin", executable)),
      ).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("loads public modules and matching driver constructors from the exact installed consumer", async () => {
    const installed = await loadPublicPostgresql({
      kind: "packed",
      consumerRoot: packed.consumerRoot,
    });
    const source = await loadPublicPostgresql({ kind: "source" });
    expect(packed.installedArchives?.map((entry) => entry.name)).toEqual([
      "@keynes/sdk",
      "@keynes/postgres",
    ]);
    const consumerRoot = await realpath(packed.consumerRoot);
    for (const entry of packed.installedArchives ?? []) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(await realpath(entry.entrypoint)).toBe(entry.entrypoint);
      const withinConsumer = relative(consumerRoot, entry.entrypoint);
      expect(isAbsolute(withinConsumer)).toBe(false);
      expect(withinConsumer).not.toBe("..");
      expect(withinConsumer.startsWith(`..${sep}`)).toBe(false);
    }
    expect(installed.postgres).not.toBe(source.postgres);
    expect(installed.createKeynes).not.toBe(source.createKeynes);
    expect(installed.Client).not.toBe(source.Client);
    expect(installed.postgres({ connection: new source.Client() }).kind).toBe(
      "embedded",
    );
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
  // @ts-expect-error Borrowed sessions expose no remote result lookup or references.
  basic.getOperationResult("unused");
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
