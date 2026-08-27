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

  constructor(
    code: Code,
    details: KeynesSdkErrorDetails[Code],
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "KeynesSdkError";
    this.code = code;
    this.details = details;
  }
}

export class ResourceDefinitionError extends Error {
  readonly code = "resource_definition_failed";
  readonly failedResource: string;
  readonly definedResources: readonly DefinedResource[];
  override readonly cause: unknown;

  constructor(
    failedResource: string,
    definedResources: readonly DefinedResource[],
    cause: unknown,
  ) {
    super("resource_definition_failed", { cause });
    this.name = "ResourceDefinitionError";
    this.failedResource = failedResource;
    this.definedResources = definedResources;
    this.cause = cause;
  }
}

export interface DefinedResource {
  readonly resource: string;
  readonly canonicalName: string;
  readonly unit: string;
  readonly accountingBehavior: "consumable" | "reusable";
  readonly definitionDigest: string;
}
