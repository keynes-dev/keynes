import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const featurePath = "docs/features/pilot";
const featureFiles = ["spec.md", "plan.md", "tasks.md", "acceptance.md"];
const gitConfig = [
  "-c",
  "user.name=Retention Pilot",
  "-c",
  "user.email=pilot@example.invalid",
  "-c",
  "commit.gpgSign=false",
  "-c",
  "core.hooksPath=/dev/null",
];
const environment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  LC_ALL: "C",
};

export interface RetentionPilotResult {
  readonly schemaVersion: "keynes.feature-retention-pilot/v1";
  readonly positive: {
    readonly source: string;
    readonly evidence: string;
    readonly deletion: string;
    readonly merge: string;
    readonly files: Readonly<Record<string, string>>;
    readonly deletedPaths: readonly string[];
    readonly cloneBranches: readonly string[];
    readonly exampleOutput: "pilot-ok";
  };
  readonly negative: {
    readonly squashOriginalEvidenceRetained: false;
    readonly rebaseOriginalEvidenceRetained: false;
  };
  readonly shallow: {
    readonly availableBeforeFetch: false;
    readonly availableAfterFetch: true;
    readonly bytesMatch: true;
  };
  readonly permanentLink: {
    readonly rejected: true;
    readonly target: "features/pilot/spec.md";
  };
}

export function runFeatureRetentionPilot(): RetentionPilotResult {
  const root = mkdtempSync(join(tmpdir(), "keynes-retention-pilot-"));
  try {
    const positive = runPositive(join(root, "positive"));
    const squash = runSquash(join(root, "squash"));
    const rebase = runRebase(join(root, "rebase"));
    return {
      schemaVersion: "keynes.feature-retention-pilot/v1",
      positive: positive.record,
      negative: {
        squashOriginalEvidenceRetained: squash,
        rebaseOriginalEvidenceRetained: rebase,
      },
      shallow: positive.shallow,
      permanentLink: positive.permanentLink,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runPositive(root: string): {
  readonly record: RetentionPilotResult["positive"];
  readonly shallow: RetentionPilotResult["shallow"];
  readonly permanentLink: RetentionPilotResult["permanentLink"];
} {
  const fixture = createFixture(root);
  const feature = createFeature(fixture.work);
  git(fixture.work, ["switch", "--quiet", "main"]);
  git(fixture.work, ["merge", "--ff-only", "feature/pilot"]);
  const merge = revision(fixture.work);
  git(fixture.work, ["push", "--quiet", "origin", "main"]);
  git(fixture.work, ["branch", "-D", "feature/pilot"]);
  strictEqual(
    git(fixture.remote, ["for-each-ref", "--format=%(refname)", "refs/heads"]),
    "refs/heads/main",
    "remote branch inventory",
  );

  const clone = join(root, "clone");
  git(root, [
    "clone",
    "--quiet",
    "--no-local",
    "--single-branch",
    "--branch",
    "main",
    fixture.remote,
    clone,
  ]);
  requireAncestor(clone, feature.evidence);
  requireAncestor(clone, feature.deletion);
  strictEqual(revision(clone), merge, "merge revision");
  strictEqual(git(clone, ["ls-files", featurePath]), "", "latest tree");
  const retrieved = retrieveFiles(clone, feature.evidence);
  deepStrictEqual(retrieved, feature.hashes, "retrieved feature bytes");
  strictEqual(runExample(clone), "pilot-ok", "permanent example");
  requireRelativeLink(clone, "docs/guide.md", "../README.md");

  const shallow = join(root, "shallow");
  git(root, [
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--single-branch",
    "--branch",
    "main",
    pathToFileURL(fixture.remote).href,
    shallow,
  ]);
  if (
    gitSucceeds(shallow, ["show", `${feature.evidence}:${featurePath}/spec.md`])
  )
    throw new Error("Shallow clone unexpectedly retained feature evidence");
  git(shallow, ["fetch", "--quiet", "--unshallow", "origin", "main"]);
  requireAncestor(shallow, feature.evidence);
  deepStrictEqual(
    retrieveFiles(shallow, feature.evidence),
    feature.hashes,
    "unshallowed feature bytes",
  );

  write(
    fixture.work,
    "docs/broken.md",
    "[deleted plan](features/pilot/spec.md)\n",
  );
  let rejected = false;
  try {
    requireRelativeLink(
      fixture.work,
      "docs/broken.md",
      "features/pilot/spec.md",
    );
  } catch {
    rejected = true;
  }
  if (!rejected)
    throw new Error("Permanent link to deleted feature was accepted");

  return {
    record: {
      source: feature.source,
      evidence: feature.evidence,
      deletion: feature.deletion,
      merge,
      files: feature.hashes,
      deletedPaths: feature.deletedPaths,
      cloneBranches: git(clone, ["branch", "--format=%(refname:short)"])
        .split("\n")
        .filter(Boolean),
      exampleOutput: "pilot-ok",
    },
    shallow: {
      availableBeforeFetch: false,
      availableAfterFetch: true,
      bytesMatch: true,
    },
    permanentLink: {
      rejected: true,
      target: "features/pilot/spec.md",
    },
  };
}

function runSquash(root: string): false {
  const fixture = createFixture(root);
  const feature = createFeature(fixture.work);
  git(fixture.work, ["switch", "--quiet", "main"]);
  git(fixture.work, ["merge", "--squash", "feature/pilot"]);
  commit(fixture.work, "squash pilot");
  git(fixture.work, ["push", "--quiet", "origin", "main"]);
  const clone = join(root, "clone");
  git(root, [
    "clone",
    "--quiet",
    "--no-local",
    "--single-branch",
    "--branch",
    "main",
    fixture.remote,
    clone,
  ]);
  if (
    gitSucceeds(clone, [
      "merge-base",
      "--is-ancestor",
      feature.evidence,
      "HEAD",
    ])
  )
    throw new Error("Squash unexpectedly retained the evidence commit");
  return false;
}

function runRebase(root: string): false {
  const fixture = createFixture(root);
  const feature = createFeature(fixture.work);
  git(fixture.work, ["switch", "--quiet", "main"]);
  write(fixture.work, "base.txt", "advanced base\n");
  commit(fixture.work, "advance main");
  git(fixture.work, ["switch", "--quiet", "feature/pilot"]);
  git(fixture.work, ["rebase", "--quiet", "main"]);
  git(fixture.work, ["switch", "--quiet", "main"]);
  git(fixture.work, [
    "merge",
    "--no-ff",
    "feature/pilot",
    "-m",
    "merge rebased pilot",
  ]);
  git(fixture.work, ["push", "--quiet", "origin", "main"]);
  const clone = join(root, "clone");
  git(root, [
    "clone",
    "--quiet",
    "--no-local",
    "--single-branch",
    "--branch",
    "main",
    fixture.remote,
    clone,
  ]);
  if (
    gitSucceeds(clone, [
      "merge-base",
      "--is-ancestor",
      feature.evidence,
      "HEAD",
    ])
  )
    throw new Error(
      "Rebase unexpectedly retained the original evidence commit",
    );
  return false;
}

function createFixture(root: string): {
  readonly remote: string;
  readonly work: string;
} {
  mkdirSync(root, { recursive: true });
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  git(root, ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  git(root, ["init", "--quiet", "--initial-branch=main", work]);
  write(work, "README.md", "# Pilot\n");
  commit(work, "initial");
  git(work, ["remote", "add", "origin", remote]);
  git(work, ["push", "--quiet", "-u", "origin", "main"]);
  return { remote, work };
}

function createFeature(work: string): {
  readonly source: string;
  readonly evidence: string;
  readonly deletion: string;
  readonly hashes: Readonly<Record<string, string>>;
  readonly deletedPaths: readonly string[];
} {
  git(work, ["switch", "--quiet", "-c", "feature/pilot"]);
  write(
    work,
    "examples/pilot.mjs",
    'import assert from "node:assert/strict";\nassert.equal(2 + 2, 4);\nprocess.stdout.write("pilot-ok\\n");\n',
  );
  write(work, "docs/guide.md", "# Pilot guide\n\n[Repository](../README.md)\n");
  const source = commit(work, "pilot source");
  strictEqual(runExample(work), "pilot-ok", "source example");
  for (const name of featureFiles) {
    const body =
      name === "acceptance.md"
        ? `# Acceptance\n\nSource: \`${source}\`\n\nCommand: \`node examples/pilot.mjs\`\n\nResult: \`pilot-ok\`\n`
        : `# ${name.replace(".md", "")}\n\nPublic fixture content.\n`;
    write(work, `${featurePath}/${name}`, body);
  }
  const evidence = commit(work, "pilot evidence");
  const hashes = Object.fromEntries(
    featureFiles.map((name) => {
      const path = `${featurePath}/${name}`;
      return [path, sha256(readFileSync(join(work, path)))];
    }),
  );
  rmSync(join(work, featurePath), { recursive: true });
  const deletion = commit(work, "delete pilot plans");
  const deletedPaths = git(work, ["diff", "--name-status", evidence, deletion])
    .split("\n")
    .filter(Boolean);
  deepStrictEqual(
    [...deletedPaths].sort(),
    featureFiles.map((name) => `D\t${featurePath}/${name}`).sort(),
    "deletion diff",
  );
  strictEqual(runExample(work), "pilot-ok", "deletion example");
  requireRelativeLink(work, "docs/guide.md", "../README.md");
  return { source, evidence, deletion, hashes, deletedPaths };
}

function requireRelativeLink(
  root: string,
  sourcePath: string,
  target: string,
): void {
  const source = join(root, sourcePath);
  if (!readFileSync(source, "utf8").includes(`](${target})`))
    throw new Error(`Missing fixture link: ${sourcePath} -> ${target}`);
  const resolved = resolve(dirname(source), target);
  if (!resolved.startsWith(`${resolve(root)}/`) || !existsSync(resolved))
    throw new Error(`Broken fixture link: ${sourcePath} -> ${target}`);
}

function retrieveFiles(root: string, evidence: string): Record<string, string> {
  return Object.fromEntries(
    featureFiles.map((name) => {
      const path = `${featurePath}/${name}`;
      return [path, sha256(gitBytes(root, ["show", `${evidence}:${path}`]))];
    }),
  );
}

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function commit(root: string, message: string): string {
  git(root, ["add", "-A"]);
  git(root, ["commit", "--quiet", "-m", message]);
  return revision(root);
}

function revision(root: string): string {
  return git(root, ["rev-parse", "HEAD"]);
}

function requireAncestor(root: string, revision_: string): void {
  if (!gitSucceeds(root, ["merge-base", "--is-ancestor", revision_, "HEAD"]))
    throw new Error(`Missing ancestor: ${revision_}`);
}

function runExample(root: string): string {
  return execFileSync(process.execPath, ["examples/pilot.mjs"], {
    cwd: root,
    env: environment,
    encoding: "utf8",
  }).trim();
}

function git(root: string, args: readonly string[]): string {
  return gitBytes(root, args).toString("utf8").trim();
}

function gitBytes(root: string, args: readonly string[]): Buffer {
  return execFileSync("git", [...gitConfig, ...args], {
    cwd: root,
    env: environment,
  });
}

function gitSucceeds(root: string, args: readonly string[]): boolean {
  return (
    spawnSync("git", [...gitConfig, ...args], {
      cwd: root,
      env: environment,
      stdio: "ignore",
    }).status === 0
  );
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.stdout.write(
    `${JSON.stringify(runFeatureRetentionPilot(), null, 2)}\n`,
  );
}
