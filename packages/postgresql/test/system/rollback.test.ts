import { afterEach, describe, expect, it } from "vitest";

import {
  registerRollbackContractTests,
  type ContractClient,
  type ContractTestHost,
} from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerRollbackContractTests(openPostgresqlContractTestHost);

const ROOT_COMMAND_ID = "26000000-0000-4000-8000-000000000001";
const RETRY_DEFINITION_ID = "16000000-0000-4000-8000-000000000001";

describe("PostgreSQL Resource-bound root authorization and rollback", () => {
  let keynes: ContractTestHost;

  afterEach(async () => {
    await keynes?.close();
  });

  it("requires definition then root-allocation permission", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "permission_tokens");

    await expect(
      createResourceBoundBudget(keynes.clientFor("allocator-fixture"), command),
    ).rejects.toMatchObject({
      code: "unauthorized",
      details: {
        operation: "createBudget",
        requiredPermission: "define_resource_type",
      },
    });
    await expect(
      createResourceBoundBudget(keynes.clientFor("definer-fixture"), command),
    ).rejects.toMatchObject({
      code: "unauthorized",
      details: {
        operation: "createBudget",
        requiredPermission: "create_root_budget",
      },
    });
  });

  it("rolls back an inserted Resource at its private checkpoint", async () => {
    keynes = await openPostgresqlContractTestHost();
    const command = resourceBoundRoot(ROOT_COMMAND_ID, "checkpoint_tokens");
    const product = clientForPostResourceCheckpoint(keynes);

    await expect(createResourceBoundBudget(product, command)).rejects.toThrow(
      "private rollback checkpoint: after_resource_insertion",
    );

    const defined = await keynes.clientFor("definer-fixture").defineResource({
      commandId: RETRY_DEFINITION_ID,
      definition: command.resources[0].definition,
    });
    expect(defined).toMatchObject({
      definitionEvidence: { commandId: RETRY_DEFINITION_ID },
      replayed: false,
    });
  });
});

interface ResourceBoundRootCommand {
  readonly commandId: string;
  readonly resources: readonly [
    {
      readonly definition: {
        readonly canonicalName: string;
        readonly unit: string;
        readonly accountingBehavior: "consumable";
      };
      readonly amount: number;
    },
  ];
}

function resourceBoundRoot(
  commandId: string,
  canonicalName: string,
): ResourceBoundRootCommand {
  return {
    commandId,
    resources: [
      {
        definition: {
          canonicalName,
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 10,
      },
    ],
  };
}

function createResourceBoundBudget(
  client: ContractClient,
  command: ResourceBoundRootCommand,
): ReturnType<ContractClient["createBudget"]> {
  return Reflect.apply(client.createBudget, client, [command]);
}

function clientForPostResourceCheckpoint(
  keynes: ContractTestHost,
): ContractClient {
  return Reflect.apply(keynes.clientFor, keynes, [
    "product-fixture",
    { checkpoint: "after_resource_insertion" },
  ]);
}
