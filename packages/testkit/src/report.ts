export interface ParsedTestFile {
  readonly name: string;
  readonly assertions: readonly string[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePassingReport(value: unknown): readonly ParsedTestFile[] {
  const invalid = () => new Error("Incomplete test report");
  if (
    !record(value) ||
    value.success !== true ||
    !Array.isArray(value.testResults) ||
    value.testResults.length === 0
  )
    throw invalid();
  for (const key of [
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
    "numFailedTestSuites",
    "numPendingTestSuites",
  ]) {
    if (value[key] !== 0) throw invalid();
  }
  for (const key of ["unhandledErrors", "errors"]) {
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) || value[key].length !== 0)
    )
      throw invalid();
  }
  let count = 0;
  const files = new Set<string>();
  const fullNames = new Set<string>();
  const suites = new Set<string>();
  const parsed: ParsedTestFile[] = [];
  for (const file of value.testResults) {
    if (
      !record(file) ||
      typeof file.name !== "string" ||
      file.status !== "passed" ||
      (file.message !== undefined && file.message !== "") ||
      !Array.isArray(file.assertionResults) ||
      file.assertionResults.length === 0
    )
      throw invalid();
    const name = file.name.replaceAll("\\", "/");
    if (files.has(name)) throw invalid();
    files.add(name);
    suites.add(JSON.stringify([name]));
    const names: string[] = [];
    for (const assertion of file.assertionResults) {
      if (
        !record(assertion) ||
        typeof assertion.fullName !== "string" ||
        assertion.fullName.trim() === "" ||
        assertion.status !== "passed" ||
        (assertion.failureMessages !== undefined &&
          (!Array.isArray(assertion.failureMessages) ||
            assertion.failureMessages.length !== 0))
      )
        throw invalid();
      if (fullNames.has(JSON.stringify([name, assertion.fullName])))
        throw invalid();
      if (
        !Array.isArray(assertion.ancestorTitles) ||
        !assertion.ancestorTitles.every(
          (title: unknown) => typeof title === "string",
        )
      )
        throw invalid();
      for (let depth = 1; depth <= assertion.ancestorTitles.length; depth++)
        suites.add(
          JSON.stringify([name, ...assertion.ancestorTitles.slice(0, depth)]),
        );
      fullNames.add(JSON.stringify([name, assertion.fullName]));
      names.push(assertion.fullName);
      count++;
    }
    parsed.push({ name, assertions: names.sort() });
  }
  if (
    value.numPassedTests !== count ||
    value.numTotalTests !== count ||
    value.numTotalTestSuites !== suites.size ||
    value.numPassedTestSuites !== value.numTotalTestSuites
  )
    throw invalid();
  return parsed;
}
