import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import canonicalize from "canonicalize";

import {
  PROFILE_LIMITS,
  PROFILE_VERSIONS,
} from "./policy-profile/constants.ts";
import {
  parseInventory,
  validateInventory,
} from "./policy-profile/inventory.ts";
import { parseNodeProfile } from "./policy-profile/node.ts";
import {
  fail,
  requireExactKeys,
  requireInteger,
  requireNumberRecord,
  requireObject,
  requireOrderedKeys,
  requireString,
  requireStringArray,
} from "./policy-profile/validation.ts";
import type { LoadedPolicyProfile, PolicyProfileSource } from "./model.ts";

export function loadPolicyProfile(sourceRoot: string): LoadedPolicyProfile {
  const parsed: unknown = JSON.parse(
    readFileSync(join(sourceRoot, "policy-profile.json"), "utf8"),
  );
  const source = parsePolicyProfile(parsed);
  const encoded = canonicalize(source);
  if (encoded === undefined) {
    fail("policy profile contains a value that cannot be canonicalized");
  }
  return {
    source,
    digest: createHash("sha256").update(encoded).digest("hex"),
    nodeKinds: source.inventory.nodeOrder,
  };
}

function parsePolicyProfile(value: unknown): PolicyProfileSource {
  const profile = requireObject(value, "policy profile");
  requireExactKeys(
    profile,
    [
      "schemaVersion",
      "versions",
      "numeric",
      "text",
      "canonicalJson",
      "limits",
      "inventory",
      "nodes",
    ],
    "policy profile",
  );
  const versions = requireObject(profile.versions, "policy profile versions");
  requireExactKeys(
    versions,
    Object.keys(PROFILE_VERSIONS),
    "policy profile versions",
  );
  const numeric = requireObject(profile.numeric, "policy numeric profile");
  requireExactKeys(
    numeric,
    ["precision", "scale", "rounding", "maximumSafeInteger"],
    "policy numeric profile",
  );
  const text = requireObject(profile.text, "policy text profile");
  requireExactKeys(
    text,
    ["maximumUtf8Bytes", "forbiddenCodePoints", "comparison"],
    "policy text profile",
  );
  const canonicalJsonProfile = requireObject(
    profile.canonicalJson,
    "policy canonical JSON profile",
  );
  requireExactKeys(
    canonicalJsonProfile,
    ["scalars", "arrays", "objectKeys"],
    "policy canonical JSON profile",
  );
  const limits = requireNumberRecord(profile.limits, "policy profile limits");
  const inventory = parseInventory(profile.inventory);
  const rawNodes = requireObject(profile.nodes, "policy profile nodes");
  requireOrderedKeys(rawNodes, inventory.nodeOrder, "policy profile nodes");
  const nodes = Object.fromEntries(
    inventory.nodeOrder.map((kind) => {
      if (!/^[a-z][a-z0-9_]*$/.test(kind)) {
        fail(`policy profile node kind ${kind} is not canonical`);
      }
      return [kind, parseNodeProfile(kind, rawNodes[kind])];
    }),
  );
  if (Object.keys(nodes).length === 0) {
    fail("policy profile must declare at least one node");
  }
  const schemaVersion = requireString(
    profile,
    "schemaVersion",
    "policy profile",
  );
  if (schemaVersion !== "keynes-policy-profile/v1") {
    fail("policy profile schemaVersion must be keynes-policy-profile/v1");
  }
  for (const [key, expected] of Object.entries(PROFILE_VERSIONS)) {
    const actual = requireString(versions, key, "policy profile versions");
    if (actual !== expected) {
      fail(`policy profile ${key} version must be ${expected}`);
    }
  }
  const precision = requireInteger(numeric, "precision", "numeric profile");
  const scale = requireInteger(numeric, "scale", "numeric profile");
  const rounding = requireString(numeric, "rounding", "numeric profile");
  const maximumSafeInteger = requireInteger(
    numeric,
    "maximumSafeInteger",
    "numeric profile",
  );
  if (
    precision !== 38 ||
    scale !== 18 ||
    rounding !== "half_away_from_zero" ||
    maximumSafeInteger !== Number.MAX_SAFE_INTEGER
  ) {
    fail(
      "policy numeric profile must be numeric(38,18) with exact safe integers",
    );
  }
  if (
    Object.keys(limits).length !== Object.keys(PROFILE_LIMITS).length ||
    Object.entries(PROFILE_LIMITS).some(
      ([name, expected]) => limits[name] !== expected,
    )
  ) {
    fail("policy profile limits must match keynes-policy-limits/v1");
  }
  const maximumUtf8Bytes = requireInteger(
    text,
    "maximumUtf8Bytes",
    "policy text profile",
  );
  const forbiddenCodePoints = requireStringArray(
    text.forbiddenCodePoints,
    "policy text profile forbiddenCodePoints",
  );
  const comparison = requireString(text, "comparison", "policy text profile");
  if (
    maximumUtf8Bytes !== 256 ||
    forbiddenCodePoints.length !== 1 ||
    forbiddenCodePoints[0] !== "U+0000" ||
    comparison !== "bytewise_C"
  ) {
    fail(
      "policy text profile must use bounded Unicode and bytewise C comparison",
    );
  }
  const scalars = requireStringArray(
    canonicalJsonProfile.scalars,
    "policy canonical JSON scalar types",
  );
  const arrays = requireString(
    canonicalJsonProfile,
    "arrays",
    "policy canonical JSON profile",
  );
  const objectKeys = requireString(
    canonicalJsonProfile,
    "objectKeys",
    "policy canonical JSON profile",
  );
  if (
    scalars.join(",") !== "null,boolean,safe_integer,string" ||
    arrays !== "preserve_order" ||
    objectKeys !== "sorted_ascii"
  ) {
    fail("policy canonical JSON profile must match keynes-policy-profile/v1");
  }
  validateInventory(inventory, nodes);
  return {
    schemaVersion,
    versions: {
      program: PROFILE_VERSIONS.program,
      query: PROFILE_VERSIONS.query,
      validator: PROFILE_VERSIONS.validator,
      limits: PROFILE_VERSIONS.limits,
    },
    numeric: { precision, scale, rounding, maximumSafeInteger },
    text: { maximumUtf8Bytes, forbiddenCodePoints, comparison },
    canonicalJson: { scalars, arrays, objectKeys },
    limits,
    inventory,
    nodes,
  };
}
