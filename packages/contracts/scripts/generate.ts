import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";
import { format } from "oxfmt";

import {
  applyGeneratedOutputs,
  jsonFile,
  loadContract,
  type LoadedContract,
} from "../src/index.ts";

export interface ContractGenerationOptions {
  readonly check: boolean;
  readonly repositoryRoot?: string;
}

export async function generateContracts(
  options: ContractGenerationOptions,
): Promise<LoadedContract> {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const packageRoot = resolve(repositoryRoot, "packages/contracts");
  const contract = loadContract(packageRoot);
  if (!isSchemaDocument(contract.schema)) {
    throw new Error("schema must be a JSON Schema document");
  }
  const types = await compile(contract.schema, "KeynesBudgetContract", {
    bannerComment: "// Generated from @keynes/contracts. Do not edit.",
    style: { singleQuote: false },
    unreachableDefinitions: true,
  });
  const formattedTypes = await formatSource("types.ts", `${types.trim()}\n`);
  const contractIdentity = await formatSource(
    "contract.ts",
    `// Generated from packages/contracts. Do not edit.\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(contract.digest)};\n`,
  );
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: packageRoot,
    outputs: new Map([
      ["generated/contract.ts", contractIdentity],
      [
        "generated/contract-digest.json",
        jsonFile({ algorithm: "sha256", digest: contract.digest }),
      ],
      ["generated/types.ts", formattedTypes],
    ]),
    generatedDirectories: [{ path: "generated", accepts: (_fileName) => true }],
  });
  return contract;
}

function isSchemaDocument(
  value: unknown,
): value is Parameters<typeof compile>[0] {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function formatSource(path: string, source: string): Promise<string> {
  const result = await format(path, source, { printWidth: 80 });
  const error = result.errors.find(({ severity }) => severity === "Error");
  if (error !== undefined) {
    throw new Error(
      `cannot format generated ${path}: ${error.message ?? "parse error"}`,
    );
  }
  return result.code;
}

const defaultRepositoryRoot = fileURLToPath(
  new URL("../../../", import.meta.url),
);

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await generateContracts({ check: process.argv.slice(2).includes("--check") });
}
