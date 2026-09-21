import type { Client, PoolClient, QueryResult } from "pg";
import { DIRECT_PROCEDURES } from "./generated/direct-procedures.js";
import {
  canonicalDefinitions,
  DomainFailure,
} from "./generated/resource-definitions.js";
import {
  createRemoteKeynesClient,
  createKeynesClient,
  type BasicRuntimeSession,
  type CommandExecutor,
  type EmbeddedPostgresRuntime,
  KeynesSdkError,
  KeynesError,
  type RuntimeResourceBinding,
  type PostgresRuntime,
} from "@keynes/sdk";
import { normalizeDatabaseUrl } from "./remote/connection-options.js";
import { openPostgresqlCommandExecutor } from "./remote/postgresql-command-executor.js";
import { invokeRemoteMutation } from "./remote/retry.js";

export type PostgresConnection = Client | PoolClient;

type OwnedOptions = {
  readonly databaseUrl: string;
  readonly connection?: never;
};
type BorrowedOptions = {
  readonly connection: PostgresConnection;
  readonly databaseUrl?: never;
};

export function postgres<const Options extends OwnedOptions>(
  options: Options & Record<Exclude<keyof Options, keyof OwnedOptions>, never>,
): PostgresRuntime;
export function postgres<const Options extends BorrowedOptions>(
  options: Options &
    Record<Exclude<keyof Options, keyof BorrowedOptions>, never>,
): EmbeddedPostgresRuntime;
export function postgres(
  options: unknown,
  ...extra: readonly unknown[]
): PostgresRuntime | EmbeddedPostgresRuntime {
  if (extra.length !== 0 || typeof options !== "object" || options === null)
    throw invalidOptions();
  const keys = Reflect.ownKeys(options);
  const key = keys[0];
  if (keys.length !== 1 || (key !== "databaseUrl" && key !== "connection"))
    throw invalidOptions();
  const descriptor = Object.getOwnPropertyDescriptor(options, key);
  if (descriptor === undefined || !("value" in descriptor))
    throw invalidOptions();
  if (key === "connection") {
    const connection: unknown = descriptor.value;
    if (!isPostgresConnection(connection)) throw invalidOptions();
    return Object.freeze({
      kind: "embedded",
      initialize: (definitions: unknown) =>
        openBorrowedRuntime(connection, definitions),
    });
  }
  if (typeof descriptor.value !== "string") throw invalidOptions();
  const databaseUrl: string = descriptor.value;
  return Object.freeze({
    kind: "remote",
    async initialize(definitions) {
      const executor = await openPostgresqlCommandExecutor(
        normalizeDatabaseUrl(databaseUrl),
      );
      const client = createRemoteKeynesClient(executor);
      let resources: readonly RuntimeResourceBinding[];
      try {
        await client.validateResources({ definitions });
        resources = await prepareResources(definitions);
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
        resources,
        prepareResources,
        client,
        invokeMutation: invokeRemoteMutation,
        close: () => executor.close(),
      };
    },
  } satisfies PostgresRuntime);
}

// Client constructor identity differs when the application installs its own pg copy.
function isPostgresConnection(value: unknown): value is Pick<Client, "query"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof value.query === "function" &&
    "connect" in value &&
    typeof value.connect === "function" &&
    "end" in value &&
    typeof value.end === "function" &&
    "_connected" in value &&
    typeof value._connected === "boolean" &&
    "_ending" in value &&
    typeof value._ending === "boolean" &&
    "_queryable" in value &&
    typeof value._queryable === "boolean"
  );
}

function invalidOptions(): KeynesSdkError<"invalid_configuration"> {
  return new KeynesSdkError("invalid_configuration", {
    field: "runtime",
    reason: "unsupported",
  });
}

async function prepareResources(
  definitions: unknown,
): Promise<readonly RuntimeResourceBinding[]> {
  try {
    return canonicalDefinitions(definitions, "validateResources").map(
      ({ key, definition }) => ({ key, ...definition }),
    );
  } catch (error: unknown) {
    if (error instanceof DomainFailure) throw new KeynesError(error.envelope);
    throw error;
  }
}

async function openBorrowedRuntime(
  connection: Pick<Client, "query">,
  definitions: unknown,
): Promise<BasicRuntimeSession> {
  // pg queues queries on a never-connected Client; inspect the driver's state without acquiring a connection.
  if (
    !("_connected" in connection) ||
    connection._connected !== true ||
    ("_ending" in connection && connection._ending === true) ||
    ("_queryable" in connection && connection._queryable === false)
  )
    throw invalidOptions();
  const executor: CommandExecutor = {
    async execute(operation, input) {
      const procedure = DIRECT_PROCEDURES[operation];
      const query = {
        text: `select ${procedure.target}($1::jsonb) as response`,
        values: [JSON.stringify(input)],
      };
      let result: QueryResult<{ response: unknown }>;
      try {
        result = await connection.query<{ response: unknown }>(query);
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "42501"
        ) {
          throw new KeynesError({
            kind: "error",
            code: "unauthorized",
            details: { operation, requiredPermission: procedure.permission },
          });
        }
        throw new KeynesSdkError("operation_interrupted", {}, { cause: error });
      }
      if (result.rows.length !== 1)
        throw new KeynesSdkError("operation_interrupted", {});
      return result.rows[0]?.response;
    },
  };
  const client = createKeynesClient(executor);
  await client.validateResources({ definitions });
  const resources = await prepareResources(definitions);
  let state: "open" | "closing" | "closed" = "open";
  let tail = Promise.resolve();
  let closePromise: Promise<void> | undefined;
  return {
    client,
    resources,
    get state() {
      return state;
    },
    admit<Result>(operation: () => Promise<Result>): Promise<Result> {
      if (state !== "open")
        return Promise.reject(new KeynesSdkError("runtime_closed", {}));
      const result = tail.then(operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    invokeMutation: (operation) => operation(),
    close() {
      if (closePromise !== undefined) return closePromise;
      state = "closing";
      closePromise = tail.then(() => {
        state = "closed";
      });
      return closePromise;
    },
  };
}
