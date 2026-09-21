// Generated from packages/database/src/resource-definitions.ts. Do not edit.
import type { DefineResourceTypeCommand, ErrorEnvelope } from "./types.js";

export class DomainFailure extends Error {
  readonly envelope: ErrorEnvelope;

  constructor(envelope: ErrorEnvelope) {
    super(envelope.code);
    this.envelope = envelope;
  }
}

export function canonicalDefinitions(
  definitions: unknown,
  operation:
    | "defineResources"
    | "createBudget"
    | "validateResources" = "defineResources",
  basePath = "$.definitions",
): {
  key: string;
  definition: DefineResourceTypeCommand["definition"];
}[] {
  const invalid = (path: string, rule: string): never =>
    fail({
      kind: "error",
      code: "invalid_command",
      details: { operation, issues: [{ path, rule }] },
    });
  if (!isRecord(definitions)) return invalid(basePath, "type");
  const entries = Object.entries(definitions);
  if (entries.length === 0) return invalid(basePath, "minProperties");
  return entries
    .map(([key, value]) => {
      const path = `${basePath}.${key}`;
      if (!/^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/.test(key))
        return invalid(path, "pattern");
      const canonicalName = key.replaceAll(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      if (canonicalName.length > 63) return invalid(path, "maxLength");
      if (!isRecord(value)) return invalid(path, "type");
      for (const field of Object.keys(value)) {
        if (field !== "unit" && field !== "accountingBehavior")
          return invalid(`${path}.${field}`, "additionalProperties");
      }
      if (
        !Object.hasOwn(value, "unit") ||
        !Object.hasOwn(value, "accountingBehavior")
      )
        return invalid(path, "required");
      const { unit, accountingBehavior } = value;
      if (
        typeof unit !== "string" ||
        unit.length < 1 ||
        [...unit].length > 64 ||
        // oxlint-disable-next-line no-control-regex -- Mirrors the canonical Resource unit schema.
        !/^(?!\s)(?!.*\s$)[^\u0000-\u001f\u007f]+$/.test(unit)
      )
        return invalid(`${path}.unit`, "pattern");
      if (
        accountingBehavior !== "consumable" &&
        accountingBehavior !== "reusable"
      )
        return invalid(`${path}.accountingBehavior`, "enum");
      return {
        key,
        definition: {
          canonicalName,
          unit,
          accountingBehavior,
        } satisfies DefineResourceTypeCommand["definition"],
      };
    })
    .sort((left, right) =>
      compareText(
        left.definition.canonicalName,
        right.definition.canonicalName,
      ),
    );
}

export function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function fail(envelope: ErrorEnvelope): never {
  throw new DomainFailure(envelope);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
