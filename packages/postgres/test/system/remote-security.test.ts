import { createHash } from "node:crypto";

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

  it("rejects foreign tenant and unknown configured catalogs with the same private-safe error", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    expect(
      await queryResponse(primary, "keynes.remote_define_resources", {
        operationKey: operationKey("d"),
        definitions,
      }),
    ).toMatchObject({ ok: true, result: { kind: "defined" } });
    expect(
      await queryResponse(primary, "keynes.remote_create_budget", {
        operationKey: operationKey("c"),
        definitions,
        amounts: { modelTokens: 2 },
      }),
    ).toMatchObject({ ok: true });
    const before = await bindingAuthorityState(fixture);
    for (const [index, candidate] of [
      definitions,
      { unknownTokens: definitions.modelTokens },
    ].entries()) {
      const response = await queryResponse(
        secondary,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey(String(index)),
          definitions: candidate,
          amounts: Object.fromEntries(
            Object.keys(candidate).map((key) => [key, 2]),
          ),
        },
      );
      expectConfiguredCatalogRefusal(response);
      expect(await bindingAuthorityState(fixture)).toEqual(before);
    }
  });

  it("creates against the current installation catalog without importing another installation's Resource identity", async () => {
    fixture = await openRemoteIdentityFixture();
    const producer = await fixture.connect(fixture.primary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    expect(
      await queryResponse(producer, "keynes.remote_define_resources", {
        operationKey: operationKey("d"),
        definitions,
      }),
    ).toMatchObject({ ok: true, result: { kind: "defined" } });
    const sourceResourceTypeId = await resourceTypeId(fixture, "model_tokens");
    const other = await openRemoteIdentityFixture();
    try {
      const consumer = await other.connect(other.primary);
      const before = await bindingAuthorityState(other);
      expectConfiguredCatalogRefusal(
        await queryResponse(consumer, "keynes.remote_create_budget", {
          operationKey: operationKey("f"),
          definitions,
          amounts: { modelTokens: 2 },
        }),
      );
      expect(await bindingAuthorityState(other)).toEqual(before);
      expect(
        await queryResponse(consumer, "keynes.remote_define_resources", {
          operationKey: operationKey("g"),
          definitions,
        }),
      ).toMatchObject({ ok: true, result: { kind: "defined" } });
      const created = await queryResponse(
        consumer,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey("c"),
          definitions,
          amounts: { modelTokens: 2 },
        },
      );
      expect(created).toMatchObject({ ok: true });
      const targetResourceTypeId = await resourceTypeId(other, "model_tokens");
      expect(targetResourceTypeId).not.toBe(sourceResourceTypeId);
      expect(
        await resourceTypeIdForBudget(other, requireCreatedReference(created)),
      ).toBe(targetResourceTypeId);
    } finally {
      await other.close();
    }
  });

  it("validates the exact input shape of all ten wrappers before mutation", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    await provisionDefinitions(client, {
      shapeTokens: { unit: "token", accountingBehavior: "consumable" },
    });
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
    await provisionRoot(client, "a");
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
        operation_count: "4",
      },
      {
        tenant_id: fixture.secondary.tenantId,
        budget_count: "2",
        operation_count: "6",
      },
    ]);
  });

  it("checks current request permission before replaying caller evidence", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const definitions = {
      requestTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("request-evidence-definition"),
        definitions,
      }),
    ).toMatchObject({ ok: true });
    const root = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("request-evidence-root"),
      definitions,
      amounts: { requestTokens: 2 },
    });
    const command = {
      operationKey: operationKey("request-evidence-replay"),
      parentBudgetReference: requireCreatedReference(root),
      resources: [{ resource: "request_tokens", amount: 1 }],
      decisionEvidence: { approved: true, source: "application" },
    };
    expect(
      await queryResponse(client, "keynes.remote_request", command),
    ).toMatchObject({
      ok: true,
      result: { kind: "approved", decisionEvidence: command.decisionEvidence },
    });
    const before = await protectedState(fixture);
    await fixture.administrator.query(
      `delete from keynes_internal.principal_permissions
        where tenant_id = $1 and principal_id = $2 and permission = 'request_budget'`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    expect(
      await queryResponse(client, "keynes.remote_request", command),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await protectedState(fixture)).toEqual(before);
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

  it("authorizes every captured-history page without minting references or exposing snapshots", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    await provisionDefinitions(primary, {
      captureTokens: { unit: "token", accountingBehavior: "consumable" },
    });
    const firstRoot = requireCreatedReference(
      await queryResponse(primary, "keynes.remote_create_budget", {
        operationKey: operationKey("captured-history-root"),
        definitions: {
          captureTokens: { unit: "token", accountingBehavior: "consumable" },
        },
        amounts: { captureTokens: 1 },
      }),
    );
    const childReference = requireResultReference(
      await queryResponse(primary, "keynes.remote_request", {
        operationKey: operationKey("captured-history-child"),
        parentBudgetReference: firstRoot,
        resources: [{ resource: "capture_tokens", amount: 1 }],
      }),
      "childBudgetReference",
    );
    const commands = Array.from({ length: 255 }, (_, index) => ({
      operationKey: operationKey(`captured-history-${index}`),
      parentBudgetReference: firstRoot,
      resources: [{ resource: "capture_tokens", amount: 2 }],
    }));
    await primary.query(
      `select keynes.remote_request(command)
         from jsonb_array_elements($1::jsonb) as commands(command)`,
      [JSON.stringify(commands)],
    );
    const referencesBefore = await fixture.administrator.query<{
      count: number;
    }>(
      "select count(*)::int as count from keynes_internal.remote_budget_references",
    );
    const cursor = requireResultReference(
      await queryResponse(primary, "keynes.remote_get_budget_history_page", {
        budgetReference: firstRoot,
      }),
      "nextCursor",
    );
    expect(cursor).toMatch(/^khc_v2_[0-9a-f]{32}_257$/u);
    expect(
      await fixture.administrator.query<{ count: number }>(
        "select count(*)::int as count from keynes_internal.remote_budget_references",
      ),
    ).toEqual(referencesBefore);
    await expect(
      primary.query(
        "select * from keynes_internal.remote_inspection_snapshots",
      ),
    ).rejects.toThrow();

    await fixture.setEnabled(fixture.primary.role, false);
    const disabled = await queryResponse(
      primary,
      "keynes.remote_get_budget_history_page",
      { budgetReference: firstRoot, cursor },
    );
    expect(disabled).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expectSafeRemoteResponse(disabled);
    await fixture.setEnabled(fixture.primary.role, true);
    await fixture.administrator.query(
      `delete from keynes_internal.principal_permissions
        where tenant_id = $1 and principal_id = $2 and permission = 'read_budget'`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    const revoked = await queryResponse(
      primary,
      "keynes.remote_get_budget_history_page",
      { budgetReference: firstRoot, cursor },
    );
    expect(revoked).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expectSafeRemoteResponse(revoked);
    const revokedMalformed = await queryResponse(
      primary,
      "keynes.remote_get_budget_history_page",
      { budgetReference: firstRoot, cursor: "not-a-cursor" },
    );
    expect(revokedMalformed).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expectSafeRemoteResponse(revokedMalformed);
    await fixture.administrator.query(
      `insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission)
       values ($1, $2, 'read_budget')`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    const alternatePrincipal = "00000000-0000-4000-8000-000000000199";
    await fixture.administrator.query(
      `insert into keynes_internal.principal_permissions (tenant_id, principal_id, permission)
       values ($1, $2, 'read_budget')`,
      [fixture.primary.tenantId, alternatePrincipal],
    );
    await fixture.administrator.query(
      `update keynes_internal.remote_role_mappings
          set principal_id = $2
        where role_name = $1`,
      [fixture.primary.role, alternatePrincipal],
    );
    const wrongPrincipal = await queryResponse(
      primary,
      "keynes.remote_get_budget_history_page",
      { budgetReference: firstRoot, cursor },
    );
    expect(wrongPrincipal).toMatchObject({
      ok: false,
      error: { code: "invalid_command" },
    });
    expectSafeRemoteResponse(wrongPrincipal);
    await fixture.administrator.query(
      `update keynes_internal.remote_role_mappings
          set principal_id = $2
        where role_name = $1`,
      [fixture.primary.role, fixture.primary.principalId],
    );

    for (const { client, budgetReference } of [
      { client: secondary, budgetReference: firstRoot },
      { client: primary, budgetReference: childReference },
    ]) {
      const rejected = await queryResponse(
        client,
        "keynes.remote_get_budget_history_page",
        { budgetReference, cursor },
      );
      expect(rejected).toMatchObject({
        ok: false,
        error: {
          code: client === secondary ? "unauthorized" : "invalid_command",
        },
      });
      expectSafeRemoteResponse(rejected);
    }
    expect(
      await queryResponse(primary, "keynes.remote_get_budget_history_page", {
        budgetReference: firstRoot,
        cursor,
      }),
    ).toMatchObject({ ok: true });
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
      "delete from keynes_internal.quantity_movements",
      "insert into keynes_internal.quantity_movements default values",
      "update keynes_internal.quantity_movements set amount = 0",
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

  it("pins every security-definer search path to trusted schemas with pg_temp last", async () => {
    fixture = await openRemoteIdentityFixture();
    const functions = await fixture.administrator.query<{
      readonly name: string;
      readonly search_path: string | null;
    }>(
      `select n.nspname || '.' || p.proname as name,
                (select cfg from unnest(p.proconfig) cfg where cfg like 'search_path=%') as search_path
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('keynes', 'keynes_internal') and p.prosecdef
          order by name`,
    );

    expect(functions.rows.length).toBeGreaterThan(0);
    expect(functions.rows).toEqual(
      functions.rows.map(({ name }) => ({
        name,
        search_path: "search_path=pg_catalog, keynes_internal, pg_temp",
      })),
    );
  });
});

function createRoot(suffix: string): Record<string, unknown> {
  const key = resourceKey(`remote_tokens_${suffix}`);
  return {
    operationKey: operationKey(suffix),
    definitions: {
      [key]: { unit: "token", accountingBehavior: "consumable" },
    },
    amounts: { [key]: 100 },
  };
}

function operationKey(suffix: string): string {
  return `kop_v1_${createHash("sha256").update(suffix).digest("base64url")}`;
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
       'cursorCount', (select count(*) from keynes_internal.remote_inspection_snapshots),
       'probe', to_regclass('keynes.remote_sql_probe')
     ) as state`,
  );
  return result.rows[0]?.state;
}

function expectConfiguredCatalogRefusal(response: unknown): void {
  expect(response).toEqual({
    ok: false,
    error: {
      kind: "error",
      code: "resource_type_not_found",
      details: {},
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

async function resourceTypeId(
  fixture: RemoteIdentityFixture,
  canonicalName: string,
): Promise<string> {
  const result = await fixture.administrator.query<{
    readonly resource_type_id: string;
  }>(
    `select resource_type_id::text
       from keynes_internal.resource_types
      where tenant_id = $1 and canonical_name = $2`,
    [fixture.primary.tenantId, canonicalName],
  );
  const resourceTypeId = result.rows[0]?.resource_type_id;
  if (resourceTypeId === undefined) throw new Error("missing catalog Resource");
  return resourceTypeId;
}

async function resourceTypeIdForBudget(
  fixture: RemoteIdentityFixture,
  budgetReference: string,
): Promise<string> {
  const result = await fixture.administrator.query<{
    readonly resource_type_id: string;
  }>(
    `select holdings.resource_type_id::text
       from keynes_internal.budget_resources holdings
       join keynes_internal.budgets budgets
         on budgets.budget_id = holdings.budget_id
       join keynes_internal.remote_budget_references refs
         on refs.tenant_id = budgets.tenant_id
        and refs.budget_id = budgets.budget_id
      where budgets.tenant_id = $1 and refs.budget_reference = $2`,
    [fixture.primary.tenantId, budgetReference],
  );
  const resourceTypeId = result.rows[0]?.resource_type_id;
  if (resourceTypeId === undefined) throw new Error("missing Budget Resource");
  return resourceTypeId;
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
  return [
    {
      procedure: "keynes.remote_validate_resources",
      operation: "validateResources",
      inputs: [
        null,
        {},
        {
          definitions: {
            shapeTokens: { unit: "token", accountingBehavior: "consumable" },
          },
          unexpected: true,
        },
        {
          definitions: {
            shapeTokens: {
              unit: "token",
              accountingBehavior: "consumable",
              unexpected: true,
            },
          },
        },
      ],
    },
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
        {
          operationKey: key,
          definitions: {
            shapeTokens: { unit: "token", accountingBehavior: "consumable" },
          },
          amounts: { shapeTokens: 1 },
          unexpected: true,
        },
        {
          operationKey: key,
          definitions: {
            shapeTokens: {
              unit: "token",
              accountingBehavior: "consumable",
            },
          },
          amounts: { shapeTokens: "one" },
        },
        {
          operationKey: key,
          definitions: {
            Invalid: { unit: "token", accountingBehavior: "consumable" },
          },
          amounts: { Invalid: 1 },
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

interface ResourceDefinition {
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable";
}

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
  await provisionDefinitions(client, {
    sharedTenantTokens: { unit: "token", accountingBehavior: "consumable" },
  });
  const createInput = {
    operationKey: operationKey("t"),
    definitions: {
      sharedTenantTokens: { unit: "token", accountingBehavior: "consumable" },
    },
    amounts: { sharedTenantTokens: allocation },
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

async function provisionRoot(
  client: Parameters<typeof queryResponse>[0],
  suffix: string,
): Promise<void> {
  const key = resourceKey(`remote_tokens_${suffix}`);
  await provisionDefinitions(client, {
    [key]: { unit: "token", accountingBehavior: "consumable" },
  });
}

async function provisionDefinitions(
  client: Parameters<typeof queryResponse>[0],
  definitions: Record<
    string,
    { readonly unit: string; readonly accountingBehavior: "consumable" }
  >,
): Promise<void> {
  expect(
    await queryResponse(client, "keynes.remote_define_resources", {
      operationKey: operationKey(
        `catalog-${Object.keys(definitions).join("-")}`,
      ),
      definitions,
    }),
  ).toMatchObject({ ok: true, result: { kind: "defined" } });
}

function resourceKey(canonicalName: string): string {
  return canonicalName.replace(/_([a-z])/gu, (_match, letter: string) =>
    letter.toUpperCase(),
  );
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
