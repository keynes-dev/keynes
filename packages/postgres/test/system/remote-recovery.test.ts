import { createHash } from "node:crypto";

import { rootResources } from "@keynes/database/contract-tests";
import type { Client } from "pg";
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

describe("remote PostgreSQL recovery and bounded reads", () => {
  let fixture: RemoteIdentityFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("recovers a lost definition response and retains its receipt after ledger expiry", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const producer = await fixture.connect(fixture.primary);
    const consumer = await fixture.connect(fixture.primary);
    const key = operationKey("R");
    const input = {
      operationKey: key,
      definitions: {
        recoveryUnits: { unit: "unit", accountingBehavior: "consumable" },
      },
    };
    const transportErrors: Error[] = [];
    producer.once("error", (error) => transportErrors.push(error));
    producer.connection.stream.pause();
    const pending = queryResponse(
      producer,
      "keynes.remote_define_resources",
      input,
    );
    await expect
      .poll(
        async () => {
          const response = record(
            await queryResponse(consumer, "keynes.remote_recover_operation", {
              operationKey: key,
            }),
          );
          return record(response.result).kind;
        },
        { interval: 20, timeout: 2_000 },
      )
      .toBe("committed");
    const lost = expect(pending).rejects.toBeInstanceOf(Error);
    producer.connection.stream.destroy();
    await lost;
    expect(transportErrors).toHaveLength(1);
    const before = await authorityCounts(fixture);
    const recovered = await queryResponse(
      consumer,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );
    expect(recovered).toMatchObject({
      ok: true,
      result: { kind: "committed", operation: "defineResources" },
    });
    const receipt = record(record(record(recovered).result).result);
    expect(receipt).toMatchObject({
      kind: "defined",
      resources: [{ key: "recoveryUnits" }],
    });
    expect(
      await queryResponse(consumer, "keynes.remote_define_resources", input),
    ).toEqual({ ok: true, result: { ...receipt, replayed: true } });
    expect(
      await queryResponse(consumer, "keynes.remote_define_resources", {
        ...input,
        definitions: {
          recoveryUnits: {
            unit: "different",
            accountingBehavior: "consumable",
          },
        },
      }),
    ).toMatchObject({ ok: false, error: { code: "command_conflict" } });
    expect(await authorityCounts(fixture)).toEqual(before);
    await fixture.register(fixture.secondary);
    const otherTenant = await fixture.connect(fixture.secondary);
    expect(
      await queryResponse(otherTenant, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toEqual({ ok: true, result: { kind: "not_found", operationKey: key } });
    expect(await authorityCounts(fixture)).toEqual(before);
    const bindingReference = receipt.bindingReference;
    expect(bindingReference).toEqual(
      expect.stringMatching(/^krs_v1_[A-Za-z0-9_-]{43}$/u),
    );
    await fixture.administrator.query(
      "update keynes_internal.remote_operations set expires_at = clock_timestamp() - interval '1 second' where operation_key = $1",
      [key],
    );
    expect(
      await queryResponse(consumer, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toEqual({ ok: true, result: { kind: "expired", operationKey: key } });
    await fixture.administrator.query(
      "delete from keynes_internal.remote_operations where operation_key = $1",
      [key],
    );
    const afterDelete = await authorityCounts(fixture);
    expect(
      await queryResponse(consumer, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toEqual({ ok: true, result: { kind: "not_found", operationKey: key } });
    expect(await authorityCounts(fixture)).toEqual(afterDelete);
    const created = await queryResponse(
      consumer,
      "keynes.remote_create_budget",
      {
        operationKey: operationKey("S"),
        definitions: input.definitions,
        amounts: { recoveryUnits: 7 },
      },
    );
    expect(created).toMatchObject({
      ok: true,
      result: {
        kind: "created",
        budget: {
          resources: [
            { resource: { canonicalName: "recovery_units" }, allocated: 7 },
          ],
        },
      },
    });
    expect(JSON.stringify(created)).not.toMatch(
      /resourceTypeId|principalId|definitionDigest|tenantId|bindingReference/,
    );
    const durable = await fixture.administrator.query<{ count: number }>(
      "select count(*)::int as count from keynes_internal.commands where binding_reference = $1",
      [bindingReference],
    );
    expect(durable.rows).toEqual([{ count: 1 }]);
  });

  it("keeps failed definitions as known failures without a successful receipt", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const original = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: operationKey("T"),
        definitions: {
          failureUnits: { unit: "unit", accountingBehavior: "consumable" },
        },
      },
    );
    expect(original).toMatchObject({ ok: true });
    const before = await authorityCounts(fixture);
    const key = operationKey("U");
    const rejected = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: key,
        definitions: {
          addedUnits: { unit: "unit", accountingBehavior: "consumable" },
          failureUnits: { unit: "changed", accountingBehavior: "consumable" },
        },
      },
    );
    expect(rejected).toMatchObject({ ok: false });
    const recovered = await queryResponse(
      client,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );
    expect(recovered).toEqual({
      ok: true,
      result: {
        kind: "known_failure",
        operationKey: key,
        error: record(rejected).error,
      },
    });
    expect(JSON.stringify(recovered)).not.toMatch(
      /krs_v1_|resourceTypeId|principalId|definitionDigest|tenantId|keynes_internal/,
    );
    const after = await authorityCounts(fixture);
    expect(authorityCount(after, "commands")).toBe(
      authorityCount(before, "commands"),
    );
    const definitions = await fixture.administrator.query<{ name: string }>(
      "select canonical_name as name from keynes_internal.resource_types order by canonical_name",
    );
    expect(definitions.rows).toEqual([{ name: "failure_units" }]);
    const receipts = await fixture.administrator.query<{ count: number }>(
      "select count(*)::int as count from keynes_internal.commands where binding_reference is not null",
    );
    expect(receipts.rows).toEqual([{ count: 1 }]);
  });

  it("reports semantic compatibility before any mutation", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const response = await queryResponse(
      client,
      "keynes.remote_get_compatibility",
      {},
    );

    expect(response).toMatchObject({
      ok: true,
      result: {
        installationId: expect.any(String),
        contractDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
        remoteProceduresDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
        semanticGeneration: 6,
        minimumSdkGeneration: 6,
        procedures: expect.arrayContaining([
          expect.objectContaining({
            name: "recoverOperation",
            target: "keynes.remote_recover_operation",
            revision: 4,
          }),
        ]),
      },
    });
  });

  it("recovers a committed response without adding a command or history entry", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const key = operationKey("a");
    await provisionRoot(client, "recover_committed");
    const created = await queryResponse(
      client,
      "keynes.remote_create_budget",
      createRoot(key, "recover_committed"),
    );
    expect(created).toMatchObject({ ok: true });
    const before = await authorityCounts(fixture);

    const recovered = await queryResponse(
      client,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );

    expect(recovered).toMatchObject({
      ok: true,
      result: {
        kind: "committed",
        operationKey: key,
        operation: "createBudget",
      },
    });
    expect(await authorityCounts(fixture)).toEqual(before);
  });

  it("replays request evidence and conflicts when its caller decision changes", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    await provisionRoot(client, "request_evidence");
    const created = await queryResponse(
      client,
      "keynes.remote_create_budget",
      createRoot(operationKey("request-evidence-root"), "request_evidence"),
    );
    const parentBudgetReference = requireBudgetReference(created);
    const operationKeyValue = operationKey("request-evidence");
    const decisionEvidence = { approved: true, source: "application" };
    const command = {
      operationKey: operationKeyValue,
      parentBudgetReference,
      resources: [{ resource: "request_evidence", amount: 1 }],
      decisionEvidence,
    };

    const approved = await queryResponse(
      client,
      "keynes.remote_request",
      command,
    );
    expect(approved).toMatchObject({
      ok: true,
      result: { kind: "approved", replayed: false, decisionEvidence },
    });
    expect(
      await queryResponse(client, "keynes.remote_request", command),
    ).toMatchObject({
      ok: true,
      result: { kind: "approved", replayed: true, decisionEvidence },
    });
    const emptyEvidenceCommand = {
      operationKey: operationKey("request-evidence-empty"),
      parentBudgetReference,
      resources: [{ resource: "request_evidence", amount: 1 }],
    };
    expect(
      await queryResponse(
        client,
        "keynes.remote_request",
        emptyEvidenceCommand,
      ),
    ).toMatchObject({
      ok: true,
      result: { kind: "approved", replayed: false },
    });
    expect(
      await queryResponse(client, "keynes.remote_request", {
        ...emptyEvidenceCommand,
        decisionEvidence: {},
      }),
    ).toMatchObject({ ok: true, result: { kind: "approved", replayed: true } });
    const normalizedEvidenceCommand = {
      operationKey: operationKey("request-evidence-normalized"),
      parentBudgetReference,
      resources: [{ resource: "request_evidence", amount: 1 }],
      decisionEvidence: { source: "application", revision: 1 },
    };
    expect(
      await queryResponse(
        client,
        "keynes.remote_request",
        normalizedEvidenceCommand,
      ),
    ).toMatchObject({
      ok: true,
      result: { kind: "approved", replayed: false },
    });
    const rawNumericReplay = await client.query(
      "select keynes.remote_request($1::jsonb) as response",
      [
        JSON.stringify({
          ...normalizedEvidenceCommand,
          decisionEvidence: { revision: 1, source: "application" },
        }).replace('"revision":1', '"revision":1.0'),
      ],
    );
    expect(rawNumericReplay.rows[0]?.response).toMatchObject({
      ok: true,
      result: { kind: "approved", replayed: true },
    });
    expect(
      await queryResponse(client, "keynes.remote_request", {
        ...command,
        decisionEvidence: { approved: false, source: "application" },
      }),
    ).toMatchObject({ ok: false, error: { code: "command_conflict" } });
    expect(
      await queryResponse(client, "keynes.remote_recover_operation", {
        operationKey: operationKeyValue,
      }),
    ).toMatchObject({
      ok: true,
      result: {
        kind: "committed",
        operation: "requestBudget",
        result: { kind: "approved", decisionEvidence },
      },
    });
  });

  it("recovers a committed mutation after its transport response is lost", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const mutationClient = await fixture.connect(fixture.primary);
    const recoveryClient = await fixture.connect(fixture.primary);
    const key = operationKey("l");
    await provisionRoot(recoveryClient, "lost_response_tokens");
    const transportErrors: Error[] = [];
    mutationClient.once("error", (error) => transportErrors.push(error));

    mutationClient.connection.stream.pause();
    const mutation = queryResponse(
      mutationClient,
      "keynes.remote_create_budget",
      createRoot(key, "lost_response_tokens"),
    );
    await expect
      .poll(
        async () => {
          const response = await queryResponse(
            recoveryClient,
            "keynes.remote_recover_operation",
            { operationKey: key },
          );
          return isRecord(response) && isRecord(response.result)
            ? response.result.kind
            : undefined;
        },
        { interval: 20, timeout: 2_000 },
      )
      .toBe("committed");
    const recoveredBeforeLoss = await queryResponse(
      recoveryClient,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );
    const lostResponse = expect(mutation).rejects.toBeInstanceOf(Error);
    mutationClient.connection.stream.destroy();
    await lostResponse;
    expect(transportErrors).toHaveLength(1);
    const before = await authorityCounts(fixture);

    const recoveredAfterLoss = await queryResponse(
      recoveryClient,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );

    expect(recoveredAfterLoss).toEqual(recoveredBeforeLoss);
    expect(recoveredAfterLoss).toMatchObject({
      ok: true,
      result: {
        kind: "committed",
        operationKey: key,
        operation: "createBudget",
      },
    });
    expect(await authorityCounts(fixture)).toEqual(before);
  });

  it("recovers a lost child terminal cascade without duplicating movements", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const producer = await fixture.connect(fixture.primary);
    const recovery = await fixture.connect(fixture.primary);
    const name = "lost_terminal_tokens";
    await provisionRoot(producer, name);
    const created = await queryResponse(
      producer,
      "keynes.remote_create_budget",
      createRoot(operationKey("lost-terminal-root"), name),
    );
    expect(created).toMatchObject({ ok: true, result: { kind: "created" } });
    const rootReference = requireBudgetReference(created);
    const requested = await queryResponse(producer, "keynes.remote_request", {
      operationKey: operationKey("lost-terminal-child"),
      parentBudgetReference: rootReference,
      resources: [{ resource: name, amount: 2 }],
    });
    const childReference = requireChildBudgetReference(requested);
    await queryResponse(producer, "keynes.remote_settle", {
      operationKey: operationKey("lost-terminal-root-settle"),
      budgetReference: rootReference,
      usage: [{ resource: name, amount: 0 }],
    });
    const key = operationKey("lost-terminal-child-settle");
    const transportErrors: Error[] = [];
    producer.once("error", (error) => transportErrors.push(error));
    producer.connection.stream.pause();
    const pending = queryResponse(producer, "keynes.remote_settle", {
      operationKey: key,
      budgetReference: childReference,
      usage: [{ resource: name, amount: 1 }],
    });
    await expect
      .poll(
        async () =>
          record(
            record(
              await queryResponse(recovery, "keynes.remote_recover_operation", {
                operationKey: key,
              }),
            ).result,
          ).kind,
        { interval: 20, timeout: 2_000 },
      )
      .toBe("committed");
    producer.connection.stream.destroy();
    await expect(pending).rejects.toBeInstanceOf(Error);
    expect(transportErrors).toHaveLength(1);
    const facts = await journalFacts(fixture);
    const recovered = await queryResponse(
      recovery,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );
    expect(recovered).toMatchObject({
      ok: true,
      result: {
        kind: "committed",
        operation: "settleBudget",
        result: { kind: "settled" },
      },
    });
    expect(
      await queryResponse(recovery, "keynes.remote_settle", {
        operationKey: key,
        budgetReference: childReference,
        usage: [{ resource: name, amount: 1 }],
      }),
    ).toMatchObject({ ok: true, result: { replayed: true } });
    expect(await journalFacts(fixture)).toEqual(facts);
    expect(facts).toEqual(
      expect.objectContaining({ settlementReturn: "1", rootRelease: "1" }),
    );
    expect(
      await queryResponse(recovery, "keynes.remote_settle", {
        operationKey: key,
        budgetReference: childReference,
        usage: [{ resource: name, amount: 2 }],
      }),
    ).toMatchObject({ ok: false, error: { code: "command_conflict" } });
    expect(await journalFacts(fixture)).toEqual(facts);
  });

  it("recovers a lost configured creation only after current authorization and selected-definition validation", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const producer = await fixture.connect(fixture.primary);
    const recoveryClient = await fixture.connect(fixture.primary);
    const key = operationKey("configured-lost-response");
    const selectedDefinitions = {
      recoveryUnits: { unit: "unit", accountingBehavior: "consumable" },
      zeroSeats: { unit: "seat", accountingBehavior: "reusable" },
    };
    const clientDeclarations = {
      unusedSeats: { unit: "seat", accountingBehavior: "reusable" },
      ...selectedDefinitions,
    };
    const command = {
      operationKey: key,
      definitions: selectedDefinitions,
      amounts: { recoveryUnits: 7, zeroSeats: 0 },
    };
    expect(
      await queryResponse(producer, "keynes.remote_define_resources", {
        operationKey: operationKey("configured-catalog"),
        definitions: clientDeclarations,
      }),
    ).toMatchObject({ ok: true, result: { kind: "defined" } });
    expect(
      await queryResponse(recoveryClient, "keynes.remote_validate_resources", {
        definitions: clientDeclarations,
      }),
    ).toEqual({ ok: true, result: { valid: true } });

    const transportErrors: Error[] = [];
    producer.once("error", (error) => transportErrors.push(error));
    producer.connection.stream.pause();
    const pending = queryResponse(
      producer,
      "keynes.remote_create_budget",
      command,
    );
    await expect
      .poll(
        async () => {
          const response = record(
            await queryResponse(
              recoveryClient,
              "keynes.remote_recover_operation",
              {
                operationKey: key,
              },
            ),
          );
          return record(response.result).kind;
        },
        { interval: 20, timeout: 2_000 },
      )
      .toBe("committed");
    producer.connection.stream.destroy();
    await expect(pending).rejects.toBeInstanceOf(Error);
    expect(transportErrors).toHaveLength(1);

    const committed = await queryResponse(
      recoveryClient,
      "keynes.remote_recover_operation",
      { operationKey: key },
    );
    const committedResult = record(record(committed).result);
    expect(committedResult).toMatchObject({
      kind: "committed",
      operation: "createBudget",
      result: {
        kind: "created",
        budget: {
          resources: [
            { resource: { canonicalName: "recovery_units" }, allocated: 7 },
            { resource: { canonicalName: "zero_seats" }, allocated: 0 },
          ],
        },
      },
    });
    const beforeDeniedReplay = await authorityCounts(fixture);
    await fixture.administrator.query(
      `delete from keynes_internal.principal_permissions
        where tenant_id = $1 and principal_id = $2
          and permission = 'create_root_budget'`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    expect(
      await queryResponse(recoveryClient, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    expect(await authorityCounts(fixture)).toEqual(beforeDeniedReplay);
    await fixture.administrator.query(
      `insert into keynes_internal.principal_permissions
         (tenant_id, principal_id, permission)
       values ($1, $2, 'create_root_budget')`,
      [fixture.primary.tenantId, fixture.primary.principalId],
    );
    await fixture.administrator.query(
      `update keynes_internal.resource_types
          set definition = jsonb_set(definition, '{unit}', '"changed"'::jsonb)
        where tenant_id = $1 and canonical_name = 'recovery_units'`,
      [fixture.primary.tenantId],
    );
    expect(
      await queryResponse(recoveryClient, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toMatchObject({ ok: false, error: { code: "resource_type_conflict" } });
    expect(await authorityCounts(fixture)).toEqual(beforeDeniedReplay);
    await fixture.administrator.query(
      `update keynes_internal.resource_types
          set definition = jsonb_set(definition, '{unit}', '"unit"'::jsonb)
        where tenant_id = $1 and canonical_name = 'recovery_units'`,
      [fixture.primary.tenantId],
    );
    expect(
      await queryResponse(recoveryClient, "keynes.remote_recover_operation", {
        operationKey: key,
      }),
    ).toEqual(committed);
    expect(
      await queryResponse(recoveryClient, "keynes.remote_create_budget", {
        ...command,
        definitions: {
          recoveryUnits: { unit: "changed", accountingBehavior: "consumable" },
          zeroSeats: selectedDefinitions.zeroSeats,
        },
      }),
    ).toMatchObject({ ok: false, error: { code: "resource_type_conflict" } });
    expect(await authorityCounts(fixture)).toEqual(beforeDeniedReplay);

    const replay = await queryResponse(
      recoveryClient,
      "keynes.remote_create_budget",
      {
        ...command,
      },
    );
    expect(replay).toEqual({
      ok: true,
      result: { ...record(committedResult.result), replayed: true },
    });
    expect(await authorityCounts(fixture)).toEqual(beforeDeniedReplay);
  });

  it("returns known-failure and not-found recovery states without mutation", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const rejectedKey = operationKey("b");
    expect(
      await queryResponse(client, "keynes.remote_define_resources", {
        operationKey: operationKey("failed-definition-catalog"),
        definitions: {
          recoverInvalid: { unit: "token", accountingBehavior: "consumable" },
        },
      }),
    ).toMatchObject({ ok: true, result: { kind: "defined" } });
    const rejected = await queryResponse(
      client,
      "keynes.remote_define_resources",
      {
        operationKey: rejectedKey,
        definitions: {
          addedTokens: { unit: "token", accountingBehavior: "consumable" },
          recoverInvalid: {
            unit: "changed",
            accountingBehavior: "consumable",
          },
        },
      },
    );
    expect(rejected).toMatchObject({ ok: false });
    const before = await authorityCounts(fixture);

    expect(
      await queryResponse(client, "keynes.remote_recover_operation", {
        operationKey: rejectedKey,
      }),
    ).toMatchObject({ ok: true, result: { kind: "known_failure" } });
    expect(
      await queryResponse(client, "keynes.remote_recover_operation", {
        operationKey: operationKey("z"),
      }),
    ).toMatchObject({ ok: true, result: { kind: "not_found" } });
    expect(await authorityCounts(fixture)).toEqual(before);
  });

  it("reports an in-flight mutation as unresolved without changing authority state", async () => {
    fixture = await openRemoteIdentityFixture();
    const operation = operationKey("i");
    const gate = 13_006;
    const blocker = await fixture.connect();
    const mutationClient = await fixture.connect(fixture.primary);
    const recoveryClient = await fixture.connect(fixture.primary);
    let mutation: Promise<unknown> | undefined;

    await installOperationPauseTrigger(fixture, gate);
    await provisionRoot(recoveryClient, "inflight_tokens");
    await blocker.query("begin");
    await blocker.query(`select pg_advisory_xact_lock(${gate})`);
    await mutationClient.query(
      "select set_config('application_name', 'keynes-inflight-mutation', false)",
    );
    await mutationClient.query(
      "select set_config('keynes.test_inflight_operation', $1, false)",
      [operation],
    );

    try {
      mutation = queryResponse(
        mutationClient,
        "keynes.remote_create_budget",
        createRoot(operation, "inflight_tokens"),
      );
      await waitForAdvisoryWait(fixture, "keynes-inflight-mutation");
      const before = await authorityCounts(fixture);

      expect(
        await queryResponse(recoveryClient, "keynes.remote_recover_operation", {
          operationKey: operation,
        }),
      ).toEqual({
        ok: true,
        result: {
          kind: "unresolved",
          operationKey: operation,
          retryAfterMilliseconds: 100,
        },
      });
      expect(await authorityCounts(fixture)).toEqual(before);
    } finally {
      await blocker.query("commit");
      await mutation;
    }
  });

  it("converges concurrent exact retries on one committed mutation", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const operation = operationKey("j");
    const gate = 13_007;
    const blocker = await fixture.connect();
    const firstClient = await fixture.connect(fixture.primary);
    const retryClient = await fixture.connect(fixture.primary);
    let first: Promise<unknown> | undefined;
    let retry: Promise<unknown> | undefined;
    let gateReleased = false;

    await installOperationPauseTrigger(fixture, gate);
    await provisionRoot(retryClient, "concurrent_retry_tokens");
    await blocker.query("begin");
    await blocker.query(`select pg_advisory_xact_lock(${gate})`);
    await firstClient.query(
      "select set_config('application_name', 'keynes-concurrent-first', false)",
    );
    await retryClient.query(
      "select set_config('application_name', 'keynes-concurrent-retry', false)",
    );
    for (const client of [firstClient, retryClient]) {
      await client.query(
        "select set_config('keynes.test_inflight_operation', $1, false)",
        [operation],
      );
    }
    const before = await authorityCounts(fixture);

    try {
      const command = createRoot(operation, "concurrent_retry_tokens");
      first = queryResponse(
        firstClient,
        "keynes.remote_create_budget",
        command,
      );
      await waitForAdvisoryWait(fixture, "keynes-concurrent-first");
      retry = queryResponse(
        retryClient,
        "keynes.remote_create_budget",
        command,
      );
      await waitForAdvisoryWait(fixture, "keynes-concurrent-retry");

      await blocker.query("commit");
      gateReleased = true;
      const [created, replayed] = await Promise.all([first, retry]);

      expect(created).toMatchObject({
        ok: true,
        result: { kind: "created", replayed: false },
      });
      expect(replayed).toMatchObject({
        ok: true,
        result: { kind: "created", replayed: true },
      });
      expect(requireBudgetReference(replayed)).toBe(
        requireBudgetReference(created),
      );
      const after = await authorityCounts(fixture);
      for (const field of ["commands", "budgets", "history", "operations"]) {
        expect(
          authorityCount(after, field) - authorityCount(before, field),
        ).toBe(1);
      }
      expect(
        authorityCount(after, "cursors") - authorityCount(before, "cursors"),
      ).toBe(0);
    } finally {
      if (!gateReleased) await blocker.query("commit");
      await Promise.allSettled(
        [first, retry].filter(
          (operationPromise): operationPromise is Promise<unknown> =>
            operationPromise !== undefined,
        ),
      );
    }
  });

  it("reopens a Budget only for the mapped tenant and exact Resource binding", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    await fixture.register(fixture.secondary);
    const primary = await fixture.connect(fixture.primary);
    const secondary = await fixture.connect(fixture.secondary);
    await provisionRoot(primary, "reopen_tokens");
    const created = await queryResponse(
      primary,
      "keynes.remote_create_budget",
      createRoot(operationKey("c"), "reopen_tokens"),
    );
    const budgetReference = requireBudgetReference(created);

    expect(
      await queryResponse(primary, "keynes.remote_open_budget", {
        budgetReference,
        expectedResources: [resource("reopen_tokens")],
      }),
    ).toMatchObject({ ok: true, result: { budgetReference } });
    expect(
      await queryResponse(primary, "keynes.remote_open_budget", {
        budgetReference,
        expectedResources: [resource("wrong_tokens")],
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "resource_binding_mismatch" },
    });
    const crossTenant = await queryResponse(
      secondary,
      "keynes.remote_open_budget",
      {
        budgetReference,
        expectedResources: [resource("reopen_tokens")],
      },
    );
    expect(crossTenant).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
    expect(JSON.stringify(crossTenant)).not.toMatch(
      /tenant|principal|role_oid|keynes_internal|select/iu,
    );
  });

  it("captures independent repeatable 513-entry observations behind one frozen projection and fence", async () => {
    fixture = await openRemoteIdentityFixture();
    await fixture.register(fixture.primary);
    const client = await fixture.connect(fixture.primary);
    const reader = await fixture.connect(fixture.primary);
    await provisionRoot(client, "history_tokens");
    const created = await queryResponse(
      client,
      "keynes.remote_create_budget",
      createRoot(operationKey("d"), "history_tokens"),
    );
    const budgetReference = requireBudgetReference(created);

    // Fill three history pages with one child allocation and ordinary denials.
    const commands = Array.from({ length: 512 }, (_, index) => ({
      operationKey: indexedOperationKey(index),
      parentBudgetReference: budgetReference,
      resources: [
        { resource: "history_tokens", amount: index === 0 ? 1 : 300 },
      ],
    }));
    const seeded = await client.query<{ readonly response: unknown }>(
      `select keynes.remote_request(command) as response
           from jsonb_array_elements($1::jsonb) with ordinality as commands(command, ordinal)
          order by ordinal`,
      [JSON.stringify(commands)],
    );
    expect(seeded.rows).toHaveLength(commands.length);
    for (const [index, { response }] of seeded.rows.entries()) {
      expect(response).toMatchObject({
        ok: true,
        result: { kind: index === 0 ? "approved" : "denied" },
      });
    }

    const firstResponse = await queryResponse(
      client,
      "keynes.remote_get_budget_history_page",
      { budgetReference },
    );
    const first = requireCapturedPage(firstResponse);
    expect(first.entries).toHaveLength(256);
    expect(first.budget.budgetReference).toBe(budgetReference);
    const cursor = requireCursor(first.nextCursor);
    expect(cursor).toMatch(/^khc_v2_[0-9a-f]{32}_257$/u);
    const snapshot = await capturedInspectionSnapshot(fixture, cursor);
    const authorityPlan = await inspectionPagePlan(fixture, snapshot);
    const historyRange = explainPlanNodes(authorityPlan).find(
      (node) => node["Index Name"] === "budget_history_entries_pkey",
    );
    if (historyRange === undefined) {
      throw new Error(
        "inspection page plan did not use the history stream key",
      );
    }
    expect(historyRange).toMatchObject({
      "Node Type": "Index Scan",
      "Relation Name": "budget_history_entries",
      "Index Name": "budget_history_entries_pkey",
    });
    expect(historyRange["Index Cond"]).toEqual(
      expect.stringContaining("stream_id"),
    );
    expect(historyRange["Index Cond"]).toEqual(
      expect.stringContaining("sequence"),
    );
    const entry = await representativeInspectionEntry(fixture, snapshot);
    const lineagePlan = await inspectionLineagePlan(fixture, snapshot, entry);
    const lineageAccess = requirePlanRelation(
      lineagePlan,
      "budget_history_entries",
      "inspection lineage lookup",
    );
    expect(lineageAccess).toMatchObject({
      "Node Type": "Index Scan",
      "Index Name": "budget_history_entries_pkey",
    });
    expect(lineageAccess["Index Cond"]).toEqual(
      expect.stringContaining("stream_id"),
    );
    expect(lineageAccess["Filter"]).toEqual(
      expect.stringContaining("subject_id"),
    );
    const movementPlan = await inspectionMovementPlan(fixture, snapshot, entry);
    const movementAccess = requirePlanRelation(
      movementPlan,
      "quantity_movements",
      "inspection movement lookup",
    );
    expect(movementAccess).toMatchObject({
      "Node Type": "Index Scan",
      "Index Name": "quantity_movements_child_grant_once_idx",
    });
    expect(movementAccess["Index Cond"]).toEqual(
      expect.stringContaining("destination_budget_id"),
    );
    expect(movementAccess.Filter).toEqual(
      expect.stringContaining("command_id"),
    );
    const resourceAccess = requirePlanRelation(
      movementPlan,
      "resource_types",
      "inspection movement resource lookup",
    );
    expect(resourceAccess["Node Type"]).toEqual(
      expect.stringMatching(/Scan$/u),
    );
    const endpointAccesses = explainPlanNodes(movementPlan).filter(
      (node) => node["Relation Name"] === "budget_history_entries",
    );
    expect(endpointAccesses).toHaveLength(2);
    for (const endpointAccess of endpointAccesses) {
      expect(endpointAccess).toMatchObject({
        "Node Type": "Index Scan",
        "Index Name": "budget_history_entries_pkey",
      });
      expect(endpointAccess["Index Cond"]).toEqual(
        expect.stringContaining("stream_id"),
      );
      expect(endpointAccess["Index Cond"]).toEqual(
        expect.stringContaining("sequence"),
      );
    }
    const secondReader = requireCapturedPage(
      await queryResponse(reader, "keynes.remote_get_budget_history_page", {
        budgetReference,
      }),
    );
    expect(secondReader.budget).toEqual(first.budget);
    expect(secondReader.nextCursor).not.toBe(cursor);
    const secondReaderCursor = requireCursor(secondReader.nextCursor);
    const cursorLifetime = await fixture.administrator.query<{
      readonly future: boolean;
      readonly bounded: boolean;
      readonly expires_at: string;
    }>(
      `select expires_at > clock_timestamp() as future,
                expires_at <= clock_timestamp() + interval '30 minutes 5 seconds' as bounded,
                expires_at::text
           from keynes_internal.remote_inspection_snapshots
          where token = substring($1 from 8 for 32)`,
      [cursor],
    );
    expect(cursorLifetime.rows).toEqual([
      { future: true, bounded: true, expires_at: expect.any(String) },
    ]);
    const expiresAt = cursorLifetime.rows[0]?.expires_at;
    if (expiresAt === undefined) throw new Error("missing capture expiry");
    const jumped = requireCapturedPage(
      await queryResponse(client, "keynes.remote_get_budget_history_page", {
        budgetReference,
        cursor: cursor.replace(/_257$/u, "_513"),
      }),
    );
    expect(jumped.entries.map(entrySequence)).toEqual([513]);
    expect(jumped.nextCursor).toBeNull();
    expect(
      requireCapturedPage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor: cursor.replace(/_257$/u, "_513"),
        }),
      ),
    ).toEqual(jumped);
    const unchangedExpiry = await fixture.administrator.query<{
      readonly expires_at: string;
    }>(
      `select expires_at::text
           from keynes_internal.remote_inspection_snapshots
          where token = substring($1 from 8 for 32)`,
      [cursor],
    );
    expect(unchangedExpiry.rows).toEqual([{ expires_at: expiresAt }]);

    await fixture.administrator.query(
      `insert into keynes_internal.remote_inspection_snapshots (
           token, tenant_id, principal_id, target_budget_id, stream_id,
           budget_projection, terminal_sequence, expires_at
         )
         select lpad(series::text, 32, '0'),
                snapshot.tenant_id, snapshot.principal_id,
                snapshot.target_budget_id, snapshot.stream_id,
                snapshot.budget_projection, snapshot.terminal_sequence,
                clock_timestamp() - interval '1 minute'
           from keynes_internal.remote_inspection_snapshots snapshot
           cross join generate_series(1, 300) series
          where snapshot.token = substring($1 from 8 for 32)`,
      [cursor],
    );
    const expiredBefore = await expiredSnapshotCount(fixture);

    expect(
      await queryResponse(client, "keynes.remote_request", {
        operationKey: indexedOperationKey(512),
        parentBudgetReference: budgetReference,
        resources: [{ resource: "history_tokens", amount: 1 }],
      }),
    ).toMatchObject({ ok: true });
    const [secondResponse, survivorResponse] = await Promise.all([
      queryResponse(client, "keynes.remote_get_budget_history_page", {
        budgetReference,
        cursor,
      }),
      queryResponse(reader, "keynes.remote_get_budget_history_page", {
        budgetReference,
        cursor: secondReaderCursor,
      }),
    ]);
    const second = requireCapturedPage(secondResponse);
    const survivor = requireCapturedPage(survivorResponse);
    expect(survivor).toMatchObject({
      budget: first.budget,
      entries: second.entries,
    });
    expect(survivor.nextCursor).toMatch(/^khc_v2_[0-9a-f]{32}_513$/u);
    expect(survivor.nextCursor).not.toBe(second.nextCursor);
    expect(second.entries).toHaveLength(256);
    expect(second.budget).toEqual(first.budget);
    const secondCursor = requireCursor(second.nextCursor);
    expect(
      requireCapturedPage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor,
        }),
      ),
    ).toEqual(second);
    const expiredAfter = await expiredSnapshotCount(fixture);
    expect(expiredBefore - expiredAfter).toBeGreaterThan(0);
    expect(expiredBefore - expiredAfter).toBeLessThanOrEqual(512);

    const thirdResponse = await queryResponse(
      client,
      "keynes.remote_get_budget_history_page",
      { budgetReference, cursor: secondCursor },
    );
    const third = requireCapturedPage(thirdResponse);
    expect(third.entries).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
    expect(third.budget).toEqual(first.budget);
    expect(
      requireCapturedPage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor: secondCursor,
        }),
      ),
    ).toEqual(third);
    expect(
      [...first.entries, ...second.entries, ...third.entries].map(
        entrySequence,
      ),
    ).toEqual(Array.from({ length: 513 }, (_, index) => index + 1));
    const responseBytes = [
      serializedJsonBytes(firstResponse),
      serializedJsonBytes(secondResponse),
      serializedJsonBytes(thirdResponse),
    ];
    expect(responseBytes[0]).toBeLessThanOrEqual(responseBytes[2] * 256);
    expect(responseBytes[1]).toBeLessThanOrEqual(responseBytes[2] * 256);
    expect(responseBytes[2]).toBeLessThan(responseBytes[0]);
    expect(responseBytes[2]).toBeLessThan(responseBytes[1]);
    await fixture.administrator.query(
      `update keynes_internal.remote_inspection_snapshots
          set expires_at = clock_timestamp() - interval '1 second'
        where token = substring($1 from 8 for 32)`,
      [cursor],
    );
    expect(
      await queryResponse(client, "keynes.remote_get_budget_history_page", {
        budgetReference,
        cursor,
      }),
    ).toMatchObject({ ok: false, error: { code: "invalid_command" } });
    expect(
      requireCapturedPage(
        await queryResponse(reader, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor: secondReaderCursor,
        }),
      ),
    ).toMatchObject({ budget: first.budget });

    const invalidCursors = [
      "khc_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_257",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_0257",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_0",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_-257",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_258",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_9007199254740992",
      "khc_v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_769",
      "khc_v2_ffffffffffffffffffffffffffffffff_257",
    ];
    for (const invalidCursor of invalidCursors) {
      expect(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor: invalidCursor,
        }),
      ).toMatchObject({
        ok: false,
        error: {
          code: "invalid_command",
        },
      });
    }
  }, 20_000);
});

function operationKey(suffix: string): string {
  return `kop_v1_${createHash("sha256").update(suffix).digest("base64url")}`;
}

function indexedOperationKey(index: number): string {
  return `kop_v1_${index.toString(36).padStart(43, "0")}`;
}

type ResourceDefinition = Parameters<
  typeof rootResources
>[0][number]["definition"];

function resource(canonicalName: string): ResourceDefinition {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
}

function createRoot(
  operationKeyValue: string,
  canonicalName: string,
): Record<string, unknown> {
  const key = resourceKey(canonicalName);
  return {
    operationKey: operationKeyValue,
    definitions: {
      [key]: { unit: "token", accountingBehavior: "consumable" },
    },
    amounts: { [key]: 300 },
  };
}

async function provisionRoot(
  client: Client,
  canonicalName: string,
): Promise<void> {
  const key = resourceKey(canonicalName);
  expect(
    await queryResponse(client, "keynes.remote_define_resources", {
      operationKey: operationKey(`catalog-${canonicalName}`),
      definitions: {
        [key]: { unit: "token", accountingBehavior: "consumable" },
      },
    }),
  ).toMatchObject({ ok: true, result: { kind: "defined" } });
}

function resourceKey(canonicalName: string): string {
  return canonicalName.replace(/_([a-z])/gu, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function requireBudgetReference(value: unknown): string {
  const envelope = record(value);
  const result = record(envelope.result);
  const budget = record(result.budget);
  const reference = budget.budgetReference;
  if (typeof reference !== "string") {
    throw new Error("remote create did not return a Budget reference");
  }
  return reference;
}

function requireChildBudgetReference(value: unknown): string {
  const reference = record(record(value).result).childBudgetReference;
  if (typeof reference !== "string")
    throw new Error("remote request did not return a child Budget reference");
  return reference;
}

interface HistoryPage {
  readonly entries: readonly unknown[];
  readonly nextCursor: string | null;
}

interface CapturedHistoryPage extends HistoryPage {
  readonly budget: Record<string, unknown>;
}

interface InspectionSnapshot {
  readonly tenantId: string;
  readonly streamId: string;
  readonly terminalSequence: string;
}

interface InspectionHistoryEntry {
  readonly commandId: string;
  readonly eventKind: string;
  readonly subjectId: string;
}

async function capturedInspectionSnapshot(
  fixture: RemoteIdentityFixture,
  cursor: string,
): Promise<InspectionSnapshot> {
  const result = await fixture.administrator.query<{
    readonly tenant_id: string;
    readonly stream_id: string;
    readonly terminal_sequence: string;
  }>(
    `select tenant_id::text, stream_id::text, terminal_sequence::text
       from keynes_internal.remote_inspection_snapshots
      where token = substring($1 from 8 for 32)`,
    [cursor],
  );
  const snapshot = result.rows[0];
  if (snapshot === undefined) throw new Error("missing inspection snapshot");
  return {
    tenantId: snapshot.tenant_id,
    streamId: snapshot.stream_id,
    terminalSequence: snapshot.terminal_sequence,
  };
}

async function inspectionPagePlan(
  fixture: RemoteIdentityFixture,
  snapshot: InspectionSnapshot,
): Promise<Record<string, unknown>> {
  return explainPlan(
    fixture,
    `select count(*)::integer,
              coalesce(jsonb_agg(
                keynes_internal.remote_inspection_history_entry_v0006(
                  $1::uuid, page.payload
                ) order by page.sequence
              ) filter (where page.ordinal <= 256), '[]'::jsonb)
         from (
           select history.sequence,
                  history.payload || jsonb_build_object(
                    'rootBudgetId', $2::uuid::text,
                    'terminalSequence', $3::bigint
                  ) as payload,
                  row_number() over (order by history.sequence) as ordinal
             from keynes_internal.budget_history_entries history
            where history.tenant_id = $1::uuid
              and history.stream_id = $2::uuid
              and history.sequence >= 1
              and history.sequence <= $3::bigint
            order by history.sequence
            limit 257
         ) page`,
    [snapshot.tenantId, snapshot.streamId, snapshot.terminalSequence],
  );
}

async function representativeInspectionEntry(
  fixture: RemoteIdentityFixture,
  snapshot: InspectionSnapshot,
): Promise<InspectionHistoryEntry> {
  const result = await fixture.administrator.query<{
    readonly command_id: string;
    readonly event_kind: string;
    readonly subject_id: string;
  }>(
    `select command_id::text, event_kind, subject_id::text
       from keynes_internal.budget_history_entries
      where tenant_id = $1::uuid
        and stream_id = $2::uuid
        and event_kind = 'request_approved'
        and sequence <= $3::bigint
      order by sequence
      limit 1`,
    [snapshot.tenantId, snapshot.streamId, snapshot.terminalSequence],
  );
  const entry = result.rows[0];
  if (entry === undefined) throw new Error("missing approved history entry");
  return {
    commandId: entry.command_id,
    eventKind: entry.event_kind,
    subjectId: entry.subject_id,
  };
}

async function inspectionLineagePlan(
  fixture: RemoteIdentityFixture,
  snapshot: InspectionSnapshot,
  entry: InspectionHistoryEntry,
): Promise<Record<string, unknown>> {
  return explainPlan(
    fixture,
    `select history.sequence
       from keynes_internal.budget_history_entries history
      where history.tenant_id = $1::uuid
        and history.stream_id = $2::uuid
        and history.subject_id = $3::uuid
        and history.event_kind in ('budget_created', 'request_approved')
        and history.sequence <= $4::bigint`,
    [
      snapshot.tenantId,
      snapshot.streamId,
      entry.subjectId,
      snapshot.terminalSequence,
    ],
  );
}

async function inspectionMovementPlan(
  fixture: RemoteIdentityFixture,
  snapshot: InspectionSnapshot,
  entry: InspectionHistoryEntry,
): Promise<Record<string, unknown>> {
  return explainPlan(
    fixture,
    `select movement.amount,
            resource.canonical_name,
            source_lineage.sequence as source_lineage_id,
            destination_lineage.sequence as destination_lineage_id
       from keynes_internal.quantity_movements movement
       join keynes_internal.resource_types resource
         on resource.tenant_id = movement.tenant_id
        and resource.resource_type_id = movement.resource_type_id
       left join keynes_internal.budget_history_entries source_lineage
         on source_lineage.tenant_id = movement.tenant_id
        and source_lineage.stream_id = $2::uuid
        and source_lineage.subject_id = movement.source_budget_id
        and source_lineage.event_kind in ('budget_created', 'request_approved')
        and source_lineage.sequence <= $5::bigint
       left join keynes_internal.budget_history_entries destination_lineage
         on destination_lineage.tenant_id = movement.tenant_id
        and destination_lineage.stream_id = $2::uuid
        and destination_lineage.subject_id = movement.destination_budget_id
        and destination_lineage.event_kind in ('budget_created', 'request_approved')
        and destination_lineage.sequence <= $5::bigint
      where movement.tenant_id = $1::uuid
        and movement.root_budget_id = $2::uuid
        and movement.command_id = $3::uuid
        and (
          ($4::text = 'budget_created'
           and movement.reason = 'initial_allocation'
           and movement.destination_budget_id = $6::uuid)
          or ($4::text = 'request_approved'
              and movement.reason = 'child_grant'
              and movement.destination_budget_id = $6::uuid)
          or ($4::text = 'budget_settlement_recorded'
              and movement.reason = 'consumption'
              and movement.source_budget_id = $6::uuid)
          or ($4::text = 'budget_settlement_recorded'
              and movement.reason in ('settlement_return', 'root_release')
              and movement.source_budget_id = $6::uuid)
        )`,
    [
      snapshot.tenantId,
      snapshot.streamId,
      entry.commandId,
      entry.eventKind,
      snapshot.terminalSequence,
      entry.subjectId,
    ],
  );
}

async function explainPlan(
  fixture: RemoteIdentityFixture,
  statement: string,
  values: unknown[],
): Promise<Record<string, unknown>> {
  const result = await fixture.administrator.query<{
    readonly "QUERY PLAN": unknown;
  }>(`explain (format json, costs false, verbose) ${statement}`, values);
  const plan = result.rows[0]?.["QUERY PLAN"];
  if (!Array.isArray(plan) || plan.length !== 1) {
    throw new Error("inspection page EXPLAIN did not return one plan");
  }
  return record(record(plan[0]).Plan);
}

function requirePlanRelation(
  plan: Record<string, unknown>,
  relation: string,
  description: string,
): Record<string, unknown> {
  const access = explainPlanNodes(plan).find(
    (node) => node["Relation Name"] === relation,
  );
  if (access === undefined) {
    throw new Error(`${description} did not access ${relation}`);
  }
  return access;
}

function explainPlanNodes(
  node: Record<string, unknown>,
): readonly Record<string, unknown>[] {
  const children = node.Plans;
  return [
    node,
    ...(Array.isArray(children)
      ? children.flatMap((child) => explainPlanNodes(record(child)))
      : []),
  ];
}

function serializedJsonBytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("response is not JSON");
  return Buffer.byteLength(serialized, "utf8");
}

function requirePage(value: unknown): HistoryPage {
  const envelope = record(value);
  const result = record(envelope.result);
  if (
    !Array.isArray(result.entries) ||
    (result.nextCursor !== null && typeof result.nextCursor !== "string")
  ) {
    throw new Error("remote history did not return a bounded page");
  }
  return { entries: result.entries, nextCursor: result.nextCursor };
}

function requireCapturedPage(value: unknown): CapturedHistoryPage {
  const page = requirePage(value);
  const budget = record(record(value).result).budget;
  if (typeof budget !== "object" || budget === null || Array.isArray(budget)) {
    throw new Error(
      "remote history did not return a captured inspection projection",
    );
  }
  return { ...page, budget: record(budget) };
}

function requireCursor(value: string | null): string {
  if (value === null) throw new Error("remote history did not return a cursor");
  return value;
}

function entrySequence(value: unknown): number {
  const entry = record(value);
  if (typeof entry.sequence !== "number") {
    throw new Error("remote history entry has no sequence");
  }
  return entry.sequence;
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("expected record");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorityCounts(
  fixture: RemoteIdentityFixture,
): Promise<readonly Record<string, string>[]> {
  const result = await fixture.administrator.query<Record<string, string>>(
    `select
       (select count(*)::text from keynes_internal.commands) as commands,
       (select count(*)::text from keynes_internal.budgets) as budgets,
       (select count(*)::text from keynes_internal.budget_history_entries) as history,
       (select count(*)::text from keynes_internal.remote_operations) as operations,
       (select count(*)::text from keynes_internal.remote_inspection_snapshots) as cursors`,
  );
  return result.rows;
}

async function journalFacts(
  fixture: RemoteIdentityFixture,
): Promise<Record<string, string>> {
  const result = await fixture.administrator.query<
    Record<string, string>
  >(`select
    (select count(*)::text from keynes_internal.quantity_movements) as movements,
    (select count(*)::text from keynes_internal.quantity_movements where reason = 'settlement_return') as "settlementReturn",
    (select count(*)::text from keynes_internal.quantity_movements where reason = 'root_release') as "rootRelease"`);
  const facts = result.rows[0];
  if (facts === undefined) throw new Error("journal facts unavailable");
  return facts;
}

function authorityCount(
  counts: readonly Record<string, string>[],
  field: string,
): number {
  const value = counts[0]?.[field];
  if (value === undefined || !/^\d+$/u.test(value)) {
    throw new Error(`authority count ${field} is unavailable`);
  }
  return Number(value);
}

async function installOperationPauseTrigger(
  fixture: RemoteIdentityFixture,
  gate: number,
): Promise<void> {
  await fixture.administrator.query(
    `create function keynes_internal.pause_remote_operation_test_v0006()
     returns trigger language plpgsql
     set search_path = pg_catalog, keynes_internal
     as $function$
     begin
       if new.operation_key = current_setting('keynes.test_inflight_operation', true) then
         perform pg_advisory_xact_lock(${gate});
       end if;
       return new;
     end;
     $function$;
     create trigger pause_remote_operation_test_v0006
     before insert on keynes_internal.remote_operations
     for each row execute function keynes_internal.pause_remote_operation_test_v0006()`,
  );
}

async function waitForAdvisoryWait(
  fixture: RemoteIdentityFixture,
  applicationName: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await fixture.administrator.query<{
      readonly waiting: boolean;
    }>(
      `select exists (
         select 1 from pg_stat_activity
          where application_name = $1
            and wait_event_type = 'Lock'
            and wait_event = 'advisory'
       ) as waiting`,
      [applicationName],
    );
    if (result.rows[0]?.waiting === true) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("remote mutation did not reach the in-flight checkpoint");
}

async function expiredSnapshotCount(
  fixture: RemoteIdentityFixture,
): Promise<number> {
  const result = await fixture.administrator.query<{
    readonly count: number;
  }>(
    `select count(*)::int as count
       from keynes_internal.remote_inspection_snapshots
      where expires_at <= clock_timestamp()`,
  );
  return result.rows[0]?.count ?? 0;
}
