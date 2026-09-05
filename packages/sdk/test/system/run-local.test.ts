import { expect, it } from "vitest";
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
it.each([
  ["/local.test.ts", "/local.test.ts"],
  [String.raw`C:\repo\local.test.ts`, String.raw`C:\repo\local.test.ts`],
  ["C:/repo/local.test.ts", String.raw`C:\repo\local.test.ts`],
])(
  "checks selected files using the existing strict report parser: %s",
  (reported, expected) => {
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
          name: reported,
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
    expect(() => validateLocalReport(report, [expected])).not.toThrow();
    expect(() => validateLocalReport(report, ["/missing.test.ts"])).toThrow();
    expect(() => validateLocalReport(report, [])).toThrow();
    report.numPendingTests = 1;
    expect(() => validateLocalReport(report, [expected])).toThrow();
  },
);
