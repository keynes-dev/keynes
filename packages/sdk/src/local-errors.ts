import type { ResourceTypeProjection } from "./generated/types.js";

export type KeynesLocalErrorCode =
  | "invalid_configuration"
  | "runtime_closed"
  | "initialization_failed"
  | "operation_interrupted"
  | "invalid_resource_name"
  | "resource_not_defined";

export interface KeynesLocalErrorDetails {
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

export class KeynesLocalError<
  Code extends KeynesLocalErrorCode = KeynesLocalErrorCode,
> extends Error {
  readonly code: Code;
  readonly details: KeynesLocalErrorDetails[Code];

  constructor(
    code: Code,
    details: KeynesLocalErrorDetails[Code],
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "KeynesLocalError";
    this.code = code;
    this.details = details;
  }
}

export class ResourceDefinitionError extends Error {
  readonly code = "resource_definition_failed";
  readonly failed: string;
  readonly completed: readonly ResourceTypeProjection[];
  override readonly cause: unknown;

  constructor(
    failed: string,
    completed: readonly ResourceTypeProjection[],
    cause: unknown,
  ) {
    super("resource_definition_failed", { cause });
    this.name = "ResourceDefinitionError";
    this.failed = failed;
    this.completed = completed;
    this.cause = cause;
  }
}
