import type {
  CreateBudgetCommand,
  CreateBudgetResult,
  AddToBudgetCommand,
  AddToBudgetResult,
  DefineResourcesCommand,
  DefineResourcesResult,
  ErrorEnvelope,
  InspectBudgetQuery,
  InspectBudgetResult,
  OperationName,
  RequestBudgetCommand,
  RequestBudgetResult,
  SettleBudgetCommand,
  SettleBudgetResult,
  GetBudgetHistoryPageQuery,
  GetBudgetHistoryPageResult,
  GetCompatibilityQuery,
  GetCompatibilityResult,
  OpenBudgetQuery,
  OpenBudgetResult,
  RecoverOperationQuery,
  RecoverOperationResult,
  RemoteCreateBudgetCommand,
  RemoteCreateBudgetResult,
  RemoteErrorEnvelope,
  RemoteGetBudgetQuery,
  RemoteGetBudgetResult,
  RemoteRequestBudgetCommand,
  RemoteRequestBudgetResult,
  RemoteSettleBudgetCommand,
  RemoteSettleBudgetResult,
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
  | "after_resource_insertion"
  | "after_domain_mutation"
  | "after_history_insertion"
  | "after_result_storage";

export interface ContractClientOptions {
  readonly checkpoint?: RollbackCheckpoint;
  readonly dropResponseAfterCommitOnce?: boolean;
}

export interface ContractClient {
  defineResources(
    input: DefineResourcesCommand,
  ): Promise<DefineResourcesResult>;
  createBudget(input: CreateBudgetCommand): Promise<CreateBudgetResult>;
  addToBudget(input: AddToBudgetCommand): Promise<AddToBudgetResult>;
  requestBudget(input: RequestBudgetCommand): Promise<RequestBudgetResult>;
  settleBudget(input: SettleBudgetCommand): Promise<SettleBudgetResult>;
  inspectBudget(input: InspectBudgetQuery): Promise<InspectBudgetResult>;
}

export interface ContractTestHost {
  clientFor(
    fixture: FixturePrincipal,
    options?: ContractClientOptions,
  ): ContractClient;
  close(): Promise<void>;
}

export type OpenContractTestHost = () => Promise<ContractTestHost>;

export interface RemoteContractClient {
  createBudget(
    input: RemoteCreateBudgetCommand,
  ): Promise<RemoteCreateBudgetResult>;
  requestBudget(
    input: RemoteRequestBudgetCommand,
  ): Promise<RemoteRequestBudgetResult>;
  settleBudget(
    input: RemoteSettleBudgetCommand,
  ): Promise<RemoteSettleBudgetResult>;
  getBudget(input: RemoteGetBudgetQuery): Promise<RemoteGetBudgetResult>;
  getBudgetHistoryPage(
    input: GetBudgetHistoryPageQuery,
  ): Promise<GetBudgetHistoryPageResult>;
  openBudget(input: OpenBudgetQuery): Promise<OpenBudgetResult>;
  recoverOperation(
    input: RecoverOperationQuery,
  ): Promise<RecoverOperationResult>;
  getCompatibility(
    input: GetCompatibilityQuery,
  ): Promise<GetCompatibilityResult>;
}

export interface RemoteContractTestHost {
  clientFor(
    fixture: FixturePrincipal,
    options?: ContractClientOptions,
  ): RemoteContractClient;
  close(): Promise<void>;
}

export type OpenRemoteContractTestHost = () => Promise<RemoteContractTestHost>;

export interface ContractExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}

export class KeynesError extends Error {
  readonly code: (ErrorEnvelope | RemoteErrorEnvelope)["code"];
  readonly details: (ErrorEnvelope | RemoteErrorEnvelope)["details"];

  constructor(error: ErrorEnvelope | RemoteErrorEnvelope) {
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
    defineResources: (input) =>
      invoke(executor, "defineResources", input, true),
    createBudget: (input) => invoke(executor, "createBudget", input, true),
    addToBudget: (input) => invoke(executor, "addToBudget", input, true),
    requestBudget: (input) => invoke(executor, "requestBudget", input, true),
    settleBudget: (input) => invoke(executor, "settleBudget", input, true),
    inspectBudget: (input) => invoke(executor, "inspectBudget", input, false),
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
