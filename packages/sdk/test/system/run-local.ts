import { spawn } from "node:child_process";
import { glob, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { providerFreeEnvironment } from "@keynes/testkit/package";
import { manageChild, waitWithCancellation } from "@keynes/testkit/process";
import { parsePassingReport } from "@keynes/testkit/report";

const SDK = fileURLToPath(new URL("../..", import.meta.url));
export const LOCAL_GROUPS = [
  "test/unit/local",
  "test/unit/public",
  "test/unit/policy",
  "test/contract/budget.test.ts",
];

export function validateLocalReport(
  value: unknown,
  expected: readonly string[],
): void {
  const files = parsePassingReport(value)
    .map((file) => file.name)
    .sort();
  if (
    expected.length === 0 ||
    JSON.stringify(files) !==
      JSON.stringify(expected.map((path) => path.replaceAll("\\", "/")).sort())
  )
    throw new Error("Local suite selection is incomplete");
}

export async function localTestFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const group of LOCAL_GROUPS) {
    const selected: string[] = [];
    for await (const file of glob(
      group.endsWith(".ts") ? group : `${group}/**/*.test.ts`,
      { cwd: SDK },
    ))
      selected.push(join(SDK, file));
    if (selected.length === 0)
      throw new Error(`Local test group is empty: ${group}`);
    files.push(...selected);
  }
  return files;
}

export async function runLocalTests(
  args: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  const options = args[0] === "--" ? args.slice(1) : args;
  if (options.length === 1 && options[0] === "--help") {
    process.stdout.write(
      "Run Local source feedback without services or packaging. No options required.\n",
    );
    return;
  }
  if (options.length !== 0)
    throw new Error("Local feedback accepts only standalone --help");
  signal?.throwIfAborted();
  const files = await localTestFiles();
  process.stdout.write(
    `Local source feedback: ${LOCAL_GROUPS.join(", ")}. Installed and other deployment acceptance NOT RUN.\n`,
  );
  const directory = await mkdtemp(join(tmpdir(), "keynes-local-report-"));
  const report = join(directory, "vitest.json");
  const child = manageChild(
    spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "../../../../node_modules/vitest/vitest.mjs",
            import.meta.url,
          ),
        ),
        "run",
        ...files,
        "--maxWorkers=1",
        "--allowOnly=false",
        "--passWithNoTests=false",
        "--reporter=default",
        "--reporter=json",
        `--outputFile=${report}`,
      ],
      {
        cwd: SDK,
        env: providerFreeEnvironment(process.env),
        stdio: "inherit",
        detached: process.platform !== "win32",
      },
    ),
  );
  const failures: unknown[] = [];
  try {
    await waitWithCancellation(child.wait(), signal);
    validateLocalReport(JSON.parse(await readFile(report, "utf8")), files);
  } catch (error) {
    failures.push(error);
  }
  try {
    await child.terminate();
  } catch (error) {
    failures.push(error);
  }
  try {
    await rm(directory, { recursive: true, force: true });
  } catch (error) {
    failures.push(error);
  }
  signal?.throwIfAborted();
  if (failures.length)
    throw new AggregateError(failures, "Local tests or cleanup failed");
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    await runLocalTests(process.argv.slice(2), controller.signal);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Local feedback failed"}\n`,
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
