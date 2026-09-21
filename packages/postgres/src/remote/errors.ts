import { KeynesError, type RemoteProcedureDescriptor } from "@keynes/sdk";
import type {
  CompatibilityErrorEnvelope,
  RemoteErrorEnvelope,
  RemoteMutationName,
  RemoteSimpleErrorEnvelope,
} from "@keynes/sdk";

export type PostgresqlFailurePhase = "acquire" | "query";

export interface RemoteWireError {
  readonly ok: false;
  readonly error: RemoteErrorEnvelope;
}

const operationKeyPattern = /^kop_v1_[A-Za-z0-9_-]{43}$/u;

export function remoteFailure(error: RemoteErrorEnvelope): RemoteWireError {
  return { ok: false, error };
}

export function simpleRemoteFailure(
  code: RemoteSimpleErrorEnvelope["code"],
): RemoteWireError {
  return remoteFailure({ kind: "error", code, details: {} });
}

export function compatibilityFailure(
  category: CompatibilityErrorEnvelope["details"]["category"],
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "compatibility_error",
    details: { category },
  });
}

export function unknownRemoteFailure(): KeynesError {
  return new KeynesError({ kind: "error", code: "unknown", details: {} });
}

export function closeRemoteFailure(
  procedure: RemoteProcedureDescriptor,
  input: unknown,
): RemoteWireError {
  const key = operationKey(input);
  return procedure.mode === "mutation" && key !== undefined
    ? uncertainFailure(procedure.method, key)
    : simpleRemoteFailure("client_closed");
}

export function projectPostgresqlFailure(
  error: unknown,
  procedure: RemoteProcedureDescriptor,
  input: unknown,
  phase: PostgresqlFailurePhase,
  closing: boolean,
): RemoteWireError {
  const code = errorCode(error);
  const key = operationKey(input);

  if (isTlsFailure(error)) return simpleRemoteFailure("tls_error");
  if (code?.startsWith("28") === true) {
    return simpleRemoteFailure("authentication_failed");
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
  if (code === "57014") {
    return remoteFailure({
      kind: "error",
      code: "timeout",
      details: {
        operation: procedure.method,
        ...(key === undefined ? {} : { operationKey: key }),
      },
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
  if (code === "53300") {
    return remoteFailure({ kind: "error", code: "rate_limited", details: {} });
  }
  if (isConnectionFailure(error) || code === "40001" || code === "40P01") {
    return remoteFailure({ kind: "error", code: "unavailable", details: {} });
  }
  return simpleRemoteFailure("unknown");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    code?.startsWith("08") === true ||
    (error instanceof Error &&
      (error.message === "Connection terminated unexpectedly" ||
        error.message === "Connection terminated"))
  );
}

function operationKey(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  const value = input.operationKey;
  return typeof value === "string" && operationKeyPattern.test(value)
    ? value
    : undefined;
}

function uncertainFailure(
  operation: RemoteMutationName,
  key: string,
): RemoteWireError {
  return remoteFailure({
    kind: "error",
    code: "uncertain_outcome",
    details: { operation, operationKey: key },
  });
}
