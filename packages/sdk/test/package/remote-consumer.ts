import { randomUUID } from "node:crypto";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runProcess } from "@keynes/testkit/process";
import { providerFreeEnvironment } from "@keynes/testkit/package";
import { inspectArchive, installExternalConsumer } from "./qualify.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
export const REMOTE_CONSUMER_CASES = [
  "verified-budget-workflow",
  "tenant-isolation",
  "reconnect-exact-replay",
  "operation-conflict",
  "unavailable-endpoint",
  "wrong-ca",
  "wrong-hostname",
] as const;
export interface RemoteConsumerInput {
  readonly attemptId?: string;
  readonly archivePath: string;
  readonly targets: readonly {
    readonly mode: string;
    readonly primaryUrl: string;
    readonly secondaryUrl: string;
    readonly wrongCaUrl: string;
    readonly wrongHostnameUrl: string;
    readonly unavailableUrl: string;
  }[];
}

export async function runRemoteConsumer(
  input: RemoteConsumerInput,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const attemptId = input.attemptId ?? randomUUID();
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      attemptId,
    )
  )
    throw new Error("Invalid consumer attempt identity");
  if (
    input.targets.length === 0 ||
    new Set(input.targets.map((target) => target.mode)).size !==
      input.targets.length ||
    input.targets.some(
      (target) =>
        !["direct", "session-pool", "transaction-pool"].includes(target.mode),
    )
  )
    throw new Error("Invalid consumer targets");
  const archive = await inspectArchive(input.archivePath);
  const checks: {
    mode: string;
    check: string;
    status: "passed" | "failed" | "NOT RUN";
    failureCode?: string;
  }[] = input.targets.flatMap((target) =>
    REMOTE_CONSUMER_CASES.map((check) => ({
      mode: target.mode,
      check,
      status: "NOT RUN",
    })),
  );
  let cleanup: "passed" | "failed" = "passed";
  let executionFailed = false;
  const external = await installExternalConsumer(
    input.archivePath,
    archive.compressedBytes,
  );
  try {
    await cp(
      fileURLToPath(new URL("remote-consumer.mts", import.meta.url)),
      join(external.root, "remote-consumer.mts"),
    );
    await writeFile(
      join(external.root, "remote-tsconfig.json"),
      JSON.stringify({
        extends: "./tsconfig.json",
        include: ["remote-consumer.mts"],
      }),
    );
    await runProcess({
      executable: process.execPath,
      args: [
        join(ROOT, "node_modules/typescript/bin/tsc"),
        "--project",
        join(external.root, "remote-tsconfig.json"),
      ],
      cwd: external.root,
      signal,
    });
    for (const target of input.targets) {
      const output = await runProcess({
        executable: process.execPath,
        args: [join(external.root, "build/remote-consumer.mjs")],
        cwd: external.root,
        environment: {
          ...providerFreeEnvironment(process.env),
          KEYNES_CONSUMER_TARGET: JSON.stringify(target),
        },
        signal,
      });
      const observations: unknown = JSON.parse(output);
      if (
        !Array.isArray(observations) ||
        observations.length !== REMOTE_CONSUMER_CASES.length
      )
        throw new Error("Incomplete installed consumer results");
      for (const [index, expected] of REMOTE_CONSUMER_CASES.entries()) {
        const observed: unknown = observations[index];
        if (
          typeof observed !== "object" ||
          observed === null ||
          !("check" in observed) ||
          observed.check !== expected ||
          !("status" in observed) ||
          (observed.status !== "passed" && observed.status !== "failed")
        )
          throw new Error("Invalid installed consumer observation");
        const item = checks.find(
          (item) => item.mode === target.mode && item.check === expected,
        );
        if (item === undefined)
          throw new Error("Unexpected installed consumer result");
        item.status = observed.status;
        if (
          "failureCode" in observed &&
          typeof observed.failureCode === "string" &&
          [
            "unknown",
            "unauthorized",
            "compatibility_error",
            "resource_definition_failed",
            "invalid_configuration",
            "authentication_failed",
            "tls_error",
            "budget_not_found",
            "command_conflict",
            "insufficient_budget",
            "invalid_request",
            "unavailable",
            "assertion_failed",
          ].includes(observed.failureCode)
        )
          item.failureCode = observed.failureCode;
      }
    }
    if (
      JSON.stringify(await inspectArchive(input.archivePath)) !==
      JSON.stringify(archive)
    )
      throw new Error("Consumer archive changed");
  } catch {
    executionFailed = true;
  } finally {
    try {
      await external.close();
    } catch {
      cleanup = "failed";
    }
  }
  return {
    attemptId,
    outcome:
      !executionFailed &&
      cleanup === "passed" &&
      checks.every((check) => check.status === "passed")
        ? "passed"
        : "failed",
    archive,
    checks,
    cleanup,
  };
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
    const [inputPath, outputPath] = process.argv.slice(2);
    if (
      inputPath === undefined ||
      outputPath === undefined ||
      process.argv.length !== 4
    )
      throw new Error("Expected private input and result paths");
    const input: RemoteConsumerInput = JSON.parse(
      await readFile(inputPath, "utf8"),
    );
    const result = await runRemoteConsumer(input, controller.signal);
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    process.exitCode = result.outcome === "passed" ? 0 : 1;
  } catch {
    process.stderr.write(
      "Installed remote consumer failed; private diagnostics omitted\n",
    );
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
