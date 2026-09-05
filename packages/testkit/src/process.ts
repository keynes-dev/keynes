import { type ChildProcess } from "node:child_process";

export interface RunningTestChild {
  wait(): Promise<void>;
  terminate(): Promise<void>;
}

export async function waitWithCancellation<Result>(
  operation: Promise<Result>,
  signal?: AbortSignal,
): Promise<Result> {
  let abort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Test run cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  try {
    return await Promise.race([operation, cancelled]);
  } finally {
    if (abort !== undefined) signal?.removeEventListener("abort", abort);
  }
}

// Own a process group so pnpm's grandchildren cannot outlive cancellation.
export function manageChild(
  child: ChildProcess,
  graceMs = 2_000,
): RunningTestChild {
  let completed = false;
  const closed = new Promise<void>((resolveClosed) =>
    child.once("close", () => {
      completed = true;
      resolveClosed();
    }),
  );
  const completion = new Promise<void>((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("close", (code) =>
      code === 0
        ? resolveChild()
        : rejectChild(new Error("Native subprocess failed")),
    );
  });
  void completion.catch(() => {});
  function kill(signal: NodeJS.Signals): void {
    if (child.pid === undefined) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ESRCH"
      )
        throw error;
    }
  }
  return {
    wait: () => completion,
    async terminate() {
      if (completed) {
        kill("SIGKILL");
        return;
      }
      kill("SIGTERM");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closed,
          new Promise<void>((resolveGrace) => {
            timer = setTimeout(resolveGrace, graceMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      // The group can still contain descendants after its leader closes.
      kill("SIGKILL");
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closed,
          new Promise<never>((_, reject) => {
            killTimer = setTimeout(
              () => reject(new Error("Native subprocess cleanup timed out")),
              graceMs,
            );
          }),
        ]);
      } finally {
        clearTimeout(killTimer);
      }
    },
  };
}
