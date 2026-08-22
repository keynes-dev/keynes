import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  FeatureIdentityError,
  allocateFeatureIdentity,
  makeFeatureIdentity,
  parseFeatureBranch,
  resolveActiveFeature,
} from "./feature-identity.mjs";

function git(directory, ...args) {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "keynes-feature-identity-"));
  mkdirSync(join(directory, ".specify"));
  mkdirSync(join(directory, "docs/features"), { recursive: true });
  git(directory, "init", "-q");
  writeFileSync(join(directory, ".gitignore"), "\n");
  git(directory, "add", ".gitignore");
  git(
    directory,
    "-c",
    "user.name=Feature Identity Test",
    "-c",
    "user.email=feature-identity@example.invalid",
    "commit",
    "-q",
    "-m",
    "fixture",
  );
  return directory;
}

test("constructs one canonical identity", () => {
  assert.deepEqual(makeFeatureIdentity("0001", "repository-baseline"), {
    version: 1,
    feature_id: "FEAT-0001",
    number: "0001",
    slug: "repository-baseline",
    branch: "feat/0001-repository-baseline",
    feature_directory: "docs/features/0001-repository-baseline",
    feature_file: "docs/features/0001-repository-baseline/spec.md",
    roadmap_stage: null,
  });
});

test("rejects invalid numbers and slugs", () => {
  for (const number of ["0000", "001", "10000", "abcd"]) {
    assert.throws(
      () => makeFeatureIdentity(number, "valid-name"),
      FeatureIdentityError,
    );
  }
  for (const slug of ["", "Uppercase", "two_words", "../escape"]) {
    assert.throws(
      () => makeFeatureIdentity("0001", slug),
      FeatureIdentityError,
    );
  }
});

test("parses only canonical feature branches", () => {
  assert.equal(
    parseFeatureBranch("feat/0042-contract-foundation").feature_id,
    "FEAT-0042",
  );
  for (const branch of [
    "0042-contract-foundation",
    "feat-0042-contract-foundation",
    "feat/042-name",
  ]) {
    assert.throws(() => parseFeatureBranch(branch), FeatureIdentityError);
  }
});

test("allocates after feature directories and canonical refs", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/0001-baseline"));
  git(directory, "branch", "feat/0003-future-work");
  assert.equal(
    allocateFeatureIdentity(directory, "next-work").feature_id,
    "FEAT-0004",
  );
});

test("rejects duplicate numbers with different slugs", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/0001-baseline"));
  git(directory, "branch", "feat/0001-other-work");
  assert.throws(
    () => allocateFeatureIdentity(directory, "next-work"),
    /used by both/,
  );
});

test("rejects malformed feature directories", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/001-wrong-width"));
  assert.throws(
    () => allocateFeatureIdentity(directory, "next-work"),
    /must match/,
  );
});

test("stops after FEAT-9999", async () => {
  const directory = await fixture();
  mkdirSync(join(directory, "docs/features/9999-last-feature"));
  assert.throws(
    () => allocateFeatureIdentity(directory, "next-work"),
    /exhausted/,
  );
});

test("requires the branch, manifest, directory, and spec metadata to agree", async () => {
  const directory = await fixture();
  const featureDirectory = join(
    directory,
    "docs/features/0001-canonical-identity",
  );
  mkdirSync(featureDirectory);
  writeFileSync(join(directory, "docs/roadmap.md"), "## Repository baseline\n");
  writeFileSync(
    join(directory, ".specify/feature.json"),
    `${JSON.stringify({
      version: 1,
      feature_id: "FEAT-0001",
      slug: "canonical-identity",
      branch: "feat/0001-canonical-identity",
      feature_directory: "docs/features/0001-canonical-identity",
      roadmap_stage: "Repository baseline",
    })}\n`,
  );
  writeFileSync(
    join(featureDirectory, "spec.md"),
    [
      "**Feature ID**: `FEAT-0001`",
      "**Feature branch**: `feat/0001-canonical-identity`",
      "**Roadmap stage**: `Repository baseline`",
    ].join("\n"),
  );
  git(directory, "switch", "-c", "feat/0001-canonical-identity");

  assert.equal(resolveActiveFeature(directory).feature_id, "FEAT-0001");

  writeFileSync(
    join(featureDirectory, "spec.md"),
    "**Feature ID**: `FEAT-0001`\n**Feature branch**: `feat/0002-wrong`\n**Roadmap stage**: `Repository baseline`\n",
  );
  assert.throws(() => resolveActiveFeature(directory), FeatureIdentityError);
});
