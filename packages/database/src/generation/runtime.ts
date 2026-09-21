export function renderRuntime(): string {
  return `// Generated from packages/database/src/generation/runtime.ts. Do not edit.
import type { KeynesClient, RemoteKeynesClient } from "./client.js";
import type { RemoteMutationName } from "./types.js";

export interface RuntimeResourceBinding {
  readonly key: string;
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
}

export interface BasicRuntimeSession {
  readonly resources: readonly RuntimeResourceBinding[];
  readonly client: KeynesClient;
  readonly state: "open" | "closing" | "closed";
  admit<Result>(operation: () => Promise<Result>): Promise<Result>;
  admit<Prepared, Result>(prepare: () => Prepared, execute: (prepared: Prepared) => Promise<Result>): Promise<Result>;
  invokeMutation<Result>(operation: () => Promise<Result>): Promise<Result>;
  close(): Promise<void>;
}

export interface RemoteRuntimeSession {
  assertOpen(): void;
  readonly resources: readonly RuntimeResourceBinding[];
  prepareResources(definitions: unknown): Promise<readonly RuntimeResourceBinding[]>;
  readonly client: RemoteKeynesClient;
  invokeMutation<Result>(operation: RemoteMutationName, operationKey: string, invoke: () => Promise<Result>): Promise<Result>;
  close(): Promise<void>;
}

export interface NodeSqliteRuntime {
  readonly kind: "local";
  initialize(definitions: unknown): Promise<BasicRuntimeSession>;
}

export interface EmbeddedPostgresRuntime {
  readonly kind: "embedded";
  initialize(definitions: unknown): Promise<BasicRuntimeSession>;
}

export interface PostgresRuntime {
  readonly kind: "remote";
  initialize(definitions: unknown): Promise<RemoteRuntimeSession>;
}

export type KeynesRuntime = NodeSqliteRuntime | EmbeddedPostgresRuntime | PostgresRuntime;
`;
}
