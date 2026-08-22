import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { checkStructure } from "./check-structure.ts";

const repositoryRoot = new URL("../", import.meta.url);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("checkStructure", () => {
  it("accepts the approved six-area repository", async () => {
    await expect(checkStructure(repositoryRoot)).resolves.toEqual([]);
  });

  it("reports a missing ownership area", async () => {
    const results = await checkStructure(repositoryRoot, {
      requiredAreas: ["missing-area"],
    });

    expect(results).toContain(
      "STRUCT001_MISSING_AREA: missing required area missing-area/",
    );
  });

  it.each([
    [
      "owner",
      "contracts/README.md",
      ownershipReadme().replace("@shubsharan", "nobody"),
      "STRUCT003_MISSING_OWNER",
    ],
    [
      "status",
      "contracts/README.md",
      ownershipReadme().replace("Nonfunctional", "Planned"),
      "STRUCT004_FUNCTIONAL_STATUS",
    ],
    [
      "heading",
      "contracts/README.md",
      ownershipReadme().replace("## Source policy", "## Sources"),
      "STRUCT005_OWNERSHIP_FIELD",
    ],
    [
      "public manifest",
      "sdk/package.json",
      '{"name":"@keynes/sdk","private":false}\n',
      "STRUCT007_PUBLIC_MANIFEST",
    ],
    [
      "workspace name",
      "sdk/package.json",
      '{"name":"@keynes/wrong","private":true}\n',
      "STRUCT014_WORKSPACE_NAME",
    ],
    [
      "extra manifest",
      "contracts/package.json",
      '{"private":true}\n',
      "STRUCT008_EXTRA_MANIFEST",
    ],
    ["license", "LICENSE", "not the approved license\n", "STRUCT010_LICENSE"],
    ["code owner", ".github/CODEOWNERS", "* @nobody\n", "STRUCT011_CODEOWNERS"],
    ["ignore rule", ".gitignore", "node_modules/\n", "STRUCT012_GITIGNORE"],
    [
      "workspace discovery",
      "pnpm-workspace.yaml",
      "packages:\n  - sdk\n",
      "STRUCT013_WORKSPACES",
    ],
    [
      "workspace discovery decoy",
      "pnpm-workspace.yaml",
      "packages:\n  - sdk\nonlyBuiltDependencies:\n  - cloud\n",
      "STRUCT013_WORKSPACES",
    ],
  ])("reports an invalid %s", async (_name, path, contents, diagnostic) => {
    const root = await createValidFixture();
    await writeFixtureFile(root, path, contents);

    const results = await checkStructure(root);
    expect(results.some((result) => result.startsWith(diagnostic))).toBe(true);
  });

  it("reports a missing private workspace manifest", async () => {
    const root = await createValidFixture();
    await rm(join(root, "sdk", "package.json"));

    const results = await checkStructure(root);
    expect(results).toContain(
      "STRUCT006_MISSING_MANIFEST: sdk/package.json is required",
    );
  });

  it("reports a deferred top-level area", async () => {
    const root = await createValidFixture();
    await mkdir(join(root, "tools"));

    const results = await checkStructure(root);
    expect(results).toContain(
      "STRUCT009_FORBIDDEN_AREA: tools/ is deferred and must not exist",
    );
  });
});

async function createValidFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "keynes-structure-"));
  temporaryRoots.push(root);

  for (const area of [
    "contracts",
    "database",
    "sdk",
    "cloud",
    "scripts",
    "docs",
  ]) {
    await mkdir(join(root, area), { recursive: true });
    await writeFixtureFile(root, `${area}/README.md`, ownershipReadme());
  }
  await mkdir(join(root, ".github"), { recursive: true });
  await writeFixtureFile(
    root,
    "sdk/package.json",
    '{"name":"@keynes/sdk","private":true}\n',
  );
  await writeFixtureFile(
    root,
    "cloud/package.json",
    '{"name":"@keynes/cloud","private":true}\n',
  );
  await writeFixtureFile(root, "LICENSE", "Apache License\nVersion 2.0\n");
  await writeFixtureFile(root, ".github/CODEOWNERS", "* @shubsharan\n");
  await writeFixtureFile(
    root,
    ".gitignore",
    "node_modules/\n.turbo/\ncoverage/\nreports/\ndist/\n",
  );
  await writeFixtureFile(
    root,
    "pnpm-workspace.yaml",
    "packages:\n  - sdk\n  - cloud\n",
  );

  return root;
}

async function writeFixtureFile(
  root: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

function ownershipReadme(): string {
  return `# Fixture

- **Owner:** \`@shubsharan\`
- **Status:** Nonfunctional

## Responsibility

Fixture responsibility.

## Allowed and public edges

None.

## Private internals

None.

## Source policy

Hand-authored.
`;
}
