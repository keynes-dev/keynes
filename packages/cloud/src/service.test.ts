import { createHash } from "node:crypto";
import { request as requestHttp } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBearerAuthenticator } from "./authentication.ts";
import { DatabaseUnavailableError } from "./database.ts";
import { startCloudService } from "./service.ts";

const TOKEN = "cloud-test-token";
const OTHER_TOKEN = "unknown-cloud-token";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const PRINCIPAL_ID = "00000000-0000-4000-8000-000000000101";
const limits = {
  maxBodyBytes: 256,
  requestTimeoutMs: 50,
  drainTimeoutMs: 500,
} as const;

const running: Array<Awaited<ReturnType<typeof startCloudService>>> = [];

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function authenticator() {
  return createBearerAuthenticator([
    {
      tokenSha256: tokenDigest(TOKEN),
      tenantId: TENANT_ID,
      principalId: PRINCIPAL_ID,
    },
  ]);
}

async function start(
  invoke: Parameters<typeof startCloudService>[0]["invoke"],
) {
  const service = await startCloudService({
    port: 0,
    authenticate: authenticator(),
    invoke,
    limits,
  });
  running.push(service);
  return service;
}

async function rpc(
  origin: string,
  options: {
    readonly token?: string;
    readonly method?: string;
    readonly path?: string;
    readonly contentType?: string;
    readonly body?: string;
  } = {},
): Promise<{
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) {
    headers.authorization = `Bearer ${options.token}`;
  }
  if (options.contentType !== undefined) {
    headers["content-type"] = options.contentType;
  }
  const response = await fetch(`${origin}${options.path ?? "/rpc"}`, {
    method: options.method ?? "POST",
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === "" ? undefined : JSON.parse(text),
    text,
  };
}

function validBody(): string {
  return JSON.stringify({
    operation: "getBudget",
    input: { budgetId: "20000000-0000-4000-8000-000000000001" },
  });
}

afterEach(async () => {
  await Promise.all(running.splice(0).map((service) => service.close()));
});

describe("controlled bearer authentication", () => {
  it("returns only the configured tenant and principal", () => {
    const authenticate = authenticator();

    expect(authenticate(`Bearer ${TOKEN}`)).toEqual({
      tenantId: TENANT_ID,
      principalId: PRINCIPAL_ID,
    });
    expect(authenticate(`Bearer ${TOKEN}`)).not.toHaveProperty("token");
    expect(authenticate(`Bearer ${TOKEN}`)).not.toHaveProperty("tokenSha256");
  });

  it("rejects duplicate digest configuration", () => {
    const digest = tokenDigest(TOKEN);

    expect(() =>
      createBearerAuthenticator([
        {
          tokenSha256: digest,
          tenantId: TENANT_ID,
          principalId: PRINCIPAL_ID,
        },
        {
          tokenSha256: digest,
          tenantId: "00000000-0000-4000-8000-000000000002",
          principalId: "00000000-0000-4000-8000-000000000201",
        },
      ]),
    ).toThrow(/duplicate token digest/i);
  });

  it.each([
    [
      "raw token",
      { token: TOKEN, tenantId: TENANT_ID, principalId: PRINCIPAL_ID },
    ],
    [
      "invalid digest",
      {
        tokenSha256: "not-a-digest",
        tenantId: TENANT_ID,
        principalId: PRINCIPAL_ID,
      },
    ],
    [
      "invalid tenant",
      {
        tokenSha256: tokenDigest(TOKEN),
        tenantId: "tenant-a",
        principalId: PRINCIPAL_ID,
      },
    ],
  ])("rejects %s identity configuration", (_name, binding) => {
    expect(() => createBearerAuthenticator([binding])).toThrow(
      /identity registry/i,
    );
  });
});

describe("private Cloud transport", () => {
  it("serves only POST /rpc", async () => {
    const invoke = vi.fn();
    const service = await start(invoke);

    expect(
      await rpc(service.origin, { method: "GET", path: "/rpc" }),
    ).toMatchObject({ status: 404 });
    expect(
      await rpc(service.origin, { method: "POST", path: "/other" }),
    ).toMatchObject({ status: 404 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["malformed", `Basic ${TOKEN}`],
    ["unknown", `Bearer ${OTHER_TOKEN}`],
  ])("returns one 401 for %s credentials", async (_name, authorization) => {
    const invoke = vi.fn();
    const service = await start(invoke);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (authorization !== undefined) headers.authorization = authorization;

    const response = await fetch(`${service.origin}/rpc`, {
      method: "POST",
      headers,
      body: validBody(),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { kind: "cloud_transport_error", code: "unauthenticated" },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid JSON", "{"],
    ["non-object", "[]"],
    ["missing input", JSON.stringify({ operation: "getBudget" })],
    [
      "additional field",
      JSON.stringify({
        operation: "getBudget",
        input: {},
        tenantId: TENANT_ID,
      }),
    ],
    ["unknown operation", JSON.stringify({ operation: "query", input: {} })],
  ])("rejects a closed envelope with %s", async (_name, body) => {
    const invoke = vi.fn();
    const service = await start(invoke);

    const response = await rpc(service.origin, {
      token: TOKEN,
      contentType: "application/json",
      body,
    });

    expect(response).toMatchObject({
      status: 400,
      body: {
        error: { kind: "cloud_transport_error", code: "invalid_request" },
      },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects an unsupported content type and an oversized body", async () => {
    const invoke = vi.fn();
    const service = await start(invoke);

    expect(
      await rpc(service.origin, {
        token: TOKEN,
        contentType: "text/plain",
        body: validBody(),
      }),
    ).toMatchObject({ status: 400 });
    expect(
      await rpc(service.origin, {
        token: TOKEN,
        contentType: "application/json",
        body: JSON.stringify({
          operation: "getBudget",
          input: "x".repeat(300),
        }),
      }),
    ).toMatchObject({ status: 400 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("times out an incomplete request body", async () => {
    const invoke = vi.fn();
    const service = await start(invoke);

    const response = await new Promise<{ status: number; body: unknown }>(
      (resolveResponse, rejectResponse) => {
        const request = requestHttp(`${service.origin}/rpc`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${TOKEN}`,
            "content-type": "application/json",
            "content-length": "32",
          },
        });
        request.once("error", rejectResponse);
        request.once("response", (incoming) => {
          let source = "";
          incoming.setEncoding("utf8");
          incoming.on("data", (chunk: string) => {
            source += chunk;
          });
          incoming.once("end", () => {
            request.destroy();
            resolveResponse({
              status: incoming.statusCode ?? 0,
              body: JSON.parse(source),
            });
          });
        });
        request.write("{");
      },
    );

    expect(response).toEqual({
      status: 400,
      body: {
        error: { kind: "cloud_transport_error", code: "invalid_request" },
      },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes authenticated identity and the authority envelope unchanged", async () => {
    const wire = {
      ok: true,
      result: { kind: "budget", budgetId: "safe" },
      replayed: false,
    } as const;
    const invoke = vi.fn(async () => wire);
    const service = await start(invoke);

    const response = await rpc(service.origin, {
      token: TOKEN,
      contentType: "application/json",
      body: validBody(),
    });

    expect(response).toEqual({
      status: 200,
      body: wire,
      text: JSON.stringify(wire),
    });
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith({
      identity: { tenantId: TENANT_ID, principalId: PRINCIPAL_ID },
      operation: "getBudget",
      input: { budgetId: "20000000-0000-4000-8000-000000000001" },
    });
  });

  it("returns a sanitized database-unavailable response", async () => {
    const secret = "postgresql://service:password@127.0.0.1/keynes";
    const service = await start(async () => {
      throw new DatabaseUnavailableError(new Error(secret));
    });

    const response = await rpc(service.origin, {
      token: TOKEN,
      contentType: "application/json",
      body: validBody(),
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: { kind: "cloud_transport_error", code: "database_unavailable" },
    });
    expect(response.text).not.toContain("password");
    expect(response.text).not.toContain("postgresql");
    expect(response.text).not.toContain(TOKEN);
    expect(response.text).not.toContain(TENANT_ID);
    expect(response.text).not.toContain(PRINCIPAL_ID);
  });

  it("returns 503 for new work while draining and completes accepted work", async () => {
    let release: ((value: unknown) => void) | undefined;
    let accepted: (() => void) | undefined;
    const entered = new Promise<void>((resolveEntered) => {
      accepted = resolveEntered;
    });
    const pending = new Promise<unknown>((resolvePending) => {
      release = resolvePending;
    });
    const invoke = vi.fn(async () => {
      accepted?.();
      return pending;
    });
    const service = await start(invoke);
    const first = rpc(service.origin, {
      token: TOKEN,
      contentType: "application/json",
      body: validBody(),
    });
    await entered;

    const closing = service.close();
    const rejected = await rpc(service.origin, {
      token: TOKEN,
      contentType: "application/json",
      body: validBody(),
    });

    expect(rejected).toMatchObject({
      status: 503,
      body: {
        error: { kind: "cloud_transport_error", code: "service_unavailable" },
      },
    });
    release?.({ ok: true, result: {}, replayed: false });
    await expect(first).resolves.toMatchObject({ status: 200 });
    await closing;
  });
});
