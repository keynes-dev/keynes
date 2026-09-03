import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  identifier,
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "remote PostgreSQL identity and security",
  () => {
    let fixture: RemoteIdentityFixture | undefined;

    afterEach(async () => {
      await fixture?.close();
      fixture = undefined;
    });

    it("validates the exact input shape of all eight wrappers before mutation", async () => {
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
  },
);

function createRoot(suffix: string): Record<string, unknown> {
  return {
    operationKey: operationKey(suffix),
    resources: [
      {
        definition: {
          canonicalName: `remote_tokens_${suffix}`,
          unit: "token",
          accountingBehavior: "consumable",
        },
        amount: 100,
      },
    ],
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
      procedure: "keynes.remote_create_budget",
      operation: "createBudget",
      inputs: [
        null,
        1,
        {},
        { operationKey: key, resources: [root], unexpected: true },
        {
          operationKey: key,
          resources: [
            {
              definition: { ...resource("shape_tokens"), unit: "x".repeat(65) },
              amount: 1,
            },
          ],
        },
        {
          operationKey: key,
          resources: [{ ...root, definition: resource("Invalid") }],
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

function resource(canonicalName: string): Record<string, string> {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
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
