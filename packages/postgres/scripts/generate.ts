import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { format } from "oxfmt";

import { applyGeneratedOutputs, loadContract } from "@keynes/database";

export async function generatePostgresql(options: {
  readonly check: boolean;
  readonly repositoryRoot?: string;
}) {
  const repositoryRoot =
    options.repositoryRoot ??
    fileURLToPath(new URL("../../../", import.meta.url));
  const source = join(repositoryRoot, "packages/database/postgres");
  const paths = [
    "generated/installation-record.json",
    ...readdirSync(join(source, "migrations")).map(
      (name) => `migrations/${name}`,
    ),
  ];
  const parser = await format(
    "resource-definitions.ts",
    "// Generated from packages/database/src/resource-definitions.ts. Do not edit.\n" +
      readFileSync(
        join(source, "../src/resource-definitions.ts"),
        "utf8",
      ).replaceAll("../generated/types.js", "./types.js"),
    { printWidth: 80 },
  );
  const formattingError = parser.errors.find(
    (diagnostic) => diagnostic.severity === "Error",
  );
  if (formattingError !== undefined)
    throw new Error(
      `cannot format generated resource-definitions.ts: ${formattingError.message ?? "parse error"}`,
    );
  const direct = await format(
    "direct-procedures.ts",
    "// Generated from packages/database/contract.json. Do not edit.\nexport const DIRECT_PROCEDURES = " +
      JSON.stringify(
        Object.fromEntries(
          loadContract(join(source, "..")).source.operations.map(
            ({ method, target, permissions }) => [
              method,
              { target, permission: permissions[0] },
            ],
          ),
        ),
      ) +
      " as const;\n",
    { printWidth: 80 },
  );
  const directError = direct.errors.find(
    (diagnostic) => diagnostic.severity === "Error",
  );
  if (directError !== undefined)
    throw new Error(
      `cannot format generated direct-procedures.ts: ${directError.message ?? "parse error"}`,
    );
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: join(repositoryRoot, "packages/postgres"),
    outputs: new Map([
      ...paths.map((path): [string, string] => [
        path,
        readFileSync(join(source, path), "utf8"),
      ]),
      [
        "src/generated/types.ts",
        readFileSync(join(source, "../generated/types.ts"), "utf8"),
      ],
      ["src/generated/resource-definitions.ts", parser.code],
      ["src/generated/direct-procedures.ts", direct.code],
    ]),
    generatedDirectories: [
      { path: "generated", accepts: () => true },
      { path: "src/generated", accepts: () => true },
      { path: "migrations", accepts: () => true },
    ],
  });
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { check: { type: "boolean" } },
    strict: true,
  });
  await generatePostgresql({ check: values.check === true });
}
