import { Client } from "pg";

import {
  REMOTE_MODES,
  validateNativeSelection,
} from "../required-scenarios.ts";

import type { RemoteLogin } from "./remote-identity.js";

export type RemoteConnectionProfile =
  | "direct"
  | "session-pool"
  | "transaction-pool";

export async function openRemoteConnection(
  databaseUrl: string,
  login: Pick<RemoteLogin, "role" | "password">,
  profile: RemoteConnectionProfile,
): Promise<Client> {
  const client = new Client({
    connectionString: loginUrl(profileUrl(databaseUrl, profile), login),
  });
  await client.connect();
  return client;
}

export async function poolerMode(
  profile: Exclude<RemoteConnectionProfile, "direct">,
): Promise<string> {
  const adminUrl = new URL(profileUrl("", profile));
  adminUrl.pathname = "/pgbouncer";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const result = await client.query<{
      readonly key: string;
      readonly value: string;
    }>("show config");
    const mode = result.rows.find(({ key }) => key === "pool_mode")?.value;
    if (mode === undefined)
      throw new Error("PgBouncer did not report pool_mode");
    return mode;
  } finally {
    await client.end();
  }
}

export async function connectWithVerifiedTls(
  databaseUrl: string,
  login: Pick<RemoteLogin, "role" | "password">,
  profile: RemoteConnectionProfile = "direct",
): Promise<Client> {
  const client = new Client({
    connectionString: loginUrl(profileUrl(databaseUrl, profile), login),
    connectionTimeoutMillis: 2_000,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

export function unavailableDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.hostname = "127.0.0.1";
  url.port = "1";
  return url.toString();
}

function loginUrl(
  databaseUrl: string,
  login: Pick<RemoteLogin, "role" | "password">,
): string {
  const url = new URL(databaseUrl);
  url.username = login.role;
  url.password = login.password;
  return url.toString();
}

function profileUrl(
  directUrl: string,
  profile: RemoteConnectionProfile,
): string {
  if (profile === "direct") return directUrl;
  const source = process.env.KEYNES_POSTGRESQL_SYSTEM_CONTEXT;
  if (source === undefined)
    throw new Error("PgBouncer profiles require runner context");
  const value: unknown = JSON.parse(source);
  if (!isRecord(value) || !isRecord(value.poolers)) {
    throw new Error("Invalid PgBouncer runner context");
  }
  const key = profile === "session-pool" ? "sessionUrl" : "transactionUrl";
  const endpoint = value.poolers[key];
  if (typeof endpoint !== "string")
    throw new Error("Invalid PgBouncer runner context");
  if (directUrl === "") return endpoint;
  const url = new URL(endpoint);
  url.pathname = new URL(directUrl).pathname;
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function selectedConnectionProfiles(): readonly RemoteConnectionProfile[] {
  const source = process.env.KEYNES_POSTGRESQL_SYSTEM_CONTEXT;
  if (source === undefined)
    throw new Error("Remote profiles require runner context");
  const context: unknown = JSON.parse(source);
  if (!isRecord(context)) throw new Error("Invalid runner context");
  if (context.selection === undefined) return REMOTE_MODES;
  const selection = validateNativeSelection(context.selection);
  if (selection.kind === "ci") return ["direct"];
  if (selection.kind !== "remote")
    throw new Error("Remote profiles require remote or CI selection");
  return selection.modes;
}
