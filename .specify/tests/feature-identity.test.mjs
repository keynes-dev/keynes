import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
  assert.throws(
    () =>
      makeFeatureIdentity(
        directory,
        IDENTIFIER,
        "Accountable budget loop",
        BRANCH,
        WORK_ITEM,
      ),
    /imperative action verb/,
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
