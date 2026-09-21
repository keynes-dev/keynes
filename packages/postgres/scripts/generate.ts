import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { applyGeneratedOutputs } from "@keynes/database";

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
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: join(repositoryRoot, "packages/postgres"),
    outputs: new Map(
      paths.map((path) => [path, readFileSync(join(source, path), "utf8")]),
    ),
    generatedDirectories: [
      { path: "generated", accepts: () => true },
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
