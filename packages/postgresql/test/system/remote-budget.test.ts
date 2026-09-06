import { rootResources } from "@keynes/contracts/contract-tests";
import { createHash } from "node:crypto";

import {
  canonicalJson,
  POLICY_LIMITS_VERSION,
  POLICY_PROFILE_DIGEST,
  POLICY_PROGRAM_VERSION,
  POLICY_QUERY_PROFILE_VERSION,
  POLICY_VALIDATOR_VERSION,
  type PolicyDefinitionV1,
  type PolicyProgramV1,
} from "@keynes/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("remote PostgreSQL Budget authority", () => {
  let fixture: RemoteIdentityFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("defines Resources through authenticated Remote calls with exact reuse and replay", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
    };
    const key = operationKey("define-resources");
    const first = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: key,
        definitions,
      },
    );
    expect(first).toMatchObject({
      ok: true,
      result: {
        kind: "defined",
        replayed: false,
        bindingReference: expect.stringMatching(/^krs_v1_[A-Za-z0-9_-]{43}$/),
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
      },
    });
    const firstResult = requireResult(first);
    const reordered = {
      reviewerSeats: definitions.reviewerSeats,
      modelTokens: definitions.modelTokens,
    };
    const replay = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: key,
        definitions: reordered,
      },
    );
    expect(replay).toMatchObject({
      ok: true,
      result: { ...firstResult, replayed: true },
    });
    const reused = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: operationKey("reuse-resources"),
        definitions: reordered,
      },
    );
    expect(reused).toMatchObject({
      ok: true,
      result: {
        kind: "defined",
        replayed: false,
        resources: firstResult.resources,
      },
    });
    expect(await definitionState(fixture)).toEqual([
      {
        resources: 2,
        commands: 2,
        references: 2,
        budgets: 0,
        holdings: 0,
        history: 0,
      },
    ]);
  });

  it("rejects malformed Remote definition batches without partial authority state", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const definition = { unit: "token", accountingBehavior: "consumable" };
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("seed-definition"),
        definitions: { modelTokens: definition },
      }),
    ).toMatchObject({ ok: true, result: { kind: "defined" } });
    const before = await definitionState(fixture);
    const malformed = [
      { apiCalls: definition, zInvalid: null },
      { apiCalls: definition, zInvalid: { ...definition, unknown: null } },
      { apiCalls: definition, invalid_name: definition },
      {
        apiCalls: definition,
        zInvalid: { unit: "", accountingBehavior: "consumable" },
      },
    ];
    for (const [index, definitions] of malformed.entries()) {
      expect(
        await queryResponse(client, "keynes.remote_define_resources", {
          operationKey: operationKey(`invalid-definition-${index}`),
          definitions,
        }),
      ).toMatchObject({ ok: false, error: { code: "invalid_command" } });
      expect(await definitionState(fixture)).toEqual(before);
    }
  });

  it("requires current definition permission for exact Remote replay and fresh commands", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const command = {
      operationKey: operationKey("definition-permission"),
      definitions: {
        modelTokens: { unit: "token", accountingBehavior: "consumable" },
      },
    };
    expect(
      await queryResponse(client, "keynes.remote_define_resources", command),
    ).toMatchObject({ ok: true });
    const before = await definitionState(fixture);
    await fixture.administrator.query(
      `delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2
        and permission = 'define_resource_type'`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    for (const key of [
      command.operationKey,
      operationKey("definition-permission-new"),
    ]) {
      expect(
        await queryResponse(client, "keynes.remote_define_resources", {
          ...command,
          operationKey: key,
        }),
      ).toMatchObject({
        ok: false,
        error: { code: "unauthorized" },
      });
      expect(await definitionState(fixture)).toEqual(before);
    }
  });

  it("creates from a binding after producer close using another same-tenant creation-only principal", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const consumer = {
      ...fixture.secondary,
      tenantId: fixture.primary.tenantId,
    };
    await fixture.register(consumer);
    const producerClient = await fixture.connect(fixture.primary);
    const defined = await queryResponse(
      producerClient,
      "keynes.remote_define_resources",
      {
        operationKey: operationKey("bound-resource-definition"),
        definitions: {
          modelTokens: { unit: "token", accountingBehavior: "consumable" },
          reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
        },
      },
    );
    const bindingReference = requireResultReference(
      defined,
      "bindingReference",
    );
    const beforeDefinitions = await fixture.administrator.query(
      "select to_jsonb(r) as resource, xmin::text as version from keynes_internal.resource_types r order by canonical_name",
    );
    await producerClient.end();
    await fixture.administrator.query(
      "delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2 and permission <> 'create_root_budget'",
      [consumer.tenantId, consumer.principalId],
    );
    const client = await fixture.connect(consumer);
    const resources = { kind: "binding", bindingReference };
    const created = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("consume-binding"),
      resources,
      allocation: { modelTokens: 7 },
    });
    expect(created).toMatchObject({
      ok: true,
      result: {
        kind: "created",
        budget: {
          resources: [
            {
              resource: { canonicalName: "model_tokens" },
              allocated: 7,
              available: 7,
            },
          ],
        },
      },
    });
    const afterDefinitions = await fixture.administrator.query(
      "select to_jsonb(r) as resource, xmin::text as version from keynes_internal.resource_types r order by canonical_name",
    );
    expect(afterDefinitions.rows).toEqual(beforeDefinitions.rows);
    expect(await definitionState(fixture)).toEqual([
      {
        resources: 2,
        commands: 2,
        references: 1,
        budgets: 1,
        holdings: 1,
        history: 1,
      },
    ]);
    const beforeDenied = await definitionState(fixture);
    expect(
      await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("raw-needs-definition-permission"),
        resources: {
          kind: "definitions",
          definitions: {
            modelTokens: { unit: "token", accountingBehavior: "consumable" },
          },
        },
        allocation: { modelTokens: 1 },
      }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await definitionState(fixture)).toEqual(beforeDenied);
    await fixture.setEnabled(consumer.role, false);
    expect(
      await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("revoked-binding-consumer"),
        resources,
        allocation: { modelTokens: 1 },
      }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await definitionState(fixture)).toEqual(beforeDenied);
  });

  it("retains the KEY-78 Remote zero-allocation refusal for binding creation", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    const defined = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: operationKey("zero-bound-definition"),
        definitions: {
          modelTokens: { unit: "token", accountingBehavior: "consumable" },
        },
      },
    );
    const resources = {
      kind: "binding",
      bindingReference: requireResultReference(defined, "bindingReference"),
    };
    expect(
      await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("positive-bound-control"),
        resources,
        allocation: { modelTokens: 1 },
      }),
    ).toMatchObject({ ok: true });
    const before = await definitionState(fixture);
    expect(
      await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("zero-bound-root"),
        resources,
        allocation: { modelTokens: 0 },
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_command" } });
    expect(await definitionState(fixture)).toEqual(before);
  });

  it("completes one remote create, request, inspect, and settlement loop", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const resource = "remote_lifecycle_tokens";
    const created = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("create"),
      ...rootResources([
        { definition: resourceDefinition(resource), amount: 10 },
      ]),
    });
    const rootReference = requireBudgetReference(created);

    const requested = await queryResponse(client, "keynes.remote_request", {
      operationKey: operationKey("request"),
      parentBudgetReference: rootReference,
      resources: [{ resource, amount: 4 }],
    });
    const childReference = requireResultReference(
      requested,
      "childBudgetReference",
    );
    expect(requested).toMatchObject({
      ok: true,
      result: {
        kind: "approved",
        parentBudgetReference: rootReference,
        childBudgetReference: childReference,
        resources: [{ resource, amount: 4 }],
      },
    });

    expect(
      await queryResponse(client, "keynes.remote_get_budget", {
        budgetReference: childReference,
      }),
    ).toMatchObject({
      ok: true,
      result: {
        budget: {
          budgetReference: childReference,
          lifecycle: "active",
          resources: [
            {
              resource: resourceDefinition(resource),
              allocated: 4,
            },
          ],
        },
      },
    });

    expect(
      await queryResponse(client, "keynes.remote_settle", {
        operationKey: operationKey("settle"),
        budgetReference: childReference,
        usage: [{ resource, amount: 4 }],
      }),
    ).toMatchObject({ ok: true, result: { kind: "settled" } });
    expect(
      await queryResponse(client, "keynes.remote_get_budget", {
        budgetReference: childReference,
      }),
    ).toMatchObject({
      ok: true,
      result: { budget: { lifecycle: "settled" } },
    });
  });

  it("enforces a generated Policy through canonical remote Resources", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const created = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("canonical"),
      ...rootResources([
        { definition: resourceDefinition("remote_zebra"), amount: 10 },
        { definition: resourceDefinition("remote_alpha"), amount: 20 },
      ]),
      policies: [requestCeilingPolicy("remote_alpha")],
    });
    const budgetReference = requireBudgetReference(created);

    expect(created).toMatchObject({
      ok: true,
      result: {
        budget: {
          resources: [
            {
              resource: resourceDefinition("remote_alpha"),
              allocated: 20,
            },
            {
              resource: resourceDefinition("remote_zebra"),
              allocated: 10,
            },
          ],
        },
      },
    });
    const approved = await queryResponse(client, "keynes.remote_request", {
      operationKey: operationKey("policy-approved"),
      parentBudgetReference: budgetReference,
      resources: [{ resource: "remote_alpha", amount: 5 }],
      context: { remote_ceiling: 5 },
    });
    expect(approved).toMatchObject({
      ok: true,
      result: {
        kind: "approved",
        resources: [{ resource: "remote_alpha", amount: 5 }],
        policyEvidence: {
          decision: "approved",
          policies: [expect.objectContaining({ name: "remote_ceiling" })],
          effectiveCeilings: [
            expect.objectContaining({ resource: "remote_alpha", ceiling: 5 }),
          ],
        },
      },
    });
    const denied = await queryResponse(client, "keynes.remote_request", {
      operationKey: operationKey("policy-denied"),
      parentBudgetReference: budgetReference,
      resources: [{ resource: "remote_alpha", amount: 6 }],
      context: { remote_ceiling: 5 },
    });
    expect(denied).toMatchObject({
      ok: true,
      result: {
        kind: "denied",
        reasons: [
          expect.objectContaining({
            code: "policy_ceiling",
            resource: "remote_alpha",
            requested: 6,
            ceiling: 5,
            policyName: "remote_ceiling",
          }),
        ],
        policyEvidence: { decision: "denied" },
      },
    });
  });
});

function operationKey(suffix: string): string {
  return `kop_v1_${suffix.padEnd(43, "x")}`;
}

async function definitionState(fixture: RemoteIdentityFixture) {
  const { rows } = await fixture.administrator.query(`SELECT
    (SELECT count(*)::integer FROM keynes_internal.resource_types) AS resources,
    (SELECT count(*)::integer FROM keynes_internal.commands WHERE result IS NOT NULL) AS commands,
    (SELECT count(*)::integer FROM keynes_internal.commands WHERE binding_reference IS NOT NULL) AS references,
    (SELECT count(*)::integer FROM keynes_internal.budgets) AS budgets,
    (SELECT count(*)::integer FROM keynes_internal.budget_resources) AS holdings,
    (SELECT count(*)::integer FROM keynes_internal.budget_history_entries) AS history
  `);
  return rows;
}

function requireResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.result))
    throw new Error("Remote definition did not return a result");
  return value.result;
}

function requestCeilingPolicy(resource: string): PolicyDefinitionV1 {
  const program = {
    kind: "select",
    availabilityJoin: { kind: "inner_join" },
    resource: reference("requested", "resource", "text"),
    ceiling: reference("context", "remote_ceiling", "numeric"),
    reason: {
      kind: "text_literal",
      value: "remote_ceiling",
      valueType: "text",
      nullable: false,
    },
    where: {
      kind: "comparison",
      operator: "=",
      left: reference("requested", "resource", "text"),
      right: {
        kind: "text_literal",
        value: resource,
        valueType: "text",
        nullable: false,
      },
      valueType: "boolean",
      nullable: false,
    },
    groupBy: [],
    orderBy: ["resource", "reason", "ceiling"],
  } satisfies PolicyProgramV1;
  const canonicalSql = [
    "select requested.resource as resource,",
    "       context.remote_ceiling as ceiling,",
    "       'remote_ceiling' as reason",
    "from requested_resources as requested",
    "inner join available_resources as available using (resource)",
    "cross join policy_context as context",
    `where requested.resource = '${resource}'`,
    "order by resource asc, reason asc, ceiling asc",
    "",
  ].join("\n");
  const document = {
    kind: "keynes.policy",
    name: "remote_ceiling",
    revision: 1,
    inputResources: [resource],
    outputResources: [resource],
    contextSchema: [
      { name: "remote_ceiling", type: "integer", nullable: false },
    ],
    reasons: ["remote_ceiling"],
    programVersion: POLICY_PROGRAM_VERSION,
    queryProfileVersion: POLICY_QUERY_PROFILE_VERSION,
    validatorVersion: POLICY_VALIDATOR_VERSION,
    limitsVersion: POLICY_LIMITS_VERSION,
    policyProfileDigest: POLICY_PROFILE_DIGEST,
    program,
    canonicalSql,
    sourceDigest: digest(canonicalSql),
  } satisfies Omit<PolicyDefinitionV1, "definitionDigest">;
  return { ...document, definitionDigest: digest(canonicalJson(document)) };
}

function reference(
  source: "requested" | "context",
  field: string,
  valueType: "text" | "numeric",
): PolicyProgramV1["resource"] {
  return { kind: "reference", source, field, valueType, nullable: false };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type ResourceDefinition = Parameters<
  typeof rootResources
>[0][number]["definition"];

function resourceDefinition(canonicalName: string): ResourceDefinition {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
}

function requireBudgetReference(value: unknown): string {
  if (
    !isRecord(value) ||
    !isRecord(value.result) ||
    !isRecord(value.result.budget)
  ) {
    throw new Error("remote creation did not return a Budget");
  }
  const reference = value.result.budget.budgetReference;
  if (typeof reference !== "string") {
    throw new Error("remote creation did not return budgetReference");
  }
  return reference;
}

function requireResultReference(value: unknown, field: string): string {
  if (!isRecord(value) || !isRecord(value.result)) {
    throw new Error("remote mutation did not return a result");
  }
  const reference = value.result[field];
  if (typeof reference !== "string") {
    throw new Error(`remote mutation did not return ${field}`);
  }
  return reference;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
