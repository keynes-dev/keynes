import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ConnectionOptions } from "node:tls";
import type { PoolConfig } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeDatabaseUrl } from "../../src/remote/connection-options.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("remote PostgreSQL connection options", () => {
  it("normalizes one verified PostgreSQL URL without retaining the raw URL", () => {
    const databaseUrl =
      "postgresql://application%2Bworker:p%40ssword@db.example.test:6543/keynes%2Dprod?sslmode=verify-full";

    const options = normalizeDatabaseUrl(databaseUrl);

    expect(options).toMatchObject({
      host: "db.example.test",
      port: 6_543,
      database: "keynes-prod",
      user: "application+worker",
      password: "p@ssword",
      sslnegotiation: "postgres",
      max: 10,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      query_timeout: 30_000,
      ssl: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        checkServerIdentity: expect.any(Function),
      },
    });
    expect(requireTlsOptions(options)).not.toHaveProperty("ca");
    expect(options).not.toHaveProperty("connectionString");
    expect(JSON.stringify(options)).not.toContain(databaseUrl);
  });

  it("loads the one explicitly supported root certificate path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "keynes-root-cert-"));
    temporaryDirectories.push(directory);
    const certificatePath = join(directory, "authority.pem");
    const certificate =
      "-----BEGIN CERTIFICATE-----\ntest-root\n-----END CERTIFICATE-----\n";
    await writeFile(certificatePath, certificate, "utf8");

    const options = normalizeDatabaseUrl(
      `postgresql://application:secret@db.example.test/keynes?sslmode=verify-full&sslrootcert=${encodeURIComponent(certificatePath)}`,
    );

    expect(requireTlsOptions(options).ca).toBe(certificate);
    expect(options).not.toHaveProperty("sslrootcert");
    expect(options).not.toHaveProperty("connectionString");
  });

  it("normalizes a bracketed IPv6 authority for pg", () => {
    const options = normalizeDatabaseUrl(
      "postgresql://application:secret@[::1]/keynes?sslmode=verify-full",
    );

    expect(options.host).toBe("::1");
  });

  it.each([
    ["empty", ""],
    ["wrong protocol", "https://application:secret@db.example.test/keynes"],
    [
      "PostgreSQL alias",
      "postgres://application:secret@db.example.test/keynes?sslmode=verify-full",
    ],
    [
      "missing host",
      "postgresql://application:secret@/keynes?sslmode=verify-full",
    ],
    [
      "missing user",
      "postgresql://:secret@db.example.test/keynes?sslmode=verify-full",
    ],
    [
      "missing password",
      "postgresql://application@db.example.test/keynes?sslmode=verify-full",
    ],
    [
      "missing database",
      "postgresql://application:secret@db.example.test?sslmode=verify-full",
    ],
    [
      "non-numeric port",
      "postgresql://application:secret@db.example.test:not-a-port/keynes?sslmode=verify-full",
    ],
    [
      "zero port",
      "postgresql://application:secret@db.example.test:0/keynes?sslmode=verify-full",
    ],
    [
      "out-of-range port",
      "postgresql://application:secret@db.example.test:65536/keynes?sslmode=verify-full",
    ],
    [
      "fragment",
      "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full#ignored",
    ],
    [
      "control character",
      "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full\n",
    ],
    [
      "percent-decoded Unix socket authority",
      "postgresql://application:secret@%2Ftmp/keynes?sslmode=verify-full",
    ],
    [
      "percent-decoded whitespace in authority",
      "postgresql://application:secret@db%20evil/keynes?sslmode=verify-full",
    ],
    [
      "over 4,096 UTF-8 bytes",
      `postgresql://application:secret@db.example.test/${"a".repeat(4_096)}?sslmode=verify-full`,
    ],
  ])("rejects a malformed URL: %s", (_description, databaseUrl) => {
    expectInvalidDatabaseUrl(databaseUrl);
  });

  it.each([
    "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full&sslmode=verify-full",
    "postgresql://application:secret@db.example.test/keynes?sslmode=verify-full&sslrootcert=%2Ffirst.pem&sslrootcert=%2Fsecond.pem",
  ])("rejects duplicated URL parameters", (databaseUrl) => {
    expectInvalidDatabaseUrl(databaseUrl);
  });

  it.each([
    ["missing sslmode", ""],
    ["empty sslmode", "?sslmode="],
    ["plaintext sslmode", "?sslmode=disable"],
    ["opportunistic sslmode", "?sslmode=prefer"],
    ["chain-only sslmode", "?sslmode=verify-ca"],
    ["TLS without verification", "?sslmode=require"],
    ["driver SSL override", "?sslmode=verify-full&ssl=no-verify"],
    ["direct TLS negotiation", "?sslmode=verify-full&sslnegotiation=direct"],
    ["libpq compatibility", "?sslmode=verify-full&uselibpqcompat=true"],
    ["host override", "?sslmode=verify-full&host=redirect.example.test"],
    ["host address override", "?sslmode=verify-full&hostaddr=127.0.0.1"],
    ["port override", "?sslmode=verify-full&port=6543"],
    ["user override", "?sslmode=verify-full&user=another"],
    ["password override", "?sslmode=verify-full&password=another"],
    ["database override", "?sslmode=verify-full&dbname=another"],
    ["service routing", "?sslmode=verify-full&service=another"],
    ["password file", "?sslmode=verify-full&passfile=%2Ftmp%2Fpgpass"],
    ["libpq options", "?sslmode=verify-full&options=-csearch_path%3Dpublic"],
    [
      "target session routing",
      "?sslmode=verify-full&target_session_attrs=read-write",
    ],
    ["application name", "?sslmode=verify-full&application_name=worker"],
    ["client certificate", "?sslmode=verify-full&sslcert=%2Ftmp%2Fclient.pem"],
    ["client key", "?sslmode=verify-full&sslkey=%2Ftmp%2Fclient.key"],
    ["empty root certificate", "?sslmode=verify-full&sslrootcert="],
  ])("rejects an unknown or unsafe parameter: %s", (_description, query) => {
    expectInvalidDatabaseUrl(
      `postgresql://application:secret@db.example.test/keynes${query}`,
    );
  });
});

function requireTlsOptions(options: PoolConfig): ConnectionOptions {
  if (typeof options.ssl !== "object" || options.ssl === null) {
    throw new Error("expected normalized TLS options");
  }
  return options.ssl;
}

function expectInvalidDatabaseUrl(databaseUrl: string): void {
  let failure: unknown;
  try {
    normalizeDatabaseUrl(databaseUrl);
  } catch (error: unknown) {
    failure = error;
  }

  expect(failure).toMatchObject({
    name: "KeynesSdkError",
    code: "invalid_configuration",
    details: { field: "databaseUrl" },
  });
  expect(JSON.stringify(failure)).not.toContain("application:secret");
}
