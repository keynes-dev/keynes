import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import {
  assertDeclaration,
  type DeepReadonly,
  type ParameterDeclaration,
  type ParameterDefinition,
} from "./parameters.ts";
export type ParameterSnapshot<V> = Readonly<{
  formatVersion: 1;
  definition: ParameterDefinition;
  definitionId: string;
  values: DeepReadonly<V>;
  snapshotId: string;
}>;
export function contentId(value: unknown): string {
  const bytes = canonicalize(value);
  if (bytes === undefined) throw new TypeError("Expected canonical JSON");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}
export function createParameterSnapshot<V>(
  declaration: ParameterDeclaration<V>,
): ParameterSnapshot<V> {
  assertDeclaration(declaration);
  const definitionId = contentId(declaration.definition);
  const values = declaration.initials;
  return Object.freeze({
    formatVersion: 1 as const,
    definition: declaration.definition,
    definitionId,
    values,
    snapshotId: contentId({ formatVersion: 1, definitionId, values }),
  });
}
