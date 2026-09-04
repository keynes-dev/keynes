import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "independent PostgreSQL Resource definitions",
  () => {
    let fixture: RemoteIdentityFixture | undefined;

    afterEach(async () => {
      await fixture?.close();
      fixture = undefined;
    });

    it("defines Resources before creation and creates only Budget holdings", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const defined = await defineResources(client, "primary", [
        definition("independent_tokens", "token"),
        definition("independent_seats", "seat", "reusable"),
      ]);
      const resourceIds = definedResourceIds(defined);
      const catalogBefore = await catalogCount(fixture);

      await fixture.administrator.query(
        `delete from keynes_internal.principal_permissions
          where tenant_id = $1::uuid and principal_id = $2::uuid
            and permission = 'define_resource_type'`,
        [fixture.primary.tenantId, fixture.primary.principalId],
      );
      const created = await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("create"),
        resources: [
          { resourceTypeId: resourceIds[0], amount: 0 },
          { resourceTypeId: resourceIds[1], amount: 4 },
        ],
      });

      expect(created).toMatchObject({
        ok: true,
        result: {
          kind: "created",
          budget: { resources: [{ allocated: 0 }, { allocated: 4 }] },
        },
      });
      await expect(catalogCount(fixture)).resolves.toBe(catalogBefore);
      const quantities = await fixture.administrator.query<{
        readonly catalog_amount_columns: string;
        readonly holding_total: string;
      }>(
        `select
           (select count(*)::text from information_schema.columns
             where table_schema = 'keynes_internal'
               and table_name = 'resource_types'
               and column_name like '%amount%') as catalog_amount_columns,
           (select sum(allocated_amount)::text
              from keynes_internal.budget_resources
             where tenant_id = $1::uuid) as holding_total`,
        [fixture.primary.tenantId],
      );
      expect(quantities.rows[0]).toEqual({
        catalog_amount_columns: "0",
        holding_total: "4",
      });
    });

    it("rejects unknown and cross-tenant Resource identities without catalog writes", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      await fixture.provision(fixture.secondary);
      await fixture.register(fixture.secondary);
      const primary = await fixture.connect(fixture.primary);
      const secondary = await fixture.connect(fixture.secondary);
      const secondaryDefined = await defineResources(secondary, "secondary", [
        definition("tenant_private_tokens", "token"),
      ]);
      const [secondaryResourceId] = definedResourceIds(secondaryDefined);
      const catalogBefore = await catalogCount(fixture);

      for (const resourceTypeId of [
        "ffffffff-ffff-4fff-8fff-ffffffffffff",
        secondaryResourceId,
      ]) {
        await expect(
          queryResponse(primary, "keynes.remote_create_budget", {
            operationKey: operationKey(resourceTypeId.slice(0, 8)),
            resources: [{ resourceTypeId, amount: 1 }],
          }),
        ).resolves.toMatchObject({
          ok: false,
          error: { code: "resource_type_not_found" },
        });
      }
      await expect(catalogCount(fixture)).resolves.toBe(catalogBefore);
    });
  },
);

function definition(
  canonicalName: string,
  unit: string,
  accountingBehavior: "consumable" | "reusable" = "consumable",
) {
  return { canonicalName, unit, accountingBehavior } as const;
}

function operationKey(suffix: string): string {
  return `kop_v1_${suffix.padEnd(43, "x")}`;
}

async function defineResources(
  client: Parameters<typeof queryResponse>[0],
  suffix: string,
  definitions: readonly ReturnType<typeof definition>[],
): Promise<unknown> {
  return queryResponse(client, "keynes.remote_define_resources", {
    operationKey: operationKey(`define-${suffix}`),
    definitions,
  });
}

function definedResourceIds(response: unknown): readonly [string, ...string[]] {
  if (
    typeof response !== "object" ||
    response === null ||
    !("result" in response) ||
    typeof response.result !== "object" ||
    response.result === null ||
    !("resources" in response.result) ||
    !Array.isArray(response.result.resources)
  ) {
    throw new Error("remote definition returned no Resource projections");
  }
  const ids = response.result.resources.map((resource: unknown) => {
    if (
      typeof resource !== "object" ||
      resource === null ||
      !("resourceTypeId" in resource) ||
      typeof resource.resourceTypeId !== "string"
    ) {
      throw new Error("remote definition returned an invalid Resource projection");
    }
    return resource.resourceTypeId;
  });
  const [first, ...rest] = ids;
  if (first === undefined) throw new Error("remote definition returned no Resources");
  return [first, ...rest];
}

async function catalogCount(fixture: RemoteIdentityFixture): Promise<number> {
  const result = await fixture.administrator.query<{ readonly count: string }>(
    "select count(*)::text as count from keynes_internal.resource_types",
  );
  return Number(result.rows[0]?.count);
}
