import { KeynesError } from "@keynes/sdk";
import type { RemoteMutationName } from "@keynes/sdk";
import { setTimeout as sleep } from "node:timers/promises";

const MAX_ATTEMPTS = 3;
const RETRY_DEADLINE_MILLISECONDS = 60_000;
const INITIAL_DELAY_MILLISECONDS = 100;
const MAX_DELAY_MILLISECONDS = 2_000;

export async function invokeRemoteMutation<Result>(
  operation: RemoteMutationName,
  operationKey: string,
  invoke: () => Promise<Result>,
): Promise<Result> {
  const deadline = Date.now() + RETRY_DEADLINE_MILLISECONDS;
  let uncertainOutcome: KeynesError | undefined;
  let lastError: unknown;
  for (let attempt = 1; ; attempt += 1) {
    const remainingBeforeAttempt = deadline - Date.now();
    if (attempt > 1 && remainingBeforeAttempt <= 0) {
      throw uncertainOutcome ?? lastError;
    }
    try {
      return await beforeMutationDeadline(
        operation,
        operationKey,
        remainingBeforeAttempt,
        invoke,
      );
    } catch (error: unknown) {
      lastError = error;
      if (isUncertainOutcome(error)) uncertainOutcome ??= error;
      if (
        attempt >= MAX_ATTEMPTS ||
        Date.now() >= deadline ||
        !isRetryable(error)
      ) {
        throw uncertainOutcome ?? error;
      }
      const remaining = deadline - Date.now();
      const exponential = Math.min(
        INITIAL_DELAY_MILLISECONDS * 2 ** (attempt - 1),
        MAX_DELAY_MILLISECONDS,
      );
      const jitter = Math.floor(Math.random() * exponential);
      const serverDelay = retryAfterMilliseconds(error);
      const delay = Math.min(
        Math.max(jitter, serverDelay),
        MAX_DELAY_MILLISECONDS,
        remaining,
      );
      if (delay > 0) await sleep(delay);
    }
  }
}

function beforeMutationDeadline<Result>(
  operation: RemoteMutationName,
  operationKey: string,
  remaining: number,
  invoke: () => Promise<Result>,
): Promise<Result> {
  return new Promise<Result>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(uncertainFailure(operation, operationKey)),
      remaining,
    );
    invoke().then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isRetryable(error: unknown): error is KeynesError {
  return (
    error instanceof KeynesError &&
    (error.code === "uncertain_outcome" ||
      error.code === "unavailable" ||
      error.code === "rate_limited")
  );
}

function isUncertainOutcome(error: unknown): error is KeynesError {
  return error instanceof KeynesError && error.code === "uncertain_outcome";
}

function uncertainFailure(
  operation: RemoteMutationName,
  operationKey: string,
): KeynesError {
  return new KeynesError({
    kind: "error",
    code: "uncertain_outcome",
    details: { operation, operationKey },
  });
}

function retryAfterMilliseconds(error: KeynesError): number {
  const details = error.details;
  if (!isRecord(details)) return 0;
  if (!("retryAfterMilliseconds" in details)) return 0;
  const delay = details.retryAfterMilliseconds;
  return typeof delay === "number" && Number.isFinite(delay) && delay >= 0
    ? delay
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
