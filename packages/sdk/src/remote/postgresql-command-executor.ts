import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResultRow,
} from "pg";

import {
  CONTRACT_DIGEST,
  createRemoteKeynesClient,
  KeynesError,
  REMOTE_CONTRACT,
  REMOTE_PROCEDURES_DIGEST,
  type RemoteCommandExecutor,
  type RemoteProcedureDescriptor,
} from "../generated/client.js";
import { POLICY_PROFILE_DIGEST } from "../generated/policy-profile.js";
import type { GetCompatibilityResult } from "../generated/types.js";
import {
  closeRemoteFailure,
  compatibilityFailure,
  projectPostgresqlFailure,
  remoteFailure,
  simpleRemoteFailure,
  unknownRemoteFailure,
} from "./errors.js";

export const POSTGRESQL_WAITING_CALLERS_MAXIMUM = 100;
export const POSTGRESQL_CLOSE_TIMEOUT_MILLISECONDS = 10_000;
export const POSTGRESQL_INSTALLATION_ID = "embedded-postgresql-18.3-preview";

type ExecutorState = "open" | "closing" | "closed";

interface ResponseRow extends QueryResultRow {
  readonly response: unknown;
}

class PoolLease {
  readonly client: PoolClient;
  #released = false;

  constructor(client: PoolClient) {
    this.client = client;
  }

  release(destroy = false): void {
    if (this.#released) return;
    this.#released = true;
    try {
      this.client.release(destroy);
    } catch {
      throw unknownRemoteFailure();
    }
  }
}

class AdmittedCall {
  readonly result: Promise<unknown>;
  #finishClose: (() => void) | undefined;

  constructor(operation: Promise<unknown>, closeResult: unknown) {
    const closed = new Promise<unknown>((resolve) => {
      this.#finishClose = () => resolve(closeResult);
    });
    this.result = Promise.race([
      operation.then(
        (result) => result,
        () => simpleRemoteFailure("unknown"),
      ),
      closed,
    ]);
  }

  finishClose(): void {
    this.#finishClose?.();
    this.#finishClose = undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveProcedure(
  procedure: RemoteProcedureDescriptor,
): RemoteProcedureDescriptor | undefined {
  if (!isRecord(procedure)) return undefined;
  return REMOTE_CONTRACT.procedures.find(
    (candidate) =>
      procedure.method === candidate.method &&
      procedure.target === candidate.target &&
      procedure.revision === candidate.revision &&
      procedure.mode === candidate.mode &&
      procedure.input === candidate.input &&
      procedure.output === candidate.output,
  );
}

function isWireResponse(value: unknown): boolean {
  return isRecord(value) && typeof value.ok === "boolean";
}

function verifyCompatibility(result: GetCompatibilityResult): void {
  if (result.installationId !== POSTGRESQL_INSTALLATION_ID) {
    throw compatibilityFailure("installation");
  }
  if (
    result.contractDigest !== CONTRACT_DIGEST ||
    result.semanticGeneration !== REMOTE_CONTRACT.semanticGeneration
  ) {
    throw compatibilityFailure("command_contract");
  }
  if (result.policyProfileDigest !== POLICY_PROFILE_DIGEST) {
    throw compatibilityFailure("policy_profile");
  }
  if (result.remoteProceduresDigest !== REMOTE_PROCEDURES_DIGEST) {
    throw compatibilityFailure("remote_procedures");
  }
  if (result.minimumSdkGeneration > REMOTE_CONTRACT.minimumSdkGeneration) {
    throw compatibilityFailure("sdk_generation");
  }
  if (
    result.procedures.length !== REMOTE_CONTRACT.procedures.length ||
    result.procedures.some((capability, index) => {
      const required = REMOTE_CONTRACT.procedures[index];
      return (
        required === undefined ||
        capability.name !== required.method ||
        capability.target !== required.target ||
        capability.revision !== required.revision
      );
    })
  ) {
    throw compatibilityFailure("remote_procedures");
  }
}

async function settlesWithin(
  promises: readonly Promise<unknown>[],
  milliseconds: number,
): Promise<boolean> {
  if (promises.length === 0) return true;
  if (milliseconds <= 0) return false;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<false>((resolve) => {
    timeout = setTimeout(() => resolve(false), milliseconds);
  });
  try {
    return await Promise.race([
      Promise.allSettled(promises).then(() => true as const),
      elapsed,
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export class PostgresqlCommandExecutor implements RemoteCommandExecutor {
  readonly #pool: Pool;
  readonly #admitted = new Set<AdmittedCall>();
  readonly #leases = new Set<PoolLease>();
  #state: ExecutorState = "open";
  #closePromise: Promise<void> | undefined;

  constructor(pool: Pool) {
    this.#pool = pool;
    this.#pool.on("error", () => undefined);
  }

  execute(
    requestedProcedure: RemoteProcedureDescriptor,
    input: unknown,
  ): Promise<unknown> {
    if (this.#state === "closing" || this.#state === "closed") {
      return Promise.resolve(simpleRemoteFailure("client_closed"));
    }
    const procedure = resolveProcedure(requestedProcedure);
    if (procedure === undefined) {
      return Promise.resolve(simpleRemoteFailure("unknown"));
    }
    if (this.#pool.waitingCount >= POSTGRESQL_WAITING_CALLERS_MAXIMUM) {
      return Promise.resolve(
        remoteFailure({
          kind: "error",
          code: "limit_exceeded",
          details: {
            limit: "waiting_callers",
            maximum: POSTGRESQL_WAITING_CALLERS_MAXIMUM,
          },
        }),
      );
    }

    const admitted = new AdmittedCall(
      this.#executeAdmitted(procedure, input),
      closeRemoteFailure(procedure, input),
    );
    this.#admitted.add(admitted);
    void admitted.result.then(
      () => this.#admitted.delete(admitted),
      () => this.#admitted.delete(admitted),
    );
    return admitted.result;
  }

  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#state = "closing";
    this.#closePromise = this.#close();
    return this.#closePromise;
  }

  async #executeAdmitted(
    procedure: RemoteProcedureDescriptor,
    input: unknown,
  ): Promise<unknown> {
    let client: PoolClient;
    try {
      client = await this.#pool.connect();
    } catch (error: unknown) {
      return projectPostgresqlFailure(
        error,
        procedure,
        input,
        "acquire",
        this.#state === "closing" || this.#state === "closed",
      );
    }

    const lease = new PoolLease(client);
    this.#leases.add(lease);
    try {
      const result = await client.query<ResponseRow>({
        text: `select ${procedure.target}($1::jsonb) as response`,
        values: [JSON.stringify(input)],
      });
      const response =
        result.rows.length === 1 ? result.rows[0]?.response : null;
      return isWireResponse(response)
        ? response
        : simpleRemoteFailure("unknown");
    } catch (error: unknown) {
      return projectPostgresqlFailure(
        error,
        procedure,
        input,
        "query",
        this.#state === "closing" || this.#state === "closed",
      );
    } finally {
      this.#leases.delete(lease);
      lease.release();
    }
  }

  async #close(): Promise<void> {
    const deadline = Date.now() + POSTGRESQL_CLOSE_TIMEOUT_MILLISECONDS;
    try {
      const drained = await settlesWithin(
        [...this.#admitted].map((call) => call.result),
        deadline - Date.now(),
      );
      if (!drained) {
        for (const call of this.#admitted) call.finishClose();
        for (const lease of this.#leases) lease.release(true);
      }

      const poolClosed = Promise.resolve()
        .then(() => this.#pool.end())
        .then(
          () => undefined,
          () => undefined,
        );
      await settlesWithin([poolClosed], deadline - Date.now());
    } finally {
      this.#state = "closed";
    }
  }
}

export async function openPostgresqlCommandExecutor(
  poolConfig: PoolConfig,
): Promise<PostgresqlCommandExecutor> {
  let pool: Pool;
  try {
    pool = new Pool(poolConfig);
  } catch {
    throw new KeynesError({ kind: "error", code: "unknown", details: {} });
  }

  const executor = new PostgresqlCommandExecutor(pool);
  try {
    const compatibility = await createRemoteKeynesClient(
      executor,
    ).getCompatibility({});
    verifyCompatibility(compatibility);
    return executor;
  } catch (error: unknown) {
    await executor.close();
    if (error instanceof KeynesError) throw error;
    throw unknownRemoteFailure();
  }
}
