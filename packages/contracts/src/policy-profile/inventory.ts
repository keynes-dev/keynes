import type {
  PolicyNodeProfile,
  PolicyProfileInventory,
  PolicySemanticSignature,
} from "../model.ts";
import {
  fail,
  requireExactKeys,
  requireInteger,
  requireNonEmptyUniqueStrings,
  requireNumber,
  requireObject,
  requirePolicyScalar,
  requireString,
} from "./validation.ts";

export function parseInventory(value: unknown): PolicyProfileInventory {
  const inventory = requireObject(value, "policy profile inventory");
  requireExactKeys(
    inventory,
    ["nodeOrder", "operators", "functions"],
    "policy profile inventory",
  );
  const nodeOrder = requireNonEmptyUniqueStrings(
    inventory.nodeOrder,
    "policy profile node order",
  );
  return {
    nodeOrder,
    operators: parseSignatures(inventory.operators, "operator"),
    functions: parseSignatures(inventory.functions, "function"),
  };
}

function parseSignatures(
  value: unknown,
  family: "operator" | "function",
): readonly PolicySemanticSignature[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`policy profile ${family} signatures must be a non-empty array`);
  }
  return value.map((entry, index) => {
    const description = `policy profile ${family} signature ${index}`;
    const signature = requireObject(entry, description);
    requireExactKeys(
      signature,
      [
        "node",
        "names",
        "sourceArity",
        "normalizedArity",
        "operandTypes",
        "resultTypes",
        "nullBehavior",
        "numericBoundary",
        "defaults",
        "postgresqlSignatures",
      ],
      description,
    );
    const sourceArity = requireObject(
      signature.sourceArity,
      `${description} sourceArity`,
    );
    requireExactKeys(
      sourceArity,
      ["minimum", "maximum"],
      `${description} sourceArity`,
    );
    const minimum = requireInteger(
      sourceArity,
      "minimum",
      `${description} sourceArity`,
    );
    const maximum = requireInteger(
      sourceArity,
      "maximum",
      `${description} sourceArity`,
    );
    if (minimum < 1 || maximum < minimum || maximum > 64) {
      fail(`${description} sourceArity is invalid`);
    }
    const rawNormalizedArity = signature.normalizedArity;
    if (
      rawNormalizedArity !== "source" &&
      (!Number.isSafeInteger(rawNormalizedArity) ||
        Number(rawNormalizedArity) < minimum ||
        Number(rawNormalizedArity) > maximum)
    ) {
      fail(`${description} normalizedArity is invalid`);
    }
    const normalizedArity =
      rawNormalizedArity === "source"
        ? rawNormalizedArity
        : requireNumber(rawNormalizedArity);
    const defaults = parseDefaults(signature.defaults, description);
    if (
      typeof normalizedArity === "number" &&
      defaults.length !== normalizedArity - minimum
    ) {
      fail(`${description} defaults must fill omitted source arguments`);
    }
    if (
      typeof normalizedArity === "number" &&
      defaults.some(
        ({ position }) => position < minimum || position >= normalizedArity,
      )
    ) {
      fail(`${description} default position is invalid`);
    }
    if (
      new Set(defaults.map(({ position }) => position)).size !== defaults.length
    ) {
      fail(`${description} default positions must be unique`);
    }
    return {
      node: requireString(signature, "node", description),
      names: requireNonEmptyUniqueStrings(
        signature.names,
        `${description} names`,
      ),
      sourceArity: { minimum, maximum },
      normalizedArity,
      operandTypes: requireNonEmptyUniqueStrings(
        signature.operandTypes,
        `${description} operandTypes`,
      ),
      resultTypes: requireNonEmptyUniqueStrings(
        signature.resultTypes,
        `${description} resultTypes`,
      ),
      nullBehavior: requireString(signature, "nullBehavior", description),
      numericBoundary: requireString(signature, "numericBoundary", description),
      defaults,
      postgresqlSignatures: requireNonEmptyUniqueStrings(
        signature.postgresqlSignatures,
        `${description} postgresqlSignatures`,
      ),
    };
  });
}

function parseDefaults(
  value: unknown,
  description: string,
): readonly {
  readonly position: number;
  readonly value: string | boolean | number | null;
}[] {
  if (!Array.isArray(value)) fail(`${description} defaults must be an array`);
  return value.map((entry, index) => {
    const itemDescription = `${description} default ${index}`;
    const item = requireObject(entry, itemDescription);
    requireExactKeys(item, ["position", "value"], itemDescription);
    const position = requireInteger(item, "position", itemDescription);
    const member = requirePolicyScalar(item.value, itemDescription);
    return { position, value: member };
  });
}

export function validateInventory(
  inventory: PolicyProfileInventory,
  nodes: Readonly<Record<string, PolicyNodeProfile>>,
): void {
  for (const family of ["operators", "functions"] as const) {
    const field = family === "operators" ? "operator" : "function";
    const signatures = inventory[family];
    for (const signature of signatures) {
      const node = nodes[signature.node];
      if (node === undefined || node.category !== "expression") {
        fail(
          `policy profile ${family} signature node ${signature.node} is invalid`,
        );
      }
      if (field in node.fields) {
        const descriptor = requireObject(
          node.fields[field],
          `policy profile node ${signature.node} field ${field}`,
        );
        if (descriptor.type !== "enum") {
          fail(
            `policy profile node ${signature.node} field ${field} must be an enum`,
          );
        }
      }
    }
    const grouped = new Map<string, string[]>();
    for (const signature of signatures) {
      grouped.set(signature.node, [
        ...(grouped.get(signature.node) ?? []),
        ...signature.names,
      ]);
    }
    for (const [kind, node] of Object.entries(nodes)) {
      if (!(field in node.fields)) continue;
      const descriptor = requireObject(
        node.fields[field],
        `policy profile node ${kind} field ${field}`,
      );
      const actual = requireNonEmptyUniqueStrings(
        descriptor.values,
        `policy profile node ${kind} field ${field} values`,
      );
      const declared = grouped.get(kind);
      if (declared === undefined || actual.join("\0") !== declared.join("\0")) {
        fail(
          `policy profile node ${kind} ${field} enum must match ${family} signatures`,
        );
      }
    }
  }
}
