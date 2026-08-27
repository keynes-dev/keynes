import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateContracts } from "../scripts/generate.ts";
import { loadPolicyProfile } from "../src/load-policy-profile.ts";

const packageRoot = resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

const EXPECTED_NODE_ORDER = [
  "select",
  "inner_join",
  "cross_join",
  "decimal_literal",
  "text_literal",
  "boolean_literal",
  "null_literal",
  "reference",
  "unary_numeric",
  "binary_numeric",
  "comparison",
  "text_in",
  "is_null",
  "boolean_binary",
  "boolean_not",
  "case",
  "variadic",
  "numeric_function",
  "scale_function",
  "power",
  "aggregate",
] as const;

const EXPECTED_OPERATORS = [
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "is_null",
  "is_not_null",
  "and",
  "or",
  "not",
] as const;

const EXPECTED_FUNCTIONS = [
  "coalesce",
  "least",
  "greatest",
  "abs",
  "ceil",
  "floor",
  "round",
  "trunc",
  "sqrt",
  "power",
  "sum",
  "avg",
  "min",
  "max",
  "count",
] as const;

interface RequirementMutation {
  readonly name: string;
  readonly remove: (node: Record<string, unknown>) => void;
  readonly error: RegExp;
}

const REQUIREMENT_MUTATIONS = [
  {
    name: "TypeScript handling",
    remove(node) {
      delete requireRecord(
        requireRecord(node.backends, "node backends").typescript,
        "TypeScript backend",
      ).handler;
    },
    error: /policy profile node .*typescript.*handler/i,
  },
  {
    name: "PostgreSQL validation",
    remove(node) {
      delete requireRecord(
        requireRecord(node.backends, "node backends").postgresql,
        "PostgreSQL backend",
      ).validator;
    },
    error: /policy profile node .*postgresql.*validator/i,
  },
  {
    name: "PostgreSQL rendering",
    remove(node) {
      delete requireRecord(
        requireRecord(node.backends, "node backends").postgresql,
        "PostgreSQL backend",
      ).renderer;
    },
    error: /policy profile node .*postgresql.*renderer/i,
  },
  {
    name: "work cost",
    remove(node) {
      delete node.work;
    },
    error: /policy profile node .*work/i,
  },
  {
    name: "canonical vectors",
    remove(node) {
      delete node.vectors;
    },
    error: /policy profile node .*canonical vectors?/i,
  },
] satisfies readonly RequirementMutation[];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Policy profile generation", () => {
  it("pins the ordered v1 node, operator, and function inventory", () => {
    const profile = loadPolicyProfile(packageRoot);

    expect(profile.nodeKinds).toEqual(EXPECTED_NODE_ORDER);
    expect([
      ...new Set(
        profile.source.inventory.operators.flatMap(({ names }) => names),
      ),
    ]).toEqual(EXPECTED_OPERATORS);
    expect(
      profile.source.inventory.functions.flatMap(({ names }) => names),
    ).toEqual(EXPECTED_FUNCTIONS);
    const scale = profile.source.inventory.functions.find(({ names }) =>
      names.includes("round"),
    );
    expect(scale).toMatchObject({
      names: ["round", "trunc"],
      sourceArity: { minimum: 1, maximum: 2 },
      normalizedArity: 2,
      defaults: [{ position: 1, value: 0 }],
    });
  });

  it.each([
    [
      "top-level",
      (profile: Record<string, unknown>) => {
        profile.unknown = true;
      },
    ],
    [
      "node",
      (profile: Record<string, unknown>) => {
        requireRecord(
          requireRecord(profile.nodes, "nodes").select,
          "select",
        ).unknown = true;
      },
    ],
    [
      "descriptor",
      (profile: Record<string, unknown>) => {
        requireRecord(
          requireRecord(
            requireRecord(
              requireRecord(profile.nodes, "nodes").select,
              "select",
            ).fields,
            "fields",
          ).where,
          "where",
        ).unknown = true;
      },
    ],
    [
      "vector",
      (profile: Record<string, unknown>) => {
        const vectors = requireRecord(
          requireRecord(profile.nodes, "nodes").select,
          "select",
        ).vectors;
        if (!Array.isArray(vectors))
          throw new Error("vectors must be an array");
        requireRecord(vectors[0], "vector").unknown = true;
      },
    ],
    [
      "signature",
      (profile: Record<string, unknown>) => {
        const operators = requireRecord(
          profile.inventory,
          "inventory",
        ).operators;
        if (!Array.isArray(operators))
          throw new Error("operators must be an array");
        requireRecord(operators[0], "signature").unknown = true;
      },
    ],
  ] as const)("rejects unknown %s fields", async (_name, mutate) => {
    const repositoryRoot = copyContractRepository();
    const profile = readPolicyProfile(repositoryRoot);
    mutate(profile);
    writePolicyProfileDocument(repositoryRoot, profile);

    await expect(
      generateContracts({ check: false, repositoryRoot }),
    ).rejects.toThrow(/unknown fields/i);
  });

  it("rejects a deleted v1 node", async () => {
    const repositoryRoot = copyContractRepository();
    const profile = readPolicyProfile(repositoryRoot);
    delete requireRecord(profile.nodes, "nodes").power;
    writePolicyProfileDocument(repositoryRoot, profile);

    await expect(
      generateContracts({ check: false, repositoryRoot }),
    ).rejects.toThrow(/declared order/i);
  });

  it("changes identity when the explicit node order changes", () => {
    const repositoryRoot = copyContractRepository();
    const profile = readPolicyProfile(repositoryRoot);
    const inventory = requireRecord(profile.inventory, "inventory");
    const order = inventory.nodeOrder;
    if (!Array.isArray(order)) throw new Error("nodeOrder must be an array");
    const reversed = [...order].reverse();
    inventory.nodeOrder = reversed;
    const nodes = requireRecord(profile.nodes, "nodes");
    profile.nodes = Object.fromEntries(
      reversed.map((kind) => {
        if (typeof kind !== "string")
          throw new Error("node kind must be a string");
        return [kind, nodes[kind]];
      }),
    );
    writePolicyProfileDocument(repositoryRoot, profile);

    const original = loadPolicyProfile(packageRoot);
    const reordered = loadPolicyProfile(
      join(repositoryRoot, "packages/contracts"),
    );
    expect(reordered.nodeKinds).toEqual([...original.nodeKinds].reverse());
    expect(reordered.digest).not.toBe(original.digest);
  });

  it("rejects grouped enum/signature drift", async () => {
    const repositoryRoot = copyContractRepository();
    const profile = readPolicyProfile(repositoryRoot);
    const numericFunction = requireRecord(
      requireRecord(
        requireRecord(profile.nodes, "nodes").numeric_function,
        "numeric_function",
      ).fields,
      "fields",
    );
    requireRecord(numericFunction.function, "function").values = ["abs"];
    writePolicyProfileDocument(repositoryRoot, profile);

    await expect(
      generateContracts({ check: false, repositoryRoot }),
    ).rejects.toThrow(/enum must match.*signatures/i);
  });

  it("rejects a canonical vector for another node or without expected structure", async () => {
    const repositoryRoot = copyContractRepository();
    const profile = readPolicyProfile(repositoryRoot);
    const power = requireRecord(
      requireRecord(profile.nodes, "nodes").power,
      "power",
    );
    power.vectors = [
      { name: "wrong", input: { kind: "null_literal" }, expected: {} },
    ];
    writePolicyProfileDocument(repositoryRoot, profile);

    await expect(
      generateContracts({ check: false, repositoryRoot }),
    ).rejects.toThrow(/input kind must be power|expected must not be empty/i);
  });

  it("declares every backend responsibility for every Policy node", () => {
    const nodes = readPolicyNodes(packageRoot);
    const entries = Object.entries(nodes);
    expect(entries.length).toBeGreaterThan(0);

    for (const [kind, value] of entries) {
      const node = requireRecord(value, `Policy profile node ${kind}`);
      const backends = requireRecord(
        node.backends,
        `Policy profile node ${kind} backends`,
      );
      const typescript = requireRecord(
        backends.typescript,
        `Policy profile node ${kind} TypeScript backend`,
      );
      const postgresql = requireRecord(
        backends.postgresql,
        `Policy profile node ${kind} PostgreSQL backend`,
      );
      const work = requireRecord(
        node.work,
        `Policy profile node ${kind} work cost`,
      );

      expect(typescript.handler, `${kind} TypeScript handler`).toBeTypeOf(
        "string",
      );
      expect(postgresql.validator, `${kind} PostgreSQL validator`).toBeTypeOf(
        "string",
      );
      expect(postgresql.renderer, `${kind} PostgreSQL renderer`).toBeTypeOf(
        "string",
      );
      expect(Object.keys(work), `${kind} work cost`).not.toHaveLength(0);
      expect(Array.isArray(node.vectors), `${kind} canonical vectors`).toBe(
        true,
      );
      if (!Array.isArray(node.vectors)) continue;
      expect(node.vectors, `${kind} canonical vectors`).not.toHaveLength(0);
    }
  });

  it.each(REQUIREMENT_MUTATIONS)(
    "rejects a node without $name",
    async ({ remove, error }) => {
      const repositoryRoot = copyContractRepository();
      const nodes = readPolicyNodes(join(repositoryRoot, "packages/contracts"));
      const target = Object.entries(nodes).at(-1);
      if (target === undefined) {
        throw new Error("Policy profile must declare at least one node");
      }
      const [kind, value] = target;
      const node = requireRecord(value, `Policy profile node ${kind}`);
      remove(node);
      writePolicyProfile(repositoryRoot, nodes);

      await expect(
        generateContracts({ check: false, repositoryRoot }),
      ).rejects.toThrow(error);
    },
  );
});

function readPolicyNodes(contractRoot: string): Record<string, unknown> {
  const path = join(contractRoot, "policy-profile.json");
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const profile = requireRecord(parsed, "Policy profile");
  return requireRecord(profile.nodes, "Policy profile nodes");
}

function readPolicyProfile(repositoryRoot: string): Record<string, unknown> {
  const path = join(repositoryRoot, "packages/contracts/policy-profile.json");
  return requireRecord(
    JSON.parse(readFileSync(path, "utf8")),
    "Policy profile",
  );
}

function writePolicyProfileDocument(
  repositoryRoot: string,
  profile: Record<string, unknown>,
): void {
  const path = join(repositoryRoot, "packages/contracts/policy-profile.json");
  writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`);
}

function writePolicyProfile(
  repositoryRoot: string,
  nodes: Record<string, unknown>,
): void {
  const profile = readPolicyProfile(repositoryRoot);
  profile.nodes = nodes;
  writePolicyProfileDocument(repositoryRoot, profile);
}

function copyContractRepository(): string {
  const repositoryRoot = mkdtempSync(
    join(tmpdir(), "keynes-policy-generation-"),
  );
  temporaryDirectories.push(repositoryRoot);
  const packagesRoot = join(repositoryRoot, "packages");
  mkdirSync(packagesRoot, { recursive: true });
  cpSync(packageRoot, join(packagesRoot, "contracts"), { recursive: true });
  return repositoryRoot;
}

function requireRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
