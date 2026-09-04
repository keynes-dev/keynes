import type { JsonObject } from "../model.ts";

export function contractFieldOrder(definitions: JsonObject): readonly string[] {
  const fields = new Set<string>();
  for (const definition of Object.values(definitions)) {
    if (!isRecord(definition) || !isRecord(definition.properties)) continue;
    for (const name of Object.keys(definition.properties)) fields.add(name);
  }
  return [...fields].sort();
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
