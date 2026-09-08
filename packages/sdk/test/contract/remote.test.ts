import { describe, expect, it, vi } from "vitest";

import {
  REMOTE_CONTRACT,
  type RemoteCommandExecutor,
} from "../../src/generated/client.js";
import type {
  RemoteCreateBudgetCommand,
  RemoteCreateBudgetResult,
} from "../../src/generated/types.js";
import { openRemoteContractTestHost } from "./test-host.js";

const operationKey = `kop_v1_${"a".repeat(43)}`;
const budgetReference = `kbr_v1_${"b".repeat(43)}`;
const command = {
  operationKey,
  definitions: {
    modelTokens: { unit: "token", accountingBehavior: "consumable" },
  },
  amounts: { modelTokens: 100 },
} satisfies RemoteCreateBudgetCommand;

describe("remote contract test host", () => {
  it("runs the generated remote client over an injected executor", async () => {
    const response = {
      ok: true,
      result: {
        kind: "created",
        budget: {
          budgetReference,
          parentBudgetReference: null,
          rootBudgetReference: budgetReference,
          depth: 0,
          lifecycle: "active",
          resources: [
            {
              resource: {
                canonicalName: "model_tokens",
                unit: "token",
                accountingBehavior: "consumable",
              },
              allocated: 100,
              available: 100,
              committed: 0,
              directUsage: null,
              subtreeObservedUsage: 0,
              unresolved: true,
              deficit: 0,
            },
          ],
        },
        replayed: false,
      },
    } satisfies {
      readonly ok: true;
      readonly result: RemoteCreateBudgetResult;
    };
    const execute = vi.fn(async () => response);
    const close = vi.fn(async () => undefined);
    const host = await openRemoteContractTestHost({ execute }, close);

    await expect(
      host.clientFor("product-fixture").createBudget(command),
    ).resolves.toEqual(response.result);
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      REMOTE_CONTRACT.procedures.find(
        ({ method }) => method === "createBudget",
      ),
      command,
    );

    await host.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps generated validation and safe errors in front of the executor", async () => {
    const execute = vi.fn<RemoteCommandExecutor["execute"]>(async () => ({
      ok: false,
      error: {
        kind: "error",
        code: "unauthorized",
        details: {
          operation: "createBudget",
          requiredPermission: "remote_access",
        },
      },
    }));
    const host = await openRemoteContractTestHost({ execute });
    const client = host.clientFor("product-fixture");
    const invalidCommand: unknown = { operationKey, resources: [] };

    await expect(
      Reflect.apply(client.createBudget, client, [invalidCommand]),
    ).rejects.toMatchObject({
      name: "KeynesError",
      code: "invalid_command",
      details: { operation: "createBudget" },
    });
    expect(execute).not.toHaveBeenCalled();

    await expect(client.createBudget(command)).rejects.toMatchObject({
      name: "KeynesError",
      code: "unauthorized",
      details: {
        operation: "createBudget",
        requiredPermission: "remote_access",
      },
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});
