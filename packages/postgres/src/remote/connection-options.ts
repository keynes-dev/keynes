import { checkServerIdentity } from "node:tls";
import { isIP } from "node:net";

import type { PoolConfig } from "pg";
import { parse } from "pg-connection-string";

import { KeynesSdkError } from "@keynes/sdk";

export const DATABASE_URL_MAX_BYTES = 4_096;
export const POSTGRESQL_CONNECT_TIMEOUT_MILLISECONDS = 10_000;
export const POSTGRESQL_COMMAND_TIMEOUT_MILLISECONDS = 30_000;
export const POSTGRESQL_POOL_SIZE = 10;

const allowedParameters = new Set(["sslmode", "sslrootcert"]);

type InvalidConfigurationReason = "missing" | "unknown" | "unsupported";

function invalidDatabaseUrl(
  reason: InvalidConfigurationReason,
): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field: "databaseUrl",
    reason,
  });
}

function decodeParameter(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    throw invalidDatabaseUrl("unsupported");
  }
}

function validateParameters(databaseUrl: string): void {
  const fragmentIndex = databaseUrl.indexOf("#");
  if (fragmentIndex !== -1) {
    throw invalidDatabaseUrl("unsupported");
  }

  const queryIndex = databaseUrl.indexOf("?");
  if (queryIndex === -1) {
    throw invalidDatabaseUrl("missing");
  }

  const query = databaseUrl.slice(queryIndex + 1);
  if (query.length === 0) {
    throw invalidDatabaseUrl("missing");
  }

  const parameters = new Map<string, string>();
  for (const field of query.split("&")) {
    if (field.length === 0) {
      throw invalidDatabaseUrl("unsupported");
    }

    const equalsIndex = field.indexOf("=");
    const rawName = equalsIndex === -1 ? field : field.slice(0, equalsIndex);
    const rawValue = equalsIndex === -1 ? "" : field.slice(equalsIndex + 1);
    const name = decodeParameter(rawName);
    const value = decodeParameter(rawValue);

    if (!allowedParameters.has(name)) {
      throw invalidDatabaseUrl("unknown");
    }
    if (parameters.has(name)) {
      throw invalidDatabaseUrl("unsupported");
    }
    parameters.set(name, value);
  }

  const sslMode = parameters.get("sslmode");
  if (sslMode === undefined) {
    throw invalidDatabaseUrl("missing");
  }
  if (sslMode !== "verify-full") {
    throw invalidDatabaseUrl("unsupported");
  }
  if (parameters.get("sslrootcert") === "") {
    throw invalidDatabaseUrl("unsupported");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireConnectionValue(value: string | null | undefined): string {
  if (value === undefined || value === null || value.length === 0) {
    throw invalidDatabaseUrl("missing");
  }
  if (/\p{Cc}/u.test(value)) {
    throw invalidDatabaseUrl("unsupported");
  }
  return value;
}

function normalizePort(value: string | null | undefined): number {
  if (value === undefined || value === null || value.length === 0) {
    return 5_432;
  }
  if (!/^\d+$/u.test(value)) {
    throw invalidDatabaseUrl("unsupported");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw invalidDatabaseUrl("unsupported");
  }
  return port;
}

function normalizeHost(value: string | null | undefined): string {
  const parsedHost = requireConnectionValue(value);
  const host =
    parsedHost.startsWith("[") && parsedHost.endsWith("]")
      ? parsedHost.slice(1, -1)
      : parsedHost;
  if (isIP(host) !== 0) return host;

  const labels = host.split(".");
  if (
    host.length > 253 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label),
    )
  ) {
    throw invalidDatabaseUrl("unsupported");
  }
  return host;
}

export function normalizeDatabaseUrl(databaseUrl: string): PoolConfig {
  if (databaseUrl.length === 0) {
    throw invalidDatabaseUrl("missing");
  }
  if (
    Buffer.byteLength(databaseUrl, "utf8") > DATABASE_URL_MAX_BYTES ||
    /[\p{Cc} ]/u.test(databaseUrl) ||
    !databaseUrl.startsWith("postgresql://")
  ) {
    throw invalidDatabaseUrl("unsupported");
  }

  validateParameters(databaseUrl);

  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(databaseUrl);
  } catch {
    throw invalidDatabaseUrl("unsupported");
  }

  const host = normalizeHost(parsed.host);
  const ssl = parsed.ssl;
  const ca = isRecord(ssl) && typeof ssl.ca === "string" ? ssl.ca : undefined;

  return {
    host,
    port: normalizePort(parsed.port),
    database: requireConnectionValue(parsed.database),
    user: requireConnectionValue(parsed.user),
    password: requireConnectionValue(parsed.password),
    ssl: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      checkServerIdentity: (_servername, certificate) =>
        checkServerIdentity(host, certificate),
      ...(ca === undefined ? {} : { ca }),
    },
    sslnegotiation: "postgres",
    max: POSTGRESQL_POOL_SIZE,
    connectionTimeoutMillis: POSTGRESQL_CONNECT_TIMEOUT_MILLISECONDS,
    statement_timeout: POSTGRESQL_COMMAND_TIMEOUT_MILLISECONDS,
    query_timeout: POSTGRESQL_COMMAND_TIMEOUT_MILLISECONDS,
  };
}
