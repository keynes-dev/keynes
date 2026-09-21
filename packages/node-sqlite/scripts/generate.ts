import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { applyGeneratedOutputs } from "@keynes/database";

export interface GenerateNodeSqliteOptions {
  readonly check: boolean;
  readonly repositoryRoot?: string;
}

export async function generateNodeSqlite(
  options: GenerateNodeSqliteOptions,
): Promise<void> {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot();
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: resolve(repositoryRoot, "packages/node-sqlite"),
    outputs: new Map([
      ["src/generated/types.ts", stage("generated/types.ts")],
      ["src/generated/validators.ts", stage("generated/validators.ts")],
      [
        "src/command-executor.ts",
        stage("src/command-executor.ts", "../generated/", "./generated/"),
      ],
      [
        "src/resource-definitions.ts",
        stage("src/resource-definitions.ts", "../generated/", "./generated/"),
      ],
      ...[
        "sqlite-command-executor.ts",
        "sqlite-store.ts",
        "decision-evidence.ts",
        "request-validation.ts",
      ].map((name): [string, string] => [
        `src/local/${name}`,
        stage(`src/sqlite/${name}`, "../../generated/", "../generated/"),
      ]),
    ]),
    generatedDirectories: [{ path: "src/generated", accepts: () => true }],
  });

  function stage(path: string, before = "", after = ""): string {
    const source = readFileSync(
      resolve(repositoryRoot, "packages/database", path),
      "utf8",
    );
    return `// Generated from packages/database/${path}. Do not edit.\n${source.replaceAll(before, after)}`;
  }
}

function defaultRepositoryRoot(): string {
  return fileURLToPath(new URL("../../../", import.meta.url));
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { check: { type: "boolean" } },
    strict: true,
  });
  const repositoryRoot = defaultRepositoryRoot();
  await generateNodeSqlite({
    check: values.check === true,
    repositoryRoot,
  });
}
