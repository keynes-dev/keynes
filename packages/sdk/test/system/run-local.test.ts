import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_GROUPS,
  runLocalTests,
  validateLocalReport,
} from "./run-local.ts";

it("selects existing source groups without package or remote suites", () => {
  expect(LOCAL_GROUPS).toEqual([
    "test/unit/local",
    "test/unit/public",
    "test/unit/policy",
    "test/contract/budget.test.ts",
  ]);
});
it("keeps standalone help and rejects acceptance options", async () => {
  await expect(runLocalTests(["--help"])).resolves.toBeUndefined();
  await expect(runLocalTests(["--output", "unused"])).rejects.toThrow();
  await expect(runLocalTests(["--sdk-archive", "unused"])).rejects.toThrow();
});
it("checks selected files using the existing strict report parser", () => {
  const report = {
    success: true,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numPassedTests: 1,
    numTotalTests: 1,
    numTotalTestSuites: 1,
    numPassedTestSuites: 1,
    testResults: [
      {
        name: "/local.test.ts",
        status: "passed",
        assertionResults: [
          {
            fullName: "behavior",
            ancestorTitles: [],
            status: "passed",
            failureMessages: [],
          },
        ],
      },
    ],
  };
  expect(() => validateLocalReport(report, ["/local.test.ts"])).not.toThrow();
  expect(() => validateLocalReport(report, ["/missing.test.ts"])).toThrow();
  expect(() => validateLocalReport(report, [])).toThrow();
  report.numPendingTests = 1;
  expect(() => validateLocalReport(report, ["/local.test.ts"])).toThrow();
});

describe("Shared source snapshots used by acceptance", () => {
  it("hashes dirty contents even when Git status stays unchanged", async () => {
    const { execFileSync } = await import("node:child_process");
    const { readSourceSnapshot } = await import("@keynes/testkit/snapshot");
    const root = await mkdtemp(join(tmpdir(), "keynes-source-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, stdio: "ignore" });
    try {
      git("init");
      git("config", "user.email", "test@example.invalid");
      git("config", "user.name", "Test");
      await writeFile(join(root, "tracked.txt"), "initial");
      await writeFile(join(root, ".gitignore"), "ignored/\n");
      git("add", ".");
      git("commit", "-m", "fixture");
      const clean = await readSourceSnapshot(root);
      expect(clean.clean).toBe(true);
      await writeFile(join(root, "tracked.txt"), "first change");
      const first = await readSourceSnapshot(root);
      await writeFile(join(root, "tracked.txt"), "second change");
      const second = await readSourceSnapshot(root);
      expect(first.clean).toBe(false);
      expect(first.dirtyInputSha256).not.toBe(second.dirtyInputSha256);
      await writeFile(join(root, "untracked.txt"), "third input");
      expect(await readSourceSnapshot(root)).not.toEqual(second);
      const beforeIgnored = await readSourceSnapshot(root);
      await mkdir(join(root, "ignored"));
      await writeFile(join(root, "ignored/report.json"), "generated");
      expect(await readSourceSnapshot(root)).toEqual(beforeIgnored);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
