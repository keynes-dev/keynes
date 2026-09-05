import { expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  mkdir,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

it("supports standalone help and rejects arguments", () => {
  const script = fileURLToPath(new URL("run-hosted.ts", import.meta.url));
  expect(spawnSync(process.execPath, [script, "--help"]).status).toBe(0);
  expect(
    spawnSync(process.execPath, [script, "--output", "unused"]).status,
  ).toBe(1);
});
it("exits 1 with ambient credentials and never calls packages, provisioning or the database", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-hosted-cli-"));
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Missing listener");
    const shim = join(root, "bin");
    await mkdir(shim);
    for (const command of ["docker", "psql", "pnpm"]) {
      const path = join(shim, command);
      await writeFile(
        path,
        `#!/bin/sh\necho called >> '${join(root, "calls")}'\nexit 99\n`,
      );
      await chmod(path, 0o755);
    }
    const url = `postgresql://synthetic:private@127.0.0.1:${address.port}/unused`;
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("run-hosted.ts", import.meta.url))],
      {
        env: {
          ...process.env,
          PATH: `${shim}:${process.env.PATH}`,
          KEYNES_DATABASE_URL: url,
          DATABASE_URL: url,
          PGPASSWORD: "private",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.stderr.on("data", (chunk) => {
      text += chunk;
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", resolve);
    });
    expect(code).toBe(1);
    expect(connections).toBe(0);
    expect(text).not.toContain("private");
    await expect(readFile(join(root, "calls"))).rejects.toThrow();
    expect(text).toContain(
      "NOT RUN: supported Hosted product runner unavailable",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
});
