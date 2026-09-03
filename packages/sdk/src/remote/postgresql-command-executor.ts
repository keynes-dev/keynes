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
import type {
  CompatibilityErrorEnvelope,
  GetCompatibilityResult,
  OperationKey,
  RemoteErrorEnvelope,
  RemoteMutationName,
} from "../generated/types.js";

export const POSTGRESQL_WAITING_CALLERS_MAXIMUM = 100;
export const POSTGRESQL_CLOSE_TIMEOUT_MILLISECONDS = 10_000;
export const POSTGRESQL_INSTALLATION_ID = "embedded-postgresql-18.6-preview";

const operationKeyPattern = /^kop_v1_[A-Za-z0-9_-]{43}$/u;

type ExecutorState = "open" | "closing" | "closed";
type FailurePhase = "acquire" | "query";

interface RemoteWireError {
  readonly ok: false;
  readonly error: RemoteErrorEnvelope;
}

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
      throw unknownFailure();
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
        () => simpleFailure("unknown"),
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

function remoteFailure(error: RemoteErrorEnvelope): RemoteWireError {
  return { ok: false, error };
}

function simpleFailure(
  code: "authentication_failed" | "client_closed" | "tls_error" | "unknown",
): RemoteWireError {
  return remoteFailure({ kind: "error", code, details: {} });
}

function unavailableFailure(): RemoteWireError {
  return remoteFailure({
    kind: "error",
    code: "unavailable",
    details: {},
  });
}

function compatibilityFailure(
  category: CompatibilityErrorEnvelope["details"]["category"],
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "compatibility_error",
    details: { category },
  });
}

function unknownFailure(): KeynesError {
  return new KeynesError({ kind: "error", code: "unknown", details: {} });
}

function errorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isTlsFailure(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "CERT_HAS_EXPIRED" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_GET_ISSUER_CERT" ||
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code?.startsWith("ERR_SSL_") === true ||
    code?.startsWith("ERR_TLS_") === true ||
    (error instanceof Error &&
      (error.message === "The server does not support SSL connections" ||
        error.message === "There was an error establishing an SSL connection"))
  );
}

function isTimeoutFailure(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "57014" ||
    code === "ERR_SOCKET_CONNECTION_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    (error instanceof Error &&
      (error.message === "Query read timeout" ||
        error.message === "timeout exceeded when trying to connect" ||
        error.message === "Connection terminated due to connection timeout"))
  );
}

function isConnectionFailure(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "EPIPE" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code?.startsWith("08") === true
  );
}

function operationKey(input: unknown): OperationKey | undefined {
  if (!isRecord(input)) return undefined;
  const value = input.operationKey;
  return typeof value === "string" && operationKeyPattern.test(value)
    ? value
    : undefined;
}

function uncertainFailure(
  operation: RemoteMutationName,
  key: OperationKey,
): RemoteWireError {
  return remoteFailure({
    kind: "error",
    code: "uncertain_outcome",
    details: { operation, operationKey: key },
  });
}

function closeFailure(
  procedure: RemoteProcedureDescriptor,
  input: unknown,
): RemoteWireError {
  const key = operationKey(input);
  return procedure.mode === "mutation" && key !== undefined
    ? uncertainFailure(procedure.method, key)
    : simpleFailure("client_closed");
}

function projectDriverFailure(
  error: unknown,
  procedure: RemoteProcedureDescriptor,
  input: unknown,
  phase: FailurePhase,
  closing: boolean,
): RemoteWireError {
  const code = errorCode(error);
  const key = operationKey(input);

  if (isTlsFailure(error)) return simpleFailure("tls_error");
  if (code?.startsWith("28") === true) {
    return simpleFailure("authentication_failed");
  }
  if (code === "42501") {
    return remoteFailure({
      kind: "error",
      code: "unauthorized",
      details: {
        operation: procedure.method,
        requiredPermission: "remote_access",
      },
    });
  }
  if (code === "3F000" || code === "42883") {
    return remoteFailure({
      kind: "error",
      code: "compatibility_error",
      details: { category: "remote_procedures" },
    });
  }

  const uncertainMutation =
    phase === "query" && procedure.mode === "mutation" && key !== undefined;
  if (
    uncertainMutation &&
    (closing || isConnectionFailure(error) || isTimeoutFailure(error))
  ) {
    return uncertainFailure(procedure.method, key);
  }
  if (isTimeoutFailure(error)) {
    return remoteFailure({
      kind: "error",
      code: "timeout",
      details: {
        operation: procedure.method,
        ...(key === undefined ? {} : { operationKey: key }),
      },
    });
  }
  if (isConnectionFailure(error) || code === "40001" || code === "40P01") {
    return unavailableFailure();
  }
  return simpleFailure("unknown");
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
      return Promise.resolve(simpleFailure("client_closed"));
    }
    const procedure = resolveProcedure(requestedProcedure);
    if (procedure === undefined) {
      return Promise.resolve(simpleFailure("unknown"));
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
      closeFailure(procedure, input),
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
      return projectDriverFailure(
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
      return isWireResponse(response) ? response : simpleFailure("unknown");
    } catch (error: unknown) {
      return projectDriverFailure(
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
    throw unknownFailure();
  }
}
