import { describe, expect, it } from "vitest";

import type { ResourceDefinition } from "../../generated/types.ts";
import type { OpenContractTestHost } from "../host.ts";

const definitions = {
  modelTokens: { unit: "token", accountingBehavior: "consumable" },
  reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
} satisfies Record<string, Omit<ResourceDefinition, "canonicalName">>;

export function registerResourceDefinitionsContractTests(
  openHost: OpenContractTestHost,
): void {
  describe("Independent Resource definitions", () => {
    it("defines a complete canonical batch with zero Budget and quantity effects", async () => {
      const host = await openHost();
      try {
        const result = await host.clientFor("definer-fixture").defineResources({
          commandId: commandId(1),
          definitions,
        });
        expect(result).toMatchObject({
          kind: "defined",
          replayed: false,
          resources: [
            {
              key: "modelTokens",
              resourceType: {
                canonicalName: "model_tokens",
                ...definitions.modelTokens,
              },
            },
            {
              key: "reviewerSeats",
              resourceType: {
                canonicalName: "reviewer_seats",
                ...definitions.reviewerSeats,
              },
            },
          ],
        });
        expect(result.bindingReference).toEqual(expect.any(String));
        expect(result.bindingReference.length).toBeGreaterThan(0);
        expect(result.resources).toHaveLength(2);
        expect(result.resources[0].resourceType.resourceTypeId).not.toBe(
          result.resources[1].resourceType.resourceTypeId,
        );
        for (const member of result.resources) {
          expect(member.definitionEvidence.commandId).toBe(commandId(1));
        }
        expect(await host.inspectState()).toEqual({
          resources: 2,
          commands: 1,
          budgets: 0,
          holdings: 0,
          history: 0,
          quantity: 0,
        });
      } finally {
        await host.close();
      }
    });

    it("reuses reordered and mixed definitions with original identities and evidence", async () => {
      const host = await openHost();
      try {
        const client = host.clientFor("definer-fixture");
        const first = await client.defineResources({
          commandId: commandId(2),
          definitions,
        });
        const reordered = await client.defineResources({
          commandId: commandId(3),
          definitions: {
            reviewerSeats: definitions.reviewerSeats,
            modelTokens: definitions.modelTokens,
          },
        });
        expect(reordered.resources).toEqual(first.resources);
        expect(reordered.replayed).toBe(false);
        const mixed = await client.defineResources({
          commandId: commandId(4),
          definitions: {
            reviewerSeats: definitions.reviewerSeats,
            apiCalls: { unit: "call", accountingBehavior: "consumable" },
          },
        });
        expect(mixed.resources.map((member) => member.key)).toEqual([
          "apiCalls",
          "reviewerSeats",
        ]);
        expect(mixed.resources[1]).toEqual(first.resources[1]);
        expect(mixed.resources[0].definitionEvidence.commandId).toBe(
          commandId(4),
        );
        expect(mixed.replayed).toBe(false);
        expect(await host.inspectState()).toEqual({
          resources: 3,
          commands: 3,
          budgets: 0,
          holdings: 0,
          history: 0,
          quantity: 0,
        });
      } finally {
        await host.close();
      }
    });

    const invalidDefinitions: [string, unknown][] = [
      ["empty batch", {}],
      ["null batch", null],
      ["array batch", []],
      [
        "invalid name",
        { ...definitions, invalid_name: definitions.modelTokens },
      ],
      [
        "long canonical name",
        { ...definitions, ["a".repeat(128)]: definitions.modelTokens },
      ],
      [
        "empty unit",
        {
          ...definitions,
          zInvalid: { unit: "", accountingBehavior: "consumable" },
        },
      ],
      [
        "invalid behavior",
        {
          ...definitions,
          zInvalid: { unit: "unit", accountingBehavior: "refillable" },
        },
      ],
      [
        "missing unit",
        { ...definitions, zInvalid: { accountingBehavior: "reusable" } },
      ],
      [
        "unknown field",
        {
          ...definitions,
          zInvalid: {
            unit: "unit",
            accountingBehavior: "consumable",
            extra: null,
          },
        },
      ],
      ["null entry", { ...definitions, zInvalid: null }],
    ];
    it("validates exact and subset catalogs without writes or definition permission", async () => {
      const host = await openHost();
      try {
        await host
          .clientFor("definer-fixture")
          .defineResources({ commandId: commandId(20), definitions });
        const before = await host.inspectState();
        const client = host.clientFor("allocator-fixture", {
          forbidResourceWrites: true,
        });
        for (const declarations of [
          definitions,
          { modelTokens: definitions.modelTokens },
        ]) {
          await expect(
            client.validateResources({ definitions: declarations }),
          ).resolves.toEqual({ valid: true });
          expect(await host.inspectState()).toEqual(before);
        }
      } finally {
        await host.close();
      }
    });

    it.each([
      [
        "missing used name",
        { apiCalls: { unit: "call", accountingBehavior: "consumable" } },
        "resource_type_not_found",
      ],
      [
        "missing unused name",
        {
          ...definitions,
          apiCalls: { unit: "call", accountingBehavior: "consumable" },
        },
        "resource_type_not_found",
      ],
      [
        "conflicting unit",
        {
          ...definitions,
          reviewerSeats: { ...definitions.reviewerSeats, unit: "different" },
        },
        "resource_type_conflict",
      ],
      [
        "conflicting behavior",
        {
          ...definitions,
          reviewerSeats: {
            ...definitions.reviewerSeats,
            accountingBehavior: "consumable",
          },
        },
        "resource_type_conflict",
      ],
    ])(
      "rejects catalog validation with %s without writes",
      async (_label, declarations, code) => {
        const host = await openHost();
        try {
          await host
            .clientFor("definer-fixture")
            .defineResources({ commandId: commandId(21), definitions });
          const before = await host.inspectState();
          await expect(
            host
              .clientFor("allocator-fixture", { forbidResourceWrites: true })
              .validateResources({ definitions: declarations }),
          ).rejects.toMatchObject({ code });
          expect(await host.inspectState()).toEqual(before);
        } finally {
          await host.close();
        }
      },
    );

    it("authorizes catalog validation before disclosing missing definitions", async () => {
      const host = await openHost();
      try {
        const before = await host.inspectState();
        await expect(
          host
            .clientFor("unauthorized-fixture")
            .validateResources({ definitions }),
        ).rejects.toMatchObject({ code: "unauthorized" });
        expect(await host.inspectState()).toEqual(before);
      } finally {
        await host.close();
      }
    });

    it.each(invalidDefinitions)(
      "rejects catalog validation with %s without partial state",
      async (_label, invalid) => {
        const host = await openHost();
        try {
          await host
            .clientFor("definer-fixture")
            .defineResources({ commandId: commandId(22), definitions });
          const before = await host.inspectState();
          await expect(
            host
              .clientFor("allocator-fixture")
              .validateResources({ definitions: invalid }),
          ).rejects.toMatchObject({ code: "invalid_command" });
          expect(await host.inspectState()).toEqual(before);
        } finally {
          await host.close();
        }
      },
    );

    it.each(invalidDefinitions)(
      "rejects %s without any partial state",
      async (_label, invalid) => {
        const host = await openHost();
        try {
          await host.clientFor("definer-fixture").defineResource({
            commandId: commandId(9),
            definition: {
              canonicalName: "existing_resource",
              unit: "unit",
              accountingBehavior: "consumable",
            },
          });
          const before = await host.inspectState();
          await expect(
            host.clientFor("definer-fixture").defineResources({
              commandId: commandId(5),
              definitions: invalid,
            }),
          ).rejects.toMatchObject({ code: "invalid_command" });
          expect(await host.inspectState()).toEqual(before);
        } finally {
          await host.close();
        }
      },
    );

    it("rolls back an earlier new name when a later definition conflicts", async () => {
      const host = await openHost();
      try {
        const client = host.clientFor("definer-fixture");
        const original = await client.defineResource({
          commandId: commandId(6),
          definition: {
            canonicalName: "reviewer_seats",
            ...definitions.reviewerSeats,
          },
        });
        const before = await host.inspectState();
        await expect(
          client.defineResources({
            commandId: commandId(7),
            definitions: {
              apiCalls: { unit: "call", accountingBehavior: "consumable" },
              reviewerSeats: {
                unit: "different",
                accountingBehavior: "reusable",
              },
            },
          }),
        ).rejects.toMatchObject({ code: "resource_type_conflict" });
        expect(await host.inspectState()).toEqual(before);
        const corrected = await client.defineResources({
          commandId: commandId(7),
          definitions: {
            apiCalls: { unit: "call", accountingBehavior: "consumable" },
            reviewerSeats: definitions.reviewerSeats,
          },
        });
        expect(corrected.replayed).toBe(false);
        expect(corrected.resources[1]).toMatchObject({
          resourceType: original.resourceType,
          definitionEvidence: original.definitionEvidence,
        });
        expect(await host.inspectState()).toEqual({
          ...before,
          resources: 2,
          commands: 2,
        });
      } finally {
        await host.close();
      }
    });

    it("replays reordered canonical input and rejects changed input under the same identity", async () => {
      const host = await openHost();
      try {
        const client = host.clientFor("definer-fixture");
        const command = { commandId: commandId(8), definitions };
        const first = await client.defineResources(command);
        const before = await host.inspectState();
        const replay = await client.defineResources({
          ...command,
          definitions: {
            reviewerSeats: definitions.reviewerSeats,
            modelTokens: definitions.modelTokens,
          },
        });
        expect(replay).toEqual({ ...first, replayed: true });
        expect(await host.inspectState()).toEqual(before);
        await expect(
          client.defineResources({
            ...command,
            definitions: {
              ...definitions,
              modelTokens: { ...definitions.modelTokens, unit: "different" },
            },
          }),
        ).rejects.toMatchObject({ code: "command_conflict" });
        expect(await host.inspectState()).toEqual(before);
      } finally {
        await host.close();
      }
    });
  });
}

function commandId(suffix: number): string {
  return `16000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}
