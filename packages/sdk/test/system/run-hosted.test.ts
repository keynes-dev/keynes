import { expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  mkdir,
  chmod,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import {
  parseHostedArguments,
  runHosted,
  validateHostedEvidence,
} from "./run-hosted.ts";
const snapshot = async () => ({
  commit: "a".repeat(40),
  clean: true,
  dirtyInputSha256: null,
});
it.each(
  [
    [],
    ["--output", ""],
    ["--output", "a", "--output", "b"],
    ["--output", "a", "--target", "secret"],
    ["--output", "a", "--sdk-archive", "sdk.tgz"],
    ["--help", "--output", "a"],
    ["--unknown"],
    ["--", "--", "--help"],
  ].map((args) => [args] as const),
)("rejects invalid Hosted arguments %j", (args) => {
  expect(() => parseHostedArguments(args)).toThrow();
});
it("accepts only output or standalone help", () => {
  expect(parseHostedArguments(["--help"])).toEqual({ kind: "help" });
  expect(parseHostedArguments(["--", "--output", "attempt"])).toMatchObject({
    kind: "run",
  });
});
it("retains a stable source refusal and refuses reuse or changed evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-hosted-test-"));
  const output = join(root, "attempt");
  try {
    const result = await runHosted(output, snapshot);
    expect(result).toMatchObject({
      outcome: "NOT RUN",
      reason: "supported Hosted product runner unavailable",
      selection: { kind: "hosted" },
    });
    await expect(
      validateHostedEvidence(output, result),
    ).resolves.toBeUndefined();
    await expect(runHosted(output, snapshot)).rejects.toThrow();
    await expect(
      validateHostedEvidence(output, { ...result, outcome: "passed" }),
    ).rejects.toThrow();
    await writeFile(join(output, "initial.json"), "{}");
    await expect(validateHostedEvidence(output, result)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it.each(["changed", "unavailable"])(
  "retains safe failure evidence when source identity is %s",
  async (failure) => {
    const root = await mkdtemp(join(tmpdir(), "keynes-hosted-failure-"));
    let calls = 0;
    try {
      const result = await runHosted(join(root, "attempt"), async () => {
        calls++;
        if (failure === "unavailable")
          throw new Error("postgresql://sensitive:password@private/target");
        return {
          commit: (calls === 1 ? "a" : "b").repeat(40),
          clean: true,
          dirtyInputSha256: null,
        };
      });
      expect(result.outcome).toBe("failed");
      expect(JSON.stringify(result)).not.toContain("password");
      expect(
        JSON.parse(await readFile(join(root, "attempt/manifest.json"), "utf8"))
          .outcome,
      ).toBe("failed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
it("rejects linked evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "keynes-hosted-link-"));
  const output = join(root, "attempt");
  try {
    const result = await runHosted(output, snapshot);
    const bytes = await readFile(join(output, "initial.json"));
    await writeFile(join(root, "copy.json"), bytes);
    await rm(join(output, "initial.json"));
    await symlink(join(root, "copy.json"), join(output, "initial.json"));
    await expect(validateHostedEvidence(output, result)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
    const output = join(root, "attempt");
    const url = `postgresql://synthetic:private@127.0.0.1:${address.port}/unused`;
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL("run-hosted.ts", import.meta.url)),
        "--output",
        output,
      ],
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
    const result = JSON.parse(
      await readFile(join(output, "manifest.json"), "utf8"),
    );
    expect(result.outcome).toBe("NOT RUN");
    expect(JSON.stringify(result)).not.toContain("private");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
});
