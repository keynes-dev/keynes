import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadStartupConfig,
  startConfiguredCloud,
} from "../../services/cloud/src/main.ts";
import type { PostCommitContext } from "../../services/cloud/src/service.ts";

interface StartMessage {
  readonly type: "start";
  readonly dropResponseCommandId?: string;
}

function isStartMessage(value: unknown): value is StartMessage {
  if (!isRecord(value)) return false;
  return (
    value.type === "start" &&
    (value.dropResponseCommandId === undefined ||
      typeof value.dropResponseCommandId === "string")
  );
}

function commandId(context: PostCommitContext): string | undefined {
  const input = context.request.input;
  if (!isRecord(input)) return undefined;
  const value = input.commandId;
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function runChild(message: StartMessage): Promise<void> {
  const config = await loadStartupConfig(process.env);
  const cloud = await startConfiguredCloud(config, {
    afterCommit:
      message.dropResponseCommandId === undefined
        ? undefined
        : async (context) => {
            if (commandId(context) !== message.dropResponseCommandId) return;
            context.response.destroy();
            setImmediate(() => process.exit(86));
            await new Promise<void>(() => undefined);
          },
  });
  process.send?.({ type: "ready", origin: cloud.origin });

  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    void cloud.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.once("disconnect", close);
}

async function main(): Promise<void> {
  const message = await new Promise<unknown>((resolveMessage) => {
    process.once("message", resolveMessage);
  });
  if (!isStartMessage(message)) throw new Error("Invalid child start message");
  await runChild(message);
}

const executedPath = process.argv[1];
if (
  executedPath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executedPath)).href
) {
  void main().catch(() => {
    process.send?.({ type: "startup-failed" });
    process.exitCode = 1;
  });
}
