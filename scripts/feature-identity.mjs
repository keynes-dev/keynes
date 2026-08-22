#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const FEATURE_DIRECTORY = "docs/features";
const FEATURE_NUMBER = /^[0-9]{4}$/;
const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FEATURE_BRANCH = /^feat\/([0-9]{4})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const FEATURE_DIR_NAME = /^([0-9]{4})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

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

function normalizeSlug(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .join("-");
  if (!FEATURE_SLUG.test(slug))
    fail(`Invalid feature slug: ${JSON.stringify(value)}`);
  return slug;
}

export function makeFeatureIdentity(number, slug, roadmapStage = null) {
  if (!FEATURE_NUMBER.test(number) || number === "0000") {
    fail(
      `Feature number must be four digits from 0001 through 9999: ${number}`,
    );
  }
  if (!FEATURE_SLUG.test(slug))
    fail(`Feature slug must be lowercase kebab case: ${slug}`);
  if (
    roadmapStage !== null &&
    (typeof roadmapStage !== "string" || roadmapStage.trim() === "")
  ) {
    fail("Roadmap stage must be a non-empty string or null");
  }
  const stem = `${number}-${slug}`;
  return Object.freeze({
    version: 1,
    feature_id: `FEAT-${number}`,
    number,
    slug,
    branch: `feat/${stem}`,
    feature_directory: `${FEATURE_DIRECTORY}/${stem}`,
    feature_file: `${FEATURE_DIRECTORY}/${stem}/spec.md`,
    roadmap_stage: roadmapStage,
  });
}

export function parseFeatureBranch(branch, roadmapStage = null) {
  const match = FEATURE_BRANCH.exec(branch);
  if (!match) fail(`Feature branch must match feat/XXXX-kebab-name: ${branch}`);
  return makeFeatureIdentity(match[1], match[2], roadmapStage);
}

function identityNumbers(repoRoot) {
  const identities = new Map();
  const record = (number, slug, source) => {
    const previous = identities.get(number);
    if (previous && previous.slug !== slug) {
      fail(
        `Feature number ${number} is used by both ${previous.source} and ${source}`,
      );
    }
    identities.set(number, { slug, source });
  };

  const featuresPath = join(repoRoot, FEATURE_DIRECTORY);
  if (existsSync(featuresPath)) {
    for (const entry of readdirSync(featuresPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = FEATURE_DIR_NAME.exec(entry.name);
      if (!match)
        fail(`Feature directory must match XXXX-kebab-name: ${entry.name}`);
      record(match[1], match[2], `${FEATURE_DIRECTORY}/${entry.name}`);
    }
  }

  const refs = runGit(
    repoRoot,
    ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"],
    { allowFailure: true },
  );
  if (refs.status === 0) {
    for (const ref of refs.stdout.split("\n").filter(Boolean)) {
      const marker = ref.indexOf("/feat/");
      if (marker === -1) continue;
      const branch = ref.slice(marker + 1);
      const match = FEATURE_BRANCH.exec(branch);
      if (!match) fail(`Feature ref must match feat/XXXX-kebab-name: ${ref}`);
      record(match[1], match[2], ref);
    }
  }
  return identities;
}

export function allocateFeatureIdentity(repoRoot, slug, roadmapStage = null) {
  const identities = identityNumbers(repoRoot);
  let highest = 0;
  for (const number of identities.keys())
    highest = Math.max(highest, Number(number));
  if (highest >= 9999) fail("Feature number space is exhausted at FEAT-9999");
  return makeFeatureIdentity(
    String(highest + 1).padStart(4, "0"),
    slug,
    roadmapStage,
  );
}

function manifestFromIdentity(identity) {
  return {
    version: identity.version,
    feature_id: identity.feature_id,
    slug: identity.slug,
    branch: identity.branch,
    feature_directory: identity.feature_directory,
    roadmap_stage: identity.roadmap_stage,
  };
}

function parseManifest(repoRoot) {
  const path = join(repoRoot, ".specify/feature.json");
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Cannot read .specify/feature.json: ${error.message}`);
  }
  if (!value || value.version !== 1 || typeof value.feature_id !== "string") {
    fail(".specify/feature.json does not contain a version 1 feature identity");
  }
  const number = value.feature_id.replace(/^FEAT-/, "");
  const identity = makeFeatureIdentity(
    number,
    value.slug,
    value.roadmap_stage ?? null,
  );
  for (const key of ["feature_id", "branch", "feature_directory"]) {
    if (value[key] !== identity[key]) {
      fail(
        `.specify/feature.json ${key} disagrees with ${identity.feature_id}`,
      );
    }
  }
  const absoluteDirectory = resolve(repoRoot, identity.feature_directory);
  const featureRoot = resolve(repoRoot, FEATURE_DIRECTORY);
  if (relative(featureRoot, absoluteDirectory).startsWith("..")) {
    fail("Feature directory escapes docs/features");
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
  const required = [
    `**Feature ID**: \`${identity.feature_id}\``,
    `**Feature branch**: \`${identity.branch}\``,
    `**Roadmap stage**: \`${identity.roadmap_stage ?? "None"}\``,
  ];
  for (const line of required) {
    if (!contents.includes(line))
      fail(`${identity.feature_file} is missing ${line}`);
  }
}

function verifyRoadmapStage(repoRoot, identity) {
  if (identity.roadmap_stage === null) return;
  const roadmap = readFileSync(join(repoRoot, "docs/roadmap.md"), "utf8");
  if (!roadmap.includes(`## ${identity.roadmap_stage}`)) {
    fail(`Roadmap stage not found: ${identity.roadmap_stage}`);
  }
}

export function resolveActiveFeature(
  repoRoot,
  { requireSpec = true, requireBranch = true } = {},
) {
  const identity = parseManifest(repoRoot);
  if (requireBranch) {
    const branch = runGit(repoRoot, ["branch", "--show-current"]).stdout.trim();
    if (branch !== identity.branch) {
      fail(
        `Active branch ${branch || "(detached)"} does not match ${identity.branch}`,
      );
    }
  }
  const directory = join(repoRoot, identity.feature_directory);
  if (!existsSync(directory))
    fail(`Feature directory not found: ${identity.feature_directory}`);
  if (requireSpec) verifySpecHeaders(repoRoot, identity);
  verifyRoadmapStage(repoRoot, identity);
  identityNumbers(repoRoot);
  return identity;
}

function parseArguments(argv) {
  const options = {
    json: false,
    dryRun: false,
    allowExisting: false,
    materialize: false,
  };
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--allow-existing-branch")
      options.allowExisting = true;
    else if (argument === "--materialize") options.materialize = true;
    else if (argument === "--no-branch-check") options.requireBranch = false;
    else if (["--short-name", "--roadmap-stage"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) fail(`${argument} requires a value`);
      options[argument === "--short-name" ? "shortName" : "roadmapStage"] =
        value;
      index += 1;
    } else if (argument.startsWith("--")) fail(`Unknown option: ${argument}`);
    else positionals.push(argument);
  }
  options.description = positionals.join(" ").trim();
  return options;
}

function outputIdentity(identity, format) {
  const output = {
    FEATURE_ID: identity.feature_id,
    FEATURE_NUM: identity.number,
    FEATURE_SLUG: identity.slug,
    BRANCH_NAME: identity.branch,
    FEATURE_DIR: identity.feature_directory,
    FEATURE_FILE: identity.feature_file,
    ROADMAP_STAGE: identity.roadmap_stage,
  };
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return;
  }
  if (format === "shell") {
    for (const [key, value] of Object.entries(output)) {
      const rendered = value === null ? "" : String(value);
      process.stdout.write(`${key}='${rendered.replaceAll("'", "'\\''")}'\n`);
    }
    return;
  }
  for (const [key, value] of Object.entries(output))
    process.stdout.write(`${key}: ${value ?? ""}\n`);
}

function materialize(repoRoot, identity) {
  const directory = join(repoRoot, identity.feature_directory);
  const featureFile = join(repoRoot, identity.feature_file);
  mkdirSync(directory, { recursive: true });
  if (!existsSync(featureFile)) {
    copyFileSync(
      join(repoRoot, ".specify/templates/spec-template.md"),
      featureFile,
    );
  }
}

function startFeature(repoRoot, options) {
  const hasGit = runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"], {
    allowFailure: true,
  });
  if (hasGit.status !== 0 || hasGit.stdout.trim() !== "true")
    fail("Git is required to start a feature");
  const override = process.env.GIT_BRANCH_NAME;
  const slug = normalizeSlug(options.shortName || options.description);
  const identity = override
    ? parseFeatureBranch(override, options.roadmapStage ?? null)
    : allocateFeatureIdentity(repoRoot, slug, options.roadmapStage ?? null);
  if (override && identity.slug !== slug && options.shortName) {
    fail(
      `GIT_BRANCH_NAME slug ${identity.slug} does not match --short-name ${slug}`,
    );
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
  if (exists) {
    if (!options.allowExisting)
      fail(`Branch already exists: ${identity.branch}`);
    runGit(repoRoot, ["switch", identity.branch]);
  } else {
    runGit(repoRoot, ["switch", "-c", identity.branch]);
  }
  const current = runGit(repoRoot, ["branch", "--show-current"]).stdout.trim();
  if (current !== identity.branch)
    fail(`Git created ${current}, expected ${identity.branch}`);
  writeManifest(repoRoot, identity);
  if (options.materialize) materialize(repoRoot, identity);
  return identity;
}

function checkRepository(repoRoot) {
  if (existsSync(join(repoRoot, "specs")))
    fail("Root specs/ must be migrated to docs/features/");
  identityNumbers(repoRoot);
  const identity = parseManifest(repoRoot);
  if (!existsSync(join(repoRoot, identity.feature_directory))) {
    fail(`Manifest directory not found: ${identity.feature_directory}`);
  }
  verifySpecHeaders(repoRoot, identity);
  verifyRoadmapStage(repoRoot, identity);
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
      requireSpec: true,
      requireBranch: options.requireBranch !== false,
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
