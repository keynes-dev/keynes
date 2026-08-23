import { describe, expect, it } from "vitest";

import { KeynesError, type KeynesClient } from "./generated/client.js";
import type { PublishResourceCommand } from "./generated/types.js";
import { openLocalKeynes } from "./private/local-keynes.js";

describe("Budget lifecycle", () => {
  it("publishes a Resource type without creating Budget quantity", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher: KeynesClient = local.clientFor("publisher-fixture");

      const result = await publisher.publishResource({
        commandId: "10000000-0000-0000-0000-000000000001",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      });

      expect(result).toMatchObject({
        kind: "published",
        resourceType: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
        publicationEvidence: {
          kind: "resource_type_published",
          commandId: "10000000-0000-0000-0000-000000000001",
        },
        replayed: false,
      });
      expect(result).not.toHaveProperty("budget");
      expect(result).not.toHaveProperty("quantity");
      expect(result.resourceType).not.toHaveProperty("quantity");
    } finally {
      await local.close();
    }
  });

  it("preserves publication identity and distinguishes replay from republication", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher = local.clientFor("publisher-fixture");
      const firstCommand = {
        commandId: "10000000-0000-0000-0000-000000000011",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies PublishResourceCommand;
      const first = await publisher.publishResource(firstCommand);

      const republication = await publisher.publishResource({
        ...firstCommand,
        commandId: "10000000-0000-0000-0000-000000000012",
      });
      expect(republication).toEqual({
        ...first,
        replayed: false,
      });

      const replay = await publisher.publishResource(firstCommand);
      expect(replay).toEqual({
        ...first,
        replayed: true,
      });
    } finally {
      await local.close();
    }
  });

  it("returns canonical publication errors", async () => {
    const local = await openLocalKeynes();

    try {
      const publisher = local.clientFor("publisher-fixture");
      const unauthorized = local.clientFor("unauthorized-fixture");
      const command = {
        commandId: "10000000-0000-0000-0000-000000000021",
        definition: {
          canonicalName: "model_tokens",
          unit: "token",
          accountingBehavior: "consumable",
        },
      } satisfies PublishResourceCommand;

      await publisher.publishResource(command);

      await expectKeynesError(
        publisher.publishResource({
          commandId: "10000000-0000-0000-0000-000000000022",
          definition: { ...command.definition, unit: "credit" },
        }),
        "resource_type_conflict",
        { canonicalName: "model_tokens" },
      );
      await expectKeynesError(
        unauthorized.publishResource({
          ...command,
          commandId: "10000000-0000-0000-0000-000000000023",
        }),
        "unauthorized",
        {
          operation: "publishResource",
          requiredPermission: "publish_resource",
        },
      );
      await expectKeynesError(
        publisher.publishResource({
          ...command,
          definition: { ...command.definition, unit: "credit" },
        }),
        "command_conflict",
        {
          commandId: command.commandId,
          existingOperation: "publishResource",
          attemptedOperation: "publishResource",
        },
      );
    } finally {
      await local.close();
    }
  });

  it.each([
    ["after_command_binding", "10000000-0000-0000-0000-000000000031"],
    ["after_domain_mutation", "10000000-0000-0000-0000-000000000032"],
    ["after_result_storage", "10000000-0000-0000-0000-000000000033"],
  ] as const)(
    "rolls back %s before a clean retry",
    async (checkpoint, commandId) => {
      const local = await openLocalKeynes();

      try {
        const command = {
          commandId,
          definition: {
            canonicalName: `checkpoint_${commandId.slice(-3)}`,
            unit: "token",
            accountingBehavior: "consumable",
          },
        } satisfies PublishResourceCommand;

        await expect(
          local
            .clientFor("publisher-fixture", { checkpoint })
            .publishResource(command),
        ).rejects.toThrow(`private rollback checkpoint: ${checkpoint}`);

        const retry = await local
          .clientFor("publisher-fixture")
          .publishResource(command);
        expect(retry).toMatchObject({
          kind: "published",
          resourceType: {
            resourceTypeId: commandId,
            canonicalName: command.definition.canonicalName,
          },
          publicationEvidence: {
            commandId,
          },
          replayed: false,
        });
      } finally {
        await local.close();
      }
    },
  );
});

async function expectKeynesError(
  operation: Promise<unknown>,
  code: KeynesError["code"],
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await operation;
    expect.unreachable(`expected KeynesError ${code}`);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(KeynesError);
    if (!(error instanceof KeynesError)) throw error;
    expect(error).toMatchObject({ code, details });
  }
}
