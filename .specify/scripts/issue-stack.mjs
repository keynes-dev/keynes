#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import {
  parseSpecIdentity,
  resolveActiveFeature,
  validateGitBranch,
} from "./feature-identity.mjs";

import {
  IssueWorkflowError,
  parseUnits,
  validateUnits,
} from "./issue-bindings.mjs";
export {
  IssueWorkflowError,
  parseUnits,
  validateUnits,
  publicationMarker,
  planPublication,
} from "./issue-bindings.mjs";

function fail(message) {
  throw new IssueWorkflowError(message);
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

function loadActive(repoRoot, { requireBranch = true } = {}) {
  const identity = resolveActiveFeature(repoRoot, { requireBranch });
  const tasksPath = join(repoRoot, identity.feature_directory, "tasks.md");
  if (!existsSync(tasksPath))
    fail(`Task file not found: ${identity.feature_directory}/tasks.md`);
  const units = validateUnits(
    identity,
    parseUnits(readFileSync(tasksPath, "utf8")),
  );
  return { identity, units, tasksPath };
}

function run(repoRoot, command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0)
    fail(result.stderr || result.stdout || `${command[0]} failed`);
  return result.stdout.trim();
}

export function startCommands(unit, base = null) {
  if (!unit || unit.state !== "published")
    fail("Select a published sub-issue key");
  if (base && (base.state !== "published" || base.branch === unit.branch))
    fail("Select a different published base issue");
  return base
    ? [
        ["git", "switch", base.branch],
        ["gh", "stack", "add", unit.branch],
      ]
    : [["gh", "stack", "init", "--base", "main", unit.branch]];
}

export function restackCommands(unit, merged, pr) {
  if (merged.state !== "MERGED" || merged.baseRefName !== "main")
    fail("Prerequisite must be merged into main");
  if (!/^[0-9a-f]{40}$/.test(merged.headRefOid))
    fail("Merged prerequisite head SHA is required");
  if (
    pr.state !== "OPEN" ||
    pr.headRefName !== unit.branch ||
    ![merged.headRefName, "main"].includes(pr.baseRefName)
  )
    fail("PR is not an open direct dependent of this prerequisite");
  if (!/^[0-9a-f]{40}$/.test(pr.headRefOid))
    fail("Dependent remote head SHA is required");
  return [
    ["git", "fetch", "origin"],
    ["git", "rebase", "--onto", "origin/main", merged.headRefOid, unit.branch],
    [
      "git",
      "push",
      `--force-with-lease=refs/heads/${unit.branch}:${pr.headRefOid}`,
      "origin",
      unit.branch,
    ],
    ["gh", "pr", "edit", String(pr.number), "--base", "main"],
  ];
}

export function findIssue(repoRoot, identifier) {
  const matches = [];
  for (const entry of readdirSync(join(repoRoot, "docs/features"), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const path = join(repoRoot, "docs/features", entry.name, "tasks.md");
    if (!existsSync(path)) continue;
    const units = parseUnits(readFileSync(path, "utf8"));
    if (!units.length) continue;
    const identity = parseSpecIdentity(repoRoot, entry.name);
    validateUnits(identity, units);
    for (const unit of units)
      if (unit.branch) validateGitBranch(repoRoot, unit.branch);
    for (const unit of units)
      if (unit.issue?.identifier === identifier)
        matches.push({ identity, unit });
  }
  if (matches.length !== 1)
    fail(
      `Expected one published sub-issue ${identifier}, found ${matches.length}`,
    );
  return matches[0];
}

function checkRepository(repoRoot) {
  const root = join(repoRoot, "docs/features");
  const issues = new Map();
  const uuids = new Map();
  const branches = new Map();
  let checked = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tasksPath = join(root, entry.name, "tasks.md");
    if (!existsSync(tasksPath)) continue;
    const units = parseUnits(readFileSync(tasksPath, "utf8"));
    const identity = parseSpecIdentity(repoRoot, entry.name);
    if (units.some((unit) => unit.state !== "legacy")) {
      validateUnits(identity, units);
      for (const unit of units)
        if (unit.branch) validateGitBranch(repoRoot, unit.branch);
      for (const unit of units.filter(
        (candidate) => candidate.state === "published",
      )) {
        for (const [value, seen, label] of [
          [unit.issue.identifier, issues, "issue"],
          [unit.uuid, uuids, "UUID"],
          [unit.branch, branches, "branch"],
        ]) {
          const previous = seen.get(value);
          if (previous)
            fail(
              `Duplicate unit ${label} ${value}: ${previous} and ${identity.feature_id}`,
            );
          seen.set(value, identity.feature_id);
        }
      }
      checked += 1;
    }
  }
  return { checked };
}

function output(value, json) {
  if (json) process.stdout.write(`${JSON.stringify(value)}\n`);
  else if (value.command) process.stdout.write(`${value.command.join(" ")}\n`);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, ...argv] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      json: { type: "boolean" },
      "dry-run": { type: "boolean" },
      repository: { type: "boolean" },
      "base-issue": { type: "string" },
      "merged-pr": { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  const repoRoot = findRepoRoot();
  if (command === "check" && values.repository)
    return output(checkRepository(repoRoot), values.json);
  if (["start", "resolve", "restack"].includes(command)) {
    if (
      positionals.length !== 1 ||
      !/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(positionals[0])
    )
      fail(`${command} requires one Linear sub-issue key`);
    const { identity, unit } = findIssue(repoRoot, positionals[0]);
    if (command === "resolve") return output({ identity, unit }, values.json);
    let commands;
    let preflight = null;
    if (command === "start") {
      const base = values["base-issue"]
        ? findIssue(repoRoot, values["base-issue"])
        : null;
      if (base && base.identity.feature_id !== identity.feature_id)
        fail("Cross-feature prerequisite: merge it before starting this issue");
      commands = startCommands(unit, base?.unit);
    } else {
      if (!values["merged-pr"]) fail("restack requires --merged-pr <number>");
      const fields = "number,state,headRefName,headRefOid,baseRefName";
      const merged = JSON.parse(
        run(repoRoot, [
          "gh",
          "pr",
          "view",
          values["merged-pr"],
          "--json",
          fields,
        ]),
      );
      const pr = JSON.parse(
        run(repoRoot, ["gh", "pr", "view", unit.branch, "--json", fields]),
      );
      commands = restackCommands(unit, merged, pr);
      preflight = () => {
        const local = run(repoRoot, ["git", "rev-parse", unit.branch]);
        const remote = run(repoRoot, [
          "git",
          "rev-parse",
          `origin/${unit.branch}`,
        ]);
        if (local !== pr.headRefOid || remote !== pr.headRefOid)
          fail(
            "Local and remote dependent heads must match the inspected PR before restacking",
          );
        run(repoRoot, [
          "git",
          "merge-base",
          "--is-ancestor",
          merged.headRefOid,
          unit.branch,
        ]);
      };
    }
    if (!values["dry-run"]) {
      if (run(repoRoot, ["git", "status", "--porcelain"]))
        fail("Commit or preserve outstanding changes before changing branches");
      for (const [index, action] of commands.entries()) {
        run(repoRoot, action);
        if (index === 0 && preflight) preflight();
      }
    }
    return output(
      { feature: identity.feature_id, issue: unit.issue.identifier, commands },
      values.json,
    );
  }
  if (!["active", "check"].includes(command))
    fail(
      "Usage: issue-stack.mjs <check|active|resolve KEY-N|start KEY-N|restack KEY-N> [--base-issue KEY-N] [--merged-pr number] [--dry-run]",
    );
  const { identity, units } = loadActive(repoRoot, {
    requireBranch: command !== "check",
  });
  if (command === "active") {
    const branch = run(repoRoot, ["git", "branch", "--show-current"]);
    return output(
      {
        feature: identity.feature_id,
        unit: units.find((unit) => unit.branch === branch) ?? null,
      },
      values.json,
    );
  }
  return output({ feature: identity.feature_id, units }, values.json);
}

if (resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
