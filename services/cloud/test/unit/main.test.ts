import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadStartupConfig } from "../../src/main.ts";

const temporaryDirectories: string[] = [];

async function registry(contents: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "keynes-cloud-main-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "identities.json");
  await writeFile(path, `${JSON.stringify(contents)}\n`);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Cloud startup configuration", () => {
  it("loads one closed digest-only registry", async () => {
    const tokenSha256 = createHash("sha256").update("token").digest("hex");
    const registryPath = await registry([
      {
        tokenSha256,
        tenantId: "00000000-0000-4000-8000-000000000001",
        principalId: "00000000-0000-4000-8000-000000000101",
      },
    ]);

    await expect(
      loadStartupConfig({
        KEYNES_CLOUD_DATABASE_URL:
          "postgresql://keynes_service:password@127.0.0.1:5432/keynes",
        KEYNES_CLOUD_IDENTITY_REGISTRY: registryPath,
        KEYNES_CLOUD_PORT: "0",
      }),
    ).resolves.toEqual({
      databaseUrl: "postgresql://keynes_service:password@127.0.0.1:5432/keynes",
      identities: [
        {
          tokenSha256,
          tenantId: "00000000-0000-4000-8000-000000000001",
          principalId: "00000000-0000-4000-8000-000000000101",
        },
      ],
      port: 0,
    });
  });

  it.each([
    ["missing database", {}],
    [
      "unknown Cloud option",
      {
        KEYNES_CLOUD_DATABASE_URL: "postgresql://service@127.0.0.1/keynes",
        KEYNES_CLOUD_IDENTITY_REGISTRY: "/tmp/identities.json",
        KEYNES_CLOUD_PORT: "0",
        KEYNES_CLOUD_DROP_RESPONSE_COMMAND_ID:
          "00000000-0000-4000-8000-000000000001",
      },
    ],
    [
      "non-PostgreSQL URL",
      {
        KEYNES_CLOUD_DATABASE_URL: "file:///tmp/keynes",
        KEYNES_CLOUD_IDENTITY_REGISTRY: "/tmp/identities.json",
        KEYNES_CLOUD_PORT: "0",
      },
    ],
    [
      "invalid port",
      {
        KEYNES_CLOUD_DATABASE_URL: "postgresql://service@127.0.0.1/keynes",
        KEYNES_CLOUD_IDENTITY_REGISTRY: "/tmp/identities.json",
        KEYNES_CLOUD_PORT: "65536",
      },
    ],
  ])("rejects %s", async (_name, environment) => {
    await expect(loadStartupConfig(environment)).rejects.toThrow(
      /Cloud startup configuration/i,
    );
  });

  it("rejects a registry containing raw tokens or extra fields", async () => {
    const registryPath = await registry([
      {
        token: "secret",
        tokenSha256: "a".repeat(64),
        tenantId: "00000000-0000-4000-8000-000000000001",
        principalId: "00000000-0000-4000-8000-000000000101",
      },
    ]);

    await expect(
      loadStartupConfig({
        KEYNES_CLOUD_DATABASE_URL: "postgresql://service@127.0.0.1/keynes",
        KEYNES_CLOUD_IDENTITY_REGISTRY: registryPath,
        KEYNES_CLOUD_PORT: "0",
      }),
    ).rejects.toThrow(/identity registry/i);
  });
});
