import type {
  CreateBudgetCommand,
  CreateBudgetResult,
  DefineResourceTypeCommand,
  DefineResourceTypeResult,
  ErrorEnvelope,
  GetBudgetQuery,
  GetBudgetResult,
  OperationName,
  RequestBudgetCommand,
  RequestBudgetResult,
  SettleBudgetCommand,
  SettleBudgetResult,
} from "../generated/types.ts";
import {
  orderContractResult,
  validateErrorEnvelope,
  validateOperationResult,
} from "./validation.ts";

export type FixturePrincipal =
  | "definer-fixture"
  | "allocator-fixture"
  | "root-fixture"
  | "requester-fixture"
  | "settlement-fixture"
  | "reader-fixture"
  | "product-fixture"
  | "unauthorized-fixture";

export type RollbackCheckpoint =
  | "after_command_binding"
  | "after_domain_mutation"
  | "after_history_insertion"
  | "after_result_storage";

export interface ContractClientOptions {
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export interface ContractClient {
  defineResource(
    input: DefineResourceTypeCommand,
  ): Promise<DefineResourceTypeResult>;
  createBudget(input: CreateBudgetCommand): Promise<CreateBudgetResult>;
  requestBudget(input: RequestBudgetCommand): Promise<RequestBudgetResult>;
  settleBudget(input: SettleBudgetCommand): Promise<SettleBudgetResult>;
  getBudget(input: GetBudgetQuery): Promise<GetBudgetResult>;
}

export interface ContractTestHost {
  clientFor(
    fixture: FixturePrincipal,
    options?: ContractClientOptions,
  ): ContractClient;
  close(): Promise<void>;
}

export type OpenContractTestHost = () => Promise<ContractTestHost>;

export interface ContractExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}

export class KeynesError extends Error {
  readonly code: ErrorEnvelope["code"];
  readonly details: ErrorEnvelope["details"];

  constructor(error: ErrorEnvelope) {
    super(error.code);
    this.name = "KeynesError";
    this.code = error.code;
    this.details = error.details;
  }
}

export function createContractClient(
  executor: ContractExecutor,
): ContractClient {
  return {
    defineResource: (input) => invoke(executor, "defineResource", input, true),
    createBudget: (input) => invoke(executor, "createBudget", input, true),
    requestBudget: (input) => invoke(executor, "requestBudget", input, true),
    settleBudget: (input) => invoke(executor, "settleBudget", input, true),
    getBudget: (input) => invoke(executor, "getBudget", input, false),
  };
}

async function invoke<Result>(
  executor: ContractExecutor,
  operation: OperationName,
  input: unknown,
  replayable: boolean,
): Promise<Result> {
  const wire = await executor.execute(operation, input);
  if (!isRecord(wire) || typeof wire.ok !== "boolean") {
    throw new Error(`invalid wire response for ${operation}`);
  }
  if (wire.ok === false) {
    if (!validateErrorEnvelope(wire.error))
      throw new Error(`invalid error response for ${operation}`);
    throw new KeynesError(wire.error as ErrorEnvelope);
  }
  if (typeof wire.replayed !== "boolean") {
    throw new Error(`invalid result response for ${operation}`);
  }
  const result = replayable
    ? isRecord(wire.result)
      ? { ...wire.result, replayed: wire.replayed }
      : undefined
    : wire.result;
  if (result === undefined)
    throw new Error(`invalid result response for ${operation}`);
  if (!validateOperationResult(operation, result)) {
    throw new Error(`invalid result response for ${operation}`);
  }
  return orderContractResult(result) as Result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
