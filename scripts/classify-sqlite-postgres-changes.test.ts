/// <reference types="node" />

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const base = "b".repeat(40);
const head = "c".repeat(40);
const merge = "d".repeat(40);
const checkout = "e".repeat(40);
const temporaryDirectories: string[] = [];

const loadClassifier = () => import("./classify-sqlite-postgres-changes.ts");

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("PR workflow contract", () => {
  it("classifies once and fails both required checks when classification fails", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(
      workflow.match(/node scripts\/classify-sqlite-postgres-changes.ts/g),
    ).toHaveLength(1);
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).not.toMatch(
      /paths-ignore|^\s+paths:|workflow_dispatch|schedule:/mu,
    );
    for (const id of ["checks", "sqlite-postgres"]) {
      const job = workflow.split(`  ${id}:`)[1]?.split(/\n  [\w-]+:/)[0] ?? "";
      expect(job).toContain("needs: changes");
      expect(job).toContain("if: ${{ always() }}");
      const guard = step(job, "Require explicit relevance decision");
      expect(guard).toContain("needs.changes.result");
      expect(guard).toContain(
        "success/true/relevant | success/false/not-applicable",
      );
      expect(guard).toContain("*) exit 1");
      expect(step(job, "Set up Node.js")).toContain(
        "node-version-file: package.json",
      );
      expect(step(job, "Set up Node.js")).toContain("cache: pnpm");
    }
    expect(workflow).toContain("pnpm format:docs");
    expect(workflow).toContain("pnpm test:ci:postgresql");
    expect(workflow).not.toContain("pnpm test:sqlite-postgres");
    expect(workflow).not.toContain("Confirm artifact retention");
    expect(step(workflow, "Retain failure diagnostics")).toContain("failure()");
    expect(step(workflow, "Retain failure diagnostics")).toContain(
      "retention-days: 7",
    );
    expect(step(workflow, "Retain failure diagnostics")).toContain(
      "continue-on-error: true",
    );
  });
});

describe("required-check guard", () => {
  it.each([
    ["success", "true", "relevant", 0],
    ["success", "false", "not-applicable", 0],
    ["failure", "true", "relevant", 1],
    ["cancelled", "false", "not-applicable", 1],
    ["skipped", "false", "not-applicable", 1],
    ["success", "", "", 1],
    ["success", "false", "relevant", 1],
    ["success", "true", "not-applicable", 1],
  ])("handles %s/%s/%s", (classification, run, disposition, exit) => {
    const workflow = readFileSync(
      join(root, ".github/workflows/ci.yml"),
      "utf8",
    );
    const command = step(workflow, "Require explicit relevance decision").split(
      "run: |\n",
    )[1];
    expect(command).toBeDefined();
    if (command === undefined) throw new Error("Missing relevance guard");
    const result = spawnSync("bash", ["-e", "-c", command], {
      env: {
        ...process.env,
        CLASSIFICATION: String(classification),
        RUN_DATABASES: String(run),
        DISPOSITION: String(disposition),
      },
    });
    expect(result.status).toBe(exit);
  });
});

describe("path classification", () => {
  it.each([
    ["docs/product.md", "documentation"],
    ["docs/features/key-93/spec.md", "documentation"],
    [".specify/memory/constitution.md", "spec-kit-record"],
    ["AGENTS.md", "repository-metadata"],
    ["LICENSE", "repository-metadata"],
    [".github/CODEOWNERS", "repository-metadata"],
    [".github/PULL_REQUEST_TEMPLATE.md", "repository-metadata"],
  ])("approves %s as %s", async (path, category) => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(classifyChangedPaths([{ status: "M", path }])).toEqual({
      disposition: "not-applicable",
      paths: [{ status: "M", path, category }],
    });
  });

  it.each([
    "packages/sdk/src/keynes.ts",
    "packages/contracts/contract-tests/scenarios/create.ts",
    "scripts/run-sqlite-postgres.ts",
    "scripts/classify-sqlite-postgres-changes.ts",
    ".github/workflows/ci.yml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".specify/scripts/bash/common.sh",
    ".specify/extensions.yml",
    ".gitignore",
    ".gitattributes",
    ".dockerignore",
    "new-owner/file.txt",
    "new-root-file.txt",
  ])("requires execution for %s", async (path) => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(classifyChangedPaths([{ status: "M", path }])).toEqual({
      disposition: "relevant",
      paths: [{ status: "M", path, category: "relevant" }],
    });
  });

  it("approves a mix of every safe category", async () => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(
      classifyChangedPaths([
        { status: "M", path: "docs/product.md" },
        { status: "M", path: ".specify/memory/constitution.md" },
        { status: "M", path: ".github/CODEOWNERS" },
      ]).disposition,
    ).toBe("not-applicable");
  });

  it("requires execution when a relevant file moves into documentation", async () => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(
      classifyChangedPaths([
        { status: "D", path: "packages/sdk/src/old.ts" },
        { status: "A", path: "docs/old.ts" },
      ]).disposition,
    ).toBe("relevant");
  });

  it("allows a safe-to-safe move represented as delete and add", async () => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(
      classifyChangedPaths([
        { status: "D", path: "docs/old.md" },
        { status: "A", path: "docs/new.md" },
      ]).disposition,
    ).toBe("not-applicable");
  });

  it("rejects an empty change set", async () => {
    const { classifyChangedPaths } = await loadClassifier();
    expect(() => classifyChangedPaths([])).toThrow("empty");
  });
});

describe("NUL-delimited Git status parsing", () => {
  it("retains additions, modifications, deletions, and type changes", async () => {
    const { parseNameStatusZ } = await loadClassifier();
    expect(
      parseNameStatusZ(
        Buffer.from(
          "A\0docs/new.md\0M\0packages/new.ts\0D\0packages/old.ts\0T\0tool\0",
        ),
      ),
    ).toEqual([
      { status: "A", path: "docs/new.md" },
      { status: "M", path: "packages/new.ts" },
      { status: "D", path: "packages/old.ts" },
      { status: "T", path: "tool" },
    ]);
  });

  it.each([
    Buffer.alloc(0),
    Buffer.from("M\0docs/a.md"),
    Buffer.from("R100\0packages/a.ts\0docs/a.ts\0"),
    Buffer.from("M\0../outside\0"),
    Buffer.from("M\0/absolute\0"),
    Buffer.from("M\0docs/a.md\0D\0docs/a.md\0"),
    Buffer.from([0x4d, 0, 0xff, 0]),
  ])("rejects malformed or unsafe input", async (input) => {
    const { parseNameStatusZ } = await loadClassifier();
    expect(() => parseNameStatusZ(input)).toThrow();
  });

  it("exposes both sides of a real move without rename detection", async () => {
    const { parseNameStatusZ } = await loadClassifier();
    const directory = mkdtempSync(join(tmpdir(), "keynes-relevance-"));
    temporaryDirectories.push(directory);
    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.email", "ci@example.invalid"]);
    git(directory, ["config", "user.name", "CI"]);
    git(directory, ["checkout", "-b", "main", "--quiet"]);
    mkdirSync(join(directory, "packages/sdk/src"), { recursive: true });
    writeFileSync(
      join(directory, "packages/sdk/src/source.ts"),
      "export {};\n",
    );
    git(directory, ["add", "."]);
    git(directory, ["commit", "--quiet", "-m", "base"]);
    const baseRevision = git(directory, ["rev-parse", "HEAD"])
      .toString("utf8")
      .trim();
    mkdirSync(join(directory, "docs"), { recursive: true });
    renameSync(
      join(directory, "packages/sdk/src/source.ts"),
      join(directory, "docs/source.ts"),
    );
    git(directory, ["add", "-A"]);
    git(directory, ["commit", "--quiet", "-m", "move"]);
    const diff = git(directory, [
      "diff",
      "--name-status",
      "-z",
      "--no-renames",
      baseRevision,
      "HEAD",
      "--",
    ]);

    expect(parseNameStatusZ(diff)).toEqual([
      { status: "A", path: "docs/source.ts" },
      { status: "D", path: "packages/sdk/src/source.ts" },
    ]);
  });

  it("uses the merge base when the target branch advances", async () => {
    const { classifyChangedPaths, parseNameStatusZ } = await loadClassifier();
    const directory = mkdtempSync(join(tmpdir(), "keynes-relevance-base-"));
    temporaryDirectories.push(directory);
    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.email", "ci@example.invalid"]);
    git(directory, ["config", "user.name", "CI"]);
    git(directory, ["checkout", "-b", "main", "--quiet"]);
    writeFileSync(join(directory, "README.md"), "base\n");
    git(directory, ["add", "."]);
    git(directory, ["commit", "--quiet", "-m", "base"]);
    git(directory, ["checkout", "-b", "feature", "--quiet"]);
    mkdirSync(join(directory, "docs"));
    writeFileSync(join(directory, "docs/change.md"), "safe\n");
    git(directory, ["add", "."]);
    git(directory, ["commit", "--quiet", "-m", "feature"]);
    const featureHead = revision(directory);
    git(directory, ["checkout", "main", "--quiet"]);
    writeFileSync(join(directory, "package.json"), "{}\n");
    git(directory, ["add", "."]);
    git(directory, ["commit", "--quiet", "-m", "advance base"]);
    const advancedBase = revision(directory);
    const mergeBase = git(directory, ["merge-base", advancedBase, featureHead])
      .toString("utf8")
      .trim();
    const changed = parseNameStatusZ(
      git(directory, [
        "diff",
        "--name-status",
        "-z",
        "--no-renames",
        mergeBase,
        featureHead,
        "--",
      ]),
    );

    expect(changed).toEqual([{ status: "A", path: "docs/change.md" }]);
    expect(classifyChangedPaths(changed).disposition).toBe("not-applicable");
  });
});

describe("closed decision and CI boundary", () => {
  it("rejects contradictory or mutated decisions", async () => {
    const { validateRelevanceDecision } = await loadClassifier();
    expect(() =>
      validateRelevanceDecision({
        disposition: "not-applicable",
        paths: [{ status: "M", path: "pnpm-lock.yaml", category: "relevant" }],
      }),
    ).toThrow();
    expect(() =>
      validateRelevanceDecision({ disposition: "unknown", paths: [] }),
    ).toThrow();
  });

  it("binds Git commands to event base, head, merge base, and checkout", async () => {
    const { runClassifier } = await loadClassifier();
    const commands: string[][] = [];
    const appended = new Map<string, string>();
    const runtime = {
      readFile(path: string) {
        expect(path).toBe("event.json");
        return Buffer.from(
          JSON.stringify({
            pull_request: { base: { sha: base }, head: { sha: head } },
          }),
        );
      },
      appendFile(path: string, value: string) {
        appended.set(path, `${appended.get(path) ?? ""}${value}`);
      },
      command(file: string, args: readonly string[]) {
        expect(file).toBe("git");
        commands.push([...args]);
        if (args[0] === "rev-parse") return Buffer.from(`${checkout}\n`);
        if (args[0] === "merge-base") return Buffer.from(`${merge}\n`);
        if (args[0] === "diff") return Buffer.from("M\0docs/product.md\0");
        return Buffer.alloc(0);
      },
    };

    const result = runClassifier(
      {
        GITHUB_EVENT_PATH: "event.json",
        GITHUB_OUTPUT: "output.txt",
        GITHUB_SHA: checkout,
        GITHUB_STEP_SUMMARY: "summary.md",
      },
      runtime,
    );

    expect(result.decision.disposition).toBe("not-applicable");
    expect(commands).toContainEqual(["cat-file", "-e", `${base}^{commit}`]);
    expect(commands).toContainEqual(["cat-file", "-e", `${head}^{commit}`]);
    expect(commands).toContainEqual(["merge-base", base, head]);
    expect(commands).toContainEqual([
      "diff",
      "--name-status",
      "-z",
      "--no-renames",
      merge,
      head,
      "--",
    ]);
    expect(appended.get("output.txt")).toBe(
      "run_databases=false\ndisposition=not-applicable\n",
    );
    expect(appended.get("summary.md")).toContain("SQLite: NOT RUN");
    expect(appended.get("summary.md")).toContain("PostgreSQL: NOT RUN");
  });

  it("emits no success-shaped output when Git fails", async () => {
    const { runClassifier } = await loadClassifier();
    let appended = false;
    expect(() =>
      runClassifier(
        {
          GITHUB_EVENT_PATH: "event.json",
          GITHUB_OUTPUT: "output.txt",
          GITHUB_SHA: checkout,
          GITHUB_STEP_SUMMARY: "summary.md",
        },
        {
          readFile: () =>
            Buffer.from(
              JSON.stringify({
                pull_request: { base: { sha: base }, head: { sha: head } },
              }),
            ),
          appendFile: () => {
            appended = true;
          },
          command: () => {
            throw new Error("git failed");
          },
        },
      ),
    ).toThrow("git failed");
    expect(appended).toBe(false);
  });

  it("rejects missing pull request revisions before writing output", async () => {
    const { runClassifier } = await loadClassifier();
    let appended = false;
    expect(() =>
      runClassifier(
        {
          GITHUB_EVENT_PATH: "event.json",
          GITHUB_OUTPUT: "output.txt",
          GITHUB_SHA: checkout,
          GITHUB_STEP_SUMMARY: "summary.md",
        },
        {
          readFile: () => Buffer.from(JSON.stringify({ pull_request: {} })),
          appendFile: () => {
            appended = true;
          },
          command: () => Buffer.alloc(0),
        },
      ),
    ).toThrow("revisions");
    expect(appended).toBe(false);
  });

  it("rejects a checkout that differs from GITHUB_SHA", async () => {
    const { runClassifier } = await loadClassifier();
    expect(() =>
      runClassifier(
        {
          GITHUB_EVENT_PATH: "event.json",
          GITHUB_OUTPUT: "output.txt",
          GITHUB_SHA: "f".repeat(40),
          GITHUB_STEP_SUMMARY: "summary.md",
        },
        {
          readFile: () =>
            Buffer.from(
              JSON.stringify({
                pull_request: { base: { sha: base }, head: { sha: head } },
              }),
            ),
          appendFile: () => undefined,
          command: (_file, args) =>
            args[0] === "rev-parse" ? Buffer.from(checkout) : Buffer.alloc(0),
        },
      ),
    ).toThrow("differs");
  });

  it("escapes unusual path text without making database claims", async () => {
    const { renderSummary } = await loadClassifier();
    const summary = renderSummary({
      base,
      head,
      mergeBase: merge,
      checkout,
      decision: {
        disposition: "relevant",
        paths: [
          {
            status: "M",
            path: "new-owner/line\nbreak-```-file.ts",
            category: "relevant",
          },
        ],
      },
    });
    expect(summary).toContain('"path":"new-owner/line\\nbreak-```-file.ts"');
    expect(summary).not.toContain("SQLite: passed");
    expect(summary).not.toContain("PostgreSQL: passed");
  });
});

function step(workflow: string, name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const next = workflow.indexOf("\n      - name:", start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

function git(directory: string, args: readonly string[]): Buffer {
  return execFileSync("git", args, { cwd: directory });
}

function revision(directory: string): string {
  return git(directory, ["rev-parse", "HEAD"]).toString("utf8").trim();
}
