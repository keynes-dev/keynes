import { describe, expect, it } from "vitest";
import {
  runPostgresqlSystemTests,
  PGBOUNCER_IMAGE,
  POSTGRES_IMAGE,
} from "./run.ts";
import { selectedScenarioInventory } from "./required-scenarios.ts";
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
import { fakeRuntime, passingVitestReport } from "./support/runner-fixture.ts";
import {
  parseDeploymentArguments,
  runDeployment,
  validateDeploymentEvidence,
  REMOTE_INSTALLED_CHECKS,
  type DeploymentRuntime,
} from "./run-deployment.ts";

describe("remote native selection", () => {
  it.each([
    ["direct", 0],
    ["session-pool", 1],
    ["transaction-pool", 1],
  ] as const)("starts only dependencies for %s", async (mode, poolers) => {
    const fake = fakeRuntime();
    await runPostgresqlSystemTests(
      fake.runtime,
      {},
      { selection: { kind: "remote", modes: [mode] } },
    );
    const started = fake.commands.filter(
      (command) =>
        command.arguments[0] === "run" &&
        command.arguments.includes(PGBOUNCER_IMAGE),
    );
    expect(started).toHaveLength(poolers);
    const context = fake.commands.find(
      (command) => command.executable === "pnpm",
    )?.environment?.KEYNES_POSTGRESQL_SYSTEM_CONTEXT;
    expect(JSON.parse(context ?? "{}").selection).toEqual({
      kind: "remote",
      modes: [mode],
    });
  });
  it("rejects empty native selection before any preparation", async () => {
    const fake = fakeRuntime();
    await expect(
      runPostgresqlSystemTests(
        fake.runtime,
        {},
        { selection: { kind: "remote", modes: [] } },
      ),
    ).rejects.toThrow();
    expect(fake.packagePreparations.count).toBe(0);
  });
});

describe("remote deployment command", () => {
  it("defaults to all modes and resolves explicit narrower modes", () => {
    expect(parseDeploymentArguments(["--output", "result"])).toMatchObject({
      kind: "run",
      selection: {
        kind: "remote",
        modes: ["direct", "session-pool", "transaction-pool"],
      },
    });
    expect(
      parseDeploymentArguments([
        "--",
        "--output",
        "result",
        "--mode",
        "direct",
      ]),
    ).toMatchObject({
      kind: "run",
      selection: { kind: "remote", modes: ["direct"] },
    });
  });
  it.each(
    [
      [],
      ["--output", ""],
      ["--output", "a", "--output", "b"],
      ["--output", "a", "--mode", "direct", "--mode", "all"],
      ["--output", "a", "--mode", "automatic"],
      ["--output", "a", "--target", "postgresql://secret"],
      ["--help", "--output", "a"],
      ["--", "--", "--help"],
    ].map((args) => [args] as const),
  )("rejects invalid arguments %j before any work", (args) => {
    expect(() => parseDeploymentArguments(args)).toThrow();
  });
  it("handles help without creating an attempt", () => {
    expect(parseDeploymentArguments(["--help"])).toEqual({ kind: "help" });
  });
});

async function attempt() {
  const root = await mkdtemp(join(tmpdir(), "keynes-selected-evidence-test-"));
  const output = join(root, "attempt");
  const args = parseDeploymentArguments([
    "--output",
    output,
    "--mode",
    "direct",
  ]);
  if (args.kind !== "run") throw new Error("Missing test arguments");
  const order: string[] = [];
  const snapshot = {
    commit: "a".repeat(40),
    clean: true,
    dirtyInputSha256: null,
  };
  const sdkDigest = createHash("sha256").update("sdk").digest("hex");
  const runtime: DeploymentRuntime = {
    snapshot: async () => snapshot,
    prepare: async (workspace) => {
      order.push("prepare");
      const pgArchive = join(workspace, "postgresql.tgz");
      const sdkArchivePath = join(workspace, "sdk.tgz");
      await writeFile(pgArchive, "postgresql");
      await writeFile(sdkArchivePath, "sdk");
      return {
        sdkArchivePath,
        postgresql: {
          archivePath: pgArchive,
          commandPath: "/installed/cli",
          consumerRoot: workspace,
          close: async () => {
            order.push("archive-cleanup");
          },
        },
      };
    },
    sql: async (
      selection,
      path,
      _packed,
      _id,
      _signal,
      onCleanup,
      onEnvironment,
    ) => {
      onEnvironment?.({
        poolerCount: "0",
        postgresVersion: "180006",
        postgresImageId: `sha256:${"a".repeat(64)}`,
        dockerVersion: "29.0.1",
        pnpmVersion: "11.21.0",
      });
      order.push("sql");
      await writeFile(
        path,
        JSON.stringify(
          passingVitestReport({
            KEYNES_POSTGRESQL_SYSTEM_CONTEXT: JSON.stringify({ selection }),
          }),
        ),
      );
      order.push("sql-cleanup");
      onCleanup?.("passed");
    },
    tls: async (_command, _modes, _id, _signal, onCleanup) => {
      order.push("tls");
      return {
        root,
        targets: [],
        observations: {
          dockerVersion: "29.0.1",
          pnpmVersion: "11.21.0",
          postgresImageId: `sha256:${"a".repeat(64)}`,
          postgresVersion: "180006",
          observedPoolers: [],
          postgresImage: POSTGRES_IMAGE,
          pgbouncerImage: PGBOUNCER_IMAGE,
          poolers: [],
          certificateSha256: "a".repeat(64),
        },
        close: async () => {
          order.push("tls-cleanup");
          onCleanup?.("passed");
        },
      };
    },
    consumer: async (input, output) => {
      order.push("consumer");
      await writeFile(
        output,
        JSON.stringify({
          attemptId: JSON.parse(await readFile(input, "utf8")).attemptId,
          outcome: "passed",
          cleanup: "passed",
          archive: { sha256: sdkDigest },
          checks: REMOTE_INSTALLED_CHECKS.map((check) => ({
            mode: "direct",
            check,
            status: "passed",
          })),
        }),
      );
    },
    cleanup: async (workspace) => {
      order.push("cleanup");
      await rm(workspace, { recursive: true, force: true });
    },
  };
  return { root, output, args, runtime, order };
}

it("composes sequential SQL and installed consumer stages with a separate manifest", async () => {
  const fixture = await attempt();
  try {
    const result = await runDeployment(fixture.args, fixture.runtime);
    expect(result).toMatchObject({
      schemaVersion: "keynes.deployment-test/v1",
      outcome: "passed",
    });
    expect(fixture.order).toEqual([
      "prepare",
      "sql",
      "sql-cleanup",
      "tls",
      "consumer",
      "tls-cleanup",
      "archive-cleanup",
      "cleanup",
    ]);
    await validateDeploymentEvidence(fixture.output, result);
    await expect(
      readFile(join(fixture.output, "manifest.json"), "utf8"),
    ).resolves.toContain("keynes.deployment-test/v1");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it.each(["prepare", "sql", "tls", "consumer", "cleanup"] as const)(
  "fails acceptance when %s fails and preserves cleanup",
  async (stage) => {
    const fixture = await attempt();
    fixture.runtime[stage] = async () => {
      throw new Error("private postgresql://credential must not be retained");
    };
    try {
      const result = await runDeployment(fixture.args, fixture.runtime);
      expect(result.outcome).toBe("failed");
      expect(JSON.stringify(result)).not.toContain("postgresql://credential");
      expect(result.stages).toContainEqual(
        expect.objectContaining({
          name:
            stage === "sql"
              ? "sql-fixtures"
              : stage === "tls"
                ? "tls-fixtures"
                : stage === "consumer"
                  ? "installed-sdk"
                  : stage === "prepare"
                    ? "archives"
                    : "cleanup",
          kind: "failed",
        }),
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

it("refuses an existing output before preparation", async () => {
  const fixture = await attempt();
  await mkdir(fixture.output);
  try {
    await expect(
      runDeployment(fixture.args, fixture.runtime),
    ).rejects.toThrow();
    expect(fixture.order).toEqual([]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it("fails source changes while retaining diagnostic identity", async () => {
  const fixture = await attempt();
  let calls = 0;
  fixture.runtime.snapshot = async () => ({
    commit: "a".repeat(40),
    clean: false,
    dirtyInputSha256: (++calls === 1 ? "b" : "c").repeat(64),
  });
  try {
    expect((await runDeployment(fixture.args, fixture.runtime)).outcome).toBe(
      "failed",
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it.each([
  "missing",
  "skipped",
  "hash",
  "traversal",
  "symlink",
  "selected-schema",
] as const)("rejects %s selected evidence", async (mutation) => {
  const fixture = await attempt();
  try {
    await runDeployment(fixture.args, fixture.runtime);
    const manifest = JSON.parse(
      await readFile(join(fixture.output, "manifest.json"), "utf8"),
    );
    if (mutation === "hash")
      await writeFile(join(fixture.output, "sql.json"), "changed");
    if (mutation === "traversal") manifest.evidence[0].path = "../private.json";
    if (mutation === "symlink") {
      const path = join(fixture.output, manifest.evidence[0].path);
      await rm(path);
      await writeFile(join(fixture.root, "outside.json"), "outside");
      await symlink(join(fixture.root, "outside.json"), path);
    }
    if (["missing", "skipped", "selected-schema"].includes(mutation)) {
      const path = join(fixture.output, "sql.json");
      const report = JSON.parse(await readFile(path, "utf8"));
      if (mutation === "missing") report.testResults.pop();
      if (mutation === "skipped")
        report.testResults[0].assertionResults[0].status = "skipped";
      if (mutation === "selected-schema")
        report.schemaVersion = "keynes.deployment-test/v1";
      const bytes = JSON.stringify(report);
      await writeFile(path, bytes);
      manifest.evidence.find(
        (entry: { path: string }) => entry.path === "sql.json",
      ).sha256 = createHash("sha256").update(bytes).digest("hex");
    }
    await expect(
      validateDeploymentEvidence(fixture.output, manifest),
    ).rejects.toThrow();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it("cancels one native attempt while preserving another attempt's evidence", async () => {
  const first = await attempt();
  const second = await attempt();
  const controller = new AbortController();
  let entered: () => void = () => {};
  const active = new Promise<void>((resolve) => {
    entered = resolve;
  });
  first.runtime.sql = async () => {
    entered();
    await new Promise<void>((_resolve, reject) =>
      controller.signal.addEventListener(
        "abort",
        () => reject(new Error("cancelled")),
        { once: true },
      ),
    );
  };
  const running = runDeployment(first.args, first.runtime, controller.signal);
  try {
    await active;
    const passed = await runDeployment(second.args, second.runtime);
    const bytes = await readFile(join(second.output, "manifest.json"));
    controller.abort();
    expect((await running).outcome).toBe("failed");
    expect(passed.outcome).toBe("passed");
    expect(await readFile(join(second.output, "manifest.json"))).toEqual(bytes);
    expect(first.order).toContain("archive-cleanup");
    expect(first.order).not.toContain("tls");
  } finally {
    controller.abort();
    await running;
    await rm(first.root, { recursive: true, force: true });
    await rm(second.root, { recursive: true, force: true });
  }
});

it("rejects empty full execution even without an output path", async () => {
  const fake = fakeRuntime({
    vitestReport: { success: true, testResults: [], numPassedTests: 0 },
  });
  await expect(runPostgresqlSystemTests(fake.runtime, {})).rejects.toThrow();
  expect(fake.childTerminations.count).toBe(1);
});

it("removes containers before their network instead of racing Docker automatic removal", async () => {
  const fake = fakeRuntime();
  const run = fake.runtime.run;
  const containers = new Set<string>();
  fake.runtime.run = async (executable, args, env, signal) => {
    if (executable === "docker" && args[0] === "run")
      containers.add(args[args.indexOf("--name") + 1] ?? "");
    if (executable === "docker" && args[0] === "rm")
      containers.delete(args.at(-1) ?? "");
    if (
      executable === "docker" &&
      args[0] === "network" &&
      args[1] === "rm" &&
      containers.size > 0
    )
      throw new Error("network has active endpoints");
    return run(executable, args, env, signal);
  };
  await expect(
    runPostgresqlSystemTests(fake.runtime, {}),
  ).resolves.toBeDefined();
  expect(containers.size).toBe(0);
});

it("keeps a SQL fixture cleanup failure in the selected cleanup result", async () => {
  const fixture = await attempt();
  fixture.runtime.sql = async (
    _selection,
    _path,
    _packed,
    _id,
    _signal,
    onCleanup,
  ) => {
    onCleanup?.("failed");
    throw new Error("SQL cleanup failed");
  };
  try {
    const result = await runDeployment(fixture.args, fixture.runtime);
    expect(result.stages.find((stage) => stage.name === "cleanup")?.kind).toBe(
      "failed",
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it.each(["preparation", "TLS"])(
  "does not claim confirmed cleanup after failed %s acquisition",
  async (failure) => {
    const fixture = await attempt();
    if (failure === "preparation")
      fixture.runtime.prepare = async () => {
        throw new Error("Preparation cleanup unconfirmed");
      };
    else
      fixture.runtime.tls = async (
        _command,
        _modes,
        _id,
        _signal,
        onCleanup,
      ) => {
        onCleanup?.("failed");
        throw new Error("TLS cleanup failed");
      };
    try {
      const result = await runDeployment(fixture.args, fixture.runtime);
      expect(
        result.stages.find((stage) => stage.name === "cleanup")?.kind,
      ).toBe("failed");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

describe("Embedded fixture command", () => {
  it("selects only the canonical aggregate and fourteen transaction assertions", () => {
    const inventory = selectedScenarioInventory({ kind: "embedded" });
    expect(Object.keys(inventory)).toEqual([
      "packages/postgresql/test/system/budget.test.ts",
      "packages/postgresql/test/system/embedded-transactions.test.ts",
    ]);
    expect(Object.values(inventory).flat()).toHaveLength(51);
    expect(
      inventory[
        "packages/postgresql/test/system/embedded-transactions.test.ts"
      ],
    ).toHaveLength(14);
  });
  it("parses the Embedded owner without remote modes or SDK archives", () => {
    expect(
      parseDeploymentArguments(["--output", "attempt"], "embedded"),
    ).toMatchObject({ kind: "run", selection: { kind: "embedded" } });
    expect(() =>
      parseDeploymentArguments(
        ["--output", "attempt", "--mode", "direct"],
        "embedded",
      ),
    ).toThrow();
    expect(() =>
      parseDeploymentArguments(
        ["--output", "attempt", "--sdk-archive", "sdk.tgz"],
        "embedded",
      ),
    ).toThrow();
  });
  it("refuses installed acceptance before reading supplied archives or provisioning", async () => {
    const fixture = await attempt();
    try {
      const args = parseDeploymentArguments(
        [
          "--output",
          fixture.output,
          "--installed",
          "--postgresql-archive",
          "/unavailable/archive.tgz",
        ],
        "embedded",
      );
      if (args.kind === "help") throw new Error("Unexpected help");
      const result = await runDeployment(args, fixture.runtime);
      expect(result.outcome).toBe("NOT RUN");
      expect(fixture.order).toEqual([]);
      expect(JSON.stringify(result)).toContain("KEY-10");
      expect(JSON.stringify(result)).toContain("KEY-11");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});

it("starts one PostgreSQL fixture and zero poolers for Embedded", async () => {
  const fake = fakeRuntime();
  await runPostgresqlSystemTests(
    fake.runtime,
    {},
    { selection: { kind: "embedded" } },
  );
  const started = fake.commands.filter(
    (command) => command.arguments[0] === "run",
  );
  expect(
    started.filter((command) => command.arguments.includes(POSTGRES_IMAGE)),
  ).toHaveLength(1);
  expect(
    started.filter((command) => command.arguments.includes(PGBOUNCER_IMAGE)),
  ).toHaveLength(0);
  const context = JSON.parse(
    fake.commands.find((command) => command.executable === "pnpm")?.environment
      ?.KEYNES_POSTGRESQL_SYSTEM_CONTEXT ?? "{}",
  );
  expect(context.selection).toEqual({ kind: "embedded" });
  expect(context.poolers).toEqual({});
});

it("runs Embedded with only PostgreSQL packaging and fixture-provided grants", async () => {
  const fixture = await attempt();
  const prepare = fixture.runtime.prepare;
  fixture.runtime.prepare = async (...args) => {
    const { postgresql } = await prepare(...args);
    return { postgresql };
  };
  try {
    const result = await runDeployment(
      {
        kind: "run",
        outputPath: fixture.output,
        selection: { kind: "embedded" },
      },
      fixture.runtime,
    );
    expect(result).toMatchObject({
      outcome: "passed",
      acceptance: "fixture-only",
      applicationGrants: "fixture-provided",
    });
    expect(fixture.order).toEqual([
      "prepare",
      "sql",
      "sql-cleanup",
      "archive-cleanup",
      "cleanup",
    ]);
    expect(result.evidence.map((entry) => entry.path)).toEqual([
      "initial.json",
      "archives.json",
      "sql.json",
    ]);
    await expect(
      validateDeploymentEvidence(fixture.output, {
        ...result,
        acceptance: "installed",
      }),
    ).rejects.toThrow();
    await expect(
      validateDeploymentEvidence(fixture.output, {
        ...result,
        applicationGrants: "supported",
      }),
    ).rejects.toThrow();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it("retains actual Embedded PostgreSQL observations without querying a pooler", async () => {
  const fake = fakeRuntime();
  let observed: Readonly<Record<string, string>> | undefined;
  await runPostgresqlSystemTests(
    fake.runtime,
    {},
    {
      selection: { kind: "embedded" },
      onEnvironment: (value) => {
        observed = value;
      },
    },
  );
  expect(observed).toMatchObject({
    postgresVersion: "180006",
    dockerVersion: "29.0.1",
    pnpmVersion: "11.21.0",
  });
  expect(observed?.postgresImageId).toMatch(/^sha256:/);
  expect(observed?.pgbouncerVersion).toBeUndefined();
  expect(
    fake.commands.some((command) =>
      command.arguments.some(
        (arg) =>
          arg.includes("-session-pool") || arg.includes("-transaction-pool"),
      ),
    ),
  ).toBe(false);
});

it("refuses reused and tampered installed-refusal evidence", async () => {
  const fixture = await attempt();
  try {
    const args = parseDeploymentArguments(
      ["--output", fixture.output, "--installed"],
      "embedded",
    );
    if (args.kind === "help") throw new Error("Unexpected help");
    const result = await runDeployment(args, fixture.runtime);
    await expect(runDeployment(args, fixture.runtime)).rejects.toThrow();
    await expect(
      validateDeploymentEvidence(fixture.output, {
        ...result,
        reason: "available",
      }),
    ).rejects.toThrow();
    await writeFile(join(fixture.output, "initial.json"), "{}");
    await expect(
      validateDeploymentEvidence(fixture.output, result),
    ).rejects.toThrow();
    expect(fixture.order).toEqual([]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
