import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  REQUIRED_EXTERNAL_SCENARIOS,
  type ExternalPostgresqlAcceptanceRecord,
} from "./external-record.js";
import {
  parseExternalQualificationArguments,
  qualifyExternalPostgresql,
  stageExactArchives,
  type QualificationRuntime,
} from "./run-external.js";

const temporaryDirectories: string[] = [];
const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("external PostgreSQL qualification orchestrator", () => {
  it("requires each CLI path exactly once", () => {
    expect(
      parseExternalQualificationArguments([
        "--profile",
        "profile.json",
        "--sdk-archive",
        "sdk.tgz",
        "--postgresql-archive",
        "postgresql.tgz",
        "--output",
        "record.json",
      ]),
    ).toEqual(resolvedArguments);
    expect(
      parseExternalQualificationArguments([
        "--",
        "--profile",
        "profile.json",
        "--sdk-archive",
        "sdk.tgz",
        "--postgresql-archive",
        "postgresql.tgz",
        "--output",
        "record.json",
      ]),
    ).toEqual(resolvedArguments);

    expect(() =>
      parseExternalQualificationArguments([
        "--profile",
        "one.json",
        "--profile",
        "two.json",
        "--sdk-archive",
        "sdk.tgz",
        "--postgresql-archive",
        "postgresql.tgz",
        "--output",
        "record.json",
      ]),
    ).toThrow("exactly once");
    expect(() =>
      parseExternalQualificationArguments([
        "--profile",
        "profile.json",
        "--sdk-archive",
        "sdk.tgz",
        "--postgresql-archive",
        "postgresql.tgz",
      ]),
    ).toThrow("exactly once");
    expect(() =>
      parseExternalQualificationArguments([
        "--profile",
        "profile.json",
        "--sdk-archive",
        "sdk.tgz",
        "--postgresql-archive",
        "postgresql.tgz",
        "--output",
        "record.json",
        "--unknown",
        "value",
      ]),
    ).toThrow("unknown argument");
  });

  it("binds exact archives and one clean revision, then closes before writing", async () => {
    const events: string[] = [];
    const runtime = passingRuntime(events);

    const record = await qualifyExternalPostgresql(
      {
        profilePath: "profile.json",
        sdkArchivePath: "sdk.tgz",
        postgresqlArchivePath: "postgresql.tgz",
        outputPath: "record.json",
      },
      runtime,
    );

    expect(record.archives).toEqual({
      sdkSha256: "a".repeat(64),
      postgresqlSha256: "b".repeat(64),
    });
    expect(events).toEqual([
      "revision",
      "profile:profile.json",
      "stage:sdk.tgz:postgresql.tgz",
      "open-target",
      "scenarios:staged-sdk.tgz:staged-postgresql.tgz",
      "close",
      "archives-close",
      "revision",
      "write:record.json",
    ]);
  });

  it("does not publish when source revision drifts", async () => {
    const events: string[] = [];
    const runtime = passingRuntime(events, [
      { commit: "c".repeat(40), status: "" },
      { commit: "d".repeat(40), status: "" },
    ]);

    await expect(
      qualifyExternalPostgresql(arguments_, runtime),
    ).rejects.toThrow("source revision changed");
    expect(events).toContain("close");
    expect(events.some((event) => event.startsWith("write:"))).toBe(false);
  });

  it("does not publish when cleanup fails", async () => {
    const events: string[] = [];
    const runtime = passingRuntime(events);
    runtime.openTarget = () => ({
      ...passingTarget(events),
      close: async () => {
        events.push("close");
        throw new Error("connection remained open");
      },
    });

    await expect(
      qualifyExternalPostgresql(arguments_, runtime),
    ).rejects.toThrow("connection remained open");
    expect(events.some((event) => event.startsWith("write:"))).toBe(false);
  });

  it("does not publish when staged archive cleanup fails", async () => {
    const events: string[] = [];
    const runtime = passingRuntime(events);
    runtime.stageArchives = async () => ({
      ...stagedArchives(events),
      close: async () => {
        events.push("archives-close");
        throw new Error("staged archive remained");
      },
    });

    await expect(
      qualifyExternalPostgresql(arguments_, runtime),
    ).rejects.toThrow("staged archive remained");
    expect(events.some((event) => event.startsWith("write:"))).toBe(false);
  });

  it("validates the closed scenario inventory before publication", async () => {
    const events: string[] = [];
    const runtime = passingRuntime(events);
    runtime.runScenarios = async () => ({
      inspection,
      scenarios: [],
      tls,
    });

    await expect(
      qualifyExternalPostgresql(arguments_, runtime),
    ).rejects.toThrow("scenario inventory");
    expect(events).toContain("close");
    expect(events.some((event) => event.startsWith("write:"))).toBe(false);
  });

  it("executes immutable private copies of both exact archives", async () => {
    const inputRoot = await mkdtemp(join(tmpdir(), "keynes-archive-input-"));
    temporaryDirectories.push(inputRoot);
    const sdkPath = join(inputRoot, "sdk.tgz");
    const postgresqlPath = join(inputRoot, "postgresql.tgz");
    await Promise.all([
      writeFile(sdkPath, "sdk-original"),
      writeFile(postgresqlPath, "postgresql-original"),
    ]);

    const staged = await stageExactArchives({ sdkPath, postgresqlPath });
    await Promise.all([
      writeFile(sdkPath, "sdk-replaced"),
      writeFile(postgresqlPath, "postgresql-replaced"),
    ]);

    await expect(readFile(staged.sdkPath, "utf8")).resolves.toBe(
      "sdk-original",
    );
    await expect(readFile(staged.postgresqlPath, "utf8")).resolves.toBe(
      "postgresql-original",
    );
    expect(staged.sdkSha256).toBe(sha256("sdk-original"));
    expect(staged.postgresqlSha256).toBe(sha256("postgresql-original"));
    expect((await stat(staged.sdkPath)).mode & 0o777).toBe(0o600);
    const stagedRoot = dirname(staged.sdkPath);
    await expect(staged.close()).resolves.toBe("passed");
    await expect(stat(stagedRoot)).rejects.toThrow();
  });
});

const arguments_ = {
  profilePath: "profile.json",
  sdkArchivePath: "sdk.tgz",
  postgresqlArchivePath: "postgresql.tgz",
  outputPath: "record.json",
};

const resolvedArguments = {
  profilePath: resolve(repositoryRoot, "profile.json"),
  sdkArchivePath: resolve(repositoryRoot, "sdk.tgz"),
  postgresqlArchivePath: resolve(repositoryRoot, "postgresql.tgz"),
  outputPath: resolve(repositoryRoot, "record.json"),
};

function passingRuntime(
  events: string[],
  revisions: readonly {
    readonly commit: string;
    readonly status: string;
  }[] = [
    { commit: "c".repeat(40), status: "" },
    { commit: "c".repeat(40), status: "" },
  ],
): QualificationRuntime {
  let revisionIndex = 0;
  let clock = 0;
  return {
    readSourceRevision: () => {
      events.push("revision");
      const revision = revisions[revisionIndex];
      revisionIndex += 1;
      if (revision === undefined) throw new Error("missing test revision");
      return revision;
    },
    readProfile: async (path) => {
      events.push(`profile:${path}`);
      return profile;
    },
    stageArchives: async ({ sdkPath, postgresqlPath }) => {
      events.push(`stage:${sdkPath}:${postgresqlPath}`);
      return stagedArchives(events);
    },
    openTarget: () => {
      events.push("open-target");
      return passingTarget(events);
    },
    runScenarios: async (_target, sdkArchivePath, postgresqlArchivePath) => {
      events.push(`scenarios:${sdkArchivePath}:${postgresqlArchivePath}`);
      return { inspection, scenarios, tls };
    },
    now: () => {
      const value = clock;
      clock += 1_000;
      return value;
    },
    writeRecord: async (path, record) => {
      events.push(`write:${path}`);
      expect(record.outcome).toBe("passed");
    },
  };
}

function stagedArchives(events: string[]) {
  return {
    sdkPath: "staged-sdk.tgz",
    postgresqlPath: "staged-postgresql.tgz",
    sdkSha256: "a".repeat(64),
    postgresqlSha256: "b".repeat(64),
    close: async (): Promise<"passed"> => {
      events.push("archives-close");
      return "passed";
    },
  };
}

function passingTarget(events: string[]) {
  return {
    prepare: async () => undefined,
    qualifySdkArchive: async () => undefined,
    inspect: async () => {
      events.push("inspect");
      return inspection;
    },
    connect: async () => {
      throw new Error("unused fake connection");
    },
    closeClient: async () => undefined,
    roleName: () => "role",
    recreateCredentialRole: async () => undefined,
    inspectAcceptedTls: async () => {
      events.push("tls");
      return tls;
    },
    assertUnsafeTlsModeRejected: () => undefined,
    inspectTlsRejection: async () => ({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
      diagnostics: "secret-safe" as const,
    }),
    close: async (): Promise<"passed"> => {
      events.push("close");
      return "passed";
    },
  };
}

const profile = {
  schemaVersion: "keynes.external-postgresql-profile/v1",
  authorizationReference: "user-approved-2026-09-03",
  provider: "provider",
  serverProfile: "postgresql-18.3",
  hostClass: "public-dns",
  topology: "direct",
  downstreamTlsOwner: "provider",
  expectedLeafCertificateSha256: "d".repeat(64),
};

const inspection: Pick<
  ExternalPostgresqlAcceptanceRecord,
  "target" | "semantics"
> = {
  target: {
    provider: "provider",
    serverProfile: "postgresql-18.3",
    serverVersionNum: "180003",
    hostClass: "public-dns",
    topology: "direct",
    downstreamTlsOwner: "provider",
  },
  semantics: {
    installationIdentitySha256: "f".repeat(64),
    contractDigest: "1".repeat(64),
    policyProfileDigest: "3".repeat(64),
    remoteProcedureIdentitySha256: "2".repeat(64),
    migrationSetDigest: "4".repeat(64),
    remoteProcedureCount: 8,
  },
};

const tls: ExternalPostgresqlAcceptanceRecord["tls"] = {
  protocol: "TLSv1.3",
  cipher: "TLS_AES_256_GCM_SHA384",
  keyBits: 256,
  leafCertificateSha256: "d".repeat(64),
  issuerCertificateSha256: "e".repeat(64),
  validFrom: "2026-01-01T00:00:00.000Z",
  validTo: "2027-01-01T00:00:00.000Z",
  hostnameVerification: "passed",
};

const scenarios: ExternalPostgresqlAcceptanceRecord["scenarios"] =
  REQUIRED_EXTERNAL_SCENARIOS.map((id) => ({ id, outcome: "passed" }));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
