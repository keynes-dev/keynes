#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveActiveFeature } from "./feature-identity.mjs";

export function planningPr(identity, body, prs) {
  if (!body.includes(`Related to ${identity.feature_id}`))
    throw new Error(
      `Planning body must contain Related to ${identity.feature_id}`,
    );
  if (
    new RegExp(
      `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|complete[sd]?|implement(?:s|ed)?|linear issue)\\s*:?[\\s\\[*]*${identity.feature_id}\\b`,
      "i",
    ).test(body.replaceAll(identity.work_item.issue_url, identity.feature_id))
  )
    throw new Error("Planning PR must not close the parent issue");
  const open = prs.filter((pr) => pr.state === "OPEN");
  if (open.length > 1)
    throw new Error("Multiple open planning PRs for this branch");
  if (!open.length && prs.some((pr) => pr.state === "MERGED"))
    throw new Error(
      "Planning baseline is merged; put later design changes on the selected issue branch",
    );
  if (!open.length && prs.length)
    throw new Error(
      "Planning PR was closed; resolve its disposition before publishing again",
    );
  if (open[0] && open[0].baseRefName !== "main")
    throw new Error("Planning PR must target main");
  return {
    action: open.length ? "update" : "create",
    number: open[0]?.number,
    title: `${identity.feature_id} ${identity.feature_title}`,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      "body-file": { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  if (!values["body-file"] || !existsSync(values["body-file"]))
    throw new Error(
      "Provide --body-file with a completed repository PR description",
    );
  const run = (command, args) => {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.status !== 0)
      throw new Error(result.stderr || result.stdout || `${command} failed`);
    return result.stdout.trim();
  };
  values["body-file"] = resolve(values["body-file"]);
  const root = run("git", ["rev-parse", "--show-toplevel"]);
  process.chdir(root);
  const identity = resolveActiveFeature(root);
  if (run("git", ["branch", "--show-current"]) !== identity.branch)
    throw new Error(
      "Publish the selected issue PR from a sub-issue branch; this command publishes the parent planning PR",
    );
  const body = readFileSync(values["body-file"], "utf8");
  const prs = JSON.parse(
    run("gh", [
      "pr",
      "list",
      "--head",
      identity.branch,
      "--state",
      "all",
      "--limit",
      "100",
      "--json",
      "number,state,url,baseRefName",
    ]),
  );
  const plan = planningPr(identity, body, prs);
  if (values["dry-run"])
    return process.stdout.write(`${JSON.stringify(plan)}\n`);
  // Publication never sweeps unreviewed changes into a commit.
  const allowed = (path) =>
    path === ".specify/feature.json" ||
    path.startsWith(`${identity.feature_directory}/`);
  const changed = run("git", ["diff", "--name-only", "HEAD"])
    .split("\n")
    .filter(Boolean);
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean);
  if ([...changed, ...untracked].some((path) => !allowed(path)))
    throw new Error(
      "Commit or preserve changes outside the feature documents before publishing",
    );
  run("git", [
    "add",
    "--",
    identity.feature_directory,
    ".specify/feature.json",
  ]);
  if (run("git", ["diff", "--cached", "--name-only"]))
    run("git", [
      "commit",
      "-m",
      `${identity.feature_id} Update planning documents`,
    ]);
  run("git", ["push", "-u", "origin", identity.branch]);
  if (plan.action === "create")
    run("gh", [
      "pr",
      "create",
      "--draft",
      "--base",
      "main",
      "--head",
      identity.branch,
      "--title",
      plan.title,
      "--body-file",
      values["body-file"],
    ]);
  else
    run("gh", [
      "pr",
      "edit",
      String(plan.number),
      "--title",
      plan.title,
      "--body-file",
      values["body-file"],
    ]);
  const pr = JSON.parse(
    run("gh", [
      "pr",
      "view",
      identity.branch,
      "--json",
      "number,url,state,isDraft,headRefName,baseRefName,body",
    ]),
  );
  if (
    pr.state !== "OPEN" ||
    pr.headRefName !== identity.branch ||
    pr.baseRefName !== "main" ||
    pr.body !== body
  )
    throw new Error(
      "Planning PR read-back differs from the publication request",
    );
  process.stdout.write(
    `${JSON.stringify({ ...pr, linearIssue: identity.work_item.issue_id, linksPending: true })}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
