// Generated from contracts/. Do not edit.

import type { CommandExecutor } from "../command-executor.js";
import type {
  DefineResourceTypeCommand,
  DefineResourceTypeResult,
  CreateBudgetCommand,
  CreateBudgetResult,
  RequestBudgetCommand,
  RequestBudgetResult,
  SettleBudgetCommand,
  SettleBudgetResult,
  GetBudgetQuery,
  GetBudgetResult,
  ErrorEnvelope,
  OperationName,
} from "./types.js";
import {
  validateDefineResourceTypeResult,
  validateCreateBudgetResult,
  validateRequestBudgetResult,
  validateSettleBudgetResult,
  validateGetBudgetResult,
  validateOperationInputIssues,
  validateErrorEnvelope,
} from "./validators.js";
import type { ValidationIssue } from "./validators.js";

export const CONTRACT_DIGEST =
  "0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6";

export interface KeynesClient {
  defineResource(
    input: DefineResourceTypeCommand,
  ): Promise<DefineResourceTypeResult>;
  createBudget(input: CreateBudgetCommand): Promise<CreateBudgetResult>;
  requestBudget(input: RequestBudgetCommand): Promise<RequestBudgetResult>;
  settleBudget(input: SettleBudgetCommand): Promise<SettleBudgetResult>;
  getBudget(input: GetBudgetQuery): Promise<GetBudgetResult>;
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

type OutputValidator<Output> = (value: unknown) => value is Output;

interface Invocation<Output> {
  readonly executor: CommandExecutor;
  readonly operation: OperationName;
  readonly input: unknown;
  readonly validateOutput: OutputValidator<Output>;
  readonly replay: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidCommand(
  operation: OperationName,
  issues: readonly ValidationIssue[],
): KeynesError {
  const [first, ...rest] = issues;
  if (first === undefined)
    throw new Error("invalid command has no validation issues");
  return new KeynesError({
    kind: "error",
    code: "invalid_command",
    details: { operation, issues: [first, ...rest] },
  });
}

async function invoke<Output>(invocation: Invocation<Output>): Promise<Output> {
  const wire = await invocation.executor.execute(
    invocation.operation,
    invocation.input,
  );
  if (!isRecord(wire) || typeof wire.ok !== "boolean") {
    throw new Error(`invalid wire response for ${invocation.operation}`);
  }
  if (wire.ok === false) {
    if (!validateErrorEnvelope(wire.error)) {
      throw new Error(`invalid error response for ${invocation.operation}`);
    }
    throw new KeynesError(wire.error);
  }
  if (typeof wire.replayed !== "boolean") {
    throw new Error(`invalid result response for ${invocation.operation}`);
  }
  if (invocation.replay) {
    if (!isRecord(wire.result)) {
      throw new Error(`invalid replayable result for ${invocation.operation}`);
    }
    const result = { ...wire.result, replayed: wire.replayed };
    if (!invocation.validateOutput(result)) {
      throw new Error(`invalid result response for ${invocation.operation}`);
    }
    return structuredClone(result);
  }
  if (!invocation.validateOutput(wire.result)) {
    throw new Error(`invalid result response for ${invocation.operation}`);
  }
  return structuredClone(wire.result);
}

export function createKeynesClient(executor: CommandExecutor): KeynesClient {
  return {
    async defineResource(
      input: DefineResourceTypeCommand,
    ): Promise<DefineResourceTypeResult> {
      const operation = "defineResource";
      const issues = validateOperationInputIssues(operation, input);
      if (issues.length > 0) {
        throw invalidCommand(operation, issues);
      }
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateDefineResourceTypeResult,
        replay: true,
      });
    },
    async createBudget(
      input: CreateBudgetCommand,
    ): Promise<CreateBudgetResult> {
      const operation = "createBudget";
      const issues = validateOperationInputIssues(operation, input);
      if (issues.length > 0) {
        throw invalidCommand(operation, issues);
      }
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateCreateBudgetResult,
        replay: true,
      });
    },
    async requestBudget(
      input: RequestBudgetCommand,
    ): Promise<RequestBudgetResult> {
      const operation = "requestBudget";
      const issues = validateOperationInputIssues(operation, input);
      if (issues.length > 0) {
        throw invalidCommand(operation, issues);
      }
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateRequestBudgetResult,
        replay: true,
      });
    },
    async settleBudget(
      input: SettleBudgetCommand,
    ): Promise<SettleBudgetResult> {
      const operation = "settleBudget";
      const issues = validateOperationInputIssues(operation, input);
      if (issues.length > 0) {
        throw invalidCommand(operation, issues);
      }
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateSettleBudgetResult,
        replay: true,
      });
    },
    async getBudget(input: GetBudgetQuery): Promise<GetBudgetResult> {
      const operation = "getBudget";
      const issues = validateOperationInputIssues(operation, input);
      if (issues.length > 0) {
        throw invalidCommand(operation, issues);
      }
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateGetBudgetResult,
        replay: false,
      });
    },
  };
}
