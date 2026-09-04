import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  parsePhases,
  publicationMarker,
  pullRequestTitle,
  validatePhases,
} from "../scripts/phase-stack.mjs";

const IDENTITY = {
  feature_id: "KEY-123",
  feature_title: "Implement accountable budget loop",
  branch: "owner/key-123-implement-accountable-budget-loop",
  work_item: {
    issue_id: "11111111-2222-4333-8444-555555555555",
    issue_url:
      "https://linear.app/keynes/issue/KEY-123/implement-accountable-budget-loop",
  },
};

const TASKS = `# Tasks: Implement accountable budget loop

## Phase 1: Implement accountable budget loop

**Linear issue**: [KEY-123](https://linear.app/keynes/issue/KEY-123/implement-accountable-budget-loop)
**Git branch**: \`owner/key-123-implement-accountable-budget-loop\`
<!-- linear-issue-id: 11111111-2222-4333-8444-555555555555 -->

- [ ] T001 Start

**Checkpoint**: The parent boundary is reviewable.

## Phase 2: Generate contract

**Linear issue**: [KEY-124](https://linear.app/keynes/issue/KEY-124/generate-contract)
**Git branch**: \`owner/key-124-generate-contract\`
<!-- linear-issue-id: 22222222-3333-4444-8555-666666666666 -->

- [ ] T002 Generate

**Checkpoint**: Generated consumers agree.
`;

test("parses parent and child phase bindings", () => {
  const phases = validatePhases(IDENTITY, parsePhases(TASKS));
  assert.equal(phases[0].issue.identifier, "KEY-123");
  assert.equal(phases[1].branch, "owner/key-124-generate-contract");
  assert.equal(pullRequestTitle(phases[1]), "KEY-124 Generate contract");
});

test("requires imperative action titles for stack phases", () => {
  assert.throws(
    () =>
      validatePhases(
        IDENTITY,
        parsePhases(
          TASKS.replace(
            "Phase 2: Generate contract",
            "Phase 2: Contract generation",
          ),
        ),
      ),
    /imperative action verb/,
  );
});

test("requires the parent issue and exact parent title for Phase 1", () => {
  assert.throws(
    () =>
      validatePhases(
        IDENTITY,
        parsePhases(
          TASKS.replace(
            "Phase 1: Implement accountable budget loop",
            "Phase 1: Setup",
          ),
        ),
      ),
    /title/,
  );
  assert.throws(
    () =>
      validatePhases(
        IDENTITY,
        parsePhases(TASKS.replace("[KEY-123]", "[KEY-999]")),
      ),
    /parent/,
  );
});

test("rejects duplicate issue and branch bindings", () => {
  const duplicateIssue = TASKS.replace("[KEY-124]", "[KEY-123]").replace(
    "/KEY-124/generate-contract",
    "/KEY-123/generate-contract",
  );
  assert.throws(
    () => validatePhases(IDENTITY, parsePhases(duplicateIssue)),
    /Duplicate phase issue/,
  );
  const duplicateBranch = TASKS.replace(
    "owner/key-124-generate-contract",
    IDENTITY.branch,
  );
  assert.throws(
    () => validatePhases(IDENTITY, parsePhases(duplicateBranch)),
    /Duplicate phase branch/,
  );
});

test("supports unpublished child phases and stable publication markers", () => {
  const unpublished = TASKS.replace(
    "**Linear issue**: [KEY-124](https://linear.app/keynes/issue/KEY-124/generate-contract)",
    "**Linear issue**: `Unpublished`",
  )
    .replace(
      "**Git branch**: `owner/key-124-generate-contract`",
      "**Git branch**: `Unpublished`",
    )
    .replace(
      "<!-- linear-issue-id: 22222222-3333-4444-8555-666666666666 -->\n",
      "",
    );
  const phases = validatePhases(IDENTITY, parsePhases(unpublished));
  assert.equal(phases[1].state, "unpublished");
  assert.equal(publicationMarker("KEY-123", 2), "KEY-123/Phase-2");
});

test("dry-run commands use only recorded Linear branches", async () => {
  const directory = await mkdtemp(join(tmpdir(), "keynes-phase-stack-"));
  mkdirSync(join(directory, ".specify/scripts"), { recursive: true });
  mkdirSync(
    join(directory, "docs/features/key-123-implement-accountable-budget-loop"),
    {
      recursive: true,
    },
  );
  const script = new URL("../scripts/phase-stack.mjs", import.meta.url)
    .pathname;
  const identityScript = new URL(
    "../scripts/feature-identity.mjs",
    import.meta.url,
  ).pathname;
  writeFileSync(
    join(directory, ".specify/scripts/phase-stack.mjs"),
    `export * from ${JSON.stringify(script)};`,
  );
  writeFileSync(
    join(directory, ".specify/scripts/feature-identity.mjs"),
    `export * from ${JSON.stringify(identityScript)};`,
  );
  writeFileSync(
    join(
      directory,
      "docs/features/key-123-implement-accountable-budget-loop/spec.md",
    ),
    `# Implement accountable budget loop\n\n**Linear issue**: [KEY-123](${IDENTITY.work_item.issue_url})\n**Git branch**: \`${IDENTITY.branch}\`\n<!-- linear-issue-id: ${IDENTITY.work_item.issue_id} -->\n`,
  );
  writeFileSync(
    join(
      directory,
      "docs/features/key-123-implement-accountable-budget-loop/tasks.md",
    ),
    TASKS,
  );
  writeFileSync(
    join(directory, ".specify/feature.json"),
    `${JSON.stringify({
      version: 3,
      feature_id: "KEY-123",
      feature_title: "Implement accountable budget loop",
      feature_directory:
        "docs/features/key-123-implement-accountable-budget-loop",
      feature_file:
        "docs/features/key-123-implement-accountable-budget-loop/spec.md",
      branch: IDENTITY.branch,
      work_item: {
        provider: "linear",
        issue_id: IDENTITY.work_item.issue_id,
        issue_identifier: "KEY-123",
        issue_url: IDENTITY.work_item.issue_url,
      },
    })}\n`,
  );
  const git = (args) =>
    spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(git(["init", "-q"]).status, 0);
  assert.equal(git(["switch", "-c", IDENTITY.branch]).status, 0);
  const result = spawnSync("node", [script, "start", "2", "--dry-run"], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.trim(),
    "gh stack add owner/key-124-generate-contract",
  );
  const submit = spawnSync("node", [script, "submit", "--dry-run", "--json"], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(submit.status, 0, submit.stderr);
  assert.deepEqual(JSON.parse(submit.stdout).titles, [
    {
      branch: IDENTITY.branch,
      title: "KEY-123 Implement accountable budget loop",
    },
    {
      branch: "owner/key-124-generate-contract",
      title: "KEY-124 Generate contract",
    },
  ]);
});
