import { randomUUID } from "node:crypto";

import type { KeynesClient } from "./generated/client.js";
import type {
  CreateBudgetCommand,
  DefineResourceTypeCommand,
  GetBudgetResult,
  RequestBudgetCommand,
  ResourceTypeProjection,
  SettleBudgetCommand,
  SettleBudgetResult,
} from "./generated/types.js";
import { KeynesLocalError, ResourceDefinitionError } from "./local-errors.js";
import { openProductLocalKeynes } from "./private/local-keynes.js";
import { CommittedResponseLostError } from "./private/procedure-caller.js";
import { LocalResourceCatalog } from "./private/local-resources.js";

export type AccountingBehavior = "consumable" | "reusable";

export interface LocalResourceDefinition {
  readonly unit: string;
  readonly accountingBehavior: AccountingBehavior;
}

export type LocalResourceDefinitions = Readonly<
  Record<string, LocalResourceDefinition>
>;

export type ResourceAmounts<Names extends string = string> = Readonly<
  Partial<Record<Names, number>>
>;

export type ResourceUsage<Names extends string = string> = Readonly<
  Partial<Record<Names, number | null>>
>;

export interface LocalRequestDenialReason<Name extends string = string> {
  readonly code: "insufficient_available";
  readonly resource: Name;
  readonly requested: number;
  readonly available: number;
}

export interface LocalRequestApproved<Names extends string = string> {
  readonly status: "approved";
  readonly budget: Budget<Names>;
}

export interface LocalRequestDenied<Names extends string = string> {
  readonly status: "denied";
  readonly reasons: readonly LocalRequestDenialReason<Names>[];
}

export type LocalRequestResult<Names extends string = string> =
  | LocalRequestApproved<Names>
  | LocalRequestDenied<Names>;

export interface KeynesCreateOptions {
  readonly mode: "local";
}

type RuntimeState = "open" | "closing" | "closed";

interface LocalRuntime {
  readonly client: KeynesClient;
  readonly resources: LocalResourceCatalog;
  readonly closeHost: () => Promise<void>;
  state: RuntimeState;
  tail: Promise<void>;
  closePromise: Promise<void> | undefined;
}

export class Keynes {
  readonly #runtime: LocalRuntime;

  private constructor(runtime: LocalRuntime) {
    this.#runtime = runtime;
  }

  static async create(options: KeynesCreateOptions): Promise<Keynes> {
    validateCreateOptions(options);
    try {
      const host = await openProductLocalKeynes();
      return new Keynes({
        client: host.client,
        resources: new LocalResourceCatalog(),
        closeHost: () => host.close(),
        state: "open",
        tail: Promise.resolve(),
        closePromise: undefined,
      });
    } catch (cause: unknown) {
      throw new KeynesLocalError("initialization_failed", {}, { cause });
    }
  }

  defineResources<const Definitions extends LocalResourceDefinitions>(
    definitions: Definitions,
  ): Promise<readonly ResourceTypeProjection[]> {
    return admit(this.#runtime, async () => {
      const prepared = this.#runtime.resources.prepareDefinitions(definitions);
      const completed: ResourceTypeProjection[] = [];
      for (const resource of prepared) {
        try {
          const command = {
            commandId: randomUUID(),
            definition: resource.definition,
          } satisfies DefineResourceTypeCommand;
          const result = await invokeMutation(() =>
            this.#runtime.client.defineResource(command),
          );
          this.#runtime.resources.record(resource, result.resourceType);
          completed.push(result.resourceType);
        } catch (cause: unknown) {
          if (
            cause instanceof KeynesLocalError &&
            cause.code === "operation_interrupted"
          ) {
            throw cause;
          }
          throw new ResourceDefinitionError(resource.key, completed, cause);
        }
      }
      return completed;
    });
  }

  createBudget<const Resources extends Readonly<Record<string, number>>>(
    resources: Resources,
  ): Promise<Budget<Extract<keyof Resources, string>>> {
    return admit(this.#runtime, async () => {
      const resolved = this.#runtime.resources.resources(
        resources,
        "createBudget",
      );
      const command = {
        commandId: randomUUID(),
        resources: resolved.envelope,
      } satisfies CreateBudgetCommand;
      const result = await invokeMutation(() =>
        this.#runtime.client.createBudget(command),
      );
      return createBudgetHandle(this.#runtime, result.budget.budgetId);
    });
  }

  close(): Promise<void> {
    return closeRuntime(this.#runtime);
  }
}

export class Budget<Names extends string = string> {
  readonly #runtime: LocalRuntime;
  readonly #budgetId: string;

  protected constructor(runtime: LocalRuntime, budgetId: string) {
    this.#runtime = runtime;
    this.#budgetId = budgetId;
  }

  request<const Resources extends ResourceAmounts<Names>>(
    resources: Resources,
  ): Promise<LocalRequestResult<Extract<keyof Resources, string>>> {
    return admit(this.#runtime, async () => {
      const resolved = this.#runtime.resources.resources(
        resources,
        "requestBudget",
      );
      const command = {
        commandId: randomUUID(),
        parentBudgetId: this.#budgetId,
        resources: resolved.envelope,
      } satisfies RequestBudgetCommand;
      const result = await invokeMutation(() =>
        this.#runtime.client.requestBudget(command),
      );
      if (result.kind === "approved") {
        return {
          status: "approved",
          budget: createBudgetHandle(this.#runtime, result.childBudgetId),
        };
      }
      return {
        status: "denied",
        reasons: result.reasons.map((reason) => ({
          code: reason.code,
          resource: resolved.keyFor(reason.resourceTypeId),
          requested: reason.requested,
          available: reason.available,
        })),
      };
    });
  }

  settle(usage: ResourceUsage<Names>): Promise<SettleBudgetResult> {
    return admit(this.#runtime, () => {
      const command = {
        commandId: randomUUID(),
        budgetId: this.#budgetId,
        usage: this.#runtime.resources.usage(usage),
      } satisfies SettleBudgetCommand;
      return invokeMutation(() => this.#runtime.client.settleBudget(command));
    });
  }

  inspect(): Promise<GetBudgetResult> {
    return admit(this.#runtime, () =>
      this.#runtime.client.getBudget({ budgetId: this.#budgetId }),
    );
  }
}

class LocalBudget<Names extends string> extends Budget<Names> {
  constructor(runtime: LocalRuntime, budgetId: string) {
    super(runtime, budgetId);
  }
}

function createBudgetHandle<Names extends string>(
  runtime: LocalRuntime,
  budgetId: string,
): Budget<Names> {
  return new LocalBudget(runtime, budgetId);
}

function admit<Result>(
  runtime: LocalRuntime,
  operation: () => Promise<Result>,
): Promise<Result> {
  if (runtime.state !== "open") {
    return Promise.reject(new KeynesLocalError("runtime_closed", {}));
  }
  const result = runtime.tail.then(operation);
  runtime.tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function invokeMutation<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (!(error instanceof CommittedResponseLostError)) throw error;
  }

  try {
    return await operation();
  } catch (cause: unknown) {
    if (!(cause instanceof CommittedResponseLostError)) throw cause;
    throw new KeynesLocalError("operation_interrupted", {}, { cause });
  }
}

function closeRuntime(runtime: LocalRuntime): Promise<void> {
  if (runtime.closePromise !== undefined) {
    return runtime.closePromise;
  }
  runtime.state = "closing";
  runtime.closePromise = runtime.tail.then(runtime.closeHost).finally(() => {
    runtime.state = "closed";
  });
  return runtime.closePromise;
}

function validateCreateOptions(
  options: unknown,
): asserts options is KeynesCreateOptions {
  if (!isRecord(options) || !Object.hasOwn(options, "mode")) {
    throw new KeynesLocalError("invalid_configuration", {
      field: "mode",
      reason: "missing",
    });
  }
  if (options.mode !== "local") {
    throw new KeynesLocalError("invalid_configuration", {
      field: "mode",
      reason: "unsupported",
    });
  }
  const unknownField = Object.keys(options).find((field) => field !== "mode");
  if (unknownField !== undefined) {
    throw new KeynesLocalError("invalid_configuration", {
      field: unknownField,
      reason: "unknown",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
