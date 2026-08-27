import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import canonicalize from "canonicalize";

export interface GeneratedDirectory {
  readonly path: string;
  readonly accepts: (fileName: string) => boolean;
}

export interface ApplyGeneratedOutputsOptions {
  readonly check: boolean;
  readonly outputRoot: string;
  readonly outputs: ReadonlyMap<string, string>;
  readonly generatedDirectories: readonly GeneratedDirectory[];
}

export function applyGeneratedOutputs(
  options: ApplyGeneratedOutputsOptions,
): void {
  const undeclared = listGeneratedFiles(
    options.outputRoot,
    options.generatedDirectories,
  ).filter((path) => !options.outputs.has(path));
  if (undeclared.length > 0)
    fail(`undeclared generated files: ${undeclared.join(", ")}`);

  const drift: string[] = [];
  for (const [path, contents] of options.outputs) {
    const absolute = resolve(options.outputRoot, path);
    if (options.check) {
      if (!existsSync(absolute) || readFileSync(absolute, "utf8") !== contents)
        drift.push(path);
      continue;
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  if (drift.length > 0) fail(`generated output drift: ${drift.join(", ")}`);
}

export function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function canonicalJson(value: unknown): string {
  const encoded = canonicalize(value);
  if (encoded === undefined) throw new Error("value cannot be canonicalized");
  return encoded;
}

function listGeneratedFiles(
  root: string,
  directories: readonly GeneratedDirectory[],
): string[] {
  return directories.flatMap(({ path, accepts }) => {
    const absolute = join(root, path);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { withFileTypes: true })
      .filter((entry) => entry.isFile() && accepts(entry.name))
      .map((entry) => join(path, entry.name));
  });
}

function fail(message: string): never {
  throw new Error(message);
}
