import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  FeatureIdentityError,
  makeFeatureIdentity,
  makeWorkItem,
  parseManifest,
  resolveActiveFeature,
  validateGitBranch,
  validateRepositoryFeatureSpecs,
} from "../scripts/feature-identity.mjs";

const UUID = "11111111-2222-4333-8444-555555555555";
const IDENTIFIER = "KEY-123";
const TITLE = "Implement accountable budget loop";
const URL =
  "https://linear.app/keynes/issue/KEY-123/implement-accountable-budget-loop";
const BRANCH = "shubhankarsharan/key-123-implement-accountable-budget-loop";
const DIRECTORY = "key-123-implement-accountable-budget-loop";
const WORK_ITEM = {
  provider: "linear",
  issue_id: UUID,
  issue_identifier: IDENTIFIER,
  issue_url: URL,
};

function git(directory, ...args) {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "keynes-feature-identity-"));
  mkdirSync(join(directory, ".specify"));
  mkdirSync(join(directory, "docs/features"), { recursive: true });
  git(directory, "init", "-q");
  git(directory, "config", "user.name", "Feature Identity Test");
  git(directory, "config", "user.email", "feature-identity@example.invalid");
  writeFileSync(join(directory, ".gitignore"), "\n");
  git(directory, "add", ".gitignore");
  git(directory, "commit", "-q", "-m", "fixture");
  return directory;
}

function writeFeature(directory, overrides = {}) {
  const value = {
    identifier: IDENTIFIER,
    title: TITLE,
    url: URL,
    uuid: UUID,
    branch: BRANCH,
    ...overrides,
  };
  const leaf = value.branch.slice(value.branch.lastIndexOf("/") + 1);
  const featureDirectory = join(directory, "docs/features", leaf);
  mkdirSync(featureDirectory, { recursive: true });
  writeFileSync(
    join(featureDirectory, "spec.md"),
    `# ${value.title}\n\n**Linear issue**: [${value.identifier}](${value.url})\n**Git branch**: \`${value.branch}\`\n<!-- linear-issue-id: ${value.uuid} -->\n`,
  );
  writeFileSync(
    join(featureDirectory, "plan.md"),
    `# Implementation plan: ${value.title}\n`,
  );
  writeFileSync(
    join(featureDirectory, "tasks.md"),
    `# Tasks: ${value.title}\n`,
  );
  return value;
}

function writeManifest(directory, value = {}) {
  const manifest = {
    version: 3,
    feature_id: IDENTIFIER,
    feature_title: TITLE,
    feature_directory: `docs/features/${DIRECTORY}`,
    feature_file: `docs/features/${DIRECTORY}/spec.md`,
    branch: BRANCH,
    work_item: WORK_ITEM,
    ...value,
  };
  writeFileSync(
    join(directory, ".specify/feature.json"),
    `${JSON.stringify(manifest)}\n`,
  );
}

test("constructs a version 3 Linear-native identity", async () => {
  const directory = await fixture();
  assert.deepEqual(
    makeFeatureIdentity(directory, IDENTIFIER, TITLE, BRANCH, WORK_ITEM),
    {
      version: 3,
      feature_id: IDENTIFIER,
      feature_title: TITLE,
      feature_directory: `docs/features/${DIRECTORY}`,
      feature_file: `docs/features/${DIRECTORY}/spec.md`,
      branch: BRANCH,
      work_item: WORK_ITEM,
    },
  );
});

test("accepts arbitrary valid Linear branches and rejects invalid Git refs", async () => {
  const directory = await fixture();
  for (const branch of ["team/key-123-title", "release/key-123", "key-123"]) {
    assert.equal(validateGitBranch(directory, branch), branch);
  }
  for (const branch of ["bad branch", "../escape", "name..lock", "-option"]) {
    assert.throws(
      () => validateGitBranch(directory, branch),
      FeatureIdentityError,
    );
  }
});

test("requires matching Linear key, UUID, URL, and exact title", async () => {
  const directory = await fixture();
  assert.throws(
    () => makeFeatureIdentity(directory, "KEY-999", TITLE, BRANCH, WORK_ITEM),
    /must equal/,
  );
  assert.throws(() => makeWorkItem("not-a-uuid", IDENTIFIER, URL), /UUID/);
  assert.throws(
    () =>
      makeWorkItem(
        UUID,
        IDENTIFIER,
        "https://linear.app/keynes/issue/KEY-999/wrong",
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      makeFeatureIdentity(
        directory,
        IDENTIFIER,
        ` ${TITLE}`,
        BRANCH,
        WORK_ITEM,
      ),
    /exact/,
  );
});

test("resolves the active feature from the manifest without parsing its branch", async () => {
  const directory = await fixture();
  writeFeature(directory);
  writeManifest(directory);
  git(directory, "switch", "-c", BRANCH);
  const identity = resolveActiveFeature(directory);
  assert.equal(identity.feature_id, IDENTIFIER);
  assert.equal(identity.feature_directory, `docs/features/${DIRECTORY}`);
});

test("validates unique keys, UUIDs, and branches", async () => {
  const directory = await fixture();
  writeFeature(directory);
  assert.equal(validateRepositoryFeatureSpecs(directory), 1);
  writeFeature(directory, {
    identifier: "KEY-124",
    url: "https://linear.app/keynes/issue/KEY-124/second",
    title: "Add second feature",
    branch: "shubhankarsharan/key-124-second-feature",
  });
  assert.throws(
    () => validateRepositoryFeatureSpecs(directory),
    /Duplicate Linear UUID/,
  );
});

test("rejects directories that differ from the Linear branch final segment", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/0001-legacy"));
  writeFileSync(
    join(directory, "docs/features/0001-legacy/spec.md"),
    `# ${TITLE}\n\n**Linear issue**: [${IDENTIFIER}](${URL})\n**Git branch**: \`${BRANCH}\`\n<!-- linear-issue-id: ${UUID} -->\n`,
  );
  assert.throws(
    () => validateRepositoryFeatureSpecs(directory),
    /directory must equal the final segment/,
  );
});

test("reads historical version 2 manifests without rewriting them", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/0014-resource-bound-budget"));
  writeFileSync(
    join(directory, ".specify/feature.json"),
    `${JSON.stringify({
      version: 2,
      feature_id: "FEAT-0014",
      slug: "resource-bound-budget",
      branch: "feat/0014-resource-bound-budget",
      feature_directory: "docs/features/0014-resource-bound-budget",
      work_item: WORK_ITEM,
    })}\n`,
  );
  const identity = parseManifest(directory);
  assert.equal(identity.version, 2);
  assert.equal(
    identity.feature_file,
    "docs/features/0014-resource-bound-budget/spec.md",
  );
});

test("prepares one feature through the real hooks without phase bindings", async () => {
  const directory = await fixture();
  for (const path of ["scripts", "templates", "extensions/git/scripts/bash"]) {
    cpSync(
      new globalThis.URL(`../${path}`, import.meta.url),
      join(directory, ".specify", path),
      {
        recursive: true,
      },
    );
  }
  const start = [
    ".specify/extensions/git/scripts/bash/create-new-feature.sh",
    "--json",
    "--linear-issue-id",
    UUID,
    "--linear-issue-identifier",
    IDENTIFIER,
    "--linear-issue-title",
    TITLE,
    "--linear-issue-url",
    URL,
    "--linear-branch-name",
    BRANCH,
  ];
  function bash(...args) {
    const result = spawnSync("bash", args, {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim().split("\n").at(-1));
  }
  const reserved = bash(...start);
  assert.equal(reserved.BRANCH_NAME, BRANCH);
  assert.equal(parseManifest(directory).feature_id, IDENTIFIER);
  writeFeature(directory);
  const prepared = bash(".specify/scripts/bash/setup-plan.sh", "--json");
  assert.equal(
    prepared.FEATURE_DIR,
    realpathSync(join(directory, "docs/features", DIRECTORY)),
  );
  writeFileSync(prepared.IMPL_PLAN, `# Implementation plan: ${TITLE}\n`);
  const tasks = bash(".specify/scripts/bash/setup-tasks.sh", "--json");
  assert.equal(tasks.FEATURE_DIR, prepared.FEATURE_DIR);
  const template = readFileSync(tasks.TASKS_TEMPLATE, "utf8");
  assert.ok(template.length > 0);
  writeFileSync(
    join(tasks.FEATURE_DIR, "tasks.md"),
    `# Tasks: ${TITLE}\n\n## Phase 1: Validate input\n\n` +
      `- [x] T001 [US1] Validate the selected identity in spec.md\n\n` +
      `**Checkpoint**: Identity is consistent.\n\n## Phase 2: Verify delivery\n\n` +
      `- [ ] T002 [US1] Verify the outcome in plan.md\n\n` +
      `**Checkpoint**: Required feature evidence passes.\n`,
  );
  const prerequisites = bash(
    ".specify/scripts/bash/check-prerequisites.sh",
    "--json",
    "--require-tasks",
    "--include-tasks",
  );
  assert.equal(prerequisites.FEATURE_DIR, tasks.FEATURE_DIR);
  assert.ok(prerequisites.AVAILABLE_DOCS.includes("tasks.md"));
  assert.equal(resolveActiveFeature(directory).branch, BRANCH);
  assert.equal(validateRepositoryFeatureSpecs(directory), 1);
  const repeated = spawnSync("bash", start, {
    cwd: directory,
    encoding: "utf8",
  });
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /already bound/);
  assert.equal(validateRepositoryFeatureSpecs(directory), 1);
});
