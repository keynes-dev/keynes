import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  DefineResourceTypeResult,
  RequestBudgetCommand,
} from "../../generated/types.ts";
import type {
  ContractClient,
  ContractTestHost,
  OpenContractTestHost,
} from "../host.ts";
import { rootResource, rootResources } from "./root-resource.ts";

export function registerRequestEvidenceContractTests(
  openTestKeynes: OpenContractTestHost,
): void {
  describe("Budget request evidence", () => {
    let local: ContractTestHost;

    beforeEach(async () => {
      local = await openTestKeynes();
    });

    afterEach(async () => {
      await local.close();
    });

    it("records valid scalar evidence in ASCII key order without granting authority", async () => {
      const fixture = await requestFixture(local, 10);
      const evidence = {
        a: null,
        approved: true,
        ceiling: 999,
        constructor: "customer-decision",
        kind: "application",
        [`a${"a".repeat(62)}`]: Number.MAX_SAFE_INTEGER,
        note: "é".repeat(128),
        resources: "model_tokens",
      };

      const approved = await requestWithEvidence(
        fixture.client,
        fixture.command,
        evidence,
      );
      expect(approved).toMatchObject({
        kind: "approved",
        decisionEvidence: {
          a: null,
          approved: true,
          ceiling: 999,
          constructor: "customer-decision",
          kind: "application",
          [`a${"a".repeat(62)}`]: Number.MAX_SAFE_INTEGER,
          note: "é".repeat(128),
          resources: "model_tokens",
        },
      });
      const canonicalEvidence = Object.fromEntries(
        Object.entries(evidence).sort(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
      );
      expect(JSON.stringify(approved)).toContain(
        `"decisionEvidence":${JSON.stringify(canonicalEvidence)}`,
      );

      const denied = await requestWithEvidence(
        fixture.client,
        {
          ...fixture.command,
          commandId: "33000000-0000-0000-0000-000000000002",
          resources: [
            { resourceTypeId: fixture.resource.resourceTypeId, amount: 11 },
          ],
        },
        { approved: true, ceiling: 999 },
      );
      expect(denied).toMatchObject({
        kind: "denied",
        decisionEvidence: { approved: true, ceiling: 999 },
        reasons: [
          { code: "insufficient_available", available: 5, requested: 11 },
        ],
      });

      const parent = await fixture.client.getBudget({
        budgetId: fixture.rootBudgetId,
      });
      expect(parent.history.entries).toMatchObject([
        { kind: "budget_created" },
        {
          kind: "request_approved",
          decisionEvidence: evidence,
        },
        {
          kind: "request_denied",
          decisionEvidence: { approved: true, ceiling: 999 },
        },
      ]);
    });

    it("normalizes empty evidence and negative zero to the canonical request identity", async () => {
      const fixture = await requestFixture(local, 10);
      const omitted = await requestWithEvidence(
        fixture.client,
        fixture.command,
        undefined,
      );
      const emptyReplay = await requestWithEvidence(
        fixture.client,
        fixture.command,
        {},
      );
      expect(omitted).toMatchObject({ kind: "approved", replayed: false });
      expect(emptyReplay).toMatchObject({ kind: "approved", replayed: true });

      const negativeZero = await requestWithEvidence(
        fixture.client,
        {
          ...fixture.command,
          commandId: "33000000-0000-0000-0000-000000000003",
        },
        { amount: -0 },
      );
      const zeroReplay = await requestWithEvidence(
        fixture.client,
        {
          ...fixture.command,
          commandId: "33000000-0000-0000-0000-000000000003",
        },
        { amount: 0 },
      );
      expect(negativeZero).toMatchObject({ kind: "approved", replayed: false });
      expect(zeroReplay).toMatchObject({ kind: "approved", replayed: true });
    });

    it.each([
      [
        "too many fields",
        Object.fromEntries(
          Array.from({ length: 33 }, (_, index) => [`k${index}`, true]),
        ),
      ],
      ["invalid key", { Invalid: true }],
      ["long key", { [`a${"a".repeat(63)}`]: true }],
      ["long string", { note: "a".repeat(257) }],
      ["long UTF-8 string", { note: "é".repeat(129) }],
      ["nested object", { detail: { nested: true } }],
      ["array", { detail: [true] }],
      ["null map", null],
      ["fraction", { amount: 0.5 }],
      ["negative", { amount: -1 }],
      ["unsafe integer", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ])(
      "rejects JSON-representable %s evidence without residue",
      async (_name, evidence) => {
        const fixture = await requestFixture(local, 10);
        const before = await local.inspectState();
        await expect(
          requestWithEvidence(fixture.client, fixture.command, evidence),
        ).rejects.toMatchObject({
          code: "invalid_command",
          details: { operation: "requestBudget" },
        });
        expect(await local.inspectState()).toEqual(before);
      },
    );

    it.each([
      ["NUL", { note: "before\u0000after" }],
      ["unpaired leading surrogate", { note: "\ud800" }],
      ["unpaired trailing surrogate", { note: "\udc00" }],
    ])(
      "rejects transport-sensitive %s evidence without residue",
      async (_name, evidence) => {
        const fixture = await requestFixture(local, 10);
        const before = await local.inspectState();
        await expect(
          requestWithEvidence(fixture.client, fixture.command, evidence),
        ).rejects.toThrow();
        expect(await local.inspectState()).toEqual(before);
      },
    );

    it("accepts the field-count and canonical-byte boundaries", async () => {
      const fixture = await requestFixture(local, 10);
      const fields = Object.fromEntries(
        Array.from({ length: 32 }, (_, index) => [`k${index}`, true]),
      );
      const bytes = evidenceWithCanonicalBytes(8192);
      const tooManyBytes = evidenceWithCanonicalBytes(8193);

      await expect(
        requestWithEvidence(fixture.client, fixture.command, fields),
      ).resolves.toMatchObject({ kind: "approved", decisionEvidence: fields });
      await expect(
        requestWithEvidence(
          fixture.client,
          {
            ...fixture.command,
            commandId: "33000000-0000-0000-0000-000000000004",
          },
          bytes,
        ),
      ).resolves.toMatchObject({
        kind: "approved",
        decisionEvidence: bytes,
      });
      await expect(
        requestWithEvidence(
          fixture.client,
          {
            ...fixture.command,
            commandId: "33000000-0000-0000-0000-000000000005",
          },
          tooManyBytes,
        ),
      ).rejects.toMatchObject({ code: "invalid_command" });
      await expect(
        requestWithEvidence(
          fixture.client,
          {
            ...fixture.command,
            commandId: "33000000-0000-0000-0000-000000000006",
          },
          { ...fields, extra: true },
        ),
      ).rejects.toMatchObject({ code: "invalid_command" });
    });
  });
}

async function requestFixture(
  host: ContractTestHost,
  amount: number,
): Promise<{
  readonly client: ContractClient;
  readonly command: RequestBudgetCommand;
  readonly resource: DefineResourceTypeResult["resourceType"];
  readonly rootBudgetId: string;
}> {
  const client = host.clientFor("product-fixture");
  const resource = await client.defineResource({
    commandId: "13000000-0000-0000-0000-000000000001",
    definition: {
      canonicalName: "model_tokens",
      unit: "token",
      accountingBehavior: "consumable",
    },
  });
  const root = await client.createBudget({
    commandId: "23000000-0000-0000-0000-000000000001",
    ...rootResources([rootResource(resource.resourceType, amount)]),
  });
  return {
    client,
    resource: resource.resourceType,
    rootBudgetId: root.budget.budgetId,
    command: {
      commandId: "33000000-0000-0000-0000-000000000001",
      parentBudgetId: root.budget.budgetId,
      resources: [
        { resourceTypeId: resource.resourceType.resourceTypeId, amount: 5 },
      ],
    },
  };
}

function requestWithEvidence(
  client: ContractClient,
  command: RequestBudgetCommand,
  decisionEvidence: unknown,
): Promise<unknown> {
  const input =
    decisionEvidence === undefined ? command : { ...command, decisionEvidence };
  return Reflect.apply(client.requestBudget, client, [input]);
}

function evidenceWithCanonicalBytes(bytes: number): Record<string, string> {
  const evidence: Record<string, string> = {};
  for (let index = 0; index < 32; index += 1) evidence[`k${index}`] = "";
  let length = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  for (const key of Object.keys(evidence)) {
    const remaining = bytes - length;
    if (remaining <= 0) break;
    const value = evidence[key];
    if (value === undefined) throw new Error("missing evidence member");
    const addition = Math.min(256 - value.length, remaining);
    evidence[key] = `${value}${"a".repeat(addition)}`;
    length = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  }
  if (length !== bytes)
    throw new Error("could not construct canonical evidence");
  return evidence;
}
