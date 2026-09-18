/// <reference types="node" />

import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ApprovedCategory =
  | "documentation"
  | "spec-kit-record"
  | "repository-metadata";

export type ChangedStatus = "A" | "M" | "D" | "T" | "U" | "X" | "B";

export interface ChangedPath {
  readonly status: ChangedStatus;
  readonly path: string;
}

export interface ClassifiedPath extends ChangedPath {
  readonly category: ApprovedCategory | "relevant";
}

export type RelevanceDecision =
  | {
      readonly disposition: "relevant";
      readonly paths: readonly ClassifiedPath[];
    }
  | {
      readonly disposition: "not-applicable";
      readonly paths: readonly (ClassifiedPath & {
        readonly category: ApprovedCategory;
      })[];
    };

export interface ClassifierRuntime {
  readonly readFile: (path: string) => Buffer;
  readonly appendFile: (path: string, value: string) => void;
  readonly command: (file: string, args: readonly string[]) => Buffer;
}

export interface ClassifierEnvironment {
  readonly GITHUB_EVENT_PATH?: string;
  readonly GITHUB_OUTPUT?: string;
  readonly GITHUB_SHA?: string;
  readonly GITHUB_STEP_SUMMARY?: string;
}

export interface ClassificationReport {
  readonly base: string;
  readonly head: string;
  readonly mergeBase: string;
  readonly checkout: string;
  readonly decision: RelevanceDecision;
}

const shaPattern = /^[0-9a-f]{40}$/u;
const exactMetadata = new Set([
  "AGENTS.md",
  "LICENSE",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
]);

const defaultRuntime: ClassifierRuntime = {
  readFile: (path) => readFileSync(path),
  appendFile: (path, value) => appendFileSync(path, value),
  command: (file, args) =>
    execFileSync(file, [...args], { maxBuffer: 16 * 1024 * 1024 }),
};

export function parseNameStatusZ(output: Buffer): readonly ChangedPath[] {
  if (output.length === 0) throw new Error("Git change set is empty");
  if (output.at(-1) !== 0)
    throw new Error("Git change set is not NUL terminated");

  const payload = output.subarray(0, -1);
  const decoded = payload.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(payload))
    throw new Error("Git change set contains invalid UTF-8");

  const tokens = decoded.split("\0");
  if (tokens.length === 0 || tokens.length % 2 !== 0)
    throw new Error("Git change set has malformed status records");

  const changed: ChangedPath[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index];
    const path = tokens[index + 1];
    if (!isChangedStatus(status))
      throw new Error(`Unsupported Git status: ${JSON.stringify(status)}`);
    validateRepositoryPath(path);
    if (seen.has(path))
      throw new Error(`Duplicate changed path: ${JSON.stringify(path)}`);
    seen.add(path);
    changed.push({ status, path });
  }
  return changed;
}

export function classifyChangedPaths(
  changed: readonly ChangedPath[],
): RelevanceDecision {
  if (changed.length === 0) throw new Error("Changed path list is empty");

  const seen = new Set<string>();
  const paths = changed.map((entry): ClassifiedPath => {
    if (!isChangedStatus(entry.status))
      throw new Error(
        `Unsupported Git status: ${JSON.stringify(entry.status)}`,
      );
    validateRepositoryPath(entry.path);
    if (seen.has(entry.path))
      throw new Error(`Duplicate changed path: ${JSON.stringify(entry.path)}`);
    seen.add(entry.path);
    return {
      ...entry,
      category: approvedCategory(entry.path) ?? "relevant",
    };
  });

  if (paths.every(isApprovedPath)) {
    return { disposition: "not-applicable", paths };
  }
  return { disposition: "relevant", paths };
}

export function validateRelevanceDecision(value: unknown): RelevanceDecision {
  if (!isRecord(value) || !Array.isArray(value.paths))
    throw new Error("Invalid relevance decision");
  if (
    value.disposition !== "relevant" &&
    value.disposition !== "not-applicable"
  )
    throw new Error("Invalid relevance disposition");

  const changed: ChangedPath[] = [];
  const suppliedCategories: string[] = [];
  for (const path of value.paths) {
    if (
      !isRecord(path) ||
      !isChangedStatus(path.status) ||
      typeof path.path !== "string" ||
      typeof path.category !== "string"
    ) {
      throw new Error("Invalid classified path");
    }
    changed.push({ status: path.status, path: path.path });
    suppliedCategories.push(path.category);
  }

  const expected = classifyChangedPaths(changed);
  if (
    expected.disposition !== value.disposition ||
    expected.paths.some(
      (path, index) => path.category !== suppliedCategories[index],
    )
  ) {
    throw new Error("Contradictory relevance decision");
  }
  return expected;
}

export function renderSummary(report: ClassificationReport): string {
  validateSha(report.base, "event base");
  validateSha(report.head, "event head");
  validateSha(report.mergeBase, "merge base");
  validateSha(report.checkout, "checked-out candidate");
  const decision = validateRelevanceDecision(report.decision);
  const lines = [
    "## SQLite and PostgreSQL relevance",
    "",
    `- Checked-out candidate: \`${report.checkout}\``,
    `- Event head: \`${report.head}\``,
    `- Event base: \`${report.base}\``,
    `- Merge base: \`${report.mergeBase}\``,
    `- Disposition: \`${decision.disposition}\``,
    "",
    "### Changed paths",
    "",
    ...decision.paths.map(
      (path) =>
        `    ${JSON.stringify({ status: path.status, path: path.path, category: path.category })}`,
    ),
    "",
  ];

  if (decision.disposition === "not-applicable") {
    lines.push(
      "SQLite: NOT RUN",
      "",
      "PostgreSQL: NOT RUN",
      "",
      "No database evidence was produced for this revision.",
    );
  } else {
    lines.push(
      "Repository correctness tests include SQLite; the database job runs native PostgreSQL source correctness. Full qualification is explicit.",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function runClassifier(
  environment: ClassifierEnvironment,
  runtime: ClassifierRuntime = defaultRuntime,
): ClassificationReport {
  const eventPath = requiredEnvironment(
    environment.GITHUB_EVENT_PATH,
    "GITHUB_EVENT_PATH",
  );
  const outputPath = requiredEnvironment(
    environment.GITHUB_OUTPUT,
    "GITHUB_OUTPUT",
  );
  const summaryPath = requiredEnvironment(
    environment.GITHUB_STEP_SUMMARY,
    "GITHUB_STEP_SUMMARY",
  );
  const githubSha = validateSha(
    requiredEnvironment(environment.GITHUB_SHA, "GITHUB_SHA"),
    "GITHUB_SHA",
  );
  const event = parsePullRequestEvent(runtime.readFile(eventPath));

  runtime.command("git", ["cat-file", "-e", `${event.base}^{commit}`]);
  runtime.command("git", ["cat-file", "-e", `${event.head}^{commit}`]);
  const checkout = commandSha(
    runtime,
    ["rev-parse", "HEAD"],
    "checked-out candidate",
  );
  if (checkout !== githubSha)
    throw new Error("Checked-out candidate differs from GITHUB_SHA");
  const mergeBase = commandSha(
    runtime,
    ["merge-base", event.base, event.head],
    "merge base",
  );
  const changed = parseNameStatusZ(
    runtime.command("git", [
      "diff",
      "--name-status",
      "-z",
      "--no-renames",
      mergeBase,
      event.head,
      "--",
    ]),
  );
  const decision = validateRelevanceDecision(classifyChangedPaths(changed));
  const report = {
    base: event.base,
    head: event.head,
    mergeBase,
    checkout,
    decision,
  } satisfies ClassificationReport;

  const runDatabases = decision.disposition === "relevant" ? "true" : "false";
  runtime.appendFile(summaryPath, renderSummary(report));
  runtime.appendFile(
    outputPath,
    `run_databases=${runDatabases}\ndisposition=${decision.disposition}\n`,
  );
  return report;
}

function approvedCategory(path: string): ApprovedCategory | undefined {
  if (path.startsWith("docs/")) return "documentation";
  if (path.startsWith(".specify/memory/")) return "spec-kit-record";
  if (exactMetadata.has(path)) return "repository-metadata";
  return undefined;
}

function isApprovedPath(
  path: ClassifiedPath,
): path is ClassifiedPath & { readonly category: ApprovedCategory } {
  return path.category !== "relevant";
}

function parsePullRequestEvent(bytes: Buffer): { base: string; head: string } {
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (!isRecord(value) || !isRecord(value.pull_request))
    throw new Error("Missing pull_request event payload");
  const pullRequest = value.pull_request;
  if (!isRecord(pullRequest.base) || !isRecord(pullRequest.head))
    throw new Error("Missing pull request revisions");
  if (
    typeof pullRequest.base.sha !== "string" ||
    typeof pullRequest.head.sha !== "string"
  ) {
    throw new Error("Missing pull request SHAs");
  }
  return {
    base: validateSha(pullRequest.base.sha, "event base"),
    head: validateSha(pullRequest.head.sha, "event head"),
  };
}

function commandSha(
  runtime: ClassifierRuntime,
  args: readonly string[],
  label: string,
): string {
  return validateSha(
    runtime.command("git", args).toString("utf8").trim(),
    label,
  );
}

function validateSha(value: string, label: string): string {
  if (!shaPattern.test(value)) throw new Error(`Invalid ${label} SHA`);
  return value;
}

function validateRepositoryPath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Invalid repository path: ${JSON.stringify(path)}`);
  }
}

function requiredEnvironment(value: string | undefined, name: string): string {
  if (value === undefined || value === "")
    throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isChangedStatus(value: unknown): value is ChangedStatus {
  return (
    value === "A" ||
    value === "M" ||
    value === "D" ||
    value === "T" ||
    value === "U" ||
    value === "X" ||
    value === "B"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runClassifier(process.env);
}
