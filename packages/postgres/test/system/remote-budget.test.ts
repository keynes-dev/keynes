import { loadPublicPostgresql } from "../support/packed-package.js";
import {
  requirePostgresqlSystemInstallation,
  requirePostgresqlSystemTlsRootCertificate,
} from "./support/test-keynes.js";
import { rootResources } from "@keynes/database/contract-tests";
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

  it("creates from declarations after producer close using another same-tenant creation-only principal", async () => {
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
    expect(defined).toMatchObject({ ok: true });
    const beforeDefinitions = await fixture.administrator.query(
      "select to_jsonb(r) as resource, xmin::text as version from keynes_internal.resource_types r order by canonical_name",
    );
    await producerClient.end();
    await fixture.administrator.query(
      "delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2 and permission <> 'create_root_budget'",
      [consumer.tenantId, consumer.principalId],
    );
    const client = await fixture.connect(consumer);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
    };
    const created = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("consume-binding"),
      definitions,
      amounts: { modelTokens: 7 },
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
        definitions: {
          missingTokens: { unit: "token", accountingBehavior: "consumable" },
        },
        amounts: { missingTokens: 1 },
      }),
    ).toMatchObject({ ok: false, error: { code: "resource_type_not_found" } });
    expect(await definitionState(fixture)).toEqual(beforeDenied);
    await fixture.setEnabled(consumer.role, false);
    expect(
      await queryResponse(client, "keynes.remote_create_budget", {
        operationKey: operationKey("revoked-binding-consumer"),
        definitions,
        amounts: { modelTokens: 1 },
      }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await definitionState(fixture)).toEqual(beforeDenied);
  });

  it("accepts mixed-zero and all-zero Remote roots without changing catalog definitions", async () => {
    fixture = await openRemoteIdentityFixture();
    const client = await fixture.connect(fixture.primary);
    const definitions = {
      modelTokens: { unit: "token", accountingBehavior: "consumable" },
      reviewerSeats: { unit: "seat", accountingBehavior: "reusable" },
    };
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("zero-definition"),
        definitions,
      }),
    ).toMatchObject({ ok: true });
    const catalog = await fixture.administrator.query(
      "select to_jsonb(r) as resource, xmin::text as version from keynes_internal.resource_types r order by canonical_name",
    );
    for (const [index, amount] of [1, 0].entries()) {
      const created = await queryResponse(
        client,
        "keynes.remote_create_budget",
        {
          operationKey: operationKey(`zero-root-${index}`),
          definitions,
          amounts: { modelTokens: amount, reviewerSeats: 0 },
        },
      );
      expect(created).toMatchObject({
        ok: true,
        result: {
          kind: "created",
          budget: {
            lifecycle: "active",
            resources: [
              {
                resource: { canonicalName: "model_tokens" },
                allocated: amount,
                available: amount,
              },
              {
                resource: { canonicalName: "reviewer_seats" },
                allocated: 0,
                available: 0,
              },
            ],
          },
        },
      });
    }
    expect(
      (
        await fixture.administrator.query(
          "select to_jsonb(r) as resource, xmin::text as version from keynes_internal.resource_types r order by canonical_name",
        )
      ).rows,
    ).toEqual(catalog.rows);
    expect(await definitionState(fixture)).toEqual([
      {
        resources: 2,
        commands: 3,
        references: 1,
        budgets: 2,
        holdings: 4,
        history: 2,
      },
    ]);
  });

  it("completes one remote create, request, inspect, and settlement loop", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const resource = "remote_lifecycle_tokens";
    const creation = rootResources([
      { definition: resourceDefinition(resource), amount: 10 },
    ]);
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("lifecycle-definitions"),
        definitions: creation.definitions,
      }),
    ).toMatchObject({ ok: true });
    const created = await queryResponse(client, "keynes.remote_create_budget", {
      operationKey: operationKey("create"),
      ...creation,
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

describe("public owned PostgreSQL adapter", () => {
  const resources = {
    modelTokens: { unit: "token", accountingBehavior: "consumable" },
  };

  async function openPublicFixture() {
    const modules = await loadPublicPostgresql(
      requirePostgresqlSystemInstallation(),
    );
    const fixture = await openRemoteIdentityFixture();
    try {
      await fixture.register(fixture.primary);
      const bootstrap = await fixture.connect(fixture.primary);
      try {
        expect(
          await queryResponse(bootstrap, "keynes.remote_define_resources", {
            operationKey: modules.createOperationKey(),
            definitions: resources,
          }),
        ).toMatchObject({ ok: true });
      } finally {
        await bootstrap.end();
      }
      const url = new URL(fixture.databaseUrl);
      url.username = fixture.primary.role;
      url.password = fixture.primary.password;
      url.searchParams.set("sslmode", "verify-full");
      url.searchParams.set(
        "sslrootcert",
        requirePostgresqlSystemTlsRootCertificate(),
      );
      const keynes = await modules.createKeynes({
        resources,
        runtime: modules.postgres({ databaseUrl: url.toString() }),
      });
      return {
        fixture,
        keynes,
        createOperationKey: modules.createOperationKey,
      };
    } catch (error: unknown) {
      await fixture.close();
      throw error;
    }
  }

  it("executes the public lifecycle over verified TLS and closes its owned pool", async () => {
    const { fixture, keynes, createOperationKey } = await openPublicFixture();
    try {
      await keynes.defineResources(resources);
      const root = await keynes.createBudget({ modelTokens: 10 });
      const requestKey = createOperationKey();
      const requested = await root.request(
        { modelTokens: 3 },
        { operationKey: requestKey, decisionEvidence: { source: "native" } },
      );
      expect(requested.status).toBe("approved");
      if (requested.status !== "approved")
        throw new Error("Expected approved native public request");
      await expect(
        requested.budget.settle({ modelTokens: 2 }),
      ).resolves.toMatchObject({ kind: "settled" });
      const inspection = await root.inspect();
      expect(inspection.budget.resources).toEqual([
        expect.objectContaining({
          resource: "modelTokens",
          allocated: 10,
          subtreeObservedUsage: 2,
        }),
      ]);
      expect(inspection.history.entries.length).toBeGreaterThan(1);
      const opened = await keynes.openBudget({
        reference: root.reference,
        resourceTypes: resources,
      });
      expect(await opened.inspect()).toEqual(inspection);
      await expect(keynes.recoverOperation(requestKey)).resolves.toMatchObject({
        kind: "committed",
        operation: "requestBudget",
        result: { decisionEvidence: { source: "native" } },
      });
      const tls = await fixture.administrator.query<{ ssl: boolean }>(
        "select s.ssl from pg_stat_ssl s join pg_stat_activity a using (pid) where a.usename = $1",
        [fixture.primary.role],
      );
      expect(tls.rows.length).toBeGreaterThan(0);
      expect(tls.rows.every(({ ssl }) => ssl)).toBe(true);
      const closing = keynes.close();
      expect(keynes.close()).toBe(closing);
      const malformed = new Proxy(
        { modelTokens: NaN },
        {
          ownKeys() {
            throw new Error("closed input accessed");
          },
        },
      );
      for (const invoke of [
        () => keynes.createBudget(malformed),
        () => root.request(malformed),
        () => root.settle(malformed),
      ]) {
        let pending: Promise<unknown> | undefined;
        expect(() => {
          pending = invoke();
        }).not.toThrow();
        expect(pending).toBeInstanceOf(Promise);
        await expect(pending).rejects.toMatchObject({ code: "client_closed" });
      }

      await closing;
      await expect(root.inspect()).rejects.toMatchObject({
        code: "client_closed",
      });
    } finally {
      await keynes.close();
      await fixture.close();
    }
  });

  it("projects all public history kinds without internal identity fields", async () => {
    const { fixture, keynes } = await openPublicFixture();
    try {
      const wire = await fixture.connect(fixture.primary);
      const { createRemoteKeynesClient } = await loadPublicPostgresql(
        requirePostgresqlSystemInstallation(),
      );
      const client = createRemoteKeynesClient({
        execute: (procedure, input) =>
          queryResponse(wire, procedure.target, input),
      });
      const root = await keynes.createBudget({ modelTokens: 10 });
      const decisionEvidence = {
        budget_id: "application-label",
        command_id: "opaque",
        root_budget_id: "x",
      };
      const requested = await root.request(
        { modelTokens: 3 },
        { decisionEvidence },
      );
      if (requested.status !== "approved")
        throw new Error("Expected history fixture approval");
      await expect(
        root.request({ modelTokens: 20 }, { decisionEvidence }),
      ).resolves.toMatchObject({ status: "denied" });
      await requested.budget.settle({ modelTokens: 2 });
      const page = await client.getBudgetHistoryPage({
        budgetReference: root.reference,
      });
      expect(page.entries.map(({ kind }) => kind)).toEqual([
        "budget_created",
        "request_approved",
        "request_denied",
        "budget_settlement_recorded",
      ]);
      expect(page.entries.slice(1, 3)).toEqual([
        expect.objectContaining({ decisionEvidence }),
        expect.objectContaining({ decisionEvidence }),
      ]);
      for (const entry of page.entries) {
        for (const key of [
          "budgetReference",
          "parentBudgetReference",
          "childBudgetReference",
          "rootBudgetReference",
        ])
          expect(entry).not.toHaveProperty(key);
      }
    } finally {
      await keynes.close();
      await fixture.close();
    }
  });

  it("projects frozen root lineage without private identities or caller-evidence rewriting", async () => {
    const { fixture, keynes } = await openPublicFixture();
    try {
      const root = await keynes.createBudget({ modelTokens: 10 });
      const decisionEvidence = {
        budget_id: "caller-budget",
        command_id: "caller-command",
        resource_type_id: "caller-resource",
        movement: "caller-movement",
        cause: "caller-cause",
        subject: "caller-subject",
      };
      const requested = await root.request(
        { modelTokens: 4 },
        { decisionEvidence },
      );
      if (requested.status !== "approved")
        throw new Error("Expected lineage fixture approval");
      await expect(root.settle({ modelTokens: 1 })).resolves.toMatchObject({
        kind: "settling",
      });
      await expect(
        requested.budget.settle({ modelTokens: 2 }),
      ).resolves.toMatchObject({ kind: "settled" });

      const snapshot = await requested.budget.inspect();
      expect(snapshot).toMatchObject({
        budget: {
          lineageId: 2,
          parentLineageId: 1,
          resources: [{ resource: "modelTokens" }],
        },
        history: {
          entries: [
            {
              kind: "budget_created",
              sequence: 1,
              subject: 1,
              cause: { kind: "command" },
              movements: [
                {
                  reason: "initial_allocation",
                  resource: "modelTokens",
                  amount: 10,
                  from: null,
                  to: 1,
                },
              ],
            },
            {
              kind: "request_approved",
              sequence: 2,
              subject: 2,
              parent: 1,
              cause: { kind: "command" },
              decisionEvidence,
              movements: [
                {
                  reason: "child_grant",
                  resource: "modelTokens",
                  amount: 4,
                  from: 1,
                  to: 2,
                },
              ],
            },
            {
              kind: "budget_settlement_recorded",
              sequence: 3,
              subject: 1,
              cause: { kind: "command" },
              movements: [
                {
                  reason: "consumption",
                  resource: "modelTokens",
                  amount: 1,
                  from: 1,
                  to: null,
                },
              ],
            },
            {
              kind: "budget_settlement_recorded",
              sequence: 4,
              subject: 2,
              cause: { kind: "command" },
              movements: [
                {
                  reason: "consumption",
                  resource: "modelTokens",
                  amount: 2,
                  from: 2,
                  to: null,
                },
                {
                  reason: "settlement_return",
                  resource: "modelTokens",
                  amount: 2,
                  from: 2,
                  to: 1,
                },
              ],
            },
            {
              kind: "budget_settlement_recorded",
              sequence: 5,
              subject: 1,
              cause: { kind: "automatic_finalization", eventSequence: 4 },
              movements: [
                {
                  reason: "root_release",
                  resource: "modelTokens",
                  amount: 7,
                  from: 1,
                  to: null,
                },
              ],
            },
          ],
        },
      });
      const [created, approved, rootSettled, childSettled, finalRoot] =
        snapshot.history.entries;
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.budget)).toBe(true);
      expect(Object.isFrozen(snapshot.history)).toBe(true);
      expect(Object.isFrozen(snapshot.history.entries)).toBe(true);
      for (const entry of [
        created,
        approved,
        rootSettled,
        childSettled,
        finalRoot,
      ]) {
        expect(Object.isFrozen(entry)).toBe(true);
        expect(Object.isFrozen(entry?.cause)).toBe(true);
        expect(Object.isFrozen(entry?.movements)).toBe(true);
        expect(Object.isFrozen(entry?.movements[0])).toBe(true);
      }
      const serialized = JSON.stringify(snapshot);
      expect(serialized).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      expect(serialized).not.toContain("kop_v1_");
    } finally {
      await keynes.close();
      await fixture.close();
    }
  });

  it("reopens with read permission after creation permission is revoked", async () => {
    const { fixture, keynes } = await openPublicFixture();
    try {
      const root = await keynes.createBudget({ modelTokens: 10 });
      await fixture.administrator.query(
        "delete from keynes_internal.principal_permissions where tenant_id = $1 and principal_id = $2 and permission = 'create_root_budget'",
        [fixture.primary.tenantId, fixture.primary.principalId],
      );
      await expect(
        keynes.createBudget({ modelTokens: 1 }),
      ).rejects.toMatchObject({ code: "unauthorized" });
      const reopened = await keynes.openBudget({
        reference: root.reference,
        resourceTypes: resources,
      });
      expect(await reopened.inspect()).toEqual(await root.inspect());
    } finally {
      await keynes.close();
      await fixture.close();
    }
  });
});
