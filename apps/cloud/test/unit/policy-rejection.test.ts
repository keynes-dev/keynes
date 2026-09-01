import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBearerAuthenticator } from "../../src/authentication.ts";
import { startCloudService } from "../../src/service.ts";

const TOKEN = "policy-rejection-token";
const identity = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  principalId: "00000000-0000-4000-8000-000000000101",
} as const;
const running: Array<Awaited<ReturnType<typeof startCloudService>>> = [];

afterEach(async () => {
  await Promise.all(running.splice(0).map((service) => service.close()));
});

describe("Cloud Policy boundary", () => {
  it.each([
    ["policies", "createBudget", { policies: { definitions: [] } }],
    ["empty policies", "createBudget", { policies: [] }],
    ["context", "requestBudget", { context: { customerTier: "gold" } }],
    ["childPolicies", "requestBudget", { childPolicies: { definitions: [] } }],
    ["empty childPolicies", "requestBudget", { childPolicies: [] }],
  ])(
    "rejects %s before database invocation",
    async (_field, operation, extra) => {
      const invoke = vi.fn(async () => ({ ok: true }));
      const service = await start(invoke);

      const response = await rpc(service.origin, operation, {
        commandId: "30000000-0000-4000-8000-000000000001",
        resources: [],
        ...(operation === "requestBudget"
          ? { parentBudgetId: "20000000-0000-4000-8000-000000000001" }
          : {}),
        ...extra,
      });

      expect(response).toEqual({
        status: 400,
        body: {
          error: { kind: "cloud_transport_error", code: "invalid_request" },
        },
      });
      expect(invoke).not.toHaveBeenCalled();
    },
  );

  it("forwards a no-Policy command unchanged", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const service = await start(invoke);
    const input = {
      commandId: "30000000-0000-4000-8000-000000000001",
      parentBudgetId: "20000000-0000-4000-8000-000000000001",
      resources: [],
    };

    await expect(rpc(service.origin, "requestBudget", input)).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(invoke).toHaveBeenCalledWith({
      identity,
      operation: "requestBudget",
      input,
    });
  });
});

async function start(
  invoke: Parameters<typeof startCloudService>[0]["invoke"],
) {
  const service = await startCloudService({
    port: 0,
    authenticate: createBearerAuthenticator([
      {
        tokenSha256: createHash("sha256").update(TOKEN).digest("hex"),
        ...identity,
      },
    ]),
    invoke,
    limits: {
      maxBodyBytes: 4096,
      requestTimeoutMs: 1000,
      drainTimeoutMs: 1000,
    },
  });
  running.push(service);
  return service;
}

async function rpc(
  origin: string,
  operation: string,
  input: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await fetch(`${origin}/rpc`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ operation, input }),
  });
  return { status: response.status, body: await response.json() };
}
