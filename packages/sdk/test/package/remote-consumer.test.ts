import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";
import { withPackagePreparationLock } from "@keynes/testkit/package";
import { runProcess } from "@keynes/testkit/process";
import { runRemoteConsumer, REMOTE_CONSUMER_CASES } from "./remote-consumer.ts";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
let workspace: string;
beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "keynes-remote-consumer-test-"));
  await withPackagePreparationLock({ repositoryRoot: root }, () =>
    runProcess({
      executable: "pnpm",
      args: [
        "--config.node-linker=hoisted",
        "--filter",
        "@keynes/sdk",
        "pack",
        "--pack-destination",
        workspace,
      ],
      cwd: root,
    }),
  );
}, 30_000);
afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

it("declares all installed remote boundaries", () => {
  expect(REMOTE_CONSUMER_CASES).toEqual([
    "verified-budget-workflow",
    "tenant-isolation",
    "reconnect-exact-replay",
    "operation-conflict",
    "unavailable-endpoint",
    "wrong-ca",
    "wrong-hostname",
  ]);
});

it("fails the installed SDK workflow against an existing plaintext target", async () => {
  let sslRequests = 0;
  const server = createServer((socket) =>
    socket.once("data", () => {
      sslRequests++;
      socket.end("N");
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Missing test address");
    const url = `postgresql://ordinary:secret@127.0.0.1:${address.port}/keynes?sslmode=verify-full`;
    const result = await runRemoteConsumer({
      archivePath: join(workspace, "keynes-sdk-0.0.0.tgz"),
      targets: [
        {
          mode: "direct",
          primaryUrl: url,
          secondaryUrl: url,
          wrongCaUrl: url,
          wrongHostnameUrl: url,
          unavailableUrl: url,
        },
      ],
    });
    expect(result.outcome).toBe("failed");
    expect(sslRequests).toBeGreaterThan(0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 30_000);

it("terminates the installed consumer child when its driver receives SIGTERM", async () => {
  let signalRequest: () => void = () => {};
  const requested = new Promise<void>((resolve) => {
    signalRequest = resolve;
  });
  let connectionClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    connectionClosed = resolve;
  });
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("data", signalRequest);
    socket.once("close", () => {
      sockets.delete(socket);
      connectionClosed();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Missing listener");
    const url = `postgresql://ordinary:secret@127.0.0.1:${address.port}/keynes?sslmode=verify-full`;
    const inputPath = join(workspace, "cancel-input.json");
    await writeFile(
      inputPath,
      JSON.stringify({
        archivePath: join(workspace, "keynes-sdk-0.0.0.tgz"),
        targets: [
          {
            mode: "direct",
            primaryUrl: url,
            secondaryUrl: url,
            wrongCaUrl: url,
            wrongHostnameUrl: url,
            unavailableUrl: url,
          },
        ],
      }),
      { mode: 0o600 },
    );
    child = spawn(
      process.execPath,
      [
        join(root, "packages/sdk/test/package/remote-consumer.ts"),
        inputPath,
        join(workspace, "cancel-result.json"),
      ],
      { stdio: "ignore", env: { ...process.env, TMPDIR: workspace } },
    );
    const exit = new Promise((resolve) => child?.once("exit", resolve));
    await requested;
    child.kill("SIGTERM");
    await exit;
    expect(
      await Promise.race([
        closed.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 1_000)),
      ]),
    ).toBe(true);
  } finally {
    child?.kill("SIGKILL");
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 15_000);
