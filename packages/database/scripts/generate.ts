import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";
import { format } from "oxfmt";
import { applyGeneratedOutputs, jsonFile } from "../src/generation.ts";
import { loadContract } from "../src/load.ts";
import type { LoadedContract } from "../src/model.ts";
import { renderValidators } from "../src/generation/render.ts";
import { generatePostgresql } from "../postgres/scripts/generate.ts";

export interface ContractGenerationOptions {
  readonly check: boolean;
  readonly repositoryRoot?: string;
}

export async function generateContracts(
  options: ContractGenerationOptions,
): Promise<LoadedContract> {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  const packageRoot = resolve(repositoryRoot, "packages/database");
  const contract = loadContract(packageRoot);
  if (!isSchemaDocument(contract.schema)) {
    throw new Error("schema must be a JSON Schema document");
  }
  const types = await compile(contract.schema, "KeynesBudgetContract", {
    bannerComment: "// Generated from @keynes/database. Do not edit.",
    maxItems: 4,
    style: { singleQuote: false },
    unreachableDefinitions: true,
  });
  const formattedTypes = await formatSource("types.ts", `${types.trim()}\n`);
  const formattedContractSchema = await formatSource(
    "schema.json",
    jsonFile(contract.schema),
  );
  const contractIdentity = await formatSource(
    "contract.ts",
    `// Generated from packages/database. Do not edit.\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(contract.digest)};\nexport const REMOTE_PROCEDURES_DIGEST = ${JSON.stringify(contract.remoteDigest)};\nexport const REMOTE_CONTRACT = ${JSON.stringify(contract.source.remote, null, 2)} as const;\n`,
  );
  applyGeneratedOutputs({
    check: options.check,
    outputRoot: packageRoot,
    outputs: new Map([
      ["generated/contract.ts", contractIdentity],
      ["generated/schema.json", formattedContractSchema],
      [
        "generated/contract-digest.json",
        jsonFile({ algorithm: "sha256", digest: contract.digest }),
      ],
      [
        "generated/remote-procedures-digest.json",
        jsonFile({ algorithm: "sha256", digest: contract.remoteDigest }),
      ],
      ["generated/types.ts", formattedTypes],
      [
        "generated/validators.ts",
        await formatSource(
          "validators.ts",
          renderValidators(contract.definitions, contract.source),
        ),
      ],
    ]),
    generatedDirectories: [{ path: "generated", accepts: (_fileName) => true }],
  });
  await generatePostgresql({ check: options.check, contract, repositoryRoot });
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
