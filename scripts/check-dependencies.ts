import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { init, parse } from "es-module-lexer";

type PackageManifest = {
  name: string;
  dependencies?: Record<string, string>;
};

type Workspace = {
  path: string;
  manifest: PackageManifest;
  imports: ImportRecord[];
};

type ImportRecord = {
  file: string;
  specifier: string;
};

export async function checkDependencies(
  root: string,
  workspacePaths: string[] = ["sdk", "cloud"],
): Promise<string[]> {
  const workspaces = await Promise.all(
    workspacePaths.map((workspacePath) => loadWorkspace(root, workspacePath)),
  );
  const byName = new Map(
    workspaces.map((workspace) => [workspace.manifest.name, workspace]),
  );
  const diagnostics: string[] = [];

  for (const workspace of workspaces) {
    const dependencies = workspace.manifest.dependencies ?? {};

    for (const imported of workspace.imports) {
      if (isScriptsImport(imported, root)) {
        diagnostics.push(
          `DEP004_SCRIPTS_RUNTIME: ${workspace.manifest.name} production source imports ${imported.specifier}`,
        );
      }

      const targetName = workspaceNameForImport(
        imported,
        root,
        workspace,
        workspaces,
      );
      if (targetName === undefined) {
        continue;
      }

      if (imported.specifier !== targetName) {
        diagnostics.push(
          `DEP003_PRIVATE_IMPORT: ${workspace.manifest.name} imports private path ${imported.specifier}`,
        );
      }

      if (dependencies[targetName] === undefined) {
        diagnostics.push(
          `DEP001_UNDECLARED_WORKSPACE: ${workspace.manifest.name} imports ${targetName} without declaring it`,
        );
      }
    }

    for (const dependencyName of Object.keys(dependencies)) {
      if (byName.has(dependencyName)) {
        diagnostics.push(
          `DEP002_FORBIDDEN_DIRECTION: ${workspace.manifest.name} must not depend on ${dependencyName}`,
        );
      }
    }
  }

  const cycle = findCycle(workspaces, byName);
  if (cycle !== undefined) {
    diagnostics.push(
      `DEP005_CYCLE: workspace dependency cycle ${cycle.join(" -> ")}`,
    );
  }

  return [...new Set(diagnostics)].sort();
}

async function loadWorkspace(
  root: string,
  workspacePath: string,
): Promise<Workspace> {
  const absolutePath = join(root, workspacePath);
  const manifest = JSON.parse(
    await readFile(join(absolutePath, "package.json"), "utf8"),
  ) as PackageManifest;
  const sourceRoot = join(absolutePath, "src");
  const sourceFiles = await collectTypeScriptFiles(sourceRoot);
  const imports: ImportRecord[] = [];

  for (const file of sourceFiles) {
    if (
      file.endsWith(".test.ts") ||
      file.endsWith(".spec.ts") ||
      file.includes(`${sep}__tests__${sep}`)
    ) {
      continue;
    }
    const specifiers = await extractImports(await readFile(file, "utf8"));
    imports.push(...specifiers.map((specifier) => ({ file, specifier })));
  }

  return { path: workspacePath, manifest, imports };
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
    } else if (entry.isFile() && extname(entry.name) === ".ts") {
      files.push(path);
    }
  }

  return files.sort();
}

async function extractImports(source: string): Promise<string[]> {
  await init;
  const [imports] = parse(source);
  const moduleSpecifiers = imports
    .map((imported) => imported.n)
    .filter((specifier): specifier is string => specifier !== undefined);
  return [
    ...new Set([...moduleSpecifiers, ...extractTypeOnlyReexports(source)]),
  ];
}

type Token =
  | { kind: "identifier"; value: string }
  | { kind: "punctuation"; value: string }
  | { kind: "string"; value: string };

function extractTypeOnlyReexports(source: string): string[] {
  const tokens = tokenize(source);
  const specifiers: string[] = [];

  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (
      tokens[index]?.kind !== "identifier" ||
      tokens[index]?.value !== "export" ||
      tokens[index + 1]?.kind !== "identifier" ||
      tokens[index + 1]?.value !== "type"
    ) {
      continue;
    }

    for (let cursor = index + 2; cursor < tokens.length - 1; cursor += 1) {
      const token = tokens[cursor];
      if (token?.kind === "punctuation" && token.value === ";") {
        break;
      }
      if (
        token?.kind === "identifier" &&
        token.value === "from" &&
        tokens[cursor + 1]?.kind === "string"
      ) {
        specifiers.push(tokens[cursor + 1].value);
        break;
      }
    }
  }

  return specifiers;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "/" && next === "/") {
      index = skipLineComment(source, index + 2);
      continue;
    }
    if (character === "/" && next === "*") {
      index = skipBlockComment(source, index + 2);
      continue;
    }
    if (character === '"' || character === "'") {
      const parsed = readStringToken(source, index, character);
      tokens.push({ kind: "string", value: parsed.value });
      index = parsed.end;
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(source, index + 1);
      continue;
    }
    if (character !== undefined && /[A-Za-z_$]/.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && /[\w$]/.test(source[index] ?? "")) {
        index += 1;
      }
      tokens.push({ kind: "identifier", value: source.slice(start, index) });
      continue;
    }
    if (character !== undefined && "{}*;,".includes(character)) {
      tokens.push({ kind: "punctuation", value: character });
    }
    index += 1;
  }

  return tokens;
}

function skipLineComment(source: string, index: number): number {
  const newline = source.indexOf("\n", index);
  return newline === -1 ? source.length : newline + 1;
}

function skipBlockComment(source: string, index: number): number {
  const end = source.indexOf("*/", index);
  return end === -1 ? source.length : end + 2;
}

function skipTemplateLiteral(source: string, index: number): number {
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
    } else if (source[index] === "`") {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return source.length;
}

function readStringToken(
  source: string,
  index: number,
  quote: string,
): { value: string; end: number } {
  let value = "";
  index += 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\" && index + 1 < source.length) {
      value += source[index + 1];
      index += 2;
    } else if (character === quote) {
      return { value, end: index + 1 };
    } else {
      value += character;
      index += 1;
    }
  }
  return { value, end: source.length };
}

function workspaceNameForImport(
  imported: ImportRecord,
  root: string,
  sourceWorkspace: Workspace,
  workspaces: Workspace[],
): string | undefined {
  for (const workspace of workspaces) {
    if (workspace === sourceWorkspace) {
      continue;
    }
    const name = workspace.manifest.name;
    if (
      imported.specifier === name ||
      imported.specifier.startsWith(`${name}/`)
    ) {
      return name;
    }

    if (imported.specifier.startsWith(".")) {
      const target = resolve(dirname(imported.file), imported.specifier);
      const workspaceRoot = resolve(root, workspace.path);
      if (
        target === workspaceRoot ||
        target.startsWith(`${workspaceRoot}${sep}`)
      ) {
        return name;
      }
    }
  }
  return undefined;
}

function isScriptsImport(imported: ImportRecord, root: string): boolean {
  if (!imported.specifier.startsWith(".")) {
    return false;
  }
  const target = resolve(dirname(imported.file), imported.specifier);
  const scriptsRoot = resolve(root, "scripts");
  return target === scriptsRoot || target.startsWith(`${scriptsRoot}${sep}`);
}

function findCycle(
  workspaces: Workspace[],
  byName: Map<string, Workspace>,
): string[] | undefined {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(name: string, path: string[]): string[] | undefined {
    if (visiting.has(name)) {
      const start = path.indexOf(name);
      return [...path.slice(start), name];
    }
    if (visited.has(name)) {
      return undefined;
    }

    visiting.add(name);
    const workspace = byName.get(name);
    for (const dependency of Object.keys(
      workspace?.manifest.dependencies ?? {},
    )) {
      if (!byName.has(dependency)) {
        continue;
      }
      const cycle = visit(dependency, [...path, name]);
      if (cycle !== undefined) {
        return cycle;
      }
    }
    visiting.delete(name);
    visited.add(name);
    return undefined;
  }

  for (const workspace of workspaces) {
    const cycle = visit(workspace.manifest.name, []);
    if (cycle !== undefined) {
      return cycle;
    }
  }

  return undefined;
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return (
    entrypoint !== undefined &&
    import.meta.url === pathToFileURL(resolve(entrypoint)).href
  );
}

if (isMainModule()) {
  const fixture = process.env.KEYNES_DEPENDENCY_FIXTURE;
  const root =
    fixture === undefined
      ? process.cwd()
      : resolve(process.cwd(), "scripts", "fixtures", "dependencies", fixture);
  const diagnostics = await checkDependencies(root);
  if (diagnostics.length > 0) {
    console.error(diagnostics.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Repository dependencies verified");
  }
}
