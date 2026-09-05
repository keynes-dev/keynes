import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { runProcess } from "@keynes/testkit/process";
import { openTlsFixture, type TlsRuntime } from "./tls-fixture.ts";
import { PGBOUNCER_IMAGE, POSTGRES_IMAGE } from "../run.ts";

function fake() {
  const commands: { executable: string; args: readonly string[] }[] = [];
  const runtime: TlsRuntime = {
    async run(executable, args, environment, signal) {
      commands.push({ executable, args });
      if (executable === "openssl")
        return runProcess({
          executable,
          args,
          cwd: process.cwd(),
          environment,
          signal,
        });
      if (args[0] === "inspect") return `sha256:${"a".repeat(64)}`;
      if (args[0] === "version") return "29.0.1";
      if (args[0] === "exec") return "PgBouncer 1.25.1";
      if (args[0] === "--version") return "11.21.0";
      if (args[0] === "port") return "127.0.0.1:49152\n";
      return "";
    },
    ready: async () => {},
    install: async () => {},
  };
  return { commands, runtime };
}

it.each(["direct", "session-pool", "transaction-pool"] as const)(
  "owns TLS material and only the selected %s dependencies",
  async (mode) => {
    const fakeRuntime = fake();
    const fixture = await openTlsFixture(
      { commandPath: "/installed/cli", modes: [mode] },
      fakeRuntime.runtime,
    );
    try {
      expect(fixture.root).not.toBe("");
      expect((await stat(fixture.root)).mode & 0o777).toBe(0o700);
      expect((await stat(join(fixture.root, "server.key"))).mode & 0o777).toBe(
        0o600,
      );
      expect(
        await readFile(join(fixture.root, "server.ext"), "utf8"),
      ).toContain("IP:127.0.0.1,DNS:localhost,DNS:postgres");
      const containers = fakeRuntime.commands.filter(
        (command) => command.args[0] === "run",
      );
      expect(
        containers.filter((command) => command.args.includes(POSTGRES_IMAGE)),
      ).toHaveLength(1);
      expect(
        containers
          .find((command) => command.args.includes(POSTGRES_IMAGE))
          ?.args.at(-1),
      ).toContain("statement_timeout=30000");
      expect(
        containers.filter((command) => command.args.includes(PGBOUNCER_IMAGE)),
      ).toHaveLength(mode === "direct" ? 0 : 1);
      if (mode !== "direct") {
        const config = await readFile(
          join(fixture.root, `${mode}.ini`),
          "utf8",
        );
        expect(config).toContain(
          "ignore_startup_parameters = statement_timeout",
        );
        expect(config).toContain("client_tls_sslmode = require");
        expect(config).toContain("server_tls_sslmode = verify-full");
        expect(config).toContain("server_tls_ca_file = /tmp/keynes-tls/ca.crt");
      }
    } finally {
      await fixture.close();
    }
    await expect(stat(fixture.root)).rejects.toThrow();
  },
);

it("cleans attempted containers and private material after readiness fails", async () => {
  const fakeRuntime = fake();
  fakeRuntime.runtime.ready = async () => {
    throw new Error("readiness failure");
  };
  await expect(
    openTlsFixture(
      { commandPath: "/installed/cli", modes: ["direct"] },
      fakeRuntime.runtime,
    ),
  ).rejects.toThrow("readiness failure");
  expect(fakeRuntime.commands.some((command) => command.args[0] === "rm")).toBe(
    true,
  );
  expect(
    fakeRuntime.commands.some(
      (command) => command.args[0] === "network" && command.args[1] === "rm",
    ),
  ).toBe(true);
});

it("cleans creation racing cancellation without removing another TLS attempt", async () => {
  const healthy = fake();
  const other = await openTlsFixture(
    { commandPath: "/installed/cli", modes: ["direct"] },
    healthy.runtime,
  );
  const cancelled = fake();
  const controller = new AbortController();
  const run = cancelled.runtime.run;
  cancelled.runtime.run = async (executable, args, env, signal) => {
    const result = await run(executable, args, env, signal);
    if (executable === "docker" && args[0] === "run") controller.abort();
    return result;
  };
  try {
    await expect(
      openTlsFixture(
        {
          commandPath: "/installed/cli",
          modes: ["direct"],
          signal: controller.signal,
        },
        cancelled.runtime,
      ),
    ).rejects.toThrow();
    expect(
      cancelled.commands.filter((command) => command.args[0] === "rm"),
    ).toHaveLength(1);
    expect((await stat(other.root)).isDirectory()).toBe(true);
    const removed = cancelled.commands
      .filter((command) => command.args[0] === "rm")
      .map((command) => command.args.at(-1));
    const owned = healthy.commands
      .filter((command) => command.args[0] === "run")
      .map((command) => command.args[command.args.indexOf("--name") + 1]);
    expect(
      removed.some((name) => name !== undefined && owned.includes(name)),
    ).toBe(false);
  } finally {
    await other.close();
  }
});
it("refuses a missing endpoint and cleans attempted fixtures", async () => {
  const context = fake();
  const run = context.runtime.run;
  context.runtime.run = (executable, args, env, signal) =>
    args[0] === "port"
      ? Promise.resolve("")
      : run(executable, args, env, signal);
  await expect(
    openTlsFixture(
      { commandPath: "/installed/cli", modes: ["direct"] },
      context.runtime,
    ),
  ).rejects.toThrow("loopback");
  expect(context.commands.some((command) => command.args[0] === "rm")).toBe(
    true,
  );
});

it.each([false, true])(
  "reports cleanup after failed TLS acquisition, including removal failure=%s",
  async (removalFails) => {
    const context = fake();
    context.runtime.ready = async () => {
      throw new Error("readiness failed");
    };
    const run = context.runtime.run;
    context.runtime.run = (executable, args, env, signal) =>
      removalFails && args[0] === "rm"
        ? Promise.reject(new Error("removal failed"))
        : run(executable, args, env, signal);
    const outcomes: string[] = [];
    await expect(
      openTlsFixture(
        {
          commandPath: "/installed/cli",
          modes: ["direct"],
          onCleanup: (status) => outcomes.push(status),
        },
        context.runtime,
      ),
    ).rejects.toThrow();
    expect(outcomes).toEqual([removalFails ? "failed" : "passed"]);
  },
);
