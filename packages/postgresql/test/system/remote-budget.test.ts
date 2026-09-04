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

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "remote PostgreSQL Budget authority",
  () => {
    let fixture: RemoteIdentityFixture | undefined;

    afterEach(async () => {
      await fixture?.close();
      fixture = undefined;
    });

    it("completes one remote create, request, inspect, and settlement loop", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const resource = "remote_lifecycle_tokens";
      const created = await queryResponse(
        client,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey("create"),
          resources: [{ definition: resourceDefinition(resource), amount: 10 }],
        },
      );
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

    it("accepts a zero initial allocation", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const created = await queryResponse(
        client,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey("zero"),
          resources: [
            {
              definition: resourceDefinition("remote_zero_tokens"),
              amount: 0,
            },
          ],
        },
      );

      expect(created).toMatchObject({
        ok: true,
        result: { budget: { resources: [{ allocated: 0 }] } },
      });
    });

    it("checks current root authority before remote replay and rolls back conditional denials", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const resource = "remote_conditional_tokens";
      const committedKey = operationKey("committed");
      const committedInput = {
        operationKey: committedKey,
        resources: [{ definition: resourceDefinition(resource), amount: 1 }],
      };
      await expect(
        queryResponse(client, "keynes.remote_create_budget", committedInput),
      ).resolves.toMatchObject({ ok: true });

      await removePermission(fixture, "create_root_budget");
      await expect(
        queryResponse(client, "keynes.remote_create_budget", committedInput),
      ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
      await expect(
        queryResponse(client, "keynes.remote_create_budget", {
          ...committedInput,
          resources: [
            {
              definition: resourceDefinition("remote_changed_tokens"),
              amount: 1,
            },
          ],
        }),
      ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
      await addPermission(fixture, "create_root_budget");

      const deniedKey = operationKey("conditional");
      const missing = resourceDefinition("remote_missing_tokens");
      const deniedInput = {
        operationKey: deniedKey,
        resources: [{ definition: missing, amount: 1 }],
      };
      await removePermission(fixture, "define_resource_type");
      await expect(
        queryResponse(client, "keynes.remote_create_budget", deniedInput),
      ).resolves.toMatchObject({ ok: false, error: { code: "unauthorized" } });
      await expect(operationRecordCount(fixture, deniedKey)).resolves.toBe(0);

      await addPermission(fixture, "define_resource_type");
      await expect(
        queryResponse(client, "keynes.remote_create_budget", {
          operationKey: operationKey("definition"),
          resources: [{ definition: missing, amount: 1 }],
        }),
      ).resolves.toMatchObject({ ok: true });
      await removePermission(fixture, "define_resource_type");
      await expect(
        queryResponse(client, "keynes.remote_create_budget", deniedInput),
      ).resolves.toMatchObject({ ok: true, result: { replayed: false } });
    });

    it("enforces a generated Policy through canonical remote Resources", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const created = await queryResponse(
        client,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey("canonical"),
          resources: [
            { definition: resourceDefinition("remote_zebra"), amount: 10 },
            { definition: resourceDefinition("remote_alpha"), amount: 20 },
          ],
          policies: [requestCeilingPolicy("remote_alpha")],
        },
      );
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
  },
);

function operationKey(suffix: string): string {
  return `kop_v1_${suffix.padEnd(43, "x")}`;
}

function addPermission(
  fixture: RemoteIdentityFixture,
  permission: "create_root_budget" | "define_resource_type",
): Promise<unknown> {
  return fixture.administrator.query(
    `insert into keynes_internal.principal_permissions
       (tenant_id, principal_id, permission)
     values ($1::uuid, $2::uuid, $3)
     on conflict do nothing`,
    [fixture.primary.tenantId, fixture.primary.principalId, permission],
  );
}

function removePermission(
  fixture: RemoteIdentityFixture,
  permission: "create_root_budget" | "define_resource_type",
): Promise<unknown> {
  return fixture.administrator.query(
    `delete from keynes_internal.principal_permissions
      where tenant_id = $1::uuid and principal_id = $2::uuid
        and permission = $3`,
    [fixture.primary.tenantId, fixture.primary.principalId, permission],
  );
}

async function operationRecordCount(
  fixture: RemoteIdentityFixture,
  operationKeyValue: string,
): Promise<number> {
  const result = await fixture.administrator.query<{ readonly count: string }>(
    `select count(*)::text as count
       from keynes_internal.remote_operations
      where tenant_id = $1::uuid and operation_key = $2`,
    [fixture.primary.tenantId, operationKeyValue],
  );
  return Number(result.rows[0]?.count);
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

function resourceDefinition(canonicalName: string): Record<string, string> {
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
