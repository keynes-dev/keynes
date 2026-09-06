import { rootResources } from "@keynes/contracts/contract-tests";
import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  identifier,
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

if (process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined) {
  throw new Error(
    "Native tests require runner context; use a PostgreSQL deployment runner",
  );
}

describe("remote PostgreSQL identity and security", () => {
  let fixture: RemoteIdentityFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("validates configured declarations with creation permission and no authority writes", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("d"),
        definitions,
      }),
    ).toMatchObject({ ok: true });
    await fixture.administrator.query(
      "delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2 and permission <> 'create_root_budget'",
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    const before = await configuredAuthorityState(fixture);
    await fixture.administrator.query(`
      create function keynes_internal.reject_validation_write() returns trigger language plpgsql
      as $$ begin raise exception 'configured validation attempted a write'; end $$;
    `);
    for (const table of [
      "resource_types",
      "commands",
      "remote_operations",
      "budgets",
      "budget_resources",
      "budget_history_entries",
    ]) {
      await fixture.administrator.query(
        `create trigger reject_validation_write before insert or update or delete or truncate on keynes_internal.${table} for each statement execute function keynes_internal.reject_validation_write()`,
      );
    }
    await client.query("begin");
    try {
      expect(
        await queryResponse(client, "keynes.remote_validate_resources", {
          definitions,
        }),
      ).toEqual({ ok: true, result: { valid: true } });
    } finally {
      await client.query("rollback");
    }
    expect(await configuredAuthorityState(fixture)).toEqual(before);
  });

  it("validates configured catalogs under mapped identity without foreign disclosure", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    const definitions = {
      workUnits: { unit: "unit", accountingBehavior: "consumable" },
    };
    expect(
      await queryResponse(primary, "keynes.remote_define_resources", {
        operationKey: operationKey("d"),
        definitions,
      }),
    ).toMatchObject({ ok: true });
    const before = await configuredAuthorityState(fixture);
    await secondary.query("begin");
    let foreign: unknown;
    try {
      await secondary.query("select set_config('keynes.tenant_id', $1, true)", [
        fixture.primary.tenantId,
      ]);
      await secondary.query(
        "select set_config('keynes.principal_id', $1, true)",
        [fixture.primary.principalId],
      );
      foreign = await queryResponse(
        secondary,
        "keynes.remote_validate_resources",
        { definitions },
      );
      expect(foreign).toMatchObject({
        ok: false,
        error: { code: "resource_type_not_found" },
      });
    } finally {
      await secondary.query("rollback");
    }
    const absent = await queryResponse(
      secondary,
      "keynes.remote_validate_resources",
      { definitions: { absentUnits: definitions.workUnits } },
    );
    expect(absent).toEqual(foreign);
    expectSafeRemoteResponse(foreign);
    expect(JSON.stringify(foreign)).not.toContain(fixture.primary.tenantId);
    expect(await configuredAuthorityState(fixture)).toEqual(before);
  });

  it("rejects configured catalog validation without creation permission before reading declarations", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    await fixture.administrator.query(
      "delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2 and permission = 'create_root_budget'",
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    const before = await configuredAuthorityState(fixture);
    for (const definitions of [
      { workUnits: { unit: "unit", accountingBehavior: "consumable" } },
      {},
    ]) {
      expect(
        await queryResponse(client, "keynes.remote_validate_resources", {
          definitions,
        }),
      ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    }
    expect(await configuredAuthorityState(fixture)).toEqual(before);
  });

  it("grants configured validation only through the authenticated runtime wrapper", async () => {
    fixture = await openRemoteIdentityFixture();
    const privileges = await fixture.administrator.query<{
      runtime: boolean;
      canonical: boolean;
      administrator: boolean;
    }>(
      "select has_function_privilege($1, 'keynes.remote_validate_resources(jsonb)', 'EXECUTE') as runtime, has_function_privilege($1, 'keynes.validate_resources(jsonb)', 'EXECUTE') as canonical, has_function_privilege($2, 'keynes.remote_validate_resources(jsonb)', 'EXECUTE') as administrator",
      [fixture.primary.role, fixture.administrationRole],
    );
    expect(privileges.rows).toEqual([
      { runtime: true, canonical: false, administrator: false },
    ]);
  });

  it("rejects foreign tenant and unknown bindings with the same private-safe error", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const defined = await queryResponse(
      primary,
      "keynes.remote_define_resources",
      { operationKey: operationKey("d"), definitions },
    );
    const bindingReference = requireResultReference(
      defined,
      "bindingReference",
    );
    expect(
      await queryResponse(primary, "keynes.remote_create_budget", {
        operationKey: operationKey("c"),
        resources: { kind: "binding", bindingReference },
        allocation: { modelTokens: 2 },
      }),
    ).toMatchObject({ ok: true });
    expect(
      await queryResponse(secondary, "keynes.remote_define_resources", {
        operationKey: operationKey("d"),
        definitions,
      }),
    ).toMatchObject({ ok: true });
    const before = await bindingAuthorityState(fixture);
    for (const [index, reference] of [
      bindingReference,
      `krs_v1_${"x".repeat(43)}`,
      "malformed-reference",
    ].entries()) {
      const response = await queryResponse(
        secondary,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey(String(index)),
          resources: { kind: "binding", bindingReference: reference },
          allocation: { modelTokens: 2 },
        },
      );
      expectBindingRefusal(response);
      expect(await bindingAuthorityState(fixture)).toEqual(before);
    }
  });

  it("rejects a binding from another installation despite matching tenant and Resource names", async () => {
    fixture = await openRemoteIdentityFixture();
    const producer = await fixture.connect(fixture.primary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const defined = await queryResponse(
      producer,
      "keynes.remote_define_resources",
      { operationKey: operationKey("d"), definitions },
    );
    const bindingReference = requireResultReference(
      defined,
      "bindingReference",
    );
    const other = await openRemoteIdentityFixture();
    try {
      const consumer = await other.connect(other.primary);
      const own = await queryResponse(
        consumer,
        "keynes.remote_define_resources",
        { operationKey: operationKey("d"), definitions },
      );
      expect(
        await queryResponse(consumer, "keynes.remote_create_budget", {
          operationKey: operationKey("c"),
          resources: {
            kind: "binding",
            bindingReference: requireResultReference(own, "bindingReference"),
          },
          allocation: { modelTokens: 2 },
        }),
      ).toMatchObject({ ok: true });
      const before = await bindingAuthorityState(other);
      expectBindingRefusal(
        await queryResponse(consumer, "keynes.remote_create_budget", {
          operationKey: operationKey("f"),
          resources: { kind: "binding", bindingReference },
          allocation: { modelTokens: 2 },
        }),
      );
      expect(await bindingAuthorityState(other)).toEqual(before);
    } finally {
      await other.close();
    }
  });

  it("validates the exact input shape of all nine wrappers before mutation", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    const before = await protectedState(fixture);

    for (const candidate of invalidRemoteInputs()) {
      for (const input of candidate.inputs) {
        const response = await queryResponse(
          client,
          candidate.procedure,
          input,
        );
        expectInvalidCommand(response, candidate.operation);
      }
    }

    expect(await protectedState(fixture)).toEqual(before);
  });

  it("returns authorization-safe errors before validating an unmapped caller", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.provision(fixture.secondary);
    const client = await fixture.connect(fixture.secondary);
    const before = await protectedState(fixture);

    for (const candidate of invalidRemoteInputs()) {
      const response = await queryResponse(client, candidate.procedure, null);
      expect(response).toEqual({
        ok: false,
        error: {
          kind: "error",
          code: "unauthorized",
          details: {
            operation: candidate.operation,
            requiredPermission: "remote_access",
          },
        },
      });
      expectSafeRemoteResponse(response);
    }

    expect(await protectedState(fixture)).toEqual(before);
  });

  it("derives tenant and principal from the authenticated role on every call", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    await client.query("begin");
    await client.query("select set_config('keynes.tenant_id', $1, true)", [
      fixture.secondary.tenantId,
    ]);
    await client.query("select set_config('keynes.principal_id', $1, true)", [
      fixture.secondary.principalId,
    ]);

    const response = await queryResponse(
      client,
      "keynes.remote_create_budget",
      createRoot("a"),
    );
    await client.query("commit");
    expect(response).toMatchObject({ ok: true });

    const budgets = await fixture.administrator.query<{
      readonly tenant_id: string;
      readonly count: string;
    }>(
      `select tenant_id::text, count(*)::text
           from keynes_internal.budgets
          group by tenant_id
          order by tenant_id`,
    );
    expect(budgets.rows).toEqual([
      { tenant_id: fixture.primary.tenantId, count: "1" },
    ]);
  });

  it("scopes overlapping Resource names and operation keys to each authenticated tenant", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    const primaryResult = await completeTenantLifecycle(primary, 7, 3);
    const secondaryResult = await completeTenantLifecycle(secondary, 11, 4);
    expect(secondaryResult.rootReference).not.toBe(primaryResult.rootReference);
    expect(secondaryResult.childReference).not.toBe(
      primaryResult.childReference,
    );

    for (const { client, result, allocated, available } of [
      { client: primary, result: primaryResult, allocated: 7, available: 4 },
      {
        client: secondary,
        result: secondaryResult,
        allocated: 11,
        available: 7,
      },
    ]) {
      expect(
        await queryResponse(
          client,
          "keynes.remote_create_budget",
          result.createInput,
        ),
      ).toMatchObject({
        ok: true,
        result: {
          kind: "created",
          replayed: true,
          budget: { budgetReference: result.rootReference },
        },
      });
      expect(
        await queryResponse(client, "keynes.remote_get_budget", {
          budgetReference: result.rootReference,
        }),
      ).toMatchObject({
        ok: true,
        result: { budget: { resources: [{ allocated, available }] } },
      });
      expect(
        await queryResponse(client, "keynes.remote_get_budget", {
          budgetReference: result.childReference,
        }),
      ).toMatchObject({
        ok: true,
        result: { budget: { lifecycle: "settled" } },
      });
    }
    const primaryBefore = await Promise.all([
      queryResponse(primary, "keynes.remote_get_budget", {
        budgetReference: primaryResult.rootReference,
      }),
      queryResponse(primary, "keynes.remote_get_budget", {
        budgetReference: primaryResult.childReference,
      }),
    ]);
    const crossTenant = await queryResponse(
      secondary,
      "keynes.remote_get_budget",
      { budgetReference: primaryResult.rootReference },
    );
    expect(crossTenant).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expectSafeRemoteResponse(crossTenant);
    for (const crossTenantMutation of [
      await queryResponse(secondary, "keynes.remote_request", {
        operationKey: operationKey("w"),
        parentBudgetReference: primaryResult.rootReference,
        resources: [{ resource: "shared_tenant_tokens", amount: 1 }],
      }),
      await queryResponse(secondary, "keynes.remote_settle", {
        operationKey: operationKey("x"),
        budgetReference: primaryResult.childReference,
        usage: [{ resource: "shared_tenant_tokens", amount: 1 }],
      }),
    ]) {
      expect(crossTenantMutation).toMatchObject({
        ok: false,
        error: { code: "unauthorized" },
      });
      expectSafeRemoteResponse(crossTenantMutation);
    }
    await expect(
      Promise.all([
        queryResponse(primary, "keynes.remote_get_budget", {
          budgetReference: primaryResult.rootReference,
        }),
        queryResponse(primary, "keynes.remote_get_budget", {
          budgetReference: primaryResult.childReference,
        }),
      ]),
    ).resolves.toEqual(primaryBefore);

    const counts = await fixture.administrator.query<{
      readonly tenant_id: string;
      readonly budget_count: string;
      readonly operation_count: string;
    }>(
      `select tenants.tenant_id::text,
                count(distinct budgets.budget_id)::text as budget_count,
                count(distinct operations.operation_key)::text as operation_count
           from (values ($1::uuid), ($2::uuid)) as tenants(tenant_id)
           left join keynes_internal.budgets as budgets
             on budgets.tenant_id = tenants.tenant_id
           left join keynes_internal.remote_operations as operations
             on operations.tenant_id = tenants.tenant_id
          group by tenants.tenant_id
          order by tenants.tenant_id`,
      [fixture.primary.tenantId, fixture.secondary.tenantId],
    );
    expect(counts.rows).toEqual([
      {
        tenant_id: fixture.primary.tenantId,
        budget_count: "2",
        operation_count: "3",
      },
      {
        tenant_id: fixture.secondary.tenantId,
        budget_count: "2",
        operation_count: "5",
      },
    ]);
  });

  it("checks enabled mappings again on an already-open session", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);

    expect(await compatibility(client)).toMatchObject({ ok: true });
    await fixture.setEnabled(fixture.primary.role, false);
    expect(await compatibility(client)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await fixture.setEnabled(fixture.primary.role, true);
    expect(await compatibility(client)).toMatchObject({ ok: true });
  });

  it("rejects a recreated login until an operator explicitly registers the stale name and new OID", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const previousOid = await fixture.roleOid(fixture.primary.role);

    const nextOid = await fixture.recreate(fixture.primary);
    expect(nextOid).not.toBe(previousOid);
    const recreated = await fixture.connect(fixture.primary);
    expect(await compatibility(recreated)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });

    expect(await fixture.register(fixture.primary)).toEqual({
      roleName: fixture.primary.role,
      status: "enabled",
      tenantId: fixture.primary.tenantId,
      principalId: fixture.primary.principalId,
    });
    const mappings = await fixture.administrator.query<{
      readonly role_oid: number;
    }>(
      `select role_oid
           from keynes_internal.remote_role_mappings
          where role_name = $1`,
      [fixture.primary.role],
    );
    expect(mappings.rows).toEqual([{ role_oid: nextOid }]);
    expect(await compatibility(recreated)).toMatchObject({ ok: true });
  });

  it("rotates mappings atomically and disables the old pooled credential", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    await fixture.provision(fixture.secondary);
    const oldClient = await fixture.connect(fixture.primary);
    const administrator = await fixture.connect({
      role: fixture.administrationRole,
      password: fixture.administrationPassword,
    });

    await administrator.query(
      "select keynes_internal.rotate_remote_role_v0006($1::name, $2::name)",
      [fixture.primary.role, fixture.secondary.role],
    );
    expect(await compatibility(oldClient)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    const nextClient = await fixture.connect(fixture.secondary);
    expect(await compatibility(nextClient)).toMatchObject({ ok: true });
    const state = await fixture.administrator.query<{
      readonly role_name: string;
      readonly enabled: boolean;
    }>(
      `select role_name::text, enabled
           from keynes_internal.remote_role_mappings
          where role_name = any($1::text[])
          order by role_name`,
      [[fixture.primary.role, fixture.secondary.role]],
    );
    expect(state.rows).toEqual(
      [
        { role_name: fixture.primary.role, enabled: false },
        { role_name: fixture.secondary.role, enabled: true },
      ].sort((left, right) => left.role_name.localeCompare(right.role_name)),
    );
  });

  it("revokes an existing session and records no reusable credential", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const runtime = await fixture.connect(fixture.primary);
    const administrator = await fixture.connect({
      role: fixture.administrationRole,
      password: fixture.administrationPassword,
    });

    await administrator.query(
      "select keynes_internal.revoke_remote_role_v0006($1::name)",
      [fixture.primary.role],
    );
    expect(await compatibility(runtime)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    const audit = await fixture.administrator.query<{
      readonly action: string;
      readonly leaked: boolean;
    }>(
      `select action,
                to_jsonb(audit)::text ~ '(password|secret|token)' as leaked
           from keynes_internal.remote_credential_audit audit
          where role_oid = $1
          order by occurred_at desc
          limit 1`,
      [await fixture.roleOid(fixture.primary.role)],
    );
    expect(audit.rows).toEqual([{ action: "revoked", leaked: false }]);
  });

  it("keeps a revoked credential terminal when registration is retried", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const runtime = await fixture.connect(fixture.primary);
    const administrator = await fixture.connect({
      role: fixture.administrationRole,
      password: fixture.administrationPassword,
    });

    await administrator.query(
      "select keynes_internal.revoke_remote_role_v0006($1::name)",
      [fixture.primary.role],
    );
    await expect(fixture.register(fixture.primary)).rejects.toThrow(
      "remote login role is revoked",
    );
    expect(await compatibility(runtime)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    await fixture.recreate(fixture.primary);
    await expect(fixture.register(fixture.primary)).rejects.toThrow(
      "remote login role is revoked",
    );
  });

  it("denies private objects, canonical procedures, role assumption, and public SQL creation", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const runtime = await fixture.connect(fixture.primary);
    const before = await protectedState(fixture);

    for (const statement of [
      "select * from keynes_internal.remote_role_mappings",
      "select keynes_internal.apply_command('createBudget', '{}'::jsonb)",
      "select keynes_internal.register_remote_role_v0006(current_user, gen_random_uuid(), gen_random_uuid())",
      `set role ${identifier(fixture.ownerRole)}`,
      "create table keynes.remote_sql_probe(value integer)",
    ]) {
      await expect(runtime.query(statement)).rejects.toThrow();
    }
    expect(await protectedState(fixture)).toEqual(before);
    const generic = await fixture.administrator.query<{
      readonly present: boolean;
    }>(
      "select to_regprocedure('keynes.remote_execute(text,jsonb)') is not null as present",
    );
    expect(generic.rows[0]?.present).toBe(false);
  });
});

function createRoot(suffix: string): Record<string, unknown> {
  return {
    operationKey: operationKey(suffix),
    ...rootResources([
      {
        definition: {
          canonicalName: `remote_tokens_${suffix}`,
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 100,
      },
    ]),
  };
}

function operationKey(suffix: string): string {
  return `kop_v1_${suffix.repeat(43)}`;
}

function compatibility(
  client: Parameters<typeof queryResponse>[0],
): Promise<unknown> {
  return queryResponse(client, "keynes.remote_get_compatibility", {});
}

async function protectedState(
  fixture: RemoteIdentityFixture,
): Promise<unknown> {
  const result = await fixture.administrator.query(
    `select jsonb_build_object(
       'mappingCount', (select count(*) from keynes_internal.remote_role_mappings),
       'operationCount', (select count(*) from keynes_internal.remote_operations),
       'budgetCount', (select count(*) from keynes_internal.budgets),
       'historyCount', (select count(*) from keynes_internal.budget_history_entries),
       'cursorCount', (select count(*) from keynes_internal.remote_history_cursors),
       'probe', to_regclass('keynes.remote_sql_probe')
     ) as state`,
  );
  return result.rows[0]?.state;
}

function expectBindingRefusal(response: unknown): void {
  expect(response).toEqual({
    ok: false,
    error: {
      kind: "error",
      code: "invalid_command",
      details: {
        operation: "createBudget",
        issues: [
          { path: "$.resources.bindingReference", rule: "resourceBinding" },
        ],
      },
    },
  });
}

async function bindingAuthorityState(
  fixture: RemoteIdentityFixture,
): Promise<unknown> {
  const result = await fixture.administrator.query(`select jsonb_build_object(
    'resources', (select jsonb_agg(to_jsonb(r) order by tenant_id, canonical_name) from keynes_internal.resource_types r),
    'commands', (select jsonb_agg(to_jsonb(c) order by tenant_id, command_id) from keynes_internal.commands c),
    'budgets', (select count(*) from keynes_internal.budgets),
    'holdings', (select count(*) from keynes_internal.budget_resources),
    'history', (select count(*) from keynes_internal.budget_history_entries)
  ) as state`);
  return result.rows[0]?.state;
}

async function configuredAuthorityState(
  fixture: RemoteIdentityFixture,
): Promise<unknown> {
  const result = await fixture.administrator.query(`select jsonb_build_object(
    'resources', (select jsonb_agg(to_jsonb(r) order by tenant_id, canonical_name) from keynes_internal.resource_types r),
    'commandsAndBindings', (select jsonb_agg(to_jsonb(c) order by tenant_id, command_id) from keynes_internal.commands c),
    'remoteOperations', (select jsonb_agg(to_jsonb(o) order by tenant_id, operation_key) from keynes_internal.remote_operations o),
    'budgets', (select jsonb_agg(to_jsonb(b) order by tenant_id, budget_id) from keynes_internal.budgets b),
    'holdings', (select jsonb_agg(to_jsonb(h) order by tenant_id, budget_id, resource_type_id) from keynes_internal.budget_resources h),
    'history', (select jsonb_agg(to_jsonb(e) order by to_jsonb(e)::text) from keynes_internal.budget_history_entries e)
  ) as state`);
  return result.rows[0]?.state;
}

function invalidRemoteInputs(): readonly {
  readonly procedure: string;
  readonly operation: string;
  readonly inputs: readonly unknown[];
}[] {
  const key = operationKey("s");
  const reference = budgetReference("shape");
  const root = {
    definition: resource("shape_tokens"),
    amount: 1,
  };
  return [
    {
      procedure: "keynes.remote_define_resources",
      operation: "defineResources",
      inputs: [
        null,
        {},
        { operationKey: key, definitions: {} },
        {
          operationKey: key,
          definitions: {
            modelTokens: {
              unit: "token",
              accountingBehavior: "consumable",
              unknown: true,
            },
          },
        },
      ],
    },
    {
      procedure: "keynes.remote_create_budget",
      operation: "createBudget",
      inputs: [
        null,
        1,
        {},
        { operationKey: key, resources: [root], unexpected: true },
        {
          operationKey: key,
          ...rootResources([
            {
              definition: { ...resource("shape_tokens"), unit: "x".repeat(65) },
              amount: 1,
            },
          ]),
        },
        {
          operationKey: key,
          ...rootResources([{ ...root, definition: resource("Invalid") }]),
        },
      ],
    },
    {
      procedure: "keynes.remote_request",
      operation: "requestBudget",
      inputs: [
        null,
        "request",
        {},
        {
          operationKey: key,
          parentBudgetReference: reference,
          resources: [{ resource: "shape_tokens", amount: 1 }],
          unexpected: true,
        },
        {
          operationKey: key,
          parentBudgetReference: reference,
          resources: namedAmounts(65),
        },
        {
          operationKey: key,
          parentBudgetReference: "budget-id",
          resources: [{ resource: "shape_tokens", amount: 1 }],
        },
      ],
    },
    {
      procedure: "keynes.remote_settle",
      operation: "settleBudget",
      inputs: [
        null,
        false,
        {},
        {
          operationKey: key,
          budgetReference: reference,
          usage: [{ resource: "shape_tokens", amount: 1 }],
          unexpected: true,
        },
        {
          operationKey: key,
          budgetReference: reference,
          usage: namedAmounts(65),
        },
        {
          operationKey: key,
          budgetReference: "budget-id",
          usage: [{ resource: "shape_tokens", amount: 1 }],
        },
      ],
    },
    {
      procedure: "keynes.remote_get_budget",
      operation: "getBudget",
      inputs: [
        null,
        [],
        {},
        { budgetReference: reference, unexpected: true },
        { budgetReference: `kbr_v1_${"a".repeat(44)}` },
        { budgetReference: "budget-id" },
      ],
    },
    {
      procedure: "keynes.remote_get_budget_history_page",
      operation: "getBudgetHistoryPage",
      inputs: [
        null,
        1,
        {},
        { budgetReference: reference, unexpected: true },
        { budgetReference: `kbr_v1_${"a".repeat(44)}` },
        { budgetReference: "budget-id", cursor: "cursor" },
      ],
    },
    {
      procedure: "keynes.remote_open_budget",
      operation: "openBudget",
      inputs: [
        null,
        "open",
        {},
        {
          budgetReference: reference,
          expectedResources: [resource("shape_tokens")],
          unexpected: true,
        },
        {
          budgetReference: reference,
          expectedResources: Array.from({ length: 65 }, (_, index) =>
            resource(`shape_${index}`),
          ),
        },
        {
          budgetReference: reference,
          expectedResources: [resource("Invalid")],
        },
      ],
    },
    {
      procedure: "keynes.remote_recover_operation",
      operation: "recoverOperation",
      inputs: [
        null,
        [],
        {},
        { operationKey: key, unexpected: true },
        { operationKey: `kop_v1_${"a".repeat(44)}` },
        { operationKey: "operation-key" },
      ],
    },
    {
      procedure: "keynes.remote_get_compatibility",
      operation: "getCompatibility",
      inputs: [
        null,
        1,
        [],
        { unexpected: true },
        { unexpected: "x".repeat(65_537) },
      ],
    },
  ];
}

function namedAmounts(count: number): readonly Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => ({
    resource: `shape_${index}`,
    amount: 1,
  }));
}

function budgetReference(suffix: string): string {
  return `kbr_v1_${suffix.padEnd(43, "a")}`;
}

type ResourceDefinition = Parameters<
  typeof rootResources
>[0][number]["definition"];

function resource(canonicalName: string): ResourceDefinition {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
}

function requireCreatedReference(response: unknown): string {
  if (
    typeof response !== "object" ||
    response === null ||
    !("result" in response) ||
    typeof response.result !== "object" ||
    response.result === null ||
    !("budget" in response.result) ||
    typeof response.result.budget !== "object" ||
    response.result.budget === null ||
    !("budgetReference" in response.result.budget) ||
    typeof response.result.budget.budgetReference !== "string"
  ) {
    throw new Error("remote creation did not return a Budget reference");
  }
  return response.result.budget.budgetReference;
}

async function completeTenantLifecycle(
  client: Parameters<typeof queryResponse>[0],
  allocation: number,
  requestAmount: number,
): Promise<{
  readonly createInput: Record<string, unknown>;
  readonly rootReference: string;
  readonly childReference: string;
}> {
  const canonicalName = "shared_tenant_tokens";
  const createInput = {
    operationKey: operationKey("t"),
    ...rootResources([
      { definition: resource(canonicalName), amount: allocation },
    ]),
  };
  const created = await queryResponse(
    client,
    "keynes.remote_create_budget",
    createInput,
  );
  const rootReference = requireCreatedReference(created);
  const requested = await queryResponse(client, "keynes.remote_request", {
    operationKey: operationKey("u"),
    parentBudgetReference: rootReference,
    resources: [{ resource: canonicalName, amount: requestAmount }],
  });
  const childReference = requireResultReference(
    requested,
    "childBudgetReference",
  );
  expect(requested).toMatchObject({
    ok: true,
    result: { kind: "approved" },
  });
  expect(
    await queryResponse(client, "keynes.remote_settle", {
      operationKey: operationKey("v"),
      budgetReference: childReference,
      usage: [{ resource: canonicalName, amount: requestAmount }],
    }),
  ).toMatchObject({ ok: true, result: { kind: "settled" } });
  return { createInput, rootReference, childReference };
}

function requireResultReference(response: unknown, field: string): string {
  if (
    typeof response !== "object" ||
    response === null ||
    !("result" in response) ||
    typeof response.result !== "object" ||
    response.result === null
  ) {
    throw new Error(`remote mutation did not return ${field}`);
  }
  const reference = Reflect.get(response.result, field);
  if (typeof reference !== "string") {
    throw new Error(`remote mutation did not return ${field}`);
  }
  return reference;
}

function expectInvalidCommand(response: unknown, operation: string): void {
  expect(response).toEqual({
    ok: false,
    error: {
      kind: "error",
      code: "invalid_command",
      details: {
        operation,
        issues: expect.any(Array),
      },
    },
  });
  const issues = requireIssues(response);
  expect(issues.length).toBeGreaterThan(0);
  for (const issue of issues) {
    expect(issue).toEqual({
      path: expect.stringMatching(/^\$/u),
      rule: expect.any(String),
    });
  }
  expectSafeRemoteResponse(response);
}

function requireIssues(response: unknown): readonly unknown[] {
  if (
    typeof response !== "object" ||
    response === null ||
    !("error" in response) ||
    typeof response.error !== "object" ||
    response.error === null ||
    !("details" in response.error) ||
    typeof response.error.details !== "object" ||
    response.error.details === null ||
    !("issues" in response.error.details) ||
    !Array.isArray(response.error.details.issues)
  ) {
    throw new Error("remote validation response has no issues");
  }
  return response.error.details.issues;
}

function expectSafeRemoteResponse(response: unknown): void {
  expect(JSON.stringify(response)).not.toMatch(
    /keynes_internal|sqlstate|syntax error|relation .* does not exist|column .* does not exist|select\s|insert\s|update\s|delete\s/iu,
  );
}
