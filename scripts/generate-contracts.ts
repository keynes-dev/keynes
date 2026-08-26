/// <reference types="node" />

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  readonly operations: readonly Operation[];
  readonly outputs: readonly string[];
}

interface CliOptions {
  readonly contractRoot: string;
  readonly outputRoot: string;
  readonly check: boolean;
}

const POSTGRES_PROFILE = {
  profileId: "embedded-postgresql-18.6-preview",
  serverVersionNum: "180006",
  support: {
    install: true,
    exactRecheck: true,
    deferred: [
      "upgrades",
      "downgrades",
      "rolling-deployment",
      "uninstall",
      "backup",
      "recovery",
      "failover",
      "managed-providers",
      "security-qualification",
      "performance-qualification",
      "production-readiness",
    ],
  },
} as const;

const EXPECTED_POSTGRES_OBJECTS = [
  "schema:keynes_internal",
  "schema:keynes",
  "table:keynes_internal.schema_migrations",
  "table:keynes_internal.principal_permissions",
  "table:keynes_internal.commands",
  "table:keynes_internal.resource_types",
  "table:keynes_internal.budgets",
  "table:keynes_internal.budget_resources",
  "table:keynes_internal.budget_history_streams",
  "table:keynes_internal.budget_history_entries",
  "function:keynes_internal.raise_domain_error(text,jsonb)",
  "function:keynes_internal.checkpoint(text)",
  "function:keynes_internal.invalid_command(text,text,text)",
  "function:keynes_internal.canonical_envelope(text,jsonb,text,boolean)",
  "function:keynes_internal.event_uuid(text)",
  "function:keynes_internal.budget_is_settled(uuid,uuid)",
  "function:keynes_internal.subtree_observed(uuid,uuid,uuid)",
  "function:keynes_internal.budget_charge(uuid,uuid,uuid)",
  "function:keynes_internal.assert_safe_accounting(uuid,uuid,text)",
  "function:keynes_internal.budget_projection(uuid,uuid)",
  "function:keynes_internal.append_history(uuid,uuid,uuid,text,uuid,jsonb)",
  "function:keynes_internal.apply_command(text,jsonb)",
  "function:keynes_internal.get_budget(jsonb)",
  "function:keynes.define_resource_type(jsonb)",
  "function:keynes.create_budget(jsonb)",
  "function:keynes.request(jsonb)",
  "function:keynes.settle(jsonb)",
  "function:keynes.get_budget(jsonb)",
] as const;

const DECLARED_OUTPUTS = [
  "packages/cloud/src/generated/procedures.ts",
  "packages/contracts/generated/contract-digest.json",
  "packages/database/generated/installation-record.json",
  "packages/database/migrations/0003-public.generated.sql",
  "packages/sdk/src/generated/client.ts",
  "packages/sdk/src/generated/types.ts",
  "packages/sdk/src/generated/validators.ts",
] as const;

const ALLOWED_OPERATIONS = [
  {
    method: "defineResource",
    target: "keynes.define_resource_type",
    permission: "define_resource_type",
    replay: true,
    input: "DefineResourceTypeCommand",
    output: "DefineResourceTypeResult",
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

function renderSql(contract: Contract, digest: string): string {
  const statements = contract.operations.map((operation) => {
    const functionName = operation.target.slice("keynes.".length);
    const body = operation.replay
      ? `keynes_internal.apply_command('${operation.method}', input)`
      : "keynes_internal.get_budget(input)";
    if (operation.replay) {
      return `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $$
  SELECT ${body};
$$;`;
    }
    return `CREATE OR REPLACE FUNCTION keynes.${functionName}(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, keynes_internal
AS $$
BEGIN
  RETURN ${body};
  EXCEPTION
    WHEN SQLSTATE 'K0001' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', SQLERRM::jsonb
      );
END;
$$;`;
  });

  const revokes = contract.operations
    .map(({ target }) => `REVOKE ALL ON FUNCTION ${target}(jsonb) FROM PUBLIC;`)
    .join("\n");
  return `-- Generated by scripts/generate-contracts.ts. Do not edit.\n-- Contract SHA-256: ${digest}\n\nCREATE SCHEMA IF NOT EXISTS keynes;\nREVOKE ALL ON SCHEMA keynes FROM PUBLIC;\n\n${statements.join("\n\n")}\n\n${revokes}\n`;
}

function installationFunctions(contract: Contract): readonly JsonObject[] {
  return contract.operations.map((operation) => ({
    operation: operation.method,
    permission: operation.permission,
    target: operation.target,
    argumentType: "jsonb",
    returnType: "jsonb",
    language: operation.method === "getBudget" ? "plpgsql" : "sql",
    securityDefiner: true,
    searchPath: ["pg_catalog", "keynes_internal"],
  }));
}

function renderValidators(definitions: JsonObject, contract: Contract): string {
  const path = "$" + "{path}";
  const validatorNames = [
    ...new Set(contract.operations.map((operation) => operation.output)),
    "ErrorEnvelope",
    "OperationName",
  ];
  const validators = validatorNames
    .filter((name) => name !== "OperationName")
    .map(
      (name) =>
        `export function validate${name}(value: unknown): value is ${name} {\n  return validateDefinition(${JSON.stringify(name)}, value).length === 0;\n}`,
    )
    .join("\n\n");
  const inputValidators = contract.operations
    .map(
      ({ input }) =>
        `export function validate${input}Issues(value: unknown): ValidationIssue[] {\n  return validateDefinition(${JSON.stringify(input)}, value);\n}`,
    )
    .join("\n\n");
  const operationInputCases = contract.operations
    .map(
      (operation) =>
        `    case ${JSON.stringify(operation.method)}:\n      return validate${operation.input}Issues(value);`,
    )
    .join("\n");
  const inputIssues = `${inputValidators}\n\nexport function validateOperationInputIssues(\n  operation: OperationName,\n  value: unknown,\n): ValidationIssue[] {\n  switch (operation) {\n${operationInputCases}\n    default: {\n      const exhaustive: never = operation;\n      throw new Error(\`unknown operation: \${exhaustive}\`);\n    }\n  }\n}`;

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { ${validatorNames.join(", ")} } from "./types.js";\n\nexport interface ValidationIssue {\n  readonly path: string;\n  readonly rule: string;\n}\n\ntype Schema = {\n  readonly $ref?: string;\n  readonly type?: string;\n  readonly const?: unknown;\n  readonly enum?: readonly unknown[];\n  readonly pattern?: string;\n  readonly minimum?: number;\n  readonly maximum?: number;\n  readonly minLength?: number;\n  readonly maxLength?: number;\n  readonly minItems?: number;\n  readonly uniqueItems?: boolean;\n  readonly required?: readonly string[];\n  readonly additionalProperties?: boolean;\n  readonly properties?: Readonly<Record<string, Schema>>;\n  readonly items?: Schema;\n  readonly oneOf?: readonly Schema[];\n};\n\nconst definitions: Readonly<Record<string, Schema>> = ${JSON.stringify(definitions, null, 2)};\n\nfunction issue(path: string, rule: string): ValidationIssue[] {\n  return [{ path, rule }];\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction sameJson(left: unknown, right: unknown): boolean {\n  if (left === right) return true;\n  if (Array.isArray(left) && Array.isArray(right)) {\n    return left.length === right.length && left.every((item, index) => sameJson(item, right[index]));\n  }\n  if (!isRecord(left) || !isRecord(right)) return false;\n  const leftKeys = Object.keys(left).sort();\n  const rightKeys = Object.keys(right).sort();\n  return leftKeys.length === rightKeys.length\n    && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(left[key], right[key]));\n}\n\nfunction validate(schema: Schema, value: unknown, path: string): ValidationIssue[] {\n  if (schema.$ref !== undefined) {\n    const name = schema.$ref.slice("#/$defs/".length);\n    const definition = definitions[name];\n    return definition === undefined ? issue(path, "unknown-reference") : validate(definition, value, path);\n  }\n  if (schema.oneOf !== undefined) {\n    const matches = schema.oneOf.filter((candidate) => validate(candidate, value, path).length === 0);\n    return matches.length === 1 ? [] : issue(path, "oneOf");\n  }\n  if (schema.const !== undefined && !sameJson(value, schema.const)) return issue(path, "const");\n  if (schema.enum !== undefined && !schema.enum.some((item) => sameJson(item, value))) return issue(path, "enum");\n\n  if (schema.type === "object") {\n    if (!isRecord(value)) return issue(path, "type");\n    const properties = schema.properties ?? {};\n    const issues: ValidationIssue[] = [];\n    for (const name of schema.required ?? []) {\n      if (!(name in value)) issues.push(...issue(\`${path}/\${name}\`, "required"));\n    }\n    if (schema.additionalProperties === false) {\n      for (const name of Object.keys(value)) {\n        if (!(name in properties)) issues.push(...issue(\`${path}/\${name}\`, "additionalProperties"));\n      }\n    }\n    for (const [name, child] of Object.entries(properties)) {\n      if (name in value) issues.push(...validate(child, value[name], \`${path}/\${name}\`));\n    }\n    return issues;
  }\n  if (schema.type === "array") {\n    if (!Array.isArray(value)) return issue(path, "type");\n    const issues: ValidationIssue[] = [];\n    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(...issue(path, "minItems"));\n    if (schema.uniqueItems === true) {\n      if (value.some((item, index) => value.slice(0, index).some((candidate) => sameJson(candidate, item)))) issues.push(...issue(path, "uniqueItems"));\n    }\n    if (schema.items !== undefined) value.forEach((item, index) => issues.push(...validate(schema.items!, item, \`${path}/\${index}\`)));\n    return issues;\n  }\n  if (schema.type === "string") {\n    if (typeof value !== "string") return issue(path, "type");\n    if (schema.minLength !== undefined && value.length < schema.minLength) return issue(path, "minLength");\n    if (schema.maxLength !== undefined && value.length > schema.maxLength) return issue(path, "maxLength");\n    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) return issue(path, "pattern");\n    return [];\n  }\n  if (schema.type === "integer") {\n    if (!Number.isSafeInteger(value)) return issue(path, "type");\n    if (schema.minimum !== undefined && Number(value) < schema.minimum) return issue(path, "minimum");\n    if (schema.maximum !== undefined && Number(value) > schema.maximum) return issue(path, "maximum");\n    return [];\n  }\n  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) ? [] : issue(path, "type");\n  if (schema.type === "boolean") return typeof value === "boolean" ? [] : issue(path, "type");\n  if (schema.type === "null") return value === null ? [] : issue(path, "type");\n  return schema.type === undefined ? [] : issue(path, "unsupported-type");\n}\n\nfunction validateDefinition(name: string, value: unknown): ValidationIssue[] {\n  const definition = definitions[name];\n  const issues = definition === undefined ? issue("", "unknown-definition") : validate(definition, value, "");\n  return issues.sort((left, right) =>\n    left.path.localeCompare(right.path) || left.rule.localeCompare(right.rule),\n  );\n}\n\n${validators}\n\n${inputIssues}\n`;
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
  const validatorNames = [
    ...contract.operations.map((operation) => `validate${operation.output}`),
    "validateOperationInputIssues",
  ];
  const interfaceMethods = contract.operations
    .map(
      (operation) =>
        `  ${operation.method}(input: ${operation.input}): Promise<${operation.output}>;`,
    )
    .join("\n");
  const methods = contract.operations
    .map((operation) => {
      const replay = operation.replay ? "true" : "false";
      return `    async ${operation.method}(input: ${operation.input}): Promise<${operation.output}> {\n      const operation = ${JSON.stringify(operation.method)};\n      const issues = validateOperationInputIssues(operation, input);\n      if (issues.length > 0) {\n        throw invalidCommand(operation, issues);\n      }\n      return invoke({\n        executor,\n        operation,\n        input,\n        validateOutput: validate${operation.output},\n        replay: ${replay},\n      });\n    },`;
    })
    .join("\n");

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { ${typeNames.join(", ")} } from "./types.js";\nimport { ${[...validatorNames, "validateErrorEnvelope"].join(", ")} } from "./validators.js";\nimport type { ValidationIssue } from "./validators.js";\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(digest)};\n\nexport interface CommandExecutor {\n  execute(operation: OperationName, input: unknown): Promise<unknown>;\n}\n\nexport interface KeynesClient {\n${interfaceMethods}\n}\n\nexport class KeynesError extends Error {\n  readonly code: ErrorEnvelope["code"];\n  readonly details: ErrorEnvelope["details"];\n\n  constructor(error: ErrorEnvelope) {\n    super(error.code);\n    this.name = "KeynesError";\n    this.code = error.code;\n    this.details = error.details;\n  }\n}\n\ntype OutputValidator<Output> = (value: unknown) => value is Output;\n\ninterface Invocation<Output> {\n  readonly executor: CommandExecutor;\n  readonly operation: OperationName;\n  readonly input: unknown;\n  readonly validateOutput: OutputValidator<Output>;\n  readonly replay: boolean;\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction invalidCommand(operation: OperationName, issues: readonly ValidationIssue[]): KeynesError {\n  const [first, ...rest] = issues;\n  if (first === undefined) throw new Error("invalid command has no validation issues");\n  return new KeynesError({\n    kind: "error",\n    code: "invalid_command",\n    details: { operation, issues: [first, ...rest] },\n  });\n}\n\nasync function invoke<Output>(invocation: Invocation<Output>): Promise<Output> {\n  const wire = await invocation.executor.execute(invocation.operation, invocation.input);\n  if (!isRecord(wire) || typeof wire.ok !== "boolean") {\n    throw new Error(\`invalid wire response for \${invocation.operation}\`);\n  }\n  if (wire.ok === false) {\n    if (!validateErrorEnvelope(wire.error)) {\n      throw new Error(\`invalid error response for \${invocation.operation}\`);\n    }\n    throw new KeynesError(wire.error);\n  }\n  if (typeof wire.replayed !== "boolean") {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  if (invocation.replay) {\n    if (!isRecord(wire.result)) {\n      throw new Error(\`invalid replayable result for \${invocation.operation}\`);\n    }\n    const result = { ...wire.result, replayed: wire.replayed };\n    if (!invocation.validateOutput(result)) {\n      throw new Error(\`invalid result response for \${invocation.operation}\`);\n    }\n    return structuredClone(result);\n  }\n  if (!invocation.validateOutput(wire.result)) {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  return structuredClone(wire.result);\n}\n\nexport function createKeynesClient(executor: CommandExecutor): KeynesClient {\n  return {\n${methods}\n  };\n}\n`;
}

function renderCloudProcedures(
  contract: Contract,
  digest: string,
  migrations: readonly JsonObject[],
  contractMigrationId: string,
): string {
  const installationMigrations = migrations
    .map((migration) => {
      const id = requireString(migration, "id");
      const byteChecksum = requireString(migration, "sha256");
      const contractDigest = id === contractMigrationId ? digest : null;
      return `  {\n    id: ${JSON.stringify(id)},\n    byteChecksum: ${JSON.stringify(byteChecksum)},\n    contractDigest: ${JSON.stringify(contractDigest)},\n  },`;
    })
    .join("\n");
  const procedures = contract.operations
    .map(
      (operation) =>
        `  ${operation.method}: {\n    target: ${JSON.stringify(operation.target)},\n    statement: ${JSON.stringify(`select ${operation.target}($1::jsonb) as response`)},\n    permission: ${JSON.stringify(operation.permission)},\n    replay: ${String(operation.replay)},\n  },`,
    )
    .join("\n");

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(digest)};\n\nexport const INSTALLATION_MIGRATIONS = [\n${installationMigrations}\n] as const;\n\nexport const PROCEDURES = {\n${procedures}\n} as const;\n\nexport type OperationName = keyof typeof PROCEDURES;\n`;
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

async function formatJson(path: string, value: unknown): Promise<string> {
  const result = await format(path, jsonFile(value), { printWidth: 80 });
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
  migrations: readonly JsonObject[],
): readonly JsonObject[] {
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
    "packages/cloud/src/generated",
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
  const digest = sha256(
    stableJson({ schema, operations: contract.operations }),
  );
  const publicSql = renderSql(contract, digest);
  const migrationManifest = readMigrationManifest(options.contractRoot);
  const contractMigrations = migrationManifest.filter(
    (migration) => migration.contract === true,
  );
  if (contractMigrations.length !== 1) {
    fail("migration manifest must declare one contract migration");
  }
  const contractMigrationId = requireString(contractMigrations[0], "id");
  const migrations = migrationRecords(
    options.contractRoot,
    publicSql,
    migrationManifest,
  ).map((migration) =>
    migration.id === contractMigrationId
      ? { ...migration, contractDigest: digest }
      : migration,
  );
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
  const formattedCloudProcedures = await formatTypeScript(
    "procedures.ts",
    renderCloudProcedures(contract, digest, migrations, contractMigrationId),
  );
  const expectedTargets = contract.operations.map(({ target }) => target);
  const functionMetadata = installationFunctions(contract);
  const migrationSetDigest = sha256(stableJson(migrations));
  const installationRecord = await formatJson("installation-record.json", {
    ...POSTGRES_PROFILE,
    contractDigest: digest,
    migrationSetDigest,
    migrations,
    expectedObjects: EXPECTED_POSTGRES_OBJECTS,
    expectedTargets,
    functions: functionMetadata,
  });

  return new Map([
    ["packages/cloud/src/generated/procedures.ts", formattedCloudProcedures],
    [
      "packages/contracts/generated/contract-digest.json",
      jsonFile({ algorithm: "sha256", digest }),
    ],
    [
      "packages/database/generated/installation-record.json",
      installationRecord,
    ],
    ["packages/database/migrations/0003-public.generated.sql", publicSql],
    ["packages/sdk/src/generated/client.ts", formattedClient],
    ["packages/sdk/src/generated/types.ts", formattedTypes],
    ["packages/sdk/src/generated/validators.ts", formattedValidators],
  ]);
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
