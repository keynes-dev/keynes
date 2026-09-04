#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const FEATURE_ROOT = "docs/features";
const LINEAR_IDENTIFIER = /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/;
const LINEAR_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LEGACY_FEATURE_ID = /^FEAT-([0-9]{4})$/;
const LEGACY_DIRECTORY = /^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTION_VERBS = new Set([
  "add",
  "adopt",
  "align",
  "audit",
  "bind",
  "build",
  "change",
  "check",
  "centralize",
  "configure",
  "connect",
  "consolidate",
  "convert",
  "create",
  "define",
  "delete",
  "deploy",
  "document",
  "enable",
  "enforce",
  "expand",
  "expose",
  "extract",
  "finish",
  "fix",
  "gate",
  "generate",
  "implement",
  "improve",
  "integrate",
  "isolate",
  "launch",
  "limit",
  "measure",
  "migrate",
  "merge",
  "move",
  "organize",
  "optimize",
  "prepare",
  "provision",
  "publish",
  "qualify",
  "refactor",
  "reconcile",
  "record",
  "recover",
  "refresh",
  "remove",
  "rename",
  "replace",
  "restore",
  "retire",
  "review",
  "rewrite",
  "route",
  "secure",
  "separate",
  "ship",
  "simplify",
  "split",
  "standardize",
  "support",
  "test",
  "update",
  "upgrade",
  "unify",
  "validate",
  "verify",
]);

export class FeatureIdentityError extends Error {}

function fail(message) {
  throw new FeatureIdentityError(message);
}

function findRepoRoot(start = process.cwd()) {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, ".specify"))) return current;
    const parent = dirname(current);
    if (parent === current)
      fail("Could not find a repository containing .specify");
    current = parent;
  }
}

function runGit(repoRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    fail(
      (result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim(),
    );
  }
  return result;
}

function validateIssueUrl(identifier, issueUrl) {
  let url;
  try {
    url = new URL(issueUrl);
  } catch {
    fail(`Linear issue URL is invalid: ${issueUrl}`);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "linear.app" ||
    !url.pathname.toLowerCase().includes(`/issue/${identifier.toLowerCase()}/`)
  ) {
    fail(`Linear issue URL does not match ${identifier}: ${issueUrl}`);
  }
}

export function makeWorkItem(issueId, issueIdentifier, issueUrl) {
  if (!LINEAR_UUID.test(issueId))
    fail(`Linear issue ID must be a lowercase UUID: ${issueId}`);
  if (!LINEAR_IDENTIFIER.test(issueIdentifier)) {
    fail(`Linear issue identifier is invalid: ${issueIdentifier}`);
  }
  validateIssueUrl(issueIdentifier, issueUrl);
  return Object.freeze({
    provider: "linear",
    issue_id: issueId,
    issue_identifier: issueIdentifier,
    issue_url: issueUrl,
  });
}

export function validateActionTitle(title, label = "Title") {
  if (typeof title !== "string" || title.trim() !== title || !title) {
    fail(`${label} must be a non-empty exact title`);
  }
  const [firstWord] = title.split(" ");
  if (!ACTION_VERBS.has(firstWord.toLowerCase())) {
    fail(`${label} must start with an imperative action verb: ${title}`);
  }
  return title;
}

export function validateGitBranch(repoRoot, branch) {
  if (typeof branch !== "string" || branch.length === 0)
    fail("Linear branch name is required");
  const result = runGit(repoRoot, ["check-ref-format", "--branch", branch], {
    allowFailure: true,
  });
  if (result.status !== 0)
    fail(`Linear branch name is not a valid Git branch: ${branch}`);
  return branch;
}

function featureDirectoryForBranch(branch) {
  return `${FEATURE_ROOT}/${branch.slice(branch.lastIndexOf("/") + 1)}`;
}

export function makeFeatureIdentity(
  repoRoot,
  issueIdentifier,
  featureTitle,
  branch,
  workItem,
) {
  if (!workItem || workItem.provider !== "linear")
    fail("A Linear work item is required");
  const validatedWorkItem = makeWorkItem(
    workItem.issue_id,
    workItem.issue_identifier,
    workItem.issue_url,
  );
  if (issueIdentifier !== validatedWorkItem.issue_identifier) {
    fail("Feature ID must equal the Linear issue identifier");
  }
  validateActionTitle(featureTitle, "Linear feature title");
  validateGitBranch(repoRoot, branch);
  const featureDirectory = featureDirectoryForBranch(branch);
  return Object.freeze({
    version: 3,
    feature_id: issueIdentifier,
    feature_title: featureTitle,
    feature_directory: featureDirectory,
    feature_file: `${featureDirectory}/spec.md`,
    branch,
    work_item: validatedWorkItem,
  });
}

function makeLegacyIdentity(value) {
  const match = LEGACY_FEATURE_ID.exec(value.feature_id || "");
  if (
    !match ||
    typeof value.slug !== "string" ||
    !LEGACY_DIRECTORY.test(`${match[1]}-${value.slug}`)
  ) {
    fail("Invalid version 2 feature manifest");
  }
  const workItem = makeWorkItem(
    value.work_item?.issue_id,
    value.work_item?.issue_identifier,
    value.work_item?.issue_url,
  );
  const featureDirectory = `${FEATURE_ROOT}/${match[1]}-${value.slug}`;
  if (value.feature_directory !== featureDirectory) {
    fail("Version 2 feature directory disagrees with its feature identity");
  }
  return Object.freeze({
    version: 2,
    feature_id: value.feature_id,
    feature_title: null,
    feature_directory: featureDirectory,
    feature_file: `${featureDirectory}/spec.md`,
    branch: value.branch,
    work_item: workItem,
  });
}

function manifestFromIdentity(identity) {
  if (identity.version === 2) {
    const [, number] = LEGACY_FEATURE_ID.exec(identity.feature_id);
    return {
      version: 2,
      feature_id: identity.feature_id,
      slug: identity.feature_directory.slice(
        `${FEATURE_ROOT}/${number}-`.length,
      ),
      branch: identity.branch,
      feature_directory: identity.feature_directory,
      work_item: identity.work_item,
    };
  }
  return {
    version: 3,
    feature_id: identity.feature_id,
    feature_title: identity.feature_title,
    feature_directory: identity.feature_directory,
    feature_file: identity.feature_file,
    branch: identity.branch,
    work_item: identity.work_item,
  };
}

export function parseManifest(
  repoRoot,
  manifestPath = ".specify/feature.json",
) {
  let value;
  try {
    value = JSON.parse(readFileSync(join(repoRoot, manifestPath), "utf8"));
  } catch (error) {
    fail(`Cannot read ${manifestPath}: ${error.message}`);
  }
  if (value?.version === 2) return makeLegacyIdentity(value);
  if (value?.version !== 3) fail(`${manifestPath} must use version 2 or 3`);
  const workItem = makeWorkItem(
    value.work_item?.issue_id,
    value.work_item?.issue_identifier,
    value.work_item?.issue_url,
  );
  const identity = makeFeatureIdentity(
    repoRoot,
    value.feature_id,
    value.feature_title,
    value.branch,
    workItem,
  );
  const expected = manifestFromIdentity(identity);
  for (const key of ["feature_directory", "feature_file"]) {
    if (value[key] !== expected[key])
      fail(`${manifestPath} ${key} disagrees with ${identity.feature_id}`);
  }
  return identity;
}

function writeManifest(repoRoot, identity) {
  const path = join(repoRoot, ".specify/feature.json");
  const temporary = `${path}.tmp`;
  writeFileSync(
    temporary,
    `${JSON.stringify(manifestFromIdentity(identity), null, 2)}\n`,
  );
  renameSync(temporary, path);
}

function verifySpecHeaders(repoRoot, identity) {
  const featureFile = join(repoRoot, identity.feature_file);
  if (!existsSync(featureFile))
    fail(`Feature specification not found: ${identity.feature_file}`);
  const contents = readFileSync(featureFile, "utf8");
  const required =
    identity.version === 2
      ? [
          `**Feature ID**: \`${identity.feature_id}\``,
          `**Feature branch**: \`${identity.branch}\``,
          `**Linear issue**: [${identity.work_item.issue_identifier}](${identity.work_item.issue_url})`,
        ]
      : [
          `# ${identity.feature_title}`,
          `**Linear issue**: [${identity.feature_id}](${identity.work_item.issue_url})`,
          `**Git branch**: \`${identity.branch}\``,
          `<!-- linear-issue-id: ${identity.work_item.issue_id} -->`,
        ];
  for (const line of required) {
    if (!contents.includes(line))
      fail(`${identity.feature_file} is missing ${line}`);
  }
}

export function parseSpecIdentity(repoRoot, directory) {
  const relativeFile = `${FEATURE_ROOT}/${directory}/spec.md`;
  if (!existsSync(join(repoRoot, relativeFile))) {
    fail(`Feature specification not found: ${relativeFile}`);
  }
  const contents = readFileSync(join(repoRoot, relativeFile), "utf8");
  const issue = /^\*\*Linear issue\*\*: \[([^\]]+)\]\(([^)]+)\)$/m.exec(
    contents,
  );
  const branch = /^\*\*Git branch\*\*: `([^`]+)`$/m.exec(contents);
  const uuid = /^<!-- linear-issue-id: ([0-9a-f-]+) -->$/m.exec(contents);
  const title = /^# (.+)$/m.exec(contents);
  if (!issue || !branch || !uuid || !title)
    fail(`${relativeFile} lacks the Linear-native feature header`);
  const identity = makeFeatureIdentity(
    repoRoot,
    issue[1],
    title[1],
    branch[1],
    makeWorkItem(uuid[1], issue[1], issue[2]),
  );
  if (identity.feature_directory !== `${FEATURE_ROOT}/${directory}`) {
    fail(
      `${relativeFile} directory must equal the final segment of ${identity.branch}`,
    );
  }
  return identity;
}

export function validateRepositoryFeatureSpecs(repoRoot) {
  const seen = { keys: new Map(), uuids: new Map(), branches: new Map() };
  let count = 0;
  for (const entry of readdirSync(join(repoRoot, FEATURE_ROOT), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const identity = parseSpecIdentity(repoRoot, entry.name);
    for (const [value, index, label] of [
      [identity.feature_id, seen.keys, "key"],
      [identity.work_item.issue_id, seen.uuids, "UUID"],
      [identity.branch, seen.branches, "branch"],
    ]) {
      const previous = index.get(value);
      if (previous)
        fail(
          `Duplicate Linear ${label} ${value}: ${previous} and ${entry.name}`,
        );
      index.set(value, entry.name);
    }
    for (const artifact of ["plan.md", "tasks.md"]) {
      const path = join(repoRoot, FEATURE_ROOT, entry.name, artifact);
      if (!existsSync(path)) continue;
      if (
        !readFileSync(path, "utf8")
          .split("\n", 1)[0]
          .includes(identity.feature_title)
      ) {
        fail(
          `${FEATURE_ROOT}/${entry.name}/${artifact} must use the exact Linear title`,
        );
      }
    }
    count += 1;
  }
  return count;
}

export function resolveActiveFeature(
  repoRoot,
  { requireSpec = true, requireBranch = true } = {},
) {
  const identity = parseManifest(repoRoot);
  const absoluteDirectory = resolve(repoRoot, identity.feature_directory);
  if (
    relative(resolve(repoRoot, FEATURE_ROOT), absoluteDirectory).startsWith(
      "..",
    )
  ) {
    fail("Feature directory escapes docs/features");
  }
  if (requireBranch) {
    const branch = runGit(repoRoot, ["branch", "--show-current"]).stdout.trim();
    if (branch !== identity.branch) {
      fail(
        `Active branch ${branch || "(detached)"} does not match ${identity.branch}`,
      );
    }
  }
  if (!existsSync(absoluteDirectory))
    fail(`Feature directory not found: ${identity.feature_directory}`);
  if (requireSpec) verifySpecHeaders(repoRoot, identity);
  return identity;
}

function parseArguments(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      json: { type: "boolean" },
      "dry-run": { type: "boolean" },
      "allow-existing-branch": { type: "boolean" },
      materialize: { type: "boolean" },
      "no-branch-check": { type: "boolean" },
      "linear-issue-id": { type: "string" },
      "linear-issue-identifier": { type: "string" },
      "linear-issue-title": { type: "string" },
      "linear-issue-url": { type: "string" },
      "linear-branch-name": { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length) fail(`Unexpected argument: ${positionals.join(" ")}`);
  return {
    json: values.json === true,
    dryRun: values["dry-run"] === true,
    allowExisting: values["allow-existing-branch"] === true,
    materialize: values.materialize === true,
    requireBranch: values["no-branch-check"] !== true,
    linearIssueId: values["linear-issue-id"],
    linearIssueIdentifier: values["linear-issue-identifier"],
    linearIssueTitle: values["linear-issue-title"],
    linearIssueUrl: values["linear-issue-url"],
    linearBranchName: values["linear-branch-name"],
  };
}

function outputIdentity(identity, format) {
  const output = {
    FEATURE_ID: identity.feature_id,
    FEATURE_TITLE: identity.feature_title,
    BRANCH_NAME: identity.branch,
    FEATURE_DIR: identity.feature_directory,
    FEATURE_FILE: identity.feature_file,
    LINEAR_ISSUE_ID: identity.work_item.issue_id,
    LINEAR_ISSUE_IDENTIFIER: identity.work_item.issue_identifier,
    LINEAR_ISSUE_URL: identity.work_item.issue_url,
  };
  if (format === "json")
    return process.stdout.write(`${JSON.stringify(output)}\n`);
  if (format === "shell") {
    for (const [key, value] of Object.entries(output)) {
      process.stdout.write(
        `${key}='${String(value ?? "").replaceAll("'", "'\\''")}'\n`,
      );
    }
    return;
  }
  for (const [key, value] of Object.entries(output))
    process.stdout.write(`${key}: ${value ?? ""}\n`);
}

function materialize(repoRoot, identity) {
  mkdirSync(join(repoRoot, identity.feature_directory), { recursive: true });
  if (!existsSync(join(repoRoot, identity.feature_file))) {
    copyFileSync(
      join(repoRoot, ".specify/templates/spec-template.md"),
      join(repoRoot, identity.feature_file),
    );
  }
}

function startFeature(repoRoot, options) {
  const workItem = makeWorkItem(
    options.linearIssueId,
    options.linearIssueIdentifier,
    options.linearIssueUrl,
  );
  const identity = makeFeatureIdentity(
    repoRoot,
    options.linearIssueIdentifier,
    options.linearIssueTitle,
    options.linearBranchName,
    workItem,
  );
  if (
    existsSync(join(repoRoot, identity.feature_directory)) &&
    !options.allowExisting
  ) {
    fail(`Linear issue is already bound: ${identity.feature_id}`);
  }
  if (options.dryRun) return identity;
  const exists =
    runGit(
      repoRoot,
      ["show-ref", "--verify", `refs/heads/${identity.branch}`],
      {
        allowFailure: true,
      },
    ).status === 0;
  if (exists && !options.allowExisting)
    fail(`Branch already exists: ${identity.branch}`);
  if (exists) {
    const stored = parseManifest(repoRoot);
    if (
      JSON.stringify(manifestFromIdentity(stored)) !==
      JSON.stringify(manifestFromIdentity(identity))
    ) {
      fail(`Existing branch ${identity.branch} is bound to another feature`);
    }
    runGit(repoRoot, ["switch", identity.branch]);
  } else {
    runGit(repoRoot, ["switch", "-c", identity.branch]);
  }
  writeManifest(repoRoot, identity);
  if (options.materialize) materialize(repoRoot, identity);
  return identity;
}

function checkRepository(repoRoot) {
  if (existsSync(join(repoRoot, "specs")))
    fail("Root specs/ must be migrated to docs/features/");
  validateRepositoryFeatureSpecs(repoRoot);
  const identity = parseManifest(repoRoot);
  if (identity.version !== 3)
    fail("Active repository manifest must use version 3");
  verifySpecHeaders(repoRoot, identity);
  return identity;
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  const repoRoot = findRepoRoot();
  const options = parseArguments(argv);
  let identity;
  if (command === "start") identity = startFeature(repoRoot, options);
  else if (command === "active") {
    identity = resolveActiveFeature(repoRoot, {
      requireBranch: options.requireBranch,
    });
  } else if (command === "check-repository")
    identity = checkRepository(repoRoot);
  else
    fail(
      "Usage: feature-identity.mjs <start|active|check-repository> [options]",
    );
  outputIdentity(
    identity,
    options.json ? "json" : command === "active" ? "shell" : "text",
  );
}

if (resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
