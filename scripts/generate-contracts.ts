/// <reference types="node" />

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import canonicalize from "canonicalize";
import { compile } from "json-schema-to-typescript";
import { format } from "oxfmt";

type JsonObject = { [key: string]: unknown };

interface Operation {
  readonly method: string;
  readonly target: string;
  readonly permission: string;
  readonly replay: boolean;
  readonly input: string;
  readonly output: string;
}

interface Contract {
  readonly schema: string;
  readonly fixtureSource: string;
  readonly fixtureExpectations: string;
  readonly operations: readonly Operation[];
  readonly outputs: readonly string[];
}

interface CliOptions {
  readonly contractRoot: string;
  readonly outputRoot: string;
  readonly check: boolean;
}

const DECLARED_OUTPUTS = [
  "packages/contracts/generated/contract-digest.json",
  "packages/contracts/generated/fixtures.json",
  "packages/contracts/generated/operations.json",
  "packages/database/generated/installation-record.json",
  "packages/database/migrations/0003-public.generated.sql",
  "packages/sdk/src/generated/client.ts",
  "packages/sdk/src/generated/types.ts",
  "packages/sdk/src/generated/validators.ts",
] as const;

const ALLOWED_OPERATIONS = [
  {
    method: "publishResource",
    target: "keynes.publish_resource_type",
    permission: "publish_resource",
    replay: true,
    input: "PublishResourceCommand",
    output: "PublishResourceResult",
  },
  {
    method: "createBudget",
    target: "keynes.create_budget",
    permission: "create_root_budget",
    replay: true,
    input: "CreateBudgetCommand",
    output: "CreateBudgetResult",
  },
  {
    method: "requestBudget",
    target: "keynes.request",
    permission: "request_budget",
    replay: true,
    input: "RequestBudgetCommand",
    output: "RequestBudgetResult",
  },
  {
    method: "settleBudget",
    target: "keynes.settle",
    permission: "settle_budget",
    replay: true,
    input: "SettleBudgetCommand",
    output: "SettleBudgetResult",
  },
  {
    method: "getBudget",
    target: "keynes.get_budget",
    permission: "read_budget",
    replay: false,
    input: "GetBudgetQuery",
    output: "GetBudgetResult",
  },
] as const satisfies readonly Operation[];

const SCHEMA_KEYWORDS = new Set([
  "$ref",
  "additionalProperties",
  "const",
  "enum",
  "items",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "oneOf",
  "pattern",
  "properties",
  "required",
  "type",
  "uniqueItems",
]);

function fail(message: string): never {
  throw new Error(message);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requireString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string") {
    fail(`contract field ${key} must be a string`);
  }
  return value;
}

function parseOperation(value: unknown): Operation {
  if (!isObject(value)) {
    fail("contract operation must be an object");
  }
  if (typeof value.replay !== "boolean") {
    fail("contract operation replay must be a boolean");
  }
  return {
    method: requireString(value, "method"),
    target: requireString(value, "target"),
    permission: requireString(value, "permission"),
    replay: value.replay,
    input: requireString(value, "input"),
    output: requireString(value, "output"),
  };
}

function parseContract(value: unknown): Contract {
  if (!isObject(value)) {
    fail("contract source must be an object");
  }
  if (!Array.isArray(value.operations) || !Array.isArray(value.outputs)) {
    fail("contract operations and outputs must be arrays");
  }
  if (!value.outputs.every((output) => typeof output === "string")) {
    fail("contract outputs must be strings");
  }
  return {
    schema: requireString(value, "schema"),
    fixtureSource: requireString(value, "fixtureSource"),
    fixtureExpectations: requireString(value, "fixtureExpectations"),
    operations: value.operations.map(parseOperation),
    outputs: value.outputs,
  };
}

function parseOptions(arguments_: readonly string[]): CliOptions {
  let contractRoot = process.cwd();
  let outputRoot = process.cwd();
  let check = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--check") {
      check = true;
      continue;
    }
    if (argument !== "--contract-root" && argument !== "--output-root") {
      fail(`unknown argument: ${argument}`);
    }
    const value = arguments_[index + 1];
    if (value === undefined) {
      fail(`missing value for ${argument}`);
    }
    if (argument === "--contract-root") {
      contractRoot = resolve(value);
    } else {
      outputRoot = resolve(value);
    }
    index += 1;
  }

  return { contractRoot, outputRoot, check };
}

function validateSchemaNode(node: unknown, location: string): void {
  if (!isObject(node)) {
    fail(`schema node ${location} must be an object`);
  }
  for (const keyword of Object.keys(node)) {
    if (!SCHEMA_KEYWORDS.has(keyword)) {
      fail(`unsupported schema keyword ${keyword} at ${location}`);
    }
  }

  if (Array.isArray(node.enum)) {
    const encoded = node.enum.map((value) => JSON.stringify(value));
    if (encoded.length !== new Set(encoded).size) {
      fail(`unstable enumeration at ${location}`);
    }
  }

  if (isObject(node.properties)) {
    for (const [name, child] of Object.entries(node.properties)) {
      validateSchemaNode(child, `${location}/properties/${name}`);
    }
  }
  if (isObject(node.items)) {
    validateSchemaNode(node.items, `${location}/items`);
  }
  if (Array.isArray(node.oneOf)) {
    node.oneOf.forEach((child, index) =>
      validateSchemaNode(child, `${location}/oneOf/${index}`),
    );
  }
}

function validateInputs(contract: Contract, schema: unknown): JsonObject {
  if (!isObject(schema) || !isObject(schema.$defs)) {
    fail("schema must define an object-valued $defs");
  }
  for (const [name, definition] of Object.entries(schema.$defs)) {
    validateSchemaNode(definition, `#/$defs/${name}`);
  }

  const expectedOutputs = [...DECLARED_OUTPUTS];
  if (
    contract.outputs.length !== expectedOutputs.length ||
    contract.outputs.some((output, index) => output !== expectedOutputs[index])
  ) {
    fail("contract outputs must equal the sorted generator output allowlist");
  }

  const targets = new Set<string>();
  for (const operation of contract.operations) {
    if (targets.has(operation.target)) {
      fail(`duplicate installed target ${operation.target}`);
    }
    targets.add(operation.target);
  }
  for (const [index, operation] of contract.operations.entries()) {
    const expected = ALLOWED_OPERATIONS[index];
    if (expected === undefined) {
      fail("contract declares more than five operations");
    }
    if (operation.method !== expected.method) {
      fail(`operation order mismatch at index ${index}`);
    }
    if (operation.target !== expected.target) {
      fail(
        `non-allowlisted target ${operation.target} for operation ${operation.method}`,
      );
    }
    if (!(operation.input in schema.$defs)) {
      fail(`undeclared input ${operation.input}`);
    }
    if (!(operation.output in schema.$defs)) {
      fail(`undeclared output ${operation.output}`);
    }
    for (const field of ["permission", "replay", "input", "output"] as const) {
      if (operation[field] !== expected[field]) {
        fail(`operation metadata mismatch for ${operation.method}: ${field}`);
      }
    }
  }
  if (contract.operations.length !== ALLOWED_OPERATIONS.length) {
    fail("contract must declare exactly the five allowlisted operations");
  }
  return schema.$defs;
}

function stableJson(value: unknown): string {
  const encoded = canonicalize(value);
  if (encoded === undefined) {
    fail("contract contains a value that cannot be canonicalized");
  }
  return encoded;
}

function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalFixture(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalFixture);
    if (
      items.every(
        (item) => isObject(item) && typeof item.resourceTypeId === "string",
      )
    ) {
      return items.sort((left, right) => {
        if (!isObject(left) || !isObject(right)) return 0;
        return String(left.resourceTypeId).localeCompare(
          String(right.resourceTypeId),
        );
      });
    }
    return items;
  }
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalFixture(value[key])]),
  );
}

function renderSql(contract: Contract, digest: string): string {
  const statements = [
    `INSERT INTO keynes_internal.installed_contracts (contract_digest)\nVALUES ('${digest}');`,
    ...contract.operations.map((operation) => {
      const functionName = operation.target.slice("keynes.".length);
      const body = operation.replay
        ? `keynes_internal.apply_command('${operation.method}', input)`
        : "keynes_internal.get_budget(input)";
      return `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  BEGIN
    RETURN ${body};
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', SQLERRM::jsonb
      );
  END;
END;
$$;`;
    }),
  ];

  return `-- Generated by scripts/generate-contracts.ts. Do not edit.\n-- Contract SHA-256: ${digest}\n\nCREATE SCHEMA IF NOT EXISTS keynes;\n\n${statements.join("\n\n")}\n`;
}

function renderValidators(definitions: JsonObject, contract: Contract): string {
  const path = "$" + "{path}";
  const validatorNames = [
    ...new Set(
      contract.operations.flatMap((operation) => [
        operation.input,
        operation.output,
      ]),
    ),
    "ErrorEnvelope",
  ];
  const validators = validatorNames
    .map(
      (name) =>
        `export function validate${name}(value: unknown): value is ${name} {\n  return validateDefinition(${JSON.stringify(name)}, value).length === 0;\n}`,
    )
    .join("\n\n");
  const inputIssues = contract.operations
    .map(
      ({ input }) =>
        `export function validate${input}Issues(value: unknown): ValidationIssue[] {\n  return validateDefinition(${JSON.stringify(input)}, value);\n}`,
    )
    .join("\n\n");

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { ${validatorNames.join(", ")} } from "./types.js";\n\nexport interface ValidationIssue {\n  readonly path: string;\n  readonly rule: string;\n}\n\ntype Schema = {\n  readonly $ref?: string;\n  readonly type?: string;\n  readonly const?: unknown;\n  readonly enum?: readonly unknown[];\n  readonly pattern?: string;\n  readonly minimum?: number;\n  readonly maximum?: number;\n  readonly minLength?: number;\n  readonly maxLength?: number;\n  readonly minItems?: number;\n  readonly uniqueItems?: boolean;\n  readonly required?: readonly string[];\n  readonly additionalProperties?: boolean;\n  readonly properties?: Readonly<Record<string, Schema>>;\n  readonly items?: Schema;\n  readonly oneOf?: readonly Schema[];\n};\n\nconst definitions: Readonly<Record<string, Schema>> = ${JSON.stringify(definitions, null, 2)};\n\nfunction issue(path: string, rule: string): ValidationIssue[] {\n  return [{ path, rule }];\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction sameJson(left: unknown, right: unknown): boolean {\n  return JSON.stringify(left) === JSON.stringify(right);\n}\n\nfunction validate(schema: Schema, value: unknown, path: string): ValidationIssue[] {\n  if (schema.$ref !== undefined) {\n    const name = schema.$ref.slice("#/$defs/".length);\n    const definition = definitions[name];\n    return definition === undefined ? issue(path, "unknown-reference") : validate(definition, value, path);\n  }\n  if (schema.oneOf !== undefined) {\n    const matches = schema.oneOf.filter((candidate) => validate(candidate, value, path).length === 0);\n    return matches.length === 1 ? [] : issue(path, "oneOf");\n  }\n  if (schema.const !== undefined && !sameJson(value, schema.const)) return issue(path, "const");\n  if (schema.enum !== undefined && !schema.enum.some((item) => sameJson(item, value))) return issue(path, "enum");\n\n  if (schema.type === "object") {\n    if (!isRecord(value)) return issue(path, "type");\n    const properties = schema.properties ?? {};\n    const issues: ValidationIssue[] = [];\n    for (const name of schema.required ?? []) {\n      if (!(name in value)) issues.push(...issue(\`${path}/\${name}\`, "required"));\n    }\n    if (schema.additionalProperties === false) {\n      for (const name of Object.keys(value)) {\n        if (!(name in properties)) issues.push(...issue(\`${path}/\${name}\`, "additionalProperties"));\n      }\n    }\n    for (const [name, child] of Object.entries(properties)) {\n      if (name in value) issues.push(...validate(child, value[name], \`${path}/\${name}\`));\n    }\n    return issues;
  }\n  if (schema.type === "array") {\n    if (!Array.isArray(value)) return issue(path, "type");\n    const issues: ValidationIssue[] = [];\n    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(...issue(path, "minItems"));\n    if (schema.uniqueItems === true) {\n      const encoded = value.map((item) => JSON.stringify(item));\n      if (new Set(encoded).size !== encoded.length) issues.push(...issue(path, "uniqueItems"));\n    }\n    if (schema.items !== undefined) value.forEach((item, index) => issues.push(...validate(schema.items!, item, \`${path}/\${index}\`)));\n    return issues;\n  }\n  if (schema.type === "string") {\n    if (typeof value !== "string") return issue(path, "type");\n    if (schema.minLength !== undefined && value.length < schema.minLength) return issue(path, "minLength");\n    if (schema.maxLength !== undefined && value.length > schema.maxLength) return issue(path, "maxLength");\n    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) return issue(path, "pattern");\n    return [];\n  }\n  if (schema.type === "integer") {\n    if (!Number.isSafeInteger(value)) return issue(path, "type");\n    if (schema.minimum !== undefined && Number(value) < schema.minimum) return issue(path, "minimum");\n    if (schema.maximum !== undefined && Number(value) > schema.maximum) return issue(path, "maximum");\n    return [];\n  }\n  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) ? [] : issue(path, "type");\n  if (schema.type === "boolean") return typeof value === "boolean" ? [] : issue(path, "type");\n  if (schema.type === "null") return value === null ? [] : issue(path, "type");\n  return schema.type === undefined ? [] : issue(path, "unsupported-type");\n}\n\nfunction validateDefinition(name: string, value: unknown): ValidationIssue[] {\n  const definition = definitions[name];\n  const issues = definition === undefined ? issue("", "unknown-definition") : validate(definition, value, "");\n  return issues.sort((left, right) =>\n    left.path.localeCompare(right.path) || left.rule.localeCompare(right.rule),\n  );\n}\n\n${validators}\n\n${inputIssues}\n`;
}

function renderClient(contract: Contract, digest: string): string {
  const typeNames = [
    ...new Set(
      contract.operations.flatMap((operation) => [
        operation.input,
        operation.output,
      ]),
    ),
    "ErrorEnvelope",
    "OperationName",
  ];
  const validatorNames = contract.operations.flatMap((operation) => [
    `validate${operation.input}`,
    `validate${operation.input}Issues`,
    `validate${operation.output}`,
  ]);
  const interfaceMethods = contract.operations
    .map(
      (operation) =>
        `  ${operation.method}(input: ${operation.input}): Promise<${operation.output}>;`,
    )
    .join("\n");
  const methods = contract.operations
    .map((operation) => {
      const replay = operation.replay ? "true" : "false";
      return `    async ${operation.method}(input: ${operation.input}): Promise<${operation.output}> {\n      if (!validate${operation.input}(input)) {\n        throw invalidCommand(${JSON.stringify(operation.method)}, validate${operation.input}Issues(input));\n      }\n      return invoke({\n        caller,\n        target: ${JSON.stringify(operation.target)},\n        operation: ${JSON.stringify(operation.method)},\n        input,\n        validateOutput: validate${operation.output},\n        replay: ${replay},\n      });\n    },`;
    })
    .join("\n");

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { ${typeNames.join(", ")} } from "./types.js";\nimport { ${[...validatorNames, "validateErrorEnvelope"].join(", ")} } from "./validators.js";\nimport type { ValidationIssue } from "./validators.js";\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(digest)};\n\nexport type InstalledTarget = ${contract.operations.map((operation) => JSON.stringify(operation.target)).join(" | ")};\n\nexport interface ProcedureCaller {\n  call(target: InstalledTarget, input: unknown): Promise<unknown>;\n}\n\nexport interface KeynesClient {\n${interfaceMethods}\n}\n\nexport class KeynesError extends Error {\n  readonly code: ErrorEnvelope["code"];\n  readonly details: ErrorEnvelope["details"];\n\n  constructor(error: ErrorEnvelope) {\n    super(error.code);\n    this.name = "KeynesError";\n    this.code = error.code;\n    this.details = error.details;\n  }\n}\n\ntype OutputValidator<Output> = (value: unknown) => value is Output;\n\ninterface Invocation<Output> {\n  readonly caller: ProcedureCaller;\n  readonly target: InstalledTarget;\n  readonly operation: string;\n  readonly input: unknown;\n  readonly validateOutput: OutputValidator<Output>;\n  readonly replay: boolean;\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction invalidCommand(operation: OperationName, issues: readonly ValidationIssue[]): KeynesError {\n  const [first, ...rest] = issues;\n  if (first === undefined) throw new Error("invalid command has no validation issues");\n  return new KeynesError({\n    kind: "error",\n    code: "invalid_command",\n    details: { operation, issues: [first, ...rest] },\n  });\n}\n\nasync function invoke<Output>(invocation: Invocation<Output>): Promise<Output> {\n  const wire = await invocation.caller.call(invocation.target, invocation.input);\n  if (!isRecord(wire) || typeof wire.ok !== "boolean") {\n    throw new Error(\`invalid wire response for \${invocation.operation}\`);\n  }\n  if (wire.ok === false) {\n    if (!validateErrorEnvelope(wire.error)) {\n      throw new Error(\`invalid error response for \${invocation.operation}\`);\n    }\n    throw new KeynesError(wire.error);\n  }\n  if (typeof wire.replayed !== "boolean") {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  if (invocation.replay) {\n    if (!isRecord(wire.result)) {\n      throw new Error(\`invalid replayable result for \${invocation.operation}\`);\n    }\n    const result = { ...wire.result, replayed: wire.replayed };\n    if (!invocation.validateOutput(result)) {\n      throw new Error(\`invalid result response for \${invocation.operation}\`);\n    }\n    return result;\n  }\n  if (!invocation.validateOutput(wire.result)) {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  return wire.result;\n}\n\nexport function createKeynesClient(caller: ProcedureCaller): KeynesClient {\n  return {\n${methods}\n  };\n}\n`;
}

async function formatTypeScript(path: string, source: string): Promise<string> {
  const result = await format(path, source, { printWidth: 80 });
  const error = result.errors.find(
    (diagnostic) => diagnostic.severity === "Error",
  );
  if (error !== undefined) {
    fail(`cannot format generated ${path}: ${error.message ?? "parse error"}`);
  }
  return result.code;
}

function readMigrationManifest(root: string): readonly JsonObject[] {
  const path = join(root, "packages/database/migrations/manifest.json");
  if (!existsSync(path)) fail("migration manifest is required");
  const value = parseJson(path);
  if (!isObject(value) || !Array.isArray(value.migrations)) {
    fail("migration manifest must contain a migrations array");
  }
  return value.migrations.map((migration) => {
    if (!isObject(migration))
      fail("migration manifest entry must be an object");
    requireString(migration, "id");
    requireString(migration, "path");
    return migration;
  });
}

function migrationRecords(
  contractRoot: string,
  publicSql: string,
): readonly JsonObject[] {
  const migrations = readMigrationManifest(contractRoot);
  return migrations.map((migration) => {
    const id = requireString(migration, "id");
    const path = requireString(migration, "path");
    const contents =
      path === "0003-public.generated.sql"
        ? publicSql
        : readFileSync(
            join(contractRoot, "packages/database/migrations", path),
            "utf8",
          );
    return { id, path, sha256: sha256(contents) };
  });
}

function listGeneratedFiles(root: string): string[] {
  const directories = [
    "packages/contracts/generated",
    "packages/database/generated",
    "packages/sdk/src/generated",
  ];
  return directories.flatMap((directory) => {
    const absolute = join(root, directory);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(directory, entry.name));
  });
}

async function buildOutputs(options: CliOptions): Promise<Map<string, string>> {
  const sourceRoot = join(options.contractRoot, "packages/contracts");
  const contract = parseContract(parseJson(join(sourceRoot, "contract.json")));
  const schema = parseJson(join(sourceRoot, contract.schema));
  const definitions = validateInputs(contract, schema);
  const fixtureSource = parseJson(join(sourceRoot, contract.fixtureSource));
  const fixtureExpectations = parseJson(
    join(sourceRoot, contract.fixtureExpectations),
  );
  const digest = sha256(
    stableJson({ schema, operations: contract.operations }),
  );
  const publicSql = renderSql(contract, digest);
  const types = await compile(schema, "KeynesBudgetContract", {
    bannerComment:
      "// Generated by scripts/generate-contracts.ts. Do not edit.",
    style: { singleQuote: false },
    unreachableDefinitions: true,
  });
  const formattedTypes = await formatTypeScript(
    "types.ts",
    `${types.trim()}\n`,
  );
  const formattedValidators = await formatTypeScript(
    "validators.ts",
    renderValidators(definitions, contract),
  );
  const formattedClient = await formatTypeScript(
    "client.ts",
    renderClient(contract, digest),
  );
  const expectedObjects = contract.operations.map((operation) => ({
    kind: "function",
    name: operation.target,
    arguments: "jsonb",
    returns: "jsonb",
  }));

  return new Map([
    [
      "packages/contracts/generated/contract-digest.json",
      jsonFile({ algorithm: "sha256", digest }),
    ],
    [
      "packages/contracts/generated/fixtures.json",
      jsonFile({
        contractDigest: digest,
        bindings: contract.operations.map(({ method, target }) => ({
          method,
          target,
        })),
        source: canonicalFixture(fixtureSource),
        expectations: canonicalFixture(fixtureExpectations),
      }),
    ],
    [
      "packages/contracts/generated/operations.json",
      jsonFile({ contractDigest: digest, operations: contract.operations }),
    ],
    [
      "packages/database/generated/installation-record.json",
      jsonFile({
        contractDigest: digest,
        migrations: migrationRecords(options.contractRoot, publicSql),
        expectedObjects,
      }),
    ],
    ["packages/database/migrations/0003-public.generated.sql", publicSql],
    ["packages/sdk/src/generated/client.ts", formattedClient],
    ["packages/sdk/src/generated/types.ts", formattedTypes],
    ["packages/sdk/src/generated/validators.ts", formattedValidators],
  ]);
}

function ensureInsideRoot(root: string, path: string): void {
  const relativePath = relative(root, path);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    fail(`output escapes output root: ${path}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const outputs = await buildOutputs(options);
  const undeclared = listGeneratedFiles(options.outputRoot).filter(
    (path) => !outputs.has(path),
  );
  if (undeclared.length > 0) {
    fail(`undeclared generated files: ${undeclared.join(", ")}`);
  }

  const drift: string[] = [];
  for (const [path, contents] of outputs) {
    const absolute = resolve(options.outputRoot, path);
    ensureInsideRoot(options.outputRoot, absolute);
    if (options.check) {
      if (
        !existsSync(absolute) ||
        readFileSync(absolute, "utf8") !== contents
      ) {
        drift.push(path);
      }
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  if (drift.length > 0) {
    fail(`generated output drift: ${drift.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
