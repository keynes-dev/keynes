// Generated from contracts/. Do not edit.

import type { CommandExecutor } from "../command-executor.js";
import type {
  DefineResourceTypeResult,
  DefineResourcesResult,
  ValidateResourcesResult,
  CreateBudgetResult,
  RequestBudgetResult,
  SettleBudgetResult,
  GetBudgetResult,
  RemoteDefineResourcesResult,
  RemoteCreateBudgetResult,
  RemoteRequestBudgetResult,
  RemoteSettleBudgetResult,
  RemoteGetBudgetResult,
  GetBudgetHistoryPageResult,
  OpenBudgetResult,
  RecoverOperationResult,
  GetCompatibilityResult,
  ErrorEnvelope,
  OperationName,
  RemoteErrorEnvelope,
} from "./types.js";
import {
  validateDefineResourceTypeResult,
  validateDefineResourcesResult,
  validateValidateResourcesResult,
  validateCreateBudgetResult,
  validateRequestBudgetResult,
  validateSettleBudgetResult,
  validateGetBudgetResult,
  validateRemoteDefineResourcesResult,
  validateRemoteCreateBudgetResult,
  validateRemoteRequestBudgetResult,
  validateRemoteSettleBudgetResult,
  validateRemoteGetBudgetResult,
  validateGetBudgetHistoryPageResult,
  validateOpenBudgetResult,
  validateRecoverOperationResult,
  validateGetCompatibilityResult,
  validateRemoteErrorEnvelope,
  validateErrorEnvelope,
} from "./validators.js";

export const CONTRACT_DIGEST =
  "58fbd93b13e5efd6258916f449e9de91f4a881c4707482bc046b05125f86cd13";

export const REMOTE_PROCEDURES_DIGEST =
  "22e7b3c80e526694f87f9872bed0645bab4e80d7f472669191354afbe7f2d327";
export const REMOTE_CONTRACT = {
  semanticGeneration: 6,
  minimumSdkGeneration: 6,
  semanticIdentities: ["installation", "command_contract", "remote_procedures"],
  procedures: [
    {
      method: "defineResources",
      target: "keynes.remote_define_resources",
      revision: 1,
      mode: "mutation",
      input: "RemoteDefineResourcesCommand",
      output: "RemoteDefineResourcesResult",
    },
    {
      method: "validateResources",
      target: "keynes.remote_validate_resources",
      revision: 1,
      mode: "read",
      input: "ValidateResourcesQuery",
      output: "ValidateResourcesResult",
    },
    {
      method: "createBudget",
      target: "keynes.remote_create_budget",
      revision: 5,
      mode: "mutation",
      input: "RemoteCreateBudgetCommand",
      output: "RemoteCreateBudgetResult",
    },
    {
      method: "requestBudget",
      target: "keynes.remote_request",
      revision: 3,
      mode: "mutation",
      input: "RemoteRequestBudgetCommand",
      output: "RemoteRequestBudgetResult",
    },
    {
      method: "settleBudget",
      target: "keynes.remote_settle",
      revision: 2,
      mode: "mutation",
      input: "RemoteSettleBudgetCommand",
      output: "RemoteSettleBudgetResult",
    },
    {
      method: "getBudget",
      target: "keynes.remote_get_budget",
      revision: 3,
      mode: "read",
      input: "RemoteGetBudgetQuery",
      output: "RemoteGetBudgetResult",
    },
    {
      method: "getBudgetHistoryPage",
      target: "keynes.remote_get_budget_history_page",
      revision: 3,
      mode: "read",
      input: "GetBudgetHistoryPageQuery",
      output: "GetBudgetHistoryPageResult",
    },
    {
      method: "openBudget",
      target: "keynes.remote_open_budget",
      revision: 3,
      mode: "read",
      input: "OpenBudgetQuery",
      output: "OpenBudgetResult",
    },
    {
      method: "recoverOperation",
      target: "keynes.remote_recover_operation",
      revision: 4,
      mode: "read",
      input: "RecoverOperationQuery",
      output: "RecoverOperationResult",
    },
    {
      method: "getCompatibility",
      target: "keynes.remote_get_compatibility",
      revision: 3,
      mode: "read",
      input: "GetCompatibilityQuery",
      output: "GetCompatibilityResult",
    },
  ],
} as const;

const resultFieldRank = new Map(
  [
    "installationId",
    "contractDigest",
    "key",
    "kind",
    "bindingReference",
    "code",
    "details",
    "entryId",
    "name",
    "operationKey",
    "budgetReference",
    "budget",
    "cursor",
    "error",
    "expectedResources",
    "history",
    "operation",
    "parentBudgetReference",
    "childBudgetReference",
    "path",
    "remoteProceduresDigest",
    "resource",
    "resourceType",
    "allocated",
    "definitionEvidence",
    "resourceTypeId",
    "canonicalName",
    "requested",
    "available",
    "committed",
    "directUsage",
    "result",
    "retryAfterMilliseconds",
    "rootBudgetReference",
    "rule",
    "semanticGeneration",
    "minimumSdkGeneration",
    "procedures",
    "sequence",
    "commandId",
    "definition",
    "amount",
    "definitions",
    "amounts",
    "subjectBudgetId",
    "budgetId",
    "newlyKnown",
    "parentBudgetId",
    "childBudgetId",
    "reasons",
    "rootBudgetId",
    "depth",
    "entries",
    "nextCursor",
    "subtreeObservedUsage",
    "target",
    "revision",
    "unit",
    "accountingBehavior",
    "definitionDigest",
    "unresolved",
    "deficit",
    "unresolvedResourceTypeIds",
    "unresolvedResources",
    "lifecycle",
    "isolatedDeficits",
    "resources",
    "replayed",
    "decisionEvidence",
    "usage",
    "valid",
  ].map((field, index) => [field, index]),
);

export interface KeynesClient {
  defineResource(input: unknown): Promise<DefineResourceTypeResult>;
  defineResources(input: unknown): Promise<DefineResourcesResult>;
  validateResources(input: unknown): Promise<ValidateResourcesResult>;
  createBudget(input: unknown): Promise<CreateBudgetResult>;
  requestBudget(input: unknown): Promise<RequestBudgetResult>;
  settleBudget(input: unknown): Promise<SettleBudgetResult>;
  getBudget(input: unknown): Promise<GetBudgetResult>;
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

function orderResult<Value>(value: Value, preserveAsciiOrder = false): Value {
  if (Array.isArray(value))
    return value.map((member) =>
      orderResult(member, preserveAsciiOrder),
    ) as Value;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => {
        if (preserveAsciiOrder) return left < right ? -1 : left > right ? 1 : 0;
        const rank =
          (resultFieldRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (resultFieldRank.get(right) ?? Number.MAX_SAFE_INTEGER);
        return rank || left.localeCompare(right);
      })
      .map(([key, member]) => [
        key,
        orderResult(member, preserveAsciiOrder || key === "decisionEvidence"),
      ]),
  ) as Value;
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
    return orderResult(result);
  }
  if (!invocation.validateOutput(wire.result)) {
    throw new Error(`invalid result response for ${invocation.operation}`);
  }
  return orderResult(wire.result);
}

export function createKeynesClient(executor: CommandExecutor): KeynesClient {
  return {
    async defineResource(input: unknown): Promise<DefineResourceTypeResult> {
      const operation = "defineResource";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateDefineResourceTypeResult,
        replay: true,
      });
    },
    async defineResources(input: unknown): Promise<DefineResourcesResult> {
      const operation = "defineResources";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateDefineResourcesResult,
        replay: true,
      });
    },
    async validateResources(input: unknown): Promise<ValidateResourcesResult> {
      const operation = "validateResources";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateValidateResourcesResult,
        replay: false,
      });
    },
    async createBudget(input: unknown): Promise<CreateBudgetResult> {
      const operation = "createBudget";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateCreateBudgetResult,
        replay: true,
      });
    },
    async requestBudget(input: unknown): Promise<RequestBudgetResult> {
      const operation = "requestBudget";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateRequestBudgetResult,
        replay: true,
      });
    },
    async settleBudget(input: unknown): Promise<SettleBudgetResult> {
      const operation = "settleBudget";
      return invoke({
        executor,
        operation,
        input,
        validateOutput: validateSettleBudgetResult,
        replay: true,
      });
    },
    async getBudget(input: unknown): Promise<GetBudgetResult> {
      const operation = "getBudget";
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

export type RemoteProcedureDescriptor =
  (typeof REMOTE_CONTRACT.procedures)[number];

export interface RemoteCommandExecutor {
  execute(
    procedure: RemoteProcedureDescriptor,
    input: unknown,
  ): Promise<unknown>;
}

export interface RemoteKeynesClient {
  defineResources(input: unknown): Promise<RemoteDefineResourcesResult>;
  validateResources(input: unknown): Promise<ValidateResourcesResult>;
  createBudget(input: unknown): Promise<RemoteCreateBudgetResult>;
  requestBudget(input: unknown): Promise<RemoteRequestBudgetResult>;
  settleBudget(input: unknown): Promise<RemoteSettleBudgetResult>;
  getBudget(input: unknown): Promise<RemoteGetBudgetResult>;
  getBudgetHistoryPage(input: unknown): Promise<GetBudgetHistoryPageResult>;
  openBudget(input: unknown): Promise<OpenBudgetResult>;
  recoverOperation(input: unknown): Promise<RecoverOperationResult>;
  getCompatibility(input: unknown): Promise<GetCompatibilityResult>;
}

interface RemoteInvocation<Output> {
  readonly executor: RemoteCommandExecutor;
  readonly procedure: RemoteProcedureDescriptor;
  readonly input: unknown;
  readonly validateOutput: OutputValidator<Output>;
}

async function invokeRemote<Output>(
  invocation: RemoteInvocation<Output>,
): Promise<Output> {
  const wire = await invocation.executor.execute(
    invocation.procedure,
    invocation.input,
  );
  if (!isRecord(wire) || typeof wire.ok !== "boolean") {
    throw new Error(
      `invalid remote wire response for ${invocation.procedure.method}`,
    );
  }
  if (wire.ok === false) {
    if (validateRemoteErrorEnvelope(wire.error)) {
      throw new KeynesError(wire.error);
    }
    throw new Error(
      `invalid remote error response for ${invocation.procedure.method}`,
    );
  }
  if (!invocation.validateOutput(wire.result)) {
    throw new Error(
      `invalid remote result response for ${invocation.procedure.method}`,
    );
  }
  return orderResult(wire.result);
}

export function createRemoteKeynesClient(
  executor: RemoteCommandExecutor,
): RemoteKeynesClient {
  return {
    async defineResources(
      input: unknown,
    ): Promise<RemoteDefineResourcesResult> {
      const procedure = REMOTE_CONTRACT.procedures[0];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteDefineResourcesResult,
      });
    },
    async validateResources(input: unknown): Promise<ValidateResourcesResult> {
      const procedure = REMOTE_CONTRACT.procedures[1];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateValidateResourcesResult,
      });
    },
    async createBudget(input: unknown): Promise<RemoteCreateBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[2];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteCreateBudgetResult,
      });
    },
    async requestBudget(input: unknown): Promise<RemoteRequestBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[3];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteRequestBudgetResult,
      });
    },
    async settleBudget(input: unknown): Promise<RemoteSettleBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[4];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteSettleBudgetResult,
      });
    },
    async getBudget(input: unknown): Promise<RemoteGetBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[5];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteGetBudgetResult,
      });
    },
    async getBudgetHistoryPage(
      input: unknown,
    ): Promise<GetBudgetHistoryPageResult> {
      const procedure = REMOTE_CONTRACT.procedures[6];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateGetBudgetHistoryPageResult,
      });
    },
    async openBudget(input: unknown): Promise<OpenBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[7];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateOpenBudgetResult,
      });
    },
    async recoverOperation(input: unknown): Promise<RecoverOperationResult> {
      const procedure = REMOTE_CONTRACT.procedures[8];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRecoverOperationResult,
      });
    },
    async getCompatibility(input: unknown): Promise<GetCompatibilityResult> {
      const procedure = REMOTE_CONTRACT.procedures[9];
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateGetCompatibilityResult,
      });
    },
  };
}
