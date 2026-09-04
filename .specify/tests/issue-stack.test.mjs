import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  parseUnits,
  validateUnits,
  planPublication,
  publicationMarker,
} from "../scripts/issue-bindings.mjs";
import { startCommands, restackCommands } from "../scripts/issue-stack.mjs";
import { planningPr } from "../scripts/publish-planning.mjs";

const identity = {
  version: 3,
  feature_id: "KEY-123",
  feature_title: "Build a feature",
  branch: "owner/key-123-build-a-feature",
  feature_directory: "docs/features/key-123-build-a-feature",
  feature_file: "docs/features/key-123-build-a-feature/spec.md",
  work_item: {
    provider: "linear",
    issue_identifier: "KEY-123",
    issue_id: "11111111-2222-4333-8444-555555555555",
    issue_url: "https://linear.app/keynes/issue/KEY-123/build-a-feature",
  },
};
const draft = (id, title = "Generate the contract") =>
  `## ${title}\n<!-- publication-id: ${id} -->\n**Linear issue**: \`Unpublished\`\n**Git branch**: \`Unpublished\`\n**Checkpoint**: Generated consumers agree.\n`;
const published = `## KEY-124 Generate the contract
<!-- publication-id: contract -->
**Linear issue**: [KEY-124](https://linear.app/keynes/issue/KEY-124/generate-the-contract)
**Git branch**: \`owner/exact-linear-branch\`
<!-- linear-issue-id: 22222222-3333-4444-8555-666666666666 -->
**Checkpoint**: Generated consumers agree.
`;
const unit = parseUnits(published)[0];

test("partial breakdown accepts drafts and bindings without sequence", () => {
  assert.equal(
    validateUnits(identity, parseUnits(draft("future") + published)).length,
    2,
  );
  assert.deepEqual(
    validateUnits(
      identity,
      parseUnits("## Remaining design\nStill discussing."),
    ),
    [],
  );
  assert.equal(parseUnits(published)[0].branch, "owner/exact-linear-branch");
});

test("rejects incomplete, parent, duplicate and mismatched bindings", () => {
  assert.throws(
    () =>
      parseUnits(published.replace("<!-- publication-id: contract -->", "")),
    /publication ID/,
  );
  assert.throws(
    () =>
      parseUnits(
        published.replace("**Checkpoint**: Generated consumers agree.", ""),
      ),
    /checkpoint/,
  );
  assert.throws(
    () => validateUnits(identity, parseUnits(published + published)),
    /Duplicate/,
  );
  assert.throws(
    () => validateUnits(identity, [{ ...unit, branch: identity.branch }]),
    /parent/,
  );
  assert.throws(
    () => parseUnits(published.replace("/KEY-124/", "/KEY-999/")),
    /URL/,
  );
});

test("publication requires explicit selection and never creates adjacent blockers", () => {
  const units = parseUnits(draft("one") + draft("two"));
  assert.throws(() => planPublication(identity, units, [], []), /Select/);
  const result = planPublication(identity, units, ["two"], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].publicationId, "two");
  assert.equal(result[0].action, "create");
  assert.equal(Object.hasOwn(result[0], "blockedBy"), false);
  assert.equal(Object.hasOwn(result[0], "priority"), false);
  assert.throws(
    () => planPublication(identity, units, ["missing"], []),
    /Unknown/,
  );
  assert.throws(
    () => planPublication(identity, units, ["two", "two"], []),
    /Duplicate/,
  );
});

test("retry after remote creation reuses identity despite local rename or reorder", () => {
  const remote = [
    {
      uuid: "22222222-3333-4444-8555-666666666666",
      title: "Linear title",
      description: publicationMarker("KEY-123", "one"),
    },
  ];
  const units = parseUnits(draft("two") + draft("one", "A renamed unit"));
  const result = planPublication(identity, units, ["one"], remote);
  assert.equal(result[0].action, "reuse");
  assert.equal(result[0].id, remote[0].uuid);
  assert.equal(result[0].title, "Linear title");
  assert.throws(
    () =>
      planPublication(
        identity,
        units,
        ["one"],
        [...remote, { ...remote[0], uuid: "different" }],
      ),
    /Duplicate remote/,
  );
});

test("bound and historical identities survive migration without new issues", () => {
  const remote = [
    { uuid: unit.uuid, title: unit.title, description: "KEY-123/Phase-1" },
  ];
  assert.equal(
    planPublication(identity, [unit], ["KEY-124"], remote)[0].action,
    "reuse",
  );
  assert.equal(
    planPublication(
      identity,
      parseUnits(draft("Phase-1")),
      ["Phase-1"],
      remote,
    )[0].action,
    "reuse",
  );
  assert.throws(
    () => planPublication(identity, [unit], ["KEY-124"], []),
    /missing/,
  );
});

test("independent and dependent start commands use exact branches and no parent trunk", () => {
  assert.deepEqual(startCommands(unit), [
    ["gh", "stack", "init", "--base", "main", unit.branch],
  ]);
  const base = { ...unit, branch: "another/exact-branch" };
  assert.deepEqual(startCommands(unit, base), [
    ["git", "switch", base.branch],
    ["gh", "stack", "add", unit.branch],
  ]);
  assert.throws(() => startCommands(unit, unit), /different/);
  assert.throws(() => startCommands(parseUnits(draft("one"))[0]), /published/);
});

test("planning publication reuses its PR and rejects closing references", () => {
  const body = "A collaborative draft.\n\nRelated to KEY-123\n";
  assert.equal(planningPr(identity, body, []).action, "create");
  assert.equal(
    planningPr(identity, body, [
      { number: 42, state: "OPEN", baseRefName: "main" },
    ]).number,
    42,
  );
  for (const keyword of ["Closes", "Fixes", "Implements", "Linear issue:"])
    assert.throws(
      () => planningPr(identity, `${body}\n${keyword} KEY-123`, []),
      /close/,
    );
  assert.throws(
    () => planningPr(identity, body, [{ state: "MERGED" }]),
    /merged/,
  );
  assert.throws(
    () => planningPr(identity, body, [{ state: "CLOSED" }]),
    /closed/,
  );
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "keynes-issues-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".specify"));
  mkdirSync(join(root, identity.feature_directory), { recursive: true });
  writeFileSync(join(root, ".specify/feature.json"), JSON.stringify(identity));
  writeFileSync(
    join(root, identity.feature_file),
    `# ${identity.feature_title}\n\n**Linear issue**: [KEY-123](${identity.work_item.issue_url})\n**Git branch**: \`${identity.branch}\`\n<!-- linear-issue-id: ${identity.work_item.issue_id} -->\n`,
  );
  writeFileSync(join(root, identity.feature_directory, "tasks.md"), published);
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "-qm", "baseline");
  return { root, git };
}

test("resolve and start work from main; unrelated active branches are rejected", (t) => {
  const { root, git } = fixture(t);
  const script = new URL("../scripts/issue-stack.mjs", import.meta.url)
    .pathname;
  const call = (...args) =>
    spawnSync("node", [script, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(call("resolve", "KEY-124", "--json").status, 0);
  const result = call("start", "KEY-124", "--dry-run", "--json");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).commands, startCommands(unit));
  assert.notEqual(call("start", "1", "--dry-run").status, 0);
  assert.notEqual(call("merge").status, 0);
  git("switch", "-c", unit.branch);
  const active = call("active", "--json");
  assert.equal(active.status, 0, active.stderr);
  assert.equal(JSON.parse(active.stdout).feature, identity.feature_id);
  git("switch", "-c", "unrelated");
  assert.notEqual(call("active").status, 0);
});

test("restack drops squashed prerequisite commits and retargets only the dependent", (t) => {
  const { root, git } = fixture(t);
  git("switch", "-c", "prerequisite");
  writeFileSync(join(root, "base.txt"), "prerequisite\n");
  git("add", ".");
  git("commit", "-qm", "prerequisite code");
  const head = git("rev-parse", "HEAD");
  git("switch", "-c", unit.branch);
  writeFileSync(join(root, "child.txt"), "child\n");
  git("add", ".");
  git("commit", "-qm", "child code");
  git("switch", "main");
  git("merge", "--squash", "prerequisite");
  git("commit", "-qm", "squash prerequisite");
  git("update-ref", "refs/remotes/origin/main", "main");
  const merged = {
    state: "MERGED",
    headRefName: "prerequisite",
    headRefOid: head,
    baseRefName: "main",
  };
  const pr = {
    state: "OPEN",
    number: 77,
    headRefOid: git("rev-parse", unit.branch),
    headRefName: unit.branch,
    baseRefName: "prerequisite",
  };
  const commands = restackCommands(unit, merged, pr);
  git(...commands[1].slice(1));
  assert.equal(git("rev-list", "--count", `main..${unit.branch}`), "1");
  assert.equal(git("diff", "--name-only", "main", unit.branch), "child.txt");
  assert.deepEqual(commands.at(-1), [
    "gh",
    "pr",
    "edit",
    "77",
    "--base",
    "main",
  ]);
  assert.throws(
    () => restackCommands(unit, { ...merged, state: "OPEN" }, pr),
    /merged/,
  );
  assert.throws(
    () => restackCommands(unit, merged, { ...pr, baseRefName: "unrelated" }),
    /dependent/,
  );
});

test("blocker updates preserve unrelated dependencies and mutable fields", async () => {
  const { planBlockerChanges } = await import("../scripts/issue-bindings.mjs");
  const snapshot = [
    { id: "KEY-1", blockedBy: ["KEY-9"], priority: 1 },
    { id: "KEY-2", blockedBy: [] },
    { id: "KEY-9", blockedBy: [] },
  ];
  const before = JSON.stringify(snapshot);
  assert.deepEqual(planBlockerChanges("KEY-123", snapshot, []), []);
  assert.deepEqual(
    planBlockerChanges("KEY-123", snapshot, [{ id: "KEY-1", add: ["KEY-2"] }]),
    [{ id: "KEY-1", blockedBy: ["KEY-2"] }],
  );
  assert.equal(JSON.stringify(snapshot), before);
  assert.throws(
    () =>
      planBlockerChanges("KEY-123", snapshot, [
        { id: "KEY-9", add: ["KEY-1"] },
      ]),
    /cycle/,
  );
  assert.throws(
    () =>
      planBlockerChanges("KEY-123", snapshot, [
        { id: "KEY-1", add: ["KEY-123"] },
      ]),
    /Parent/,
  );
  assert.throws(
    () =>
      planBlockerChanges("KEY-123", snapshot, [
        { id: "KEY-1", add: ["KEY-99"] },
      ]),
    /snapshot/,
  );
});

test("restack handles GitHub's automatic base retarget with an explicit remote lease", () => {
  const head = "a".repeat(40);
  const child = "b".repeat(40);
  const commands = restackCommands(
    unit,
    {
      state: "MERGED",
      headRefName: "base",
      headRefOid: head,
      baseRefName: "main",
    },
    {
      state: "OPEN",
      number: 4,
      headRefName: unit.branch,
      headRefOid: child,
      baseRefName: "main",
    },
  );
  assert.deepEqual(commands[2], [
    "git",
    "push",
    `--force-with-lease=refs/heads/${unit.branch}:${child}`,
    "origin",
    unit.branch,
  ]);
});

test("planning publication rejects closing references expressed as URLs", () => {
  assert.throws(
    () =>
      planningPr(
        identity,
        `Related to KEY-123\nFixes ${identity.work_item.issue_url}`,
        [],
      ),
    /close/,
  );
});

test("publication commits only documents, creates one draft and reuses it on retry", (t) => {
  const { root, git } = fixture(t);
  const directory = mkdtempSync(join(tmpdir(), "keynes-publish-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const remote = join(directory, "remote.git");
  const initialized = spawnSync("git", ["init", "--bare", "-q", remote], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  git("remote", "add", "origin", remote);
  git("switch", "-c", identity.branch);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const state = join(directory, "pr.json");
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const path = process.env.KEYNES_TEST_PR;
const value = (flag) => args[args.indexOf(flag)+1];
let pr = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : null;
if (args[1] === 'list') console.log(JSON.stringify(pr ? [pr] : []));
else if (args[1] === 'view') console.log(JSON.stringify(pr));
else if (args[1] === 'create' || args[1] === 'edit') {
  if (args[1] === 'create' && pr) process.exit(9);
  pr = {...pr, number: 42, url: 'https://example.test/pr/42', state: 'OPEN', isDraft: true,
    headRefName: ${JSON.stringify(identity.branch)}, baseRefName: 'main',
    body: fs.readFileSync(value('--body-file'), 'utf8'), title: value('--title')};
  fs.writeFileSync(path, JSON.stringify(pr)); console.log(pr.url);
} else process.exit(8);
`,
    { mode: 0o755 },
  );
  const body = join(directory, "body.md");
  writeFileSync(body, "Collaborative planning.\n\nRelated to KEY-123\n");
  const script = new URL("../scripts/publish-planning.mjs", import.meta.url)
    .pathname;
  const publish = () =>
    spawnSync("node", [script, "--body-file", body], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        KEYNES_TEST_PR: state,
      },
    });
  writeFileSync(
    join(root, identity.feature_directory, "plan.md"),
    "Discuss design\n",
  );
  let result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).isDraft, true);
  assert.equal(JSON.parse(result.stdout).linksPending, true);
  const first = git("rev-parse", "HEAD");
  result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).number, 42);
  assert.equal(git("rev-parse", "HEAD"), first);
  writeFileSync(join(root, "unrelated.txt"), "Preserve this\n");
  result = publish();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the feature/);
  assert.equal(git("rev-parse", "HEAD"), first);
  assert.equal(git("ls-files", "unrelated.txt"), "");
});

test("a child branch resolves its feature without rewriting another feature's manifest", (t) => {
  const { root, git } = fixture(t);
  const other = {
    ...identity,
    feature_id: "KEY-200",
    feature_title: "Another feature",
    branch: "owner/key-200-another-feature",
    feature_directory: "docs/features/key-200-another-feature",
    feature_file: "docs/features/key-200-another-feature/spec.md",
    work_item: {
      provider: "linear",
      issue_identifier: "KEY-200",
      issue_id: "33333333-4444-4555-8666-777777777777",
      issue_url: "https://linear.app/keynes/issue/KEY-200/another-feature",
    },
  };
  mkdirSync(join(root, other.feature_directory), { recursive: true });
  writeFileSync(
    join(root, other.feature_file),
    `# ${other.feature_title}\n\n**Linear issue**: [KEY-200](${other.work_item.issue_url})\n**Git branch**: \`${other.branch}\`\n<!-- linear-issue-id: ${other.work_item.issue_id} -->\n`,
  );
  writeFileSync(join(root, ".specify/feature.json"), JSON.stringify(other));
  git("add", ".");
  git("commit", "-qm", "select another feature");
  git("switch", "-c", unit.branch);
  const script = new URL("../scripts/feature-identity.mjs", import.meta.url)
    .pathname;
  const result = spawnSync("node", [script, "active", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).FEATURE_ID, "KEY-123");
  assert.equal(git("status", "--porcelain"), "");
});

test("PR identity uses the event head on a detached checkout and rejects generated branches", (t) => {
  const { root, git } = fixture(t);
  git("checkout", "--detach");
  const script = new URL("../scripts/issue-stack.mjs", import.meta.url)
    .pathname;
  const eventFile = join(root, "event.json");
  const check = (event) => {
    writeFileSync(eventFile, JSON.stringify(event));
    return spawnSync("node", [script, "check-pr", "--json"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GITHUB_EVENT_PATH: eventFile },
    });
  };
  for (const [title, branch, issue] of [
    ["KEY-124 Generate the contract", unit.branch, "KEY-124"],
    ["KEY-123 Build a feature", identity.branch, "KEY-123"],
  ]) {
    const result = check({ pull_request: { title, head: { ref: branch } } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).issue, issue);
  }
  for (const [title, branch] of [
    ["KEY-124 Generate the contract", "feat/linear-mention-key-124-generate"],
    ["KEY-124 Generate the contract", identity.branch],
    ["KEY-123 Build a feature", unit.branch],
    ["KEY-1240 Wrong issue", unit.branch],
    ["KEY-124-extra Wrong token", unit.branch],
    ["Missing issue", unit.branch],
    ["KEY-124 Generate the contract", ""],
  ]) {
    const result = check({ pull_request: { title, head: { ref: branch } } });
    assert.notEqual(result.status, 0, `${title}: ${branch}`);
  }
  assert.notEqual(check({}).status, 0);
  assert.equal(git("branch", "--show-current"), "");
});
