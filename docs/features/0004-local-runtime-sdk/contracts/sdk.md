# Local TypeScript SDK contract

This reference defines the FEAT-0004 package-root facade. Generated command, result, validator, and `KeynesError` exports remain available. `createKeynesClient`, `ProcedureCaller`, PGlite, fixture identities, test checkpoints, and raw database types remain private.

## Public shape

```ts
import type {
  GetBudgetResult,
  ResourceTypeProjection,
  SettleBudgetResult,
} from "./generated/types.js";

export type AccountingBehavior = "consumable" | "reusable";

export interface ResourceConfig {
  readonly unit: string;
  readonly accountingBehavior: AccountingBehavior;
}

export type ResourceConfigs = Readonly<
  Record<string, ResourceConfig>
>;

export type ResourceAmounts<Names extends string = string> = Readonly<
  Partial<Record<Names, number>>
>;

export type ResourceUsage<Names extends string = string> = Readonly<
  Partial<Record<Names, number | null>>
>;

export interface BudgetRequestDenialReason<Name extends string = string> {
  readonly code: "insufficient_available";
  readonly resource: Name;
  readonly requested: number;
  readonly available: number;
}

export type BudgetRequestResult<Names extends string = string> =
  | { readonly status: "approved"; readonly budget: Budget<Names> }
  | {
      readonly status: "denied";
      readonly reasons: readonly BudgetRequestDenialReason<Names>[];
    };

export interface KeynesCreateOptions {
  readonly mode: "local";
}

export class Keynes {
  static create(options: KeynesCreateOptions): Promise<Keynes>;

  defineResources<const Definitions extends ResourceConfigs>(
    definitions: Definitions,
  ): Promise<readonly ResourceTypeProjection[]>;

  createBudget<const Resources extends Readonly<Record<string, number>>>(
    resources: Resources,
  ): Promise<Budget<Extract<keyof Resources, string>>>;

  close(): Promise<void>;
}

export class Budget<Names extends string = string> {
  request<const Resources extends ResourceAmounts<Names>>(
    resources: Resources &
      Readonly<Record<Exclude<keyof Resources, Names>, never>>,
  ): Promise<BudgetRequestResult<Extract<keyof Resources, Names>>>;

  settle(usage: ResourceUsage<Names>): Promise<SettleBudgetResult>;

  inspect(): Promise<GetBudgetResult>;
}

export type KeynesSdkErrorCode =
  | "invalid_configuration"
  | "runtime_closed"
  | "initialization_failed"
  | "operation_interrupted"
  | "invalid_resource_name"
  | "resource_not_defined";

export interface KeynesSdkErrorDetails {
  readonly invalid_configuration: {
    readonly field: string;
    readonly reason: "missing" | "unknown" | "unsupported";
  };
  readonly runtime_closed: Readonly<Record<never, never>>;
  readonly initialization_failed: Readonly<Record<never, never>>;
  readonly operation_interrupted: Readonly<Record<never, never>>;
  readonly invalid_resource_name: { readonly resource: string };
  readonly resource_not_defined: { readonly resource: string };
}

export class KeynesSdkError<
  Code extends KeynesSdkErrorCode = KeynesSdkErrorCode,
> extends Error {
  readonly code: Code;
  readonly details: KeynesSdkErrorDetails[Code];
}

export class ResourceDefinitionError extends Error {
  readonly code: "resource_definition_failed";
  readonly failedResource: string;
  readonly definedResources: readonly ResourceTypeProjection[];
  override readonly cause: unknown;
}
```

The exact implementation may derive helper types from generated types. It must preserve these caller-visible names, discriminants, methods, and error codes without using `any`, unchecked casts, or optional-field variant bags.

## `Keynes.create()`

- Accepts exactly `{ mode: "local" }` in FEAT-0004.
- Rejects a missing or unknown mode, unknown fields, and durable-host configuration with `KeynesSdkError` and `code: "invalid_configuration"` before acquiring a runtime resource.
- Creates one private in-memory PGlite database.
- Installs and verifies the current migration graph and generated contract digest before returning.
- Binds one fixed private tenant and one fixed private principal with the five current permissions.
- Returns only after the runtime can accept calls.
- Closes every acquired runtime resource if initialization fails.
- Wraps startup failure as `KeynesSdkError` with `code: "initialization_failed"` and retains the original failure as `cause`.
- Does not infer a mode from environment variables and does not export placeholder `cloud` or `postgres` variants.

## `defineResources()`

- Requires a non-empty definition record.
- Accepts lower-camel keys that round-trip through the canonical lower-snake mapping.
- Validates every key before invoking the generated client.
- Sorts definitions by canonical name and commits one `defineResource` command at a time.
- Creates one private command ID for each definition.
- Returns the database-owned `ResourceTypeProjection` values in canonical-name order.
- Repeating exact definitions succeeds. A changed definition fails with the generated Resource conflict.
- If an entry fails after earlier commits, throws `ResourceDefinitionError`. `definedResources` contains the committed prefix from this call.

## `createBudget()`

- Requires a non-empty Resource amount record.
- Resolves every key through this runtime's private Resource catalog.
- Creates one generated `createBudget` command with a private command ID.
- Returns an identity-only `Budget` after the command commits.
- Does not return or expose the root Budget ID directly.

## `Budget.request()`

- Requires a non-empty exact Resource amount record. TypeScript rejects keys outside the handle's Resource names, including on predeclared variables.
- Uses the handle's private ID as the generated `parentBudgetId`.
- Creates one generated `requestBudget` command with a private command ID.
- Maps generated `kind: "approved"` to `status: "approved"` and returns one child handle.
- Maps generated `kind: "denied"` to `status: "denied"` and replaces each reason's Resource ID with the application key.
- Never revises a denied request or runs application work.

## `Budget.settle()`

- Requires a non-empty usage record.
- Accepts a known amount or `null` for each included Resource key.
- Omitting a key leaves that Resource unresolved.
- Uses the handle's private ID as the generated `budgetId`.
- Returns the unchanged generated `SettleBudgetResult` after commit.

## `Budget.inspect()`

- Calls the generated `getBudget` operation with the handle's private ID.
- Returns the unchanged generated `GetBudgetResult`.
- Preserves one transaction snapshot for the projection and complete root-lineage history.
- Does not cache, paginate, filter, or reinterpret history.

## Command replay

The facade creates each generated command once. Only an internal `CommittedResponseLostError`, thrown after confirmed commit and before returning the response, triggers a retry. The retry runs once and reuses the same command object and ID. A canonical `KeynesError`, local input error, lifecycle error, pre-commit failure, or unclassified host error is not retried.

## Close

`close()` stops admission before draining the existing owner queue. Admitted operations finish. Later operations, including calls through existing Budget handles, fail with `runtime_closed`. Repeated calls return the same close promise. Closing one runtime does not affect another runtime.

## Private exports

The package root must not export these symbols or equivalent controls:

- `PGlite` or a database handle;
- `createKeynesClient` or `ProcedureCaller`;
- `openLocalKeynes`, `clientFor`, or fixture principal names;
- tenant or principal IDs;
- rollback checkpoints or response-loss controls;
- raw SQL, transactions, paths, connection strings, credentials, or extension options.
