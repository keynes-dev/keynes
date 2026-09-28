import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import picomatch from "picomatch";
import { isMap, isSeq, parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

const workflow = parseDocument(
  readFileSync(".github/workflows/ci.yml", "utf8"),
);
const filters = parseDocument(readFileSync(".github/filters.yml", "utf8"));

function stepScript(job: string, name: string): string {
  const steps = workflow.getIn(["jobs", job, "steps"]);
  if (!isSeq(steps)) throw new Error("Missing workflow steps");
  for (const step of steps.items) {
    if (isMap(step) && step.get("name") === name) {
      const script = step.get("run");
      if (typeof script === "string") return script;
    }
  }
  throw new Error(`Missing step ${name}`);
}

function run(script: string, env: Record<string, string>) {
  const directory = mkdtempSync(join(tmpdir(), "keynes-ci-route-"));
  try {
    return spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
      encoding: "utf8",
      env: { ...process.env, ...env, GITHUB_OUTPUT: join(directory, "output") },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function matches(name: string, paths: string[]): string {
  const node = filters.get(name);
  const patterns: unknown = isSeq(node) ? node.toJSON() : undefined;
  if (
    !Array.isArray(patterns) ||
    !patterns.every((pattern): pattern is string => typeof pattern === "string")
  ) {
    throw new Error(`Invalid filter ${name}`);
  }
  const predicates = patterns.map((pattern) =>
    picomatch(pattern, { dot: true }),
  );
  return String(paths.some((path) => predicates.every((match) => match(path))));
}

expect(workflow.errors).toEqual([]);
expect(filters.errors).toEqual([]);

const select = stepScript("changes", "Select route");

describe("CI routing policy", () => {
  it.each([
    [["README.md"], "docs"],
    [
      ["CONTRIBUTING.md", "SECURITY.md", "LICENSE", ".github/CODEOWNERS"],
      "docs",
    ],
    [
      [
        "packages/sdk/README.md",
        "apps/cli/README.md",
        "packages/policy/docs/guide.md",
        "apps/cli/docs/guide.md",
      ],
      "docs",
    ],
    [["docs/testing.md", ".specify/memory/constitution.md"], "docs"],
    [["packages/policy/src/index.ts"], "affected"],
    [["apps/cli/src/index.ts", "README.md"], "affected"],
    [["packages/policy/src/index.ts", "apps/cli/package.json"], "affected"],
    [["packages/sdk/src/index.ts", "README.md"], "full"],
    [["packages/database/schema.json"], "full"],
    [["packages/node-sqlite/src/index.ts"], "full"],
    [["packages/postgres/src/index.ts"], "full"],
    [["packages/testkit/src/index.ts"], "full"],
    [["pnpm-lock.yaml"], "full"],
    [["turbo.json"], "full"],
    [["scripts/generate.ts"], "full"],
    [[".github/workflows/ci.yml", ".github/filters.yml"], "full"],
    [["unknown.md"], "full"],
    [["packages/sdk/src/notes.md"], "full"],
    [["packages/sdk/docs/fixture.ts"], "full"],
    // Git reports deleted paths too; moves include both old and new paths.
    [["packages/sdk/src/deleted.ts"], "full"],
    [["packages/sdk/src/moved.ts", "docs/moved.md"], "full"],
    [["docs/moved.md", "apps/cli/src/moved.ts"], "affected"],
  ])("routes %j to %s", (paths, route) => {
    const env = {
      ALL: matches("all", paths),
      CODE: matches("code", paths),
      FULL: matches("full", paths),
    };
    const result = run(select + '\nprintf "%s" "$route"', env);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(route);
  });

  it("rejects an empty change set", () => {
    expect(
      run(select, { ALL: "false", CODE: "false", FULL: "false" }).status,
    ).not.toBe(0);
  });

  for (const job of ["checks", "sqlite-postgres"]) {
    it(`${job} accepts only complete, successful and consistent classifications`, () => {
      const script = stepScript(job, "Require explicit route");
      for (const [route, code, full] of [
        ["docs", "false", "false"],
        ["affected", "true", "false"],
        ["full", "true", "true"],
      ]) {
        const valid = {
          CLASSIFICATION: "success",
          ROUTE: route,
          ALL: "true",
          CODE: code,
          FULL: full,
        };
        expect(run(script, valid).status).toBe(0);
        for (const [key, value] of Object.entries(valid)) {
          for (const invalid of [
            "",
            "failure",
            "skipped",
            "cancelled",
            "unknown",
            "true",
            "false",
          ]) {
            if (invalid === value) continue;
            const env = { ...valid, [key]: invalid };
            expect(run(script, env).status, JSON.stringify(env)).not.toBe(0);
          }
        }
      }
    });
  }

  it("hashes shared source and configuration without hashing generated logs or builds", () => {
    const config: unknown = JSON.parse(readFileSync("turbo.json", "utf8"));
    if (
      !config ||
      typeof config !== "object" ||
      !("globalDependencies" in config) ||
      !Array.isArray(config.globalDependencies) ||
      !config.globalDependencies.every(
        (value): value is string => typeof value === "string",
      )
    ) {
      throw new Error("Missing shared cache inputs");
    }
    const included = picomatch(config.globalDependencies, { dot: true });
    for (const path of [
      "tsconfig.json",
      "tsconfig.tests.json",
      "packages/database/schema.json",
      "packages/database/postgres/migrations/0001-baseline.sql",
      "packages/sdk/src/index.ts",
      "packages/node-sqlite/src/adapter.ts",
      "packages/postgres/src/adapter.ts",
      "packages/testkit/src/index.ts",
      "packages/sdk/turbo.json",
    ]) {
      expect(included(path), path).toBe(true);
    }
    for (const path of [
      "packages/database/.turbo/turbo-typecheck.log",
      "packages/testkit/.turbo/turbo-typecheck.log",
      "packages/sdk/dist/index.js",
      "packages/database/node_modules/ajv/index.js",
    ]) {
      expect(included(path), path).toBe(false);
    }
  });

  it("fails revision resolution when Git cannot find the event commits", () => {
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).stdout.trim();
    expect(
      run(stepScript("changes", "Resolve event comparison"), {
        HEAD: head,
        BASE: "a".repeat(40),
      }).status,
    ).not.toBe(0);
  });

  it("uses Git without PR API permissions, retains checks, and tests the merge candidate", () => {
    const source = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow.getIn(["permissions", "contents"])).toBe("read");
    expect(source).not.toContain("pull_request_target");
    expect(source).not.toContain("pull-requests:");
    expect(source).toContain('token: ""');
    expect(source).toContain("predicate-quantifier: every");
    expect(source).toContain("ref: ${{ github.event.pull_request.head.sha }}");
    expect(source).toContain("git merge-base");
    for (const [job, name] of [
      ["checks", "Repository and tests"],
      ["sqlite-postgres", "SQLite and PostgreSQL behavior tests"],
    ]) {
      expect(workflow.getIn(["jobs", job, "name"])).toBe(name);
      expect(workflow.getIn(["jobs", job, "if"])).toBe("${{ !cancelled() }}");
    }
    expect(source.match(/ref: \$\{\{ github.sha \}\}/gu)).toHaveLength(2);
    expect(source).toContain(
      "TURBO_SCM_BASE: ${{ needs.changes.outputs.merge_base }}",
    );
    expect(source).toContain(
      "TURBO_SCM_HEAD: ${{ github.event.pull_request.head.sha }}",
    );
    expect(source).toContain("NOT RUN");
  });
});
