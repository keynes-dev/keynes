import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import type {
  AuthenticateBearer,
  AuthenticatedIdentity,
} from "./authentication.ts";
import { DatabaseUnavailableError } from "./postgresql-database.ts";
import { type OperationName, PROCEDURES } from "./generated/procedures.ts";

export interface ServiceLimits {
  readonly maxBodyBytes: number;
  readonly requestTimeoutMs: number;
  readonly drainTimeoutMs: number;
}

export const SERVICE_LIMITS: ServiceLimits = {
  maxBodyBytes: 64 * 1024,
  requestTimeoutMs: 5_000,
  drainTimeoutMs: 5_000,
};

export interface AuthenticatedCommand {
  readonly identity: AuthenticatedIdentity;
  readonly operation: OperationName;
  readonly input: unknown;
}

export interface PostCommitContext {
  readonly request: AuthenticatedCommand;
  readonly response: ServerResponse;
}

export interface CloudServiceOptions {
  readonly port: number;
  readonly authenticate: AuthenticateBearer;
  readonly invoke: (request: AuthenticatedCommand) => Promise<unknown>;
  readonly limits: ServiceLimits;
  readonly afterCommit?: (context: PostCommitContext) => void | Promise<void>;
}

export interface RunningCloudService {
  readonly origin: string;
  close(): Promise<void>;
}

class InvalidRequestError extends Error {}

export async function startCloudService(
  options: CloudServiceOptions,
): Promise<RunningCloudService> {
  let draining = false;
  let activeRequests = 0;
  let drained: (() => void) | undefined;
  let closePromise: Promise<void> | undefined;
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      if (!response.headersSent) {
        sendTransportError(response, 503, "service_unavailable");
      } else {
        response.destroy();
      }
    });
  });

  async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== "POST" || request.url !== "/rpc") {
      request.resume();
      sendTransportError(response, 404, "invalid_request");
      return;
    }
    if (draining) {
      request.resume();
      sendTransportError(response, 503, "service_unavailable");
      return;
    }

    activeRequests += 1;
    try {
      const identity = options.authenticate(request.headers.authorization);
      if (identity === undefined) {
        request.resume();
        sendTransportError(response, 401, "unauthenticated");
        return;
      }
      if (request.headers["content-type"] !== "application/json") {
        request.resume();
        sendTransportError(response, 400, "invalid_request");
        return;
      }

      let parsed: AuthenticatedCommand;
      try {
        parsed = parseRequest(
          identity,
          await readBody(request, options.limits),
        );
      } catch (error: unknown) {
        if (error instanceof InvalidRequestError) {
          sendTransportError(response, 400, "invalid_request");
          return;
        }
        throw error;
      }

      try {
        const wire = await options.invoke(parsed);
        await options.afterCommit?.({ request: parsed, response });
        sendJson(response, 200, wire);
      } catch (error: unknown) {
        sendTransportError(
          response,
          503,
          error instanceof DatabaseUnavailableError
            ? "database_unavailable"
            : "service_unavailable",
        );
      }
    } finally {
      activeRequests -= 1;
      if (draining && activeRequests === 0) drained?.();
    }
  }

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await server[Symbol.asyncDispose]();
    throw new Error("Cloud service did not bind a TCP address");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close() {
      if (closePromise !== undefined) return closePromise;
      draining = true;
      closePromise = (async () => {
        if (activeRequests > 0) {
          await new Promise<void>((resolveDrain) => {
            const timeout = setTimeout(() => {
              server.closeAllConnections();
              resolveDrain();
            }, options.limits.drainTimeoutMs);
            drained = () => {
              clearTimeout(timeout);
              resolveDrain();
            };
          });
        }
        await server[Symbol.asyncDispose]();
      })();
      return closePromise;
    },
  };
}

async function readBody(
  request: IncomingMessage,
  limits: ServiceLimits,
): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    let settled = false;
    let size = 0;
    const chunks: Buffer[] = [];

    function cleanup(): void {
      request.setTimeout(0);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
    }
    function rejectInvalid(): void {
      if (settled) return;
      settled = true;
      cleanup();
      request.resume();
      rejectBody(new InvalidRequestError());
    }
    function onData(chunk: Buffer): void {
      size += chunk.length;
      if (size > limits.maxBodyBytes) {
        rejectInvalid();
        return;
      }
      chunks.push(chunk);
    }
    function onEnd(): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    }
    function onError(): void {
      rejectInvalid();
    }
    function onAborted(): void {
      rejectInvalid();
    }

    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
    request.setTimeout(limits.requestTimeoutMs, rejectInvalid);
  });
}

function parseRequest(
  identity: AuthenticatedIdentity,
  source: string,
): AuthenticatedCommand {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new InvalidRequestError();
  }
  if (!isRecord(value)) throw new InvalidRequestError();
  const keys = Object.keys(value);
  if (
    keys.length !== 2 ||
    !Object.hasOwn(value, "operation") ||
    !Object.hasOwn(value, "input") ||
    !isOperationName(value.operation)
  ) {
    throw new InvalidRequestError();
  }
  if (
    isRecord(value.input) &&
    ((value.operation === "createBudget" &&
      Object.hasOwn(value.input, "policies")) ||
      (value.operation === "requestBudget" &&
        (Object.hasOwn(value.input, "context") ||
          Object.hasOwn(value.input, "childPolicies"))))
  ) {
    throw new InvalidRequestError();
  }
  return { identity, operation: value.operation, input: value.input };
}

function isOperationName(value: unknown): value is OperationName {
  return typeof value === "string" && Object.hasOwn(PROCEDURES, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendTransportError(
  response: ServerResponse,
  status: number,
  code:
    | "unauthenticated"
    | "invalid_request"
    | "database_unavailable"
    | "service_unavailable",
): void {
  sendJson(response, status, {
    error: { kind: "cloud_transport_error", code },
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
