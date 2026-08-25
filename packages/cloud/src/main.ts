import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createBearerAuthenticator,
  parseIdentityBindings,
  type IdentityBinding,
} from "./authentication.ts";
import { connectPostgresAuthority } from "./database.ts";
import {
  SERVICE_LIMITS,
  startCloudService,
  type PostCommitContext,
} from "./service.ts";

const CLOUD_ENVIRONMENT_KEYS = new Set([
  "KEYNES_CLOUD_DATABASE_URL",
  "KEYNES_CLOUD_IDENTITY_REGISTRY",
  "KEYNES_CLOUD_PORT",
]);

export interface CloudStartupConfig {
  readonly databaseUrl: string;
  readonly identities: readonly IdentityBinding[];
  readonly port: number;
}

export interface RunningCloud {
  readonly origin: string;
  close(): Promise<void>;
}

export interface CloudRuntimeHooks {
  readonly afterCommit?: (context: PostCommitContext) => void | Promise<void>;
}

export async function loadStartupConfig(
  environment: NodeJS.ProcessEnv,
): Promise<CloudStartupConfig> {
  const unknownKey = Object.keys(environment).find(
    (key) =>
      key.startsWith("KEYNES_CLOUD_") && !CLOUD_ENVIRONMENT_KEYS.has(key),
  );
  const databaseUrl = environment.KEYNES_CLOUD_DATABASE_URL;
  const registryPath = environment.KEYNES_CLOUD_IDENTITY_REGISTRY;
  const portSource = environment.KEYNES_CLOUD_PORT;
  if (
    unknownKey !== undefined ||
    databaseUrl === undefined ||
    registryPath === undefined ||
    portSource === undefined
  ) {
    throw invalidStartupConfig();
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw invalidStartupConfig();
  }
  const port = Number(portSource);
  if (
    (parsedUrl.protocol !== "postgresql:" &&
      parsedUrl.protocol !== "postgres:") ||
    !Number.isSafeInteger(port) ||
    port < 0 ||
    port > 65_535
  ) {
    throw invalidStartupConfig();
  }

  let registry: unknown;
  try {
    registry = JSON.parse(await readFile(resolve(registryPath), "utf8"));
  } catch {
    throw invalidStartupConfig();
  }
  return {
    databaseUrl,
    identities: parseIdentityBindings(registry),
    port,
  };
}

export async function startConfiguredCloud(
  config: CloudStartupConfig,
  hooks: CloudRuntimeHooks = {},
): Promise<RunningCloud> {
  const authority = await connectPostgresAuthority(config.databaseUrl);
  let service: Awaited<ReturnType<typeof startCloudService>>;
  try {
    service = await startCloudService({
      port: config.port,
      authenticate: createBearerAuthenticator(config.identities),
      invoke: authority.invoke,
      limits: SERVICE_LIMITS,
      ...(hooks.afterCommit === undefined
        ? {}
        : { afterCommit: hooks.afterCommit }),
    });
  } catch (error: unknown) {
    await authority.close();
    throw error;
  }

  let closePromise: Promise<void> | undefined;
  return {
    origin: service.origin,
    close() {
      return (closePromise ??= (async () => {
        await service.close();
        await authority.close();
      })());
    },
  };
}

async function runMain(): Promise<void> {
  const config = await loadStartupConfig(process.env);
  const cloud = await startConfiguredCloud(config);
  process.send?.({ type: "ready", origin: cloud.origin });

  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    void cloud.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

function invalidStartupConfig(): Error {
  return new Error("Invalid Cloud startup configuration");
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void runMain().catch(() => {
    process.stderr.write("Cloud startup failed\n");
    process.exitCode = 1;
  });
}
