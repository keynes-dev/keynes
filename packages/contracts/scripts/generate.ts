import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "json-schema-to-typescript";
import { format } from "oxfmt";
import { Ajv2020 } from "ajv/dist/2020.js";

import {
  applyGeneratedOutputs,
  buildPolicySchema,
  jsonFile,
  renderPolicyProfileModule,
} from "../src/generation.ts";
import { loadContract } from "../src/load.ts";
import { loadPolicyProfile } from "../src/load-policy-profile.ts";
import type { LoadedContract } from "../src/model.ts";

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
  const policyProfile = loadPolicyProfile(packageRoot);
  const policySchema = buildPolicySchema(policyProfile);
  if (!isSchemaDocument(contract.schema)) {
    throw new Error("schema must be a JSON Schema document");
  }
  if (!isSchemaDocument(policySchema)) {
    throw new Error("Policy schema must be a JSON Schema document");
  }
  validateCanonicalVectors(policySchema, policyProfile.source.nodes);
  const types = await compile(contract.schema, "KeynesBudgetContract", {
    bannerComment: "// Generated from @keynes/contracts. Do not edit.",
    style: { singleQuote: false },
    unreachableDefinitions: true,
  });
  const policyTypes = await compile(policySchema, "KeynesPolicyContract", {
    bannerComment:
      "// Generated from packages/contracts/policy-profile.json. Do not edit.",
    maxItems: 4,
    style: { singleQuote: false },
    unreachableDefinitions: true,
  });
  const formattedTypes = await formatSource("types.ts", `${types.trim()}\n`);
  const formattedPolicyTypes = await formatSource(
    "policy-types.ts",
    `${policyTypes.trim()}\n`,
  );
  const formattedPolicyProfile = await formatSource(
    "policy-profile.ts",
    renderPolicyProfileModule(policyProfile),
  );
  const formattedPolicySchema = await formatSource(
    "policy-schema.json",
    jsonFile(policySchema),
  );
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
      ["generated/policy-types.ts", formattedPolicyTypes],
      ["generated/policy-profile.ts", formattedPolicyProfile],
      ["generated/policy-schema.json", formattedPolicySchema],
      [
        "generated/policy-profile-digest.json",
        jsonFile({ algorithm: "sha256", digest: policyProfile.digest }),
      ],
    ]),
    generatedDirectories: [{ path: "generated", accepts: (_fileName) => true }],
  });
  return contract;
}

function validateCanonicalVectors(
  policySchema: Parameters<typeof compile>[0],
  nodes: Readonly<Record<string, { readonly vectors: readonly unknown[] }>>,
): void {
  const ajv = new Ajv2020({ strict: true });
  addPolicyKeywords(ajv);
  const schemaId = policySchema.$id;
  if (typeof schemaId !== "string") {
    throw new Error("Policy schema must declare an identifier");
  }
  ajv.addSchema(policySchema, schemaId);
  for (const [kind, node] of Object.entries(nodes)) {
    const definition = `${kind
      .split("_")
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join("")}NodeV1`;
    const validateNode = ajv.getSchema(`${schemaId}#/$defs/${definition}`);
    if (validateNode === undefined) {
      throw new Error(`Policy schema must declare ${definition}`);
    }
    for (const [index, vector] of node.vectors.entries()) {
      if (!isRecord(vector) || !validateNode(vector.input)) {
        throw new Error(
          `policy profile node ${kind} canonical vector ${index} is invalid: ${JSON.stringify(validateNode.errors)}`,
        );
      }
    }
  }
}

function addPolicyKeywords(ajv: Ajv2020): void {
  ajv.addKeyword({
    keyword: "maxUtf8Bytes",
    type: "string",
    schemaType: "number",
    validate: (limit: number, value: string) =>
      new TextEncoder().encode(value).byteLength <= limit,
  });
  ajv.addKeyword({
    keyword: "maxCanonicalUtf8Bytes",
    type: "object",
    schemaType: "number",
    validate: (limit: number, value: unknown) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit,
  });
}

function isSchemaDocument(
  value: unknown,
): value is Parameters<typeof compile>[0] {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
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
