import { randomUUID, createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { runProcess } from "@keynes/testkit/process";
import { providerFreeEnvironment } from "@keynes/testkit/package";
import { PGBOUNCER_IMAGE, POSTGRES_IMAGE } from "../run.ts";
import {
  validateRemoteSelection,
  type RemoteMode,
} from "../required-scenarios.ts";
import {
  REMOTE_RUNTIME_PROCEDURES,
  REMOTE_TENANT_A,
  REMOTE_TENANT_B,
  REMOTE_PRINCIPAL_A,
  REMOTE_PRINCIPAL_B,
} from "./remote-authority.ts";
export interface TlsRuntime {
  run(
    executable: string,
    args: readonly string[],
    environment?: NodeJS.ProcessEnv,
    signal?: AbortSignal,
  ): Promise<string>;
  ready(
    url: string,
    caPath: string,
    signal?: AbortSignal,
    mode?: RemoteMode,
  ): Promise<void>;
  install(
    url: string,
    caPath: string,
    commandPath: string,
    root: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<void>;
}
export async function openTlsFixture(
  input: {
    commandPath: string;
    modes: readonly RemoteMode[];
    attemptId?: string;
    onCleanup?: (status: "passed" | "failed") => void;
    signal?: AbortSignal;
  },
  runtime: TlsRuntime = production,
) {
  const { modes } = validateRemoteSelection({
    kind: "remote",
    modes: input.modes,
  });
  input.signal?.throwIfAborted();
  const root = await mkdtemp(join(tmpdir(), "keynes-tls-"));
  const id = `keynes-tls-${input.attemptId ?? randomUUID()}`;
  const password = randomUUID();
  const caPath = join(root, "ca.crt");
  const containers: string[] = [];
  const bridges: { close(): Promise<void> }[] = [];
  let networkAttempted = false;
  let closed = false;
  const environment = providerFreeEnvironment(process.env);
  const run = (
    executable: string,
    args: readonly string[],
    env = environment,
  ) => {
    input.signal?.throwIfAborted();
    return runtime
      .run(executable, args, env, input.signal)
      .catch((cause: unknown) => {
        throw new Error(`TLS fixture ${executable} ${args[0]} failed`, {
          cause,
        });
      });
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    const failures: unknown[] = [];
    for (const bridge of bridges.reverse())
      try {
        await bridge.close();
      } catch (error) {
        failures.push(error);
      }
    for (const container of containers.reverse())
      try {
        await runtime.run(
          "docker",
          ["rm", "--force", container],
          environment,
          AbortSignal.timeout(10_000),
        );
      } catch (error) {
        failures.push(error);
      }
    if (networkAttempted)
      try {
        await runtime.run(
          "docker",
          ["network", "rm", id],
          environment,
          AbortSignal.timeout(10_000),
        );
      } catch (error) {
        failures.push(error);
      }
    try {
      await rm(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    input.onCleanup?.(failures.length === 0 ? "passed" : "failed");
    if (failures.length)
      throw new AggregateError(failures, "TLS fixture cleanup failed");
  };
  const start = async (name: string, image: string, script: string) => {
    containers.push(name);
    await run(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        name,
        "--network",
        id,
        "--network-alias",
        name === id ? "postgres" : name,
        "--user",
        "root",
        "--entrypoint",
        "/bin/sh",
        "--env",
        "POSTGRES_PASSWORD",
        "--volume",
        `${root}:/keynes-input:ro`,
        "--publish",
        "127.0.0.1::5432",
        image,
        "-ec",
        script,
      ],
      { ...environment, POSTGRES_PASSWORD: password },
    );
    const output = await run("docker", ["port", name, "5432/tcp"]);
    const match = /^127\.0\.0\.1:(\d+)\s*$/.exec(output);
    if (match?.[1] === undefined)
      throw new Error("TLS fixture must bind loopback");
    return Number(match[1]);
  };
  const url = (port: number, role: string) =>
    `postgresql://${role}:${password}@127.0.0.1:${port}/postgres`;
  const verified = (source: string, ca = caPath) => {
    const parsed = new URL(source);
    parsed.searchParams.set("sslmode", "verify-full");
    parsed.searchParams.set("sslrootcert", ca);
    return parsed.toString();
  };
  try {
    await chmod(root, 0o700);
    for (const name of ["ca", "wrong-ca"]) {
      await run("openssl", [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        `/CN=keynes-${name}`,
        "-keyout",
        join(root, `${name}.key`),
        "-out",
        join(root, `${name}.crt`),
      ]);
      await chmod(join(root, `${name}.key`), 0o600);
    }
    await run("openssl", [
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=localhost",
      "-keyout",
      join(root, "server.key"),
      "-out",
      join(root, "server.csr"),
    ]);
    await chmod(join(root, "server.key"), 0o600);
    await writeFile(
      join(root, "server.ext"),
      "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:postgres\nextendedKeyUsage=serverAuth\n",
      { mode: 0o600 },
    );
    await run("openssl", [
      "x509",
      "-req",
      "-days",
      "1",
      "-in",
      join(root, "server.csr"),
      "-CA",
      caPath,
      "-CAkey",
      join(root, "ca.key"),
      "-CAcreateserial",
      "-extfile",
      join(root, "server.ext"),
      "-out",
      join(root, "server.crt"),
    ]);
    await writeFile(
      join(root, "pg_hba.conf"),
      "local all all trust\nhostssl all all all scram-sha-256\nhostnossl all all all reject\n",
      { mode: 0o600 },
    );
    networkAttempted = true;
    await run("docker", ["network", "create", id]);
    const copy =
      "mkdir -p /tmp/keynes-tls; cp /keynes-input/server.key /keynes-input/server.crt /keynes-input/ca.crt /tmp/keynes-tls/; chown -R postgres:postgres /tmp/keynes-tls; chmod 600 /tmp/keynes-tls/server.key; ";
    const directPort = await start(
      id,
      POSTGRES_IMAGE,
      copy +
        "cp /keynes-input/pg_hba.conf /tmp/keynes-tls/; chmod 644 /tmp/keynes-tls/pg_hba.conf; exec /usr/local/bin/docker-entrypoint.sh postgres -c statement_timeout=30000 -c ssl=on -c ssl_min_protocol_version=TLSv1.2 -c ssl_cert_file=/tmp/keynes-tls/server.crt -c ssl_key_file=/tmp/keynes-tls/server.key -c hba_file=/tmp/keynes-tls/pg_hba.conf",
    );
    await runtime.ready(url(directPort, "postgres"), caPath, input.signal);
    await runtime.install(
      url(directPort, "postgres"),
      caPath,
      input.commandPath,
      root,
      password,
      input.signal,
    );
    await writeFile(
      join(root, "userlist.txt"),
      ["postgres", "keynes_a", "keynes_b"]
        .map((role) => `"${role}" "${password}"`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    const targets = [];
    for (const mode of modes) {
      let port = directPort;
      if (mode !== "direct") {
        await writeFile(
          join(root, `${mode}.ini`),
          `[databases]\n* = host=postgres port=5432\n[pgbouncer]\nlisten_addr = 0.0.0.0\nlisten_port = 5432\npool_mode = ${mode === "session-pool" ? "session" : "transaction"}\nauth_type = scram-sha-256\nauth_file = /tmp/keynes-tls/userlist.txt\nadmin_users = postgres\nignore_startup_parameters = statement_timeout\nclient_tls_sslmode = require\nclient_tls_protocols = secure\nclient_tls_cert_file = /tmp/keynes-tls/server.crt\nclient_tls_key_file = /tmp/keynes-tls/server.key\nserver_tls_sslmode = verify-full\nserver_tls_ca_file = /tmp/keynes-tls/ca.crt\nserver_reset_query = DISCARD ALL\n`,
          { mode: 0o600 },
        );
        port = await start(
          `${id}-${mode}`,
          PGBOUNCER_IMAGE,
          copy +
            `cp /keynes-input/${mode}.ini /tmp/keynes-tls/pgbouncer.ini; cp /keynes-input/userlist.txt /tmp/keynes-tls/; chown -R postgres:postgres /tmp/keynes-tls; exec pgbouncer -u postgres /tmp/keynes-tls/pgbouncer.ini`,
        );
        await runtime.ready(url(port, "postgres"), caPath, input.signal, mode);
      }
      // An IPv6 loopback bridge preserves the server certificate while changing the verified hostname.
      const bridge = await wrongHostnameBridge(port);
      bridges.push(bridge);
      const wrongHostname = new URL(verified(url(port, "keynes_a")));
      wrongHostname.hostname = "[::1]";
      wrongHostname.port = String(bridge.port);
      targets.push({
        mode,
        primaryUrl: verified(url(port, "keynes_a")),
        secondaryUrl: verified(url(port, "keynes_b")),
        wrongCaUrl: verified(url(port, "keynes_a"), join(root, "wrong-ca.crt")),
        wrongHostnameUrl: wrongHostname.toString(),
        unavailableUrl: verified(url(1, "keynes_a")),
      });
    }
    const dockerVersion = (
      await run("docker", ["version", "--format", "{{.Server.Version}}"])
    ).trim();
    const postgresImageId = (
      await run("docker", ["inspect", "--format", "{{.Image}}", id])
    ).trim();
    const pnpmVersion = (await run("pnpm", ["--version"])).trim();
    if (
      !/^\d+\.\d+\.\d+/.test(dockerVersion) ||
      !/^sha256:[a-f0-9]{64}$/.test(postgresImageId) ||
      !/^\d+\.\d+\.\d+$/.test(pnpmVersion)
    )
      throw new Error("Missing TLS runtime observations");
    const observedPoolers = [];
    for (const mode of modes)
      if (mode !== "direct") {
        const imageId = (
          await run("docker", [
            "inspect",
            "--format",
            "{{.Image}}",
            `${id}-${mode}`,
          ])
        ).trim();
        const version = /^PgBouncer (\d+\.\d+\.\d+)/.exec(
          await run("docker", [
            "exec",
            `${id}-${mode}`,
            "pgbouncer",
            "--version",
          ]),
        )?.[1];
        if (version === undefined || !/^sha256:[a-f0-9]{64}$/.test(imageId))
          throw new Error("Missing pooler observation");
        observedPoolers.push({
          profile: mode,
          poolMode: mode === "session-pool" ? "session" : "transaction",
          imageId,
          version,
        });
      }
    input.signal?.throwIfAborted();
    return {
      root,
      targets,
      observations: {
        dockerVersion,
        pnpmVersion,
        postgresImageId,
        postgresVersion: "180006",
        observedPoolers,
        postgresImage: POSTGRES_IMAGE,
        pgbouncerImage: PGBOUNCER_IMAGE,
        poolers: modes.filter((mode) => mode !== "direct"),
        certificateSha256: createHash("sha256")
          .update(await readFile(join(root, "server.crt")))
          .digest("hex"),
      },
      close,
    };
  } catch (error: unknown) {
    try {
      await close();
    } catch (cleanup: unknown) {
      throw new AggregateError(
        [error, cleanup],
        "TLS fixture failed and cleanup failed",
      );
    }
    throw error;
  }
}

async function wrongHostnameBridge(port: number) {
  const sockets = new Set<Socket>();
  const server = createServer((client) => {
    const backend = createConnection({ host: "127.0.0.1", port });
    for (const socket of [client, backend]) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {
        client.destroy();
        backend.destroy();
      });
    }
    client.pipe(backend).pipe(client);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "::1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Missing hostname bridge address");
  return {
    port: address.port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

const production: TlsRuntime = {
  run: (executable, args, environment, signal) =>
    runProcess({ executable, args, environment, signal, cwd: process.cwd() }),
  async ready(url, caPath, signal, mode = "direct") {
    const ca = await readFile(caPath, "utf8");
    const deadline = Date.now() + 30_000;
    while (true) {
      signal?.throwIfAborted();
      const client = new Client({
        connectionString: url,
        ssl: { ca, rejectUnauthorized: true, minVersion: "TLSv1.2" },
        connectionTimeoutMillis: 1_000,
        query_timeout: 1_000,
      });
      try {
        await client.connect();
        const result = await client.query<{
          ssl: boolean;
          version: string;
          timeout: string;
        }>(
          "select ssl, current_setting('server_version_num') as version, current_setting('statement_timeout') as timeout from pg_stat_ssl where pid = pg_backend_pid()",
        );
        if (
          result.rows[0]?.ssl !== true ||
          result.rows[0]?.version !== "180006" ||
          result.rows[0]?.timeout !== "30s"
        )
          throw new Error("Backend TLS, version or timeout unavailable");
        if (mode !== "direct") {
          const adminUrl = new URL(url);
          adminUrl.pathname = "/pgbouncer";
          const pooler = new Client({
            connectionString: adminUrl.toString(),
            ssl: { ca, rejectUnauthorized: true, minVersion: "TLSv1.2" },
            connectionTimeoutMillis: 1_000,
            query_timeout: 1_000,
          });
          try {
            await pooler.connect();
            const config = await pooler.query<{ key: string; value: string }>(
              "show config",
            );
            if (
              config.rows.find((row) => row.key === "pool_mode")?.value !==
              (mode === "session-pool" ? "session" : "transaction")
            )
              throw new Error("Observed pooler mode mismatch");
          } finally {
            await pooler.end();
          }
        }
        return;
      } catch (error: unknown) {
        if (Date.now() >= deadline)
          throw new Error("TLS readiness failed", { cause: error });
      } finally {
        await client.end();
      }
      await setTimeout(100, undefined, { signal });
    }
  },
  async install(url, caPath, commandPath, root, password, signal) {
    const client = new Client({
      connectionString: url,
      ssl: { ca: await readFile(caPath, "utf8"), rejectUnauthorized: true },
      connectionTimeoutMillis: 2_000,
      query_timeout: 10_000,
    });
    try {
      await client.connect();
      for (const statement of [
        "create role keynes_owner nologin",
        "create role keynes_execution nologin noinherit",
        ...["keynes_admin", "keynes_a", "keynes_b"].map(
          (role) =>
            `create role ${role} login noinherit password '${password}'`,
        ),
        "grant keynes_owner to postgres",
        "grant create on database postgres to keynes_owner",
        "grant connect on database postgres to keynes_admin, keynes_a, keynes_b",
      ]) {
        signal?.throwIfAborted();
        await client.query(statement);
      }
      const configPath = join(root, "install.json");
      await writeFile(
        configPath,
        JSON.stringify({
          ownerRole: "keynes_owner",
          executionRole: "keynes_execution",
          administrationRole: "keynes_admin",
          applicationRole: "keynes_a",
          tenantId: REMOTE_TENANT_A,
          principalId: REMOTE_PRINCIPAL_A,
        }),
        { mode: 0o600 },
      );
      const parsed = new URL(url);
      const result: unknown = JSON.parse(
        await production
          .run(
            commandPath,
            ["install", "--config", configPath],
            {
              ...providerFreeEnvironment(process.env),
              PGHOST: parsed.hostname,
              PGPORT: parsed.port,
              PGUSER: "postgres",
              PGPASSWORD: password,
              PGDATABASE: "postgres",
              PGSSLMODE: "verify-full",
              PGSSLROOTCERT: caPath,
              NODE_EXTRA_CA_CERTS: caPath,
            },
            signal,
          )
          .catch((cause: unknown) => {
            throw new Error("Installed CLI setup failed", { cause });
          }),
      );
      if (
        typeof result !== "object" ||
        result === null ||
        !("ok" in result) ||
        result.ok !== true
      )
        throw new Error("Installed CLI rejected TLS fixture");
      for (const [role, tenant, principal] of [
        ["keynes_a", REMOTE_TENANT_A, REMOTE_PRINCIPAL_A],
        ["keynes_b", REMOTE_TENANT_B, REMOTE_PRINCIPAL_B],
      ]) {
        for (const permission of [
          "define_resource_type",
          "create_root_budget",
          "request_budget",
          "settle_budget",
          "read_budget",
        ])
          await client.query(
            "insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission) values ($1::uuid, $2::uuid, $3) on conflict do nothing",
            [tenant, principal, permission],
          );
        await client.query(`grant usage on schema keynes to ${role}`);
        for (const procedure of REMOTE_RUNTIME_PROCEDURES)
          await client.query(
            `grant execute on function ${procedure} to ${role}`,
          );
        await client.query("set role keynes_admin");
        try {
          await client.query(
            "select keynes_internal.register_remote_role_v0006($1::name,$2::uuid,$3::uuid)",
            [role, tenant, principal],
          );
        } finally {
          await client.query("reset role");
        }
      }
    } finally {
      await client.end();
    }
  },
};
