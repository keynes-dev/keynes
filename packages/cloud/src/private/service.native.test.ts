import assert from "node:assert/strict";

import type { OperationName } from "../generated/procedures.ts";

const fixture = {
  commands: {
    defineConsumable: {
      commandId: "10000000-0000-0000-0000-000000000001",
      definition: {
        canonicalName: "model_tokens",
        unit: "token",
        accountingBehavior: "consumable",
      },
    },
    defineReusable: {
      commandId: "10000000-0000-0000-0000-000000000002",
      definition: {
        canonicalName: "worker_slots",
        unit: "slot",
        accountingBehavior: "reusable",
      },
    },
    createRoot: {
      commandId: "20000000-0000-0000-0000-000000000001",
      resources: [
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000002",
          amount: 2,
        },
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000001",
          amount: 100,
        },
      ],
    },
    requestChild: {
      commandId: "30000000-0000-0000-0000-000000000001",
      parentBudgetId: "20000000-0000-0000-0000-000000000001",
      resources: [
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000002",
          amount: 1,
        },
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000001",
          amount: 40,
        },
      ],
    },
    settleChild: {
      commandId: "40000000-0000-0000-0000-000000000001",
      budgetId: "30000000-0000-0000-0000-000000000001",
      usage: [
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000002",
          amount: null,
        },
        {
          resourceTypeId: "10000000-0000-0000-0000-000000000001",
          amount: 25,
        },
      ],
    },
    getChild: {
      budgetId: "30000000-0000-0000-0000-000000000001",
    },
  },
};

export type ControlledPrincipal =
  | "tenant-a-product"
  | "tenant-a-unauthorized"
  | "tenant-b-product";

export interface NativeRpcResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface NativeCloudClient {
  call(
    principal: ControlledPrincipal,
    operation: OperationName,
    input: unknown,
  ): Promise<NativeRpcResponse>;
}

export interface NativeAcceptanceHarness {
  client(): NativeCloudClient;
  restartService(options?: {
    readonly dropResponseCommandId?: string;
  }): Promise<void>;
  pauseDatabase(): Promise<void>;
  resumeDatabase(): Promise<void>;
  queryAsService(statement: string): Promise<void>;
  expectStartupRefusal(kind: "empty" | "incompatible"): Promise<void>;
  scenario(
    name: string,
    assertion: string,
    operation: () => Promise<void>,
  ): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireSuccess(response: NativeRpcResponse): Record<string, unknown> {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  assert.equal(response.body.ok, true);
  assert.ok(isRecord(response.body.result));
  return response.body.result;
}

function requireAuthorityError(
  response: NativeRpcResponse,
  code: string,
): Record<string, unknown> {
  assert.equal(response.status, 200);
  assert.ok(isRecord(response.body));
  assert.equal(response.body.ok, false);
  assert.ok(isRecord(response.body.error));
  assert.equal(response.body.error.code, code);
  return response.body.error;
}

function historyEntries(result: Record<string, unknown>): readonly unknown[] {
  assert.ok(isRecord(result.history));
  assert.ok(Array.isArray(result.history.entries));
  return result.history.entries;
}

async function defineResources(
  client: NativeCloudClient,
  principal: ControlledPrincipal,
): Promise<void> {
  requireSuccess(
    await client.call(
      principal,
      "defineResource",
      fixture.commands.defineConsumable,
    ),
  );
  requireSuccess(
    await client.call(
      principal,
      "defineResource",
      fixture.commands.defineReusable,
    ),
  );
}

export async function runNativeAcceptanceScenarios(
  harness: NativeAcceptanceHarness,
): Promise<void> {
  let client = harness.client();
  const tenantBRoot = {
    ...fixture.commands.createRoot,
    resources: fixture.commands.createRoot.resources.map((resource) => ({
      ...resource,
      amount: resource.amount === 100 ? 60 : resource.amount,
    })),
  };
  const tenantBRequest = {
    ...fixture.commands.requestChild,
    resources: fixture.commands.requestChild.resources.map((resource) => ({
      ...resource,
      amount: resource.amount === 40 ? 10 : resource.amount,
    })),
  };

  await harness.scenario(
    "two-tenant-lifecycle",
    "Both tenants complete the five-operation lifecycle with overlapping identifiers and distinct state.",
    async () => {
      await defineResources(client, "tenant-a-product");
      await defineResources(client, "tenant-b-product");
      requireSuccess(
        await client.call(
          "tenant-a-product",
          "createBudget",
          fixture.commands.createRoot,
        ),
      );
      requireSuccess(
        await client.call("tenant-b-product", "createBudget", tenantBRoot),
      );
      requireSuccess(
        await client.call(
          "tenant-a-product",
          "requestBudget",
          fixture.commands.requestChild,
        ),
      );
      requireSuccess(
        await client.call("tenant-b-product", "requestBudget", tenantBRequest),
      );
      requireSuccess(
        await client.call(
          "tenant-a-product",
          "settleBudget",
          fixture.commands.settleChild,
        ),
      );

      const tenantA = requireSuccess(
        await client.call(
          "tenant-a-product",
          "getBudget",
          fixture.commands.getChild,
        ),
      );
      const tenantB = requireSuccess(
        await client.call(
          "tenant-b-product",
          "getBudget",
          fixture.commands.getChild,
        ),
      );
      assert.notDeepEqual(tenantA.budget, tenantB.budget);
      assert.ok(historyEntries(tenantA).length > 0);
      assert.ok(historyEntries(tenantB).length > 0);
    },
  );

  await harness.scenario(
    "permission-and-known-id-isolation",
    "Unauthorized principals and known cross-tenant identifiers reveal no protected state and cause no mutation.",
    async () => {
      requireAuthorityError(
        await client.call(
          "tenant-a-unauthorized",
          "getBudget",
          fixture.commands.getChild,
        ),
        "unauthorized",
      );
      requireAuthorityError(
        await client.call(
          "tenant-a-unauthorized",
          "requestBudget",
          fixture.commands.requestChild,
        ),
        "unauthorized",
      );

      const tenantA = requireSuccess(
        await client.call(
          "tenant-a-product",
          "getBudget",
          fixture.commands.getChild,
        ),
      );
      assert.equal(historyEntries(tenantA).length, 3);
    },
  );

  await harness.scenario(
    "service-and-client-restart",
    "A new service process and a new HTTP client reload committed Budget state from PostgreSQL.",
    async () => {
      await harness.restartService();
      client = harness.client();
      const reloaded = requireSuccess(
        await client.call(
          "tenant-a-product",
          "getBudget",
          fixture.commands.getChild,
        ),
      );
      assert.equal(historyEntries(reloaded).length, 3);
    },
  );

  await harness.scenario(
    "committed-response-loss",
    "A lost post-commit response is recovered by an exact retry after service restart without duplicate history.",
    async () => {
      const lostCommand = {
        ...fixture.commands.requestChild,
        commandId: "30000000-0000-4000-8000-000000000002",
        resources: fixture.commands.requestChild.resources.map((resource) => ({
          ...resource,
          amount: resource.amount === 40 ? 5 : resource.amount,
        })),
      };
      await harness.restartService({
        dropResponseCommandId: lostCommand.commandId,
      });
      client = harness.client();
      await assert.rejects(
        client.call("tenant-a-product", "requestBudget", lostCommand),
      );

      await harness.restartService();
      client = harness.client();
      const replay = await client.call(
        "tenant-a-product",
        "requestBudget",
        lostCommand,
      );
      requireSuccess(replay);
      assert.ok(isRecord(replay.body));
      assert.equal(replay.body.replayed, true);
      const root = requireSuccess(
        await client.call("tenant-a-product", "getBudget", {
          budgetId: fixture.commands.createRoot.commandId,
        }),
      );
      assert.equal(historyEntries(root).length, 4);
    },
  );

  await harness.scenario(
    "concurrent-replay-and-conflict",
    "Concurrent exact retries share one result, while changed target, operation, or body conflicts without another transition.",
    async () => {
      const command = {
        ...fixture.commands.requestChild,
        commandId: "30000000-0000-4000-8000-000000000003",
        resources: fixture.commands.requestChild.resources.map((resource) => ({
          ...resource,
          amount: resource.amount === 40 ? 4 : resource.amount,
        })),
      };
      const responses = await Promise.all([
        client.call("tenant-a-product", "requestBudget", command),
        client.call("tenant-a-product", "requestBudget", command),
      ]);
      const results = responses.map(requireSuccess);
      assert.deepEqual(results[0], results[1]);
      assert.deepEqual(
        responses
          .map((response) =>
            isRecord(response.body) ? response.body.replayed : undefined,
          )
          .sort(),
        [false, true],
      );

      requireAuthorityError(
        await client.call("tenant-a-product", "requestBudget", {
          ...command,
          resources: command.resources.map((resource) => ({
            ...resource,
            amount: resource.amount + 1,
          })),
        }),
        "command_conflict",
      );
      requireAuthorityError(
        await client.call("tenant-a-product", "settleBudget", {
          commandId: command.commandId,
          budgetId: fixture.commands.requestChild.commandId,
          usage: fixture.commands.settleChild.usage,
        }),
        "command_conflict",
      );
      requireAuthorityError(
        await client.call("tenant-a-product", "requestBudget", {
          ...command,
          parentBudgetId: fixture.commands.requestChild.commandId,
        }),
        "command_conflict",
      );
    },
  );

  await harness.scenario(
    "database-unavailable",
    "A paused PostgreSQL authority returns one sanitized 503 and never falls back to local state.",
    async () => {
      await harness.pauseDatabase();
      try {
        const unavailable = await client.call(
          "tenant-a-product",
          "getBudget",
          fixture.commands.getChild,
        );
        assert.equal(unavailable.status, 503);
        assert.deepEqual(unavailable.body, {
          error: {
            kind: "cloud_transport_error",
            code: "database_unavailable",
          },
        });
      } finally {
        await harness.resumeDatabase();
      }
    },
  );

  await harness.scenario(
    "limited-role-denial",
    "The service role cannot read or write private Budget authority tables.",
    async () => {
      await assert.rejects(
        harness.queryAsService("select count(*) from keynes_internal.commands"),
      );
      await assert.rejects(
        harness.queryAsService(
          "update keynes_internal.budgets set lifecycle = 'active'",
        ),
      );
    },
  );

  await harness.scenario(
    "startup-refusal",
    "Empty and incompatible databases fail before the service advertises readiness.",
    async () => {
      await harness.expectStartupRefusal("empty");
      await harness.expectStartupRefusal("incompatible");
    },
  );
}
