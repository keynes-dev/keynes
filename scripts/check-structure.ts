import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";

const defaultAreas = [
  "contracts",
  "database",
  "sdk",
  "cloud",
  "scripts",
  "docs",
];
const forbiddenAreas = ["distribution", "tools", "tests"];
const workspaceAreas = new Set(["sdk", "cloud"]);
const workspaceNames = new Map([
  ["sdk", "@keynes/sdk"],
  ["cloud", "@keynes/cloud"],
]);

type StructureOptions = {
  requiredAreas?: string[];
};

export async function checkStructure(
  root: URL | string,
  options: StructureOptions = {},
): Promise<string[]> {
  const rootPath = root instanceof URL ? fileURLToPath(root) : root;
  const requiredAreas = options.requiredAreas ?? defaultAreas;
  const diagnostics: string[] = [];

  for (const area of requiredAreas) {
    const areaPath = join(rootPath, area);
    if (!(await exists(areaPath))) {
      diagnostics.push(
        `STRUCT001_MISSING_AREA: missing required area ${area}/`,
      );
      continue;
    }

    const readmePath = join(areaPath, "README.md");
    if (!(await exists(readmePath))) {
      diagnostics.push(
        `STRUCT002_MISSING_README: ${area}/README.md is required`,
      );
      continue;
    }

    const readme = await readFile(readmePath, "utf8");
    if (!readme.includes("@shubsharan")) {
      diagnostics.push(
        `STRUCT003_MISSING_OWNER: ${area}/README.md must name @shubsharan`,
      );
    }
    if (!/nonfunctional/i.test(readme)) {
      diagnostics.push(
        `STRUCT004_FUNCTIONAL_STATUS: ${area}/README.md must state its nonfunctional status`,
      );
    }
    for (const heading of [
      "Responsibility",
      "Allowed and public edges",
      "Private internals",
      "Source policy",
    ]) {
      if (!readme.includes(`## ${heading}`)) {
        diagnostics.push(
          `STRUCT005_OWNERSHIP_FIELD: ${area}/README.md is missing the ${heading} section`,
        );
      }
    }

    const manifestPath = join(areaPath, "package.json");
    if (workspaceAreas.has(area)) {
      if (!(await exists(manifestPath))) {
        diagnostics.push(
          `STRUCT006_MISSING_MANIFEST: ${area}/package.json is required`,
        );
      } else {
        const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
          name?: string;
          private?: boolean;
        };
        if (manifest.private !== true) {
          diagnostics.push(
            `STRUCT007_PUBLIC_MANIFEST: ${area}/package.json must be private`,
          );
        }
        const expectedName = workspaceNames.get(area);
        if (manifest.name !== expectedName) {
          diagnostics.push(
            `STRUCT014_WORKSPACE_NAME: ${area}/package.json must be named ${expectedName}`,
          );
        }
      }
    } else if (await exists(manifestPath)) {
      diagnostics.push(
        `STRUCT008_EXTRA_MANIFEST: ${area}/ must not be a workspace`,
      );
    }
  }

  for (const area of forbiddenAreas) {
    if (await exists(join(rootPath, area))) {
      diagnostics.push(
        `STRUCT009_FORBIDDEN_AREA: ${area}/ is deferred and must not exist`,
      );
    }
  }

  await checkFileContains(
    rootPath,
    "LICENSE",
    ["Apache License", "Version 2.0"],
    "STRUCT010_LICENSE",
    diagnostics,
  );
  await checkFileContains(
    rootPath,
    ".github/CODEOWNERS",
    ["* @shubsharan"],
    "STRUCT011_CODEOWNERS",
    diagnostics,
  );
  await checkFileContains(
    rootPath,
    ".gitignore",
    ["node_modules/", ".turbo/", "coverage/", "reports/", "dist/"],
    "STRUCT012_GITIGNORE",
    diagnostics,
  );
  await checkWorkspaceDefinition(rootPath, diagnostics);

  return diagnostics;
}

async function checkWorkspaceDefinition(
  root: string,
  diagnostics: string[],
): Promise<void> {
  const path = join(root, "pnpm-workspace.yaml");
  if (!(await exists(path))) {
    diagnostics.push("STRUCT013_WORKSPACES: pnpm-workspace.yaml is required");
    return;
  }

  const contents = (await readFile(path, "utf8"))
    .replaceAll("\r\n", "\n")
    .trimEnd();
  const expected = "packages:\n  - sdk\n  - cloud";
  if (contents !== expected) {
    diagnostics.push(
      "STRUCT013_WORKSPACES: pnpm-workspace.yaml must list exactly sdk and cloud",
    );
  }
}

async function checkFileContains(
  root: string,
  relativePath: string,
  requiredText: string[],
  code: string,
  diagnostics: string[],
): Promise<void> {
  const path = join(root, relativePath);
  if (!(await exists(path))) {
    diagnostics.push(`${code}: ${relativePath} is required`);
    return;
  }

  const contents = await readFile(path, "utf8");
  for (const text of requiredText) {
    if (!contents.includes(text)) {
      diagnostics.push(
        `${code}: ${relativePath} must contain ${JSON.stringify(text)}`,
      );
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return (
    entrypoint !== undefined &&
    import.meta.url === pathToFileURL(resolve(entrypoint)).href
  );
}

if (isMainModule()) {
  const diagnostics = await checkStructure(process.cwd());
  if (diagnostics.length > 0) {
    console.error(diagnostics.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Repository structure verified");
  }
}
