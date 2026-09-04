#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import {
  parseSpecIdentity,
  resolveActiveFeature,
} from "./feature-identity.mjs";

import {
  PhaseStackError,
  parsePhases,
  validatePhases,
} from "./phase-bindings.mjs";
export {
  PhaseStackError,
  parsePhases,
  validatePhases,
  publicationMarker,
} from "./phase-bindings.mjs";

function fail(message) {
  throw new PhaseStackError(message);
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
  const phases = validatePhases(
    identity,
    parsePhases(readFileSync(tasksPath, "utf8")),
  );
  return { identity, phases, tasksPath };
}

function runGh(repoRoot, args, dryRun) {
  if (dryRun) return { command: ["gh", "stack", ...args] };
  const available = spawnSync("gh", ["stack", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (available.status !== 0)
    fail(
      "GitHub CLI does not provide `gh stack`; install or enable stacked PR support",
    );
  const result = spawnSync("gh", ["stack", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) fail(`gh stack ${args[0]} failed`);
  return { command: ["gh", "stack", ...args] };
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
    const phases = parsePhases(readFileSync(tasksPath, "utf8"));
    const identity = parseSpecIdentity(repoRoot, entry.name);
    if (phases.some((phase) => phase.state !== "legacy")) {
      validatePhases(identity, phases);
      for (const phase of phases.filter(
        (candidate) => candidate.state === "published",
      )) {
        for (const [value, seen, label] of [
          [phase.issue.identifier, issues, "issue"],
          [phase.uuid, uuids, "UUID"],
          [phase.branch, branches, "branch"],
        ]) {
          const previous = seen.get(value);
          if (previous)
            fail(
              `Duplicate phase ${label} ${value}: ${previous} and ${identity.feature_id}`,
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
    },
    allowPositionals: true,
    strict: true,
  });
  const repoRoot = findRepoRoot();
  if (command === "check" && values.repository)
    return output(checkRepository(repoRoot), values.json);
  const { identity, phases } = loadActive(repoRoot, {
    requireBranch: command !== "check",
  });
  if (command === "active") {
    const current = spawnSync("git", ["branch", "--show-current"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).stdout.trim();
    const phase =
      phases.find((candidate) => candidate.branch === current) ?? null;
    return output({ feature: identity.feature_id, phase }, values.json);
  }
  if (command === "check")
    return output({ feature: identity.feature_id, phases }, values.json);
  if (command === "init") {
    const first = phases[0];
    if (first.state !== "published") fail("Phase 1 is not published to Linear");
    return output(
      runGh(
        repoRoot,
        ["init", "--base", identity.branch, first.branch],
        values["dry-run"],
      ),
      values.json,
    );
  }
  if (command === "start") {
    const number = Number(positionals[0]);
    if (!Number.isInteger(number) || positionals.length !== 1)
      fail("start requires one phase number");
    if (number === 1)
      fail("Phase 1 is initialized with `phase-stack.mjs init`");
    const phase = phases[number - 1];
    if (!phase) fail(`Phase ${number} does not exist`);
    if (phase.state !== "published")
      fail(`Phase ${number} is not published to Linear`);
    return output(
      runGh(repoRoot, ["add", phase.branch], values["dry-run"]),
      values.json,
    );
  }
  if (command === "submit")
    return output(runGh(repoRoot, ["submit"], values["dry-run"]), values.json);
  fail("Usage: phase-stack.mjs <active|check|init|start|submit> [options]");
}

if (resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
