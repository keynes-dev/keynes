import type {
  ContractSource as Contract,
  JsonObject,
  LoadedPolicyProfile,
} from "@keynes/contracts";

export function renderPolicyProfile(
  profile: LoadedPolicyProfile,
  schema: JsonObject,
): string {
  const definitions = schema.$defs;
  if (!isJsonObject(definitions)) {
    throw new Error("Policy schema must declare definitions");
  }
  const mapNodes = <Value>(
    select: (node: LoadedPolicyProfile["source"]["nodes"][string]) => Value,
  ): Readonly<Record<string, Value>> =>
    Object.fromEntries(
      profile.nodeKinds.map((kind) => [
        kind,
        select(profile.source.nodes[kind]!),
      ]),
    );
  const handlers = mapNodes((node) => node.backends.typescript.handler);
  const validators = mapNodes((node) => node.backends.postgresql.validator);
  const renderers = mapNodes((node) => node.backends.postgresql.renderer);
  const work = mapNodes((node) => node.work);
  const vectors = mapNodes((node) => node.vectors);
  const semantics = mapNodes((node) => ({
    typeRule: node.typeRule,
    nullRule: node.nullRule,
    decimalBoundary: node.decimalBoundary,
    canonical: node.canonical,
  }));

  return `// Generated from packages/contracts/policy-profile.json. Do not edit.

import type { PolicyContextV1, PolicyDefinitionV1, PolicyNodeV1, PolicyProgramV1 } from "./policy-types.js";

export const POLICY_PROGRAM_VERSION = ${JSON.stringify(profile.source.versions.program)} as const;
export const POLICY_QUERY_PROFILE_VERSION = ${JSON.stringify(profile.source.versions.query)} as const;
export const POLICY_VALIDATOR_VERSION = ${JSON.stringify(profile.source.versions.validator)} as const;
export const POLICY_LIMITS_VERSION = ${JSON.stringify(profile.source.versions.limits)} as const;
export const POLICY_PROFILE_DIGEST = ${JSON.stringify(profile.digest)} as const;

export const POLICY_NODE_KINDS = ${JSON.stringify(profile.nodeKinds)} as const;
export type PolicyNodeKind = (typeof POLICY_NODE_KINDS)[number];
export type PolicyNodeDispatch<T> = Readonly<Record<PolicyNodeKind, T>>;

export const POLICY_OPERATOR_SIGNATURES = ${JSON.stringify(profile.source.inventory.operators, null, 2)} as const;
export const POLICY_FUNCTION_SIGNATURES = ${JSON.stringify(profile.source.inventory.functions, null, 2)} as const;

export const POLICY_TYPESCRIPT_HANDLERS = ${JSON.stringify(handlers, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_VALIDATORS = ${JSON.stringify(validators, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_POSTGRESQL_RENDERERS = ${JSON.stringify(renderers, null, 2)} as const satisfies PolicyNodeDispatch<string>;
export const POLICY_WORK_METADATA = ${JSON.stringify(work, null, 2)} as const satisfies PolicyNodeDispatch<Readonly<Record<string, number>>>;
export const POLICY_CANONICAL_VECTORS = ${JSON.stringify(vectors, null, 2)} as const satisfies PolicyNodeDispatch<readonly unknown[]>;
export const POLICY_NODE_SEMANTICS = ${JSON.stringify(semantics, null, 2)} as const satisfies PolicyNodeDispatch<unknown>;
export const POLICY_LIMITS = ${JSON.stringify(profile.source.limits, null, 2)} as const;
export const POLICY_NUMERIC_PROFILE = ${JSON.stringify(profile.source.numeric, null, 2)} as const;
export const POLICY_TEXT_PROFILE = ${JSON.stringify(profile.source.text, null, 2)} as const;
export const POLICY_CANONICAL_JSON_PROFILE = ${JSON.stringify(profile.source.canonicalJson, null, 2)} as const;

type Schema = {
  readonly $ref?: string;
  readonly type?: string;
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly maxUtf8Bytes?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly maxProperties?: number;
  readonly maxCanonicalUtf8Bytes?: number;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | Schema;
  readonly propertyNames?: Schema;
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly items?: Schema;
  readonly oneOf?: readonly Schema[];
};

const definitions: Readonly<Record<string, Schema>> = ${JSON.stringify(definitions, null, 2)};

export function isPolicyNodeV1(value: unknown): value is PolicyNodeV1 {
  return validateDefinition("PolicyNodeV1", value);
}

export function isPolicyProgramV1(value: unknown): value is PolicyProgramV1 {
  return validateDefinition("PolicyProgramV1", value);
}

export function isPolicyContextV1(value: unknown): value is PolicyContextV1 {
  return validateDefinition("PolicyContextV1", value);
}

export function isPolicyDefinitionV1(value: unknown): value is PolicyDefinitionV1 {
  return validateDefinition("PolicyDefinitionV1", value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameJson(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(left[key], right[key]));
}

function validate(schema: Schema, value: unknown): boolean {
  if (schema.$ref !== undefined) {
    const definition = definitions[schema.$ref.slice("#/$defs/".length)];
    return definition !== undefined && validate(definition, value);
  }
  if (schema.oneOf !== undefined) {
    return schema.oneOf.filter((candidate) => validate(candidate, value)).length === 1;
  }
  if (Object.hasOwn(schema, "const") && !sameJson(value, schema.const)) return false;
  if (schema.enum !== undefined && !schema.enum.some((item) => sameJson(item, value))) return false;
  if (schema.type === "object") {
    if (!isRecord(value)) return false;
    const properties = schema.properties ?? {};
    if (schema.maxCanonicalUtf8Bytes !== undefined && new TextEncoder().encode(JSON.stringify(value)).byteLength > schema.maxCanonicalUtf8Bytes) return false;
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) return false;
    if (schema.propertyNames !== undefined && Object.keys(value).some((name) => !validate(schema.propertyNames!, name))) return false;
    if ((schema.required ?? []).some((name) => !Object.hasOwn(value, name))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((name) => !Object.hasOwn(properties, name))) return false;
    if (isRecord(schema.additionalProperties) && Object.entries(value).some(([name, child]) => !Object.hasOwn(properties, name) && !validate(schema.additionalProperties as Schema, child))) return false;
    return Object.entries(properties).every(([name, child]) => !Object.hasOwn(value, name) || validate(child, value[name]));
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return false;
    if (schema.minItems !== undefined && value.length < schema.minItems) return false;
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    if (schema.uniqueItems === true && value.some((item, index) => value.slice(0, index).some((candidate) => sameJson(candidate, item)))) return false;
    return schema.items === undefined || value.every((item) => validate(schema.items!, item));
  }
  if (schema.type === "string") {
    return typeof value === "string"
      && (schema.minLength === undefined || value.length >= schema.minLength)
      && (schema.maxLength === undefined || value.length <= schema.maxLength)
      && (schema.maxUtf8Bytes === undefined || new TextEncoder().encode(value).byteLength <= schema.maxUtf8Bytes)
      && (schema.pattern === undefined || new RegExp(schema.pattern, "u").test(value));
  }
  if (schema.type === "integer") {
    return Number.isSafeInteger(value)
      && (schema.minimum === undefined || Number(value) >= schema.minimum)
      && (schema.maximum === undefined || Number(value) <= schema.maximum);
  }
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value);
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "null") return value === null;
  return schema.type === undefined;
}

function validateDefinition(name: string, value: unknown): boolean {
  const definition = definitions[name];
  if (definition === undefined) throw new Error(\`missing generated Policy schema definition \${name}\`);
  return validate(definition, value);
}
`;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderValidatorTemplate(
  sourceDefinitions: JsonObject,
  contract: Contract,
): string {
  const definitions = sourceDefinitions;
  const path = "$" + "{path}";
  const validatorNames = [
    ...new Set([
      ...contract.operations.map((operation) => operation.output),
      ...contract.remote.procedures.map((procedure) => procedure.output),
    ]),
    "ErrorEnvelope",
    "RemoteErrorEnvelope",
    "OperationName",
  ];
  const validators = validatorNames
    .filter((name) => name !== "OperationName")
    .map(
      (name) =>
        `export function validate${name}(value: unknown): value is ${name} {\n  return validateDefinition(${JSON.stringify(name)}, value).length === 0;\n}`,
    )
    .join("\n\n");
  const inputValidators = [
    ...new Set([
      ...contract.operations.map((operation) => operation.input),
      ...contract.remote.procedures.map((procedure) => procedure.input),
    ]),
  ]
    .map(
      (input) =>
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

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { ${validatorNames.join(", ")} } from "./types.js";\n\nexport interface ValidationIssue {\n  readonly path: string;\n  readonly rule: string;\n}\n\ntype Schema = {\n  readonly $ref?: string;\n  readonly type?: string;\n  readonly const?: unknown;\n  readonly enum?: readonly unknown[];\n  readonly pattern?: string;\n  readonly minimum?: number;\n  readonly maximum?: number;\n  readonly minLength?: number;\n  readonly maxLength?: number;\n  readonly maxUtf8Bytes?: number;\n  readonly minItems?: number;\n  readonly maxItems?: number;\n  readonly uniqueItems?: boolean;\n  readonly maxProperties?: number;\n  readonly maxCanonicalUtf8Bytes?: number;\n  readonly required?: readonly string[];\n  readonly additionalProperties?: boolean | Schema;\n  readonly propertyNames?: Schema;\n  readonly properties?: Readonly<Record<string, Schema>>;\n  readonly items?: Schema;\n  readonly oneOf?: readonly Schema[];\n};\n\nconst definitions: Readonly<Record<string, Schema>> = ${JSON.stringify(definitions, null, 2)};\n\nfunction issue(path: string, rule: string): ValidationIssue[] {\n  return [{ path, rule }];\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction sameJson(left: unknown, right: unknown): boolean {\n  if (left === right) return true;\n  if (Array.isArray(left) && Array.isArray(right)) {\n    return left.length === right.length && left.every((item, index) => sameJson(item, right[index]));\n  }\n  if (!isRecord(left) || !isRecord(right)) return false;\n  const leftKeys = Object.keys(left).sort();\n  const rightKeys = Object.keys(right).sort();\n  return leftKeys.length === rightKeys.length\n    && leftKeys.every((key, index) => key === rightKeys[index] && sameJson(left[key], right[key]));\n}\n\nfunction utf8Length(value: string): number {\n  return new TextEncoder().encode(value).byteLength;\n}\n\nfunction validate(schema: Schema, value: unknown, path: string): ValidationIssue[] {\n  if (schema.$ref !== undefined) {\n    const name = schema.$ref.slice("#/$defs/".length);\n    const definition = definitions[name];\n    return definition === undefined ? issue(path, "unknown-reference") : validate(definition, value, path);\n  }\n  if (schema.oneOf !== undefined) {\n    const matches = schema.oneOf.filter((candidate) => validate(candidate, value, path).length === 0);\n    return matches.length === 1 ? [] : issue(path, "oneOf");\n  }\n  if (schema.const !== undefined && !sameJson(value, schema.const)) return issue(path, "const");\n  if (schema.enum !== undefined && !schema.enum.some((item) => sameJson(item, value))) return issue(path, "enum");\n\n  if (schema.type === "object") {\n    if (!isRecord(value)) return issue(path, "type");\n    const properties = schema.properties ?? {};\n    const names = Object.keys(value);\n    const issues: ValidationIssue[] = [];\n    if (schema.maxProperties !== undefined && names.length > schema.maxProperties) issues.push(...issue(path, "maxProperties"));\n    if (schema.maxCanonicalUtf8Bytes !== undefined && utf8Length(JSON.stringify(value)) > schema.maxCanonicalUtf8Bytes) issues.push(...issue(path, "maxCanonicalUtf8Bytes"));\n    for (const name of schema.required ?? []) {\n      if (!Object.hasOwn(value, name)) issues.push(...issue(\`${path}/\${name}\`, "required"));\n    }\n    for (const name of names) {\n      if (schema.propertyNames !== undefined && validate(schema.propertyNames, name, \`${path}/\${name}\`).length > 0) issues.push(...issue(\`${path}/\${name}\`, "propertyNames"));\n      if (!Object.hasOwn(properties, name)) {\n        if (schema.additionalProperties === false) issues.push(...issue(\`${path}/\${name}\`, "additionalProperties"));\n        else if (typeof schema.additionalProperties === "object") issues.push(...validate(schema.additionalProperties, value[name], \`${path}/\${name}\`));\n      }\n    }\n    for (const [name, child] of Object.entries(properties)) {\n      if (Object.hasOwn(value, name)) issues.push(...validate(child, value[name], \`${path}/\${name}\`));\n    }\n    return issues;
  }\n  if (schema.type === "array") {\n    if (!Array.isArray(value)) return issue(path, "type");\n    const issues: ValidationIssue[] = [];\n    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(...issue(path, "minItems"));\n    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push(...issue(path, "maxItems"));\n    if (schema.uniqueItems === true) {\n      if (value.some((item, index) => value.slice(0, index).some((candidate) => sameJson(candidate, item)))) issues.push(...issue(path, "uniqueItems"));\n    }\n    if (schema.items !== undefined) value.forEach((item, index) => issues.push(...validate(schema.items!, item, \`${path}/\${index}\`)));\n    return issues;\n  }\n  if (schema.type === "string") {\n    if (typeof value !== "string") return issue(path, "type");\n    if (schema.minLength !== undefined && value.length < schema.minLength) return issue(path, "minLength");\n    if (schema.maxLength !== undefined && value.length > schema.maxLength) return issue(path, "maxLength");\n    if (schema.maxUtf8Bytes !== undefined && utf8Length(value) > schema.maxUtf8Bytes) return issue(path, "maxUtf8Bytes");\n    if (schema.pattern !== undefined && !new RegExp(schema.pattern, "u").test(value)) return issue(path, "pattern");\n    return [];\n  }\n  if (schema.type === "integer") {\n    if (!Number.isSafeInteger(value)) return issue(path, "type");\n    if (schema.minimum !== undefined && Number(value) < schema.minimum) return issue(path, "minimum");\n    if (schema.maximum !== undefined && Number(value) > schema.maximum) return issue(path, "maximum");\n    return [];\n  }\n  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) ? [] : issue(path, "type");\n  if (schema.type === "boolean") return typeof value === "boolean" ? [] : issue(path, "type");\n  if (schema.type === "null") return value === null ? [] : issue(path, "type");\n  return schema.type === undefined ? [] : issue(path, "unsupported-type");\n}\n\nfunction validateDefinition(name: string, value: unknown): ValidationIssue[] {\n  const definition = definitions[name];\n  const issues = definition === undefined ? issue("", "unknown-definition") : validate(definition, value, "");\n  return issues.sort((left, right) =>\n    left.path.localeCompare(right.path) || left.rule.localeCompare(right.rule),\n  );\n}\n\n${validators}\n\n${inputIssues}\n`;
}

export function renderValidators(
  sourceDefinitions: JsonObject,
  contract: Contract,
): string {
  return renderValidatorTemplate(sourceDefinitions, contract);
}

export function renderClient(
  contract: Contract,
  digest: string,
  remoteDigest: string,
  fieldOrder: readonly string[],
): string {
  const sharedClient = renderClientSource(contract, digest)
    .replace(
      "\n\nexport interface KeynesClient",
      `\n\nexport const REMOTE_PROCEDURES_DIGEST = ${JSON.stringify(remoteDigest)};\nexport const REMOTE_CONTRACT = ${JSON.stringify(contract.remote, null, 2)} as const;\n\nconst resultFieldRank = new Map(${JSON.stringify(fieldOrder)}.map((field, index) => [field, index]));\n\nexport interface KeynesClient`,
    )
    .replace(
      "\n\nasync function invoke<Output>",
      `\n\nfunction orderResult<Value>(value: Value): Value {\n  if (Array.isArray(value)) return value.map(orderResult) as Value;\n  if (!isRecord(value)) return value;\n  return Object.fromEntries(\n    Object.entries(value)\n      .sort(([left], [right]) => {\n        const rank = (resultFieldRank.get(left) ?? Number.MAX_SAFE_INTEGER) - (resultFieldRank.get(right) ?? Number.MAX_SAFE_INTEGER);\n        return rank || left.localeCompare(right);\n      })\n      .map(([key, member]) => [key, orderResult(member)]),\n  ) as Value;\n}\n\nasync function invoke<Output>`,
    )
    .replace("return structuredClone(result);", "return orderResult(result);")
    .replace(
      "return structuredClone(wire.result);",
      "return orderResult(wire.result);",
    )
    .replace(
      'readonly code: ErrorEnvelope["code"];\n  readonly details: ErrorEnvelope["details"];\n\n  constructor(error: ErrorEnvelope)',
      'readonly code: (ErrorEnvelope | RemoteErrorEnvelope)["code"];\n  readonly details: (ErrorEnvelope | RemoteErrorEnvelope)["details"];\n\n  constructor(error: ErrorEnvelope | RemoteErrorEnvelope)',
    );
  return `${sharedClient.trimEnd()}\n\n${renderRemoteClientSource(contract)}\n`;
}

function renderClientSource(contract: Contract, digest: string): string {
  const typeNames = [
    ...new Set(
      [...contract.operations, ...contract.remote.procedures].flatMap(
        (operation) => [operation.input, operation.output],
      ),
    ),
    "ErrorEnvelope",
    "OperationName",
    "RemoteErrorEnvelope",
    "RemoteProcedureName",
  ];
  const validatorNames = [
    ...new Set([
      ...contract.operations.map((operation) => `validate${operation.output}`),
      ...contract.remote.procedures.flatMap((procedure) => [
        `validate${procedure.input}Issues`,
        `validate${procedure.output}`,
      ]),
    ]),
    "validateOperationInputIssues",
    "validateRemoteErrorEnvelope",
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

  return `// Generated by scripts/generate-contracts.ts. Do not edit.\n\nimport type { CommandExecutor } from "../command-executor.js";\nimport type { ${typeNames.join(", ")} } from "./types.js";\nimport { ${[...validatorNames, "validateErrorEnvelope"].join(", ")} } from "./validators.js";\nimport type { ValidationIssue } from "./validators.js";\n\nexport const CONTRACT_DIGEST = ${JSON.stringify(digest)};\n\nexport interface KeynesClient {\n${interfaceMethods}\n}\n\nexport class KeynesError extends Error {\n  readonly code: ErrorEnvelope["code"];\n  readonly details: ErrorEnvelope["details"];\n\n  constructor(error: ErrorEnvelope) {\n    super(error.code);\n    this.name = "KeynesError";\n    this.code = error.code;\n    this.details = error.details;\n  }\n}\n\ntype OutputValidator<Output> = (value: unknown) => value is Output;\n\ninterface Invocation<Output> {\n  readonly executor: CommandExecutor;\n  readonly operation: OperationName;\n  readonly input: unknown;\n  readonly validateOutput: OutputValidator<Output>;\n  readonly replay: boolean;\n}\n\nfunction isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === "object" && value !== null && !Array.isArray(value);\n}\n\nfunction invalidCommand(operation: OperationName, issues: readonly ValidationIssue[]): KeynesError {\n  const [first, ...rest] = issues;\n  if (first === undefined) throw new Error("invalid command has no validation issues");\n  return new KeynesError({\n    kind: "error",\n    code: "invalid_command",\n    details: { operation, issues: [first, ...rest] },\n  });\n}\n\nasync function invoke<Output>(invocation: Invocation<Output>): Promise<Output> {\n  const wire = await invocation.executor.execute(invocation.operation, invocation.input);\n  if (!isRecord(wire) || typeof wire.ok !== "boolean") {\n    throw new Error(\`invalid wire response for \${invocation.operation}\`);\n  }\n  if (wire.ok === false) {\n    if (!validateErrorEnvelope(wire.error)) {\n      throw new Error(\`invalid error response for \${invocation.operation}\`);\n    }\n    throw new KeynesError(wire.error);\n  }\n  if (typeof wire.replayed !== "boolean") {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  if (invocation.replay) {\n    if (!isRecord(wire.result)) {\n      throw new Error(\`invalid replayable result for \${invocation.operation}\`);\n    }\n    const result = { ...wire.result, replayed: wire.replayed };\n    if (!invocation.validateOutput(result)) {\n      throw new Error(\`invalid result response for \${invocation.operation}\`);\n    }\n    return structuredClone(result);\n  }\n  if (!invocation.validateOutput(wire.result)) {\n    throw new Error(\`invalid result response for \${invocation.operation}\`);\n  }\n  return structuredClone(wire.result);\n}\n\nexport function createKeynesClient(executor: CommandExecutor): KeynesClient {\n  return {\n${methods}\n  };\n}\n`;
}

function renderRemoteClientSource(contract: Contract): string {
  const interfaceMethods = contract.remote.procedures
    .map(
      (procedure) =>
        `  ${procedure.method}(input: ${procedure.input}): Promise<${procedure.output}>;`,
    )
    .join("\n");
  const methods = contract.remote.procedures
    .map(
      (procedure, index) =>
        `    async ${procedure.method}(input: ${procedure.input}): Promise<${procedure.output}> {\n      const procedure = REMOTE_CONTRACT.procedures[${index}];\n      const issues = validate${procedure.input}Issues(input);\n      if (issues.length > 0) {\n        throw invalidRemoteCommand(procedure.method, issues);\n      }\n      return invokeRemote({\n        executor,\n        procedure,\n        input,\n        validateOutput: validate${procedure.output},\n      });\n    },`,
    )
    .join("\n");

  return `export type RemoteProcedureDescriptor = (typeof REMOTE_CONTRACT.procedures)[number];

export interface RemoteCommandExecutor {
  execute(
    procedure: RemoteProcedureDescriptor,
    input: unknown,
  ): Promise<unknown>;
}

export interface RemoteKeynesClient {
${interfaceMethods}
}

interface RemoteInvocation<Output> {
  readonly executor: RemoteCommandExecutor;
  readonly procedure: RemoteProcedureDescriptor;
  readonly input: unknown;
  readonly validateOutput: OutputValidator<Output>;
}

function invalidRemoteCommand(
  operation: RemoteProcedureName,
  issues: readonly ValidationIssue[],
): KeynesError {
  const [first, ...rest] = issues;
  if (first === undefined) {
    throw new Error("invalid remote command has no validation issues");
  }
  return new KeynesError({
    kind: "error",
    code: "invalid_command",
    details: { operation, issues: [first, ...rest] },
  });
}

async function invokeRemote<Output>(
  invocation: RemoteInvocation<Output>,
): Promise<Output> {
  const wire = await invocation.executor.execute(
    invocation.procedure,
    invocation.input,
  );
  if (!isRecord(wire) || typeof wire.ok !== "boolean") {
    throw new Error(
      \`invalid remote wire response for \${invocation.procedure.method}\`,
    );
  }
  if (wire.ok === false) {
    if (validateRemoteErrorEnvelope(wire.error)) {
      throw new KeynesError(wire.error);
    }
    throw new Error(
      \`invalid remote error response for \${invocation.procedure.method}\`,
    );
  }
  if (!invocation.validateOutput(wire.result)) {
    throw new Error(
      \`invalid remote result response for \${invocation.procedure.method}\`,
    );
  }
  return orderResult(wire.result);
}

export function createRemoteKeynesClient(
  executor: RemoteCommandExecutor,
): RemoteKeynesClient {
  return {
${methods}
  };
}`;
}
