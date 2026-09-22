import { z } from "zod";
import { zodParameter } from "../src/zod.ts";
import { defineParameters, createParameterSnapshot } from "../src/index.ts";
import { it, expect } from "vitest";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

it("resolves and runs a core consumer without Zod or ancestor dependencies", () => {
  const consumer = mkdtempSync(join(tmpdir(), "keynes-parameters-"));
  const source = fileURLToPath(new URL("../", import.meta.url));
  try {
    for (
      let parent = dirname(consumer);
      parent !== dirname(parent);
      parent = dirname(parent)
    )
      expect(existsSync(join(parent, "node_modules"))).toBe(false);
    const copied = new Set<string>();
    function copyDependency(name: string, from: string): void {
      if (copied.has(name)) return;
      copied.add(name);
      const found = createRequire(from)
        .resolve.paths(name)
        ?.map((path) => join(path, name, "package.json"))
        .find(existsSync);
      if (!found) throw new Error(`Missing installed dependency ${name}`);
      const manifest = realpathSync(found);
      const destination = join(consumer, "node_modules", name);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(dirname(manifest), destination, {
        recursive: true,
        dereference: true,
      });
      const metadata = JSON.parse(readFileSync(manifest, "utf8"));
      for (const dependency of Object.keys(metadata.dependencies ?? {}))
        copyDependency(dependency, manifest);
    }
    const manifest = join(source, "package.json");
    for (const name of [
      "ajv",
      "canonicalize",
      "json-schema-to-ts",
      "@types/node",
      "typescript",
    ])
      copyDependency(name, manifest);
    copyDependency(
      `@typescript/typescript-${process.platform}-${process.arch}`,
      createRequire(manifest).resolve("typescript/package.json"),
    );
    const packagePath = join(consumer, "policy-parameters");
    mkdirSync(packagePath, { recursive: true });
    cpSync(join(source, "src"), join(packagePath, "src"), { recursive: true });
    cpSync(manifest, join(packagePath, "package.json"));
    mkdirSync(join(consumer, "node_modules/@keynes"), { recursive: true });
    symlinkSync(
      packagePath,
      join(consumer, "node_modules/@keynes/policy-parameters"),
    );
    expect(existsSync(join(consumer, "node_modules/zod"))).toBe(false);
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    writeFileSync(
      join(consumer, "consumer.ts"),
      `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createParameterSnapshot, defineParameters, restoreParameterSnapshot } from '@keynes/policy-parameters';
const snapshot = createParameterSnapshot(defineParameters({ limit: { schema: { type: 'number' }, initial: 3 } }));
const limit: number = snapshot.values.limit;
assert.equal(limit, 3);
const restored = restoreParameterSnapshot(defineParameters({ limit: { schema: { type: 'number' }, initial: 99 } }), JSON.parse(readFileSync(new URL('./authored.json', import.meta.url), 'utf8')));
const restoredLimit: number = restored.values.limit;
assert.equal(restoredLimit, 3);
assert.throws(() => import.meta.resolve('zod'));
`,
    );
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          module: "NodeNext",
          target: "ESNext",
          allowImportingTsExtensions: true,
          types: ["node"],
        },
        include: ["consumer.ts"],
      }),
    );
    writeFileSync(
      join(consumer, "authored.json"),
      JSON.stringify(
        createParameterSnapshot(
          defineParameters({ limit: zodParameter(z.number(), 3) }),
        ),
      ),
    );
    const options = {
      cwd: consumer,
      env: { ...process.env, NODE_PATH: "" },
      encoding: "utf8" as const,
    };
    execFileSync(process.execPath, ["consumer.ts"], options);
    execFileSync(
      process.execPath,
      [
        resolve(consumer, "node_modules/typescript/lib/tsc.js"),
        "--project",
        "tsconfig.json",
      ],
      options,
    );
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}, 30_000);
