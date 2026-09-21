// Generated from packages/database/src/generation/runtime.ts. Do not edit.
import type { KeynesClient, RemoteKeynesClient } from "./client.js";
import type { ResourceDefinitions } from "../resources.js";
import type { RemoteMutationName } from "./types.js";

export interface BasicRuntimeSession {
  readonly client: KeynesClient;
  readonly state: "open" | "closing" | "closed";
  admit<Result>(operation: () => Promise<Result>): Promise<Result>;
  invokeMutation<Result>(operation: () => Promise<Result>): Promise<Result>;
  close(): Promise<void>;
}

export interface RemoteRuntimeSession {
  readonly client: RemoteKeynesClient;
  invokeMutation<Result>(
    operation: RemoteMutationName,
    operationKey: string,
    invoke: () => Promise<Result>,
  ): Promise<Result>;
  close(): Promise<void>;
}

export interface NodeSqliteRuntime {
  readonly kind: "local";
  initialize(definitions: ResourceDefinitions): Promise<BasicRuntimeSession>;
}

export interface EmbeddedPostgresRuntime {
  readonly kind: "embedded";
  initialize(definitions: ResourceDefinitions): Promise<BasicRuntimeSession>;
}

export interface PostgresRuntime {
  readonly kind: "remote";
  initialize(definitions: ResourceDefinitions): Promise<RemoteRuntimeSession>;
}

export type KeynesRuntime =
  | NodeSqliteRuntime
  | EmbeddedPostgresRuntime
  | PostgresRuntime;
