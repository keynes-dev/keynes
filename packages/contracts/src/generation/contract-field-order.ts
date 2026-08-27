import type { JsonObject } from "../model.ts";

export function contractFieldOrder(definitions: JsonObject): readonly string[] {
  const edges = new Map<string, Set<string>>();
  const fields = new Set<string>();
  for (const definition of Object.values(definitions)) {
    if (!isRecord(definition) || !isRecord(definition.properties)) continue;
    const names = Object.keys(definition.properties);
    for (const name of names) fields.add(name);
    for (let index = 1; index < names.length; index += 1) {
      const before = names[index - 1]!;
      const after = names[index]!;
      const successors = edges.get(before) ?? new Set<string>();
      successors.add(after);
      edges.set(before, successors);
    }
  }

  const incoming = new Map([...fields].map((field) => [field, 0]));
  for (const successors of edges.values()) {
    for (const successor of successors) {
      incoming.set(successor, (incoming.get(successor) ?? 0) + 1);
    }
  }
  const ready = [...fields].filter((field) => incoming.get(field) === 0).sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const field = ready.shift()!;
    ordered.push(field);
    for (const successor of edges.get(field) ?? []) {
      const remaining = (incoming.get(successor) ?? 0) - 1;
      incoming.set(successor, remaining);
      if (remaining === 0) {
        ready.push(successor);
        ready.sort();
      }
    }
  }
  if (ordered.length !== fields.size) {
    fail("contract object property order contains a cycle");
  }
  return ordered;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new Error(message);
}
