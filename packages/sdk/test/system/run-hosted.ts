import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import { arch, platform, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  readSourceSnapshot,
  type SourceSnapshot,
} from "@keynes/testkit/snapshot";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const REASON = "supported Hosted product runner unavailable";
const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function parseHostedArguments(
  args: readonly string[],
): { kind: "help" } | { kind: "run"; outputPath: string } {
  const { values, tokens } = parseArgs({
    args: args[0] === "--" ? args.slice(1) : args,
    options: { output: { type: "string" }, help: { type: "boolean" } },
    strict: true,
    allowPositionals: false,
    tokens: true,
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option" || seen.has(token.name))
      throw new Error("Unexpected or repeated argument");
    seen.add(token.name);
    if (
      token.value !== undefined &&
      (token.value.trim() === "" || token.value.startsWith("--"))
    )
      throw new Error("Argument requires a value");
  }
  if (values.help) {
    if (tokens.length !== 1) throw new Error("--help must be used alone");
    return { kind: "help" };
  }
  if (!values.output) throw new Error("--output is required");
  return { kind: "run", outputPath: resolve(ROOT, values.output) };
}
export async function runHosted(
  outputPath: string,
  snapshot: (signal?: AbortSignal) => Promise<SourceSnapshot> = (signal) =>
    readSourceSnapshot(ROOT, signal),
  signal?: AbortSignal,
) {
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(outputPath);
  const initial = {
    attemptId: randomUUID(),
    selection: { kind: "hosted" },
    outcome: "NOT RUN",
    reason: REASON,
  };
  const bytes = `${JSON.stringify(initial, null, 2)}\n`;
  await writeFile(join(outputPath, "initial.json"), bytes, { flag: "wx" });
  let before: SourceSnapshot | undefined;
  let after: SourceSnapshot | undefined;
  let source: "stable" | "changed" | "unavailable" = "unavailable";
  try {
    before = await snapshot(signal);
    after = await snapshot(signal);
    source =
      validSnapshot(before) &&
      validSnapshot(after) &&
      JSON.stringify(before) === JSON.stringify(after)
        ? "stable"
        : "changed";
  } catch {
    /* Only the safe source-status code is retained. */
  }
  const manifest = {
    schemaVersion: "keynes.deployment-test/v1",
    ...initial,
    outcome: source === "stable" ? "NOT RUN" : "failed",
    candidate: { before, after },
    source,
    environment: {
      node: process.versions.node,
      os: platform(),
      osRelease: release(),
      architecture: arch(),
    },
    stages: [{ name: "hosted-product", kind: "NOT RUN", cause: REASON }],
    exclusions: {
      liveExecution: "NOT RUN",
      provisioning: "NOT RUN",
      database: "NOT RUN",
      packageQualification: "NOT RUN",
      cleanup: "NOT RUN; no resources acquired",
    },
    evidence: [{ path: "initial.json", sha256: hash(bytes) }],
  };
  await validateHostedEvidence(outputPath, manifest);
  const pending = join(outputPath, "manifest.pending.json");
  await writeFile(pending, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });
  await link(pending, join(outputPath, "manifest.json"));
  await unlink(pending);
  return manifest;
}
export async function validateHostedEvidence(
  directory: string,
  value: unknown,
): Promise<void> {
  if (
    !record(value) ||
    value.schemaVersion !== "keynes.deployment-test/v1" ||
    typeof value.attemptId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.attemptId,
    ) ||
    JSON.stringify(value.selection) !== JSON.stringify({ kind: "hosted" }) ||
    value.reason !== REASON ||
    !record(value.candidate) ||
    !["stable", "changed", "unavailable"].includes(String(value.source)) ||
    value.outcome !== (value.source === "stable" ? "NOT RUN" : "failed") ||
    JSON.stringify(value.stages) !==
      JSON.stringify([
        { name: "hosted-product", kind: "NOT RUN", cause: REASON },
      ]) ||
    JSON.stringify(value.exclusions) !==
      JSON.stringify({
        liveExecution: "NOT RUN",
        provisioning: "NOT RUN",
        database: "NOT RUN",
        packageQualification: "NOT RUN",
        cleanup: "NOT RUN; no resources acquired",
      }) ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== 1 ||
    !record(value.evidence[0]) ||
    value.evidence[0].path !== "initial.json" ||
    value.inputs !== undefined
  )
    throw new Error("Invalid Hosted refusal");
  if (
    value.source === "stable" &&
    (!validSnapshot(value.candidate.before) ||
      JSON.stringify(value.candidate.before) !==
        JSON.stringify(value.candidate.after))
  )
    throw new Error("Hosted source identity changed");
  const path = join(directory, "initial.json");
  if ((await lstat(path)).isSymbolicLink())
    throw new Error("Unsafe Hosted evidence");
  const bytes = await readFile(path);
  if (
    hash(bytes) !== value.evidence[0].sha256 ||
    JSON.stringify(JSON.parse(bytes.toString())) !==
      JSON.stringify({
        attemptId: value.attemptId,
        selection: { kind: "hosted" },
        outcome: "NOT RUN",
        reason: REASON,
      })
  )
    throw new Error("Hosted evidence changed");
}
function validSnapshot(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.commit === "string" &&
    /^[a-f0-9]{40}$/.test(value.commit) &&
    typeof value.clean === "boolean" &&
    (value.clean
      ? value.dirtyInputSha256 === null
      : typeof value.dirtyInputSha256 === "string" &&
        /^[a-f0-9]{64}$/.test(value.dirtyInputSha256))
  );
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
    const args = parseHostedArguments(process.argv.slice(2));
    if (args.kind === "help")
      process.stdout.write(
        "Hosted acceptance is unavailable. --output <new-directory> records NOT RUN and exits 1.\n",
      );
    else {
      const result = await runHosted(
        args.outputPath,
        undefined,
        controller.signal,
      );
      process.stdout.write(`${result.outcome}: ${REASON}\n`);
      process.exitCode = 1;
    }
  } catch {
    process.stderr.write(
      "Hosted refusal could not be recorded; use --help or inspect the attempt.\n",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
