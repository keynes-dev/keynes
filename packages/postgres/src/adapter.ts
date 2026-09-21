import {
  createRemoteKeynesClient,
  KeynesSdkError,
  type PostgresRuntime,
} from "@keynes/sdk";
import { normalizeDatabaseUrl } from "./remote/connection-options.js";
import { openPostgresqlCommandExecutor } from "./remote/postgresql-command-executor.js";
import { invokeRemoteMutation } from "./remote/retry.js";

export function postgres<
  const Options extends { readonly databaseUrl: string },
>(
  options: Options & Record<Exclude<keyof Options, "databaseUrl">, never>,
  ...extra: readonly never[]
): PostgresRuntime {
  if (extra.length !== 0 || typeof options !== "object" || options === null) {
    throw invalidOptions();
  }
  const keys = Reflect.ownKeys(options);
  const descriptor = Object.getOwnPropertyDescriptor(options, "databaseUrl");
  if (
    keys.length !== 1 ||
    keys[0] !== "databaseUrl" ||
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    throw invalidOptions();
  }
  const databaseUrl: string = descriptor.value;
  return Object.freeze({
    kind: "remote",
    async initialize(definitions) {
      const executor = await openPostgresqlCommandExecutor(
        normalizeDatabaseUrl(databaseUrl),
      );
      const client = createRemoteKeynesClient(executor);
      try {
        await client.validateResources({ definitions });
      } catch (error: unknown) {
        try {
          await executor.close();
        } catch (cleanupError: unknown) {
          throw new AggregateError(
            [error, cleanupError],
            "PostgreSQL initialization and cleanup failed",
            { cause: error },
          );
        }
        throw error;
      }
      return {
        client,
        invokeMutation: invokeRemoteMutation,
        close: () => executor.close(),
      };
    },
  } satisfies PostgresRuntime);
}

function invalidOptions(): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field: "runtime",
    reason: "unsupported",
  });
}
