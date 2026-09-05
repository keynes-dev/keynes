import { afterEach, describe, expect, it } from "vitest";

import { POSTGRESQL_SYSTEM_CONTEXT_ENV } from "./run.js";
import {
  openRemoteIdentityFixture,
  queryResponse,
  type RemoteIdentityFixture,
} from "./support/remote-identity.js";

describe.skipIf(process.env[POSTGRESQL_SYSTEM_CONTEXT_ENV] === undefined)(
  "remote PostgreSQL recovery and bounded reads",
  () => {
    let fixture: RemoteIdentityFixture | undefined;

    afterEach(async () => {
      await fixture?.close();
      fixture = undefined;
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
          policyProfileDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
          remoteProceduresDigest: expect.stringMatching(/^[0-9a-f]{64}$/u),
          semanticGeneration: 1,
          minimumSdkGeneration: 1,
          procedures: expect.arrayContaining([
            expect.objectContaining({
              name: "getCompatibility",
              target: "keynes.remote_get_compatibility",
              revision: 1,
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

    it("recovers a committed mutation after its transport response is lost", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const mutationClient = await fixture.connect(fixture.primary);
      const recoveryClient = await fixture.connect(fixture.primary);
      const key = operationKey("l");
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

    it("returns known-failure and expired recovery states without mutation", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
      const rejectedKey = operationKey("b");
      const rejected = await queryResponse(
        client,
        "keynes.remote_create_budget",
        {
          operationKey: rejectedKey,
          resources: [
            {
              definition: resource("recover_invalid"),
              amount: 0,
            },
          ],
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
      ).toMatchObject({ ok: true, result: { kind: "expired" } });
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
          await queryResponse(
            recoveryClient,
            "keynes.remote_recover_operation",
            { operationKey: operation },
          ),
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

    it("paginates one bounded history snapshot with expiring single-use cursors", async () => {
      fixture = await openRemoteIdentityFixture();
      await fixture.register(fixture.primary);
      const client = await fixture.connect(fixture.primary);
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

      const first = requirePage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
        }),
      );
      expect(first.entries).toHaveLength(256);
      expect(first.nextCursor).toEqual(expect.any(String));
      const cursor = requireCursor(first.nextCursor);
      const expiredCursor = `khc_v1_z${"300".padStart(42, "0")}`;
      const cursorLifetime = await fixture.administrator.query<{
        readonly future: boolean;
        readonly bounded: boolean;
      }>(
        `select expires_at > clock_timestamp() as future,
                expires_at <= clock_timestamp() + interval '30 minutes 5 seconds' as bounded
           from keynes_internal.remote_history_cursors
          where cursor_value = $1`,
        [cursor],
      );
      expect(cursorLifetime.rows).toEqual([{ future: true, bounded: true }]);

      await fixture.administrator.query(
        `insert into keynes_internal.remote_history_cursors (
           cursor_value, tenant_id, stream_id, next_sequence,
           terminal_sequence, expires_at
         )
         select 'khc_v1_z' || lpad(series::text, 42, '0'),
                cursor.tenant_id, cursor.stream_id, 1000 + series,
                2000 + series,
                clock_timestamp() - interval '1 minute'
           from keynes_internal.remote_history_cursors cursor
           cross join generate_series(1, 300) series
          where cursor.cursor_value = $1`,
        [cursor],
      );
      const expiredBefore = await expiredCursorCount(fixture);

      expect(
        await queryResponse(client, "keynes.remote_request", {
          operationKey: indexedOperationKey(512),
          parentBudgetReference: budgetReference,
          resources: [{ resource: "history_tokens", amount: 1 }],
        }),
      ).toMatchObject({ ok: true });
      const second = requirePage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor,
        }),
      );
      expect(second.entries).toHaveLength(256);
      expect(second.nextCursor).toEqual(expect.any(String));
      const secondCursor = requireCursor(second.nextCursor);
      const expiredAfter = await expiredCursorCount(fixture);
      expect(expiredBefore - expiredAfter).toBeGreaterThan(0);
      expect(expiredBefore - expiredAfter).toBeLessThanOrEqual(256);
      expect(expiredAfter).toBeGreaterThan(0);

      const third = requirePage(
        await queryResponse(client, "keynes.remote_get_budget_history_page", {
          budgetReference,
          cursor: secondCursor,
        }),
      );
      expect(third.entries).toHaveLength(1);
      expect(third.nextCursor).toBeNull();
      expect(
        [...first.entries, ...second.entries, ...third.entries].map(
          entrySequence,
        ),
      ).toEqual(Array.from({ length: 513 }, (_, index) => index + 1));

      for (const invalidCursor of [cursor, expiredCursor]) {
        expect(
          await queryResponse(client, "keynes.remote_get_budget_history_page", {
            budgetReference,
            cursor: invalidCursor,
          }),
        ).toMatchObject({
          ok: false,
          error: {
            code: "invalid_command",
            details: {
              operation: "getBudgetHistoryPage",
              issues: [{ path: "$.cursor", rule: "format" }],
            },
          },
        });
      }
    });
  },
);

function operationKey(suffix: string): string {
  return `kop_v1_${suffix.repeat(43)}`;
}

function indexedOperationKey(index: number): string {
  return `kop_v1_${index.toString(36).padStart(43, "0")}`;
}

function resource(canonicalName: string): Record<string, string> {
  return { canonicalName, unit: "token", accountingBehavior: "consumable" };
}

function createRoot(
  operationKeyValue: string,
  canonicalName: string,
): Record<string, unknown> {
  return {
    operationKey: operationKeyValue,
    resources: [{ definition: resource(canonicalName), amount: 300 }],
  };
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

interface HistoryPage {
  readonly entries: readonly unknown[];
  readonly nextCursor: string | null;
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
       (select count(*)::text from keynes_internal.remote_history_cursors) as cursors`,
  );
  return result.rows;
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

async function expiredCursorCount(
  fixture: RemoteIdentityFixture,
): Promise<number> {
  const result = await fixture.administrator.query<{
    readonly count: number;
  }>(
    `select count(*)::int as count
       from keynes_internal.remote_history_cursors
      where expires_at <= clock_timestamp()`,
  );
  return result.rows[0]?.count ?? 0;
}
