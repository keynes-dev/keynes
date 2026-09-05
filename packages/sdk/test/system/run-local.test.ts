import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_LOCAL_SCENARIOS } from "./required-scenarios.ts";
import {
  parseLocalArguments,
  runLocalTests,
  validateLocalEvidence,
  validateLocalReport,
} from "./run-local.ts";

function sourceReport() {
  const testResults = Object.entries(REQUIRED_LOCAL_SCENARIOS).map(
    ([name, names]) => ({
      name,
      status: "passed",
      message: "",
      assertionResults: names.map((fullName) => ({
        fullName,
        ancestorTitles: [] as string[],
        status: "passed",
        failureMessages: [],
      })),
    }),
  );
  const count = testResults.reduce(
    (total, file) => total + file.assertionResults.length,
    0,
  );
  return {
    success: true,
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    numTotalTestSuites: testResults.length,
    numPassedTestSuites: testResults.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    testResults,
  };
}

describe("Local deployment command", () => {
  it.each(
    [
      [],
      ["--output", ""],
      ["--output", "first", "--output", "second"],
      ["--output", "first", "--mode", "direct"],
      ["--output", "first", "--sdk-archive"],
      ["--output", "first", "--sdk-archive", "a", "--sdk-archive", "b"],
      ["--output", "first", "--authorized-database"],
    ].map((args) => [args] as const),
  )("rejects invalid options %j before work", (args) => {
    expect(() => parseLocalArguments(args)).toThrow();
  });
  it("normalizes one separator and returns help without executing", async () => {
    expect(parseLocalArguments(["--", "--help"])).toEqual({ kind: "help" });
    await expect(runLocalTests(["--help"])).resolves.toBeUndefined();
  });
  it("keeps all 244 required source assertions in 18 files", () => {
    expect(Object.keys(REQUIRED_LOCAL_SCENARIOS)).toHaveLength(18);
    expect(Object.values(REQUIRED_LOCAL_SCENARIOS).flat()).toHaveLength(244);
    expect(() => validateLocalReport(sourceReport())).not.toThrow();
  });
  it.each([
    "missing",
    "duplicate",
    "skipped",
    "failed",
    "totals",
    "errors",
    "selected",
  ])("rejects %s source coverage", (kind) => {
    const report = sourceReport();
    const first = report.testResults[0];
    if (!first) throw new Error("Missing fixture");
    if (kind === "missing") {
      report.testResults.pop();
    }
    if (kind === "duplicate") report.testResults.push(first);
    if (kind === "skipped" || kind === "failed") {
      const assertion = first.assertionResults[0];
      if (!assertion) throw new Error("Missing assertion");
      assertion.status = kind;
    }
    if (kind === "totals") report.numTotalTests++;
    const value =
      kind === "errors"
        ? { ...report, unhandledErrors: ["secret"] }
        : kind === "selected"
          ? { ...report, schemaVersion: "keynes.deployment-test/v1" }
          : report;
    expect(() => validateLocalReport(value)).toThrow();
  });

  it("refuses an existing output without changing its contents", async () => {
    const output = await mkdtemp(join(tmpdir(), "keynes-local-existing-"));
    await writeFile(join(output, "manifest.json"), "other attempt");
    try {
      await expect(runLocalTests(["--output", output])).rejects.toThrow(
        /exist/i,
      );
      expect(await readFile(join(output, "manifest.json"), "utf8")).toBe(
        "other attempt",
      );
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it.each(["traversal", "symlink", "hash"])(
    "rejects %s evidence references",
    async (kind) => {
      const root = await mkdtemp(join(tmpdir(), "keynes-local-files-"));
      const output = join(root, "output");
      await mkdir(output);
      await writeFile(join(root, "outside.json"), "bytes");
      await writeFile(join(output, "inside.json"), "bytes");
      await symlink(join(root, "outside.json"), join(output, "link.json"));
      const path =
        kind === "traversal"
          ? "../outside.json"
          : kind === "symlink"
            ? "link.json"
            : "inside.json";
      try {
        await expect(
          validateLocalEvidence(output, {
            schemaVersion: "keynes.deployment-test/v1",
            attemptId: "11111111-2222-4333-8444-555555555555",
            outcome: "failed",
            selection: {
              kind: "local",
              expected: REQUIRED_LOCAL_SCENARIOS,
              inventorySha256: createHash("sha256")
                .update(JSON.stringify(REQUIRED_LOCAL_SCENARIOS))
                .digest("hex"),
            },
            evidence: [
              {
                path,
                sha256:
                  kind === "hash"
                    ? "0".repeat(64)
                    : createHash("sha256").update("bytes").digest("hex"),
              },
            ],
          }),
        ).rejects.toThrow();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});

describe("Local source identity", () => {
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

function localRuntime(
  options: {
    readonly sourceFailure?: boolean;
    readonly cleanupFailure?: boolean;
    readonly sourceChange?: boolean;
    readonly consumerFailure?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let snapshots = 0;
  const archiveSha256 = createHash("sha256").update("archive").digest("hex");
  return {
    calls,
    runtime: {
      async snapshot() {
        snapshots++;
        return {
          commit: (options.sourceChange && snapshots > 1 ? "b" : "a").repeat(
            40,
          ),
          clean: true,
          dirtyInputSha256: null,
        };
      },
      async prepareArchive(
        workspace: string,
        suppliedArchive: string | undefined,
      ) {
        calls.push("archive");
        const archivePath = suppliedArchive ?? join(workspace, "sdk.tgz");
        if (!suppliedArchive) await writeFile(archivePath, "archive");
        return {
          archivePath,
          inspection: {
            sha256: archiveSha256,
            compressedBytes: 7,
            packageVersion: "0.0.0",
            contractDigest: "c".repeat(64),
          },
        };
      },
      async runSource(reportPath: string, environment: NodeJS.ProcessEnv) {
        calls.push("source");
        expect(environment.KEYNES_DATABASE_URL).toBeUndefined();
        expect(environment.PGPASSWORD).toBeUndefined();
        expect(environment.DATABASE_URL).toBeUndefined();
        expect(environment.PGSERVICEFILE).toBeUndefined();
        await writeFile(reportPath, JSON.stringify(sourceReport()));
        if (options.sourceFailure)
          throw new Error("postgresql://secret:password@example.invalid/db");
      },
      async qualify(
        archivePath: string,
        _workspace: string,
        _signal: AbortSignal | undefined,
        observe: (entry: {
          check: string;
          status: "passed" | "failed";
        }) => void,
      ) {
        calls.push("consumer");
        expect(await readFile(archivePath, "utf8")).toBe("archive");
        if (options.consumerFailure) {
          observe({ check: "budget-loop", status: "failed" });
          throw new Error("private consumer failure");
        }
        const checks = [
          "parser-wasm",
          "public-types",
          "package-root-import",
          "remote-exports",
          "configuration-rejection",
          "environment-isolation",
          "budget-loop",
          "policy-runtime",
          "isolation",
          "closure",
          "process-loss",
          "deep-imports-blocked",
        ];
        for (const check of [...checks, "installation", "cleanup"])
          observe({ check, status: "passed" });
        return {
          schemaVersion: "keynes.package-test.sdk/v1",
          subject: "@keynes/sdk",
          outcome: "passed",
          archive: { sha256: archiveSha256 },
          checks,

          environment: { node: process.version, pnpm: "11.21.0" },
          exclusions: { authorizedRemoteDatabase: "NOT RUN" },
        };
      },
      async cleanup(workspace: string) {
        calls.push("cleanup");
        await rm(workspace, { recursive: true, force: true });
        if (options.cleanupFailure) throw new Error("private cleanup failure");
      },
    },
  };
}

it.each([
  "passed",
  "sourceFailure",
  "consumerFailure",
  "cleanupFailure",
  "sourceChange",
] as const)(
  "retains the Local %s outcome without starting services",
  async (kind) => {
    const root = await mkdtemp(join(tmpdir(), "keynes-local-run-"));
    const output = join(root, "output");
    const fake = localRuntime(kind === "passed" ? {} : { [kind]: true });
    vi.stubEnv(
      "KEYNES_DATABASE_URL",
      "postgresql://secret:password@example.invalid/db",
    );
    vi.stubEnv("PGPASSWORD", "private-password");
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://secret:password@example.invalid/db",
    );
    vi.stubEnv("PGSERVICEFILE", "/private/service.conf");
    try {
      await runLocalTests(["--output", output], fake.runtime);
      const bytes = await readFile(join(output, "manifest.json"), "utf8");
      const manifest = JSON.parse(bytes);
      expect(manifest).toMatchObject({
        schemaVersion: "keynes.deployment-test/v1",
        selection: { kind: "local" },
        outcome: kind === "passed" ? "passed" : "failed",
      });
      expect(fake.calls).toContain("cleanup");
      expect(bytes).not.toMatch(
        /postgresql:\/\/|private-password|private consumer|private cleanup/,
      );
      if (kind === "passed")
        await expect(
          validateLocalEvidence(output, manifest),
        ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  },
);

it("retains another Local attempt and a supplied archive when creation races cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-local-race-"));
  const archive = join(root, "supplied.tgz");
  await writeFile(archive, "archive");
  const controller = new AbortController();
  const first = localRuntime();
  const prepare = first.runtime.prepareArchive;
  first.runtime.prepareArchive = async (...args) => {
    const result = await prepare(...args);
    controller.abort();
    return result;
  };
  const second = localRuntime();
  try {
    await Promise.all([
      runLocalTests(
        ["--output", join(root, "first"), "--sdk-archive", archive],
        first.runtime,
        controller.signal,
      ),
      runLocalTests(
        ["--output", join(root, "second"), "--sdk-archive", archive],
        second.runtime,
      ),
    ]);
    expect(
      JSON.parse(await readFile(join(root, "first/manifest.json"), "utf8"))
        .outcome,
    ).toBe("failed");
    expect(
      JSON.parse(await readFile(join(root, "second/manifest.json"), "utf8"))
        .outcome,
    ).toBe("passed");
    expect(first.calls).not.toContain("source");
    expect(await readFile(archive, "utf8")).toBe("archive");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("retains nested suite counts in its sanitized Local source report", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-local-nested-"));
  const output = join(root, "output");
  const fake = localRuntime();
  fake.runtime.runSource = async (reportPath) => {
    const report = sourceReport();
    const file = report.testResults.find((file) =>
      file.name.endsWith("/contract/budget.test.ts"),
    );
    if (!file) throw new Error("Missing canonical aggregate");
    const assertion = file.assertionResults[0];
    if (!assertion) throw new Error("Missing assertion");
    assertion.ancestorTitles.push("Budget lifecycle");
    report.numTotalTestSuites++;
    report.numPassedTestSuites++;
    await writeFile(reportPath, JSON.stringify(report));
  };
  try {
    await runLocalTests(["--output", output], fake.runtime);
    const retained = await readFile(join(output, "source.json"), "utf8");
    expect(() => validateLocalReport(JSON.parse(retained))).not.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects a success-shaped consumer result with missing observations", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-local-missing-consumer-"));
  const output = join(root, "output");
  const fake = localRuntime();
  const qualify = fake.runtime.qualify;
  fake.runtime.qualify = (archive, workspace, signal, observe) =>
    qualify(archive, workspace, signal, (entry) => {
      if (entry.check === "cleanup") observe(entry);
    });
  try {
    await runLocalTests(["--output", output], fake.runtime);
    expect(
      JSON.parse(await readFile(join(output, "manifest.json"), "utf8")).outcome,
    ).toBe("failed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("does not overwrite a manifest created by another writer during execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-local-writer-"));
  const output = join(root, "output");
  const fake = localRuntime();
  const qualify = fake.runtime.qualify;
  fake.runtime.qualify = async (...args) => {
    const result = await qualify(...args);
    await writeFile(join(output, "manifest.json"), "another writer");
    return result;
  };
  try {
    await expect(
      runLocalTests(["--output", output], fake.runtime),
    ).rejects.toThrow();
    expect(await readFile(join(output, "manifest.json"), "utf8")).toBe(
      "another writer",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects forged source identity and stage coverage in a passing manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-local-identity-"));
  const output = join(root, "output");
  try {
    await runLocalTests(["--output", output], localRuntime().runtime);
    const original = JSON.parse(
      await readFile(join(output, "manifest.json"), "utf8"),
    );
    const source = structuredClone(original);
    source.candidate = { before: {}, after: {} };
    await expect(validateLocalEvidence(output, source)).rejects.toThrow();
    const coverage = structuredClone(original);
    coverage.stages[1].coverage = [];
    await expect(validateLocalEvidence(output, coverage)).rejects.toThrow();
    const attempt = structuredClone(original);
    attempt.attemptId = "wrong-attempt";
    await expect(validateLocalEvidence(output, attempt)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
