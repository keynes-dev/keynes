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
  RemoteCreateBudgetCommand,
  RemoteCreateBudgetResult,
  RemoteRequestBudgetCommand,
  RemoteRequestBudgetResult,
  RemoteSettleBudgetCommand,
  RemoteSettleBudgetResult,
  RemoteGetBudgetQuery,
  RemoteGetBudgetResult,
  GetBudgetHistoryPageQuery,
  GetBudgetHistoryPageResult,
  OpenBudgetQuery,
  OpenBudgetResult,
  RecoverOperationQuery,
  RecoverOperationResult,
  GetCompatibilityQuery,
  GetCompatibilityResult,
  ErrorEnvelope,
  OperationName,
  RemoteErrorEnvelope,
  RemoteProcedureName,
} from "./types.js";
import {
  validateDefineResourceTypeResult,
  validateCreateBudgetResult,
  validateRequestBudgetResult,
  validateSettleBudgetResult,
  validateGetBudgetResult,
  validateRemoteCreateBudgetCommandIssues,
  validateRemoteCreateBudgetResult,
  validateRemoteRequestBudgetCommandIssues,
  validateRemoteRequestBudgetResult,
  validateRemoteSettleBudgetCommandIssues,
  validateRemoteSettleBudgetResult,
  validateRemoteGetBudgetQueryIssues,
  validateRemoteGetBudgetResult,
  validateGetBudgetHistoryPageQueryIssues,
  validateGetBudgetHistoryPageResult,
  validateOpenBudgetQueryIssues,
  validateOpenBudgetResult,
  validateRecoverOperationQueryIssues,
  validateRecoverOperationResult,
  validateGetCompatibilityQueryIssues,
  validateGetCompatibilityResult,
  validateOperationInputIssues,
  validateRemoteErrorEnvelope,
  validateErrorEnvelope,
} from "./validators.js";
import type { ValidationIssue } from "./validators.js";

export const CONTRACT_DIGEST =
  "85b6193ade401110325fb22569c52c72f298d52effd4e52dcc518cf10ea46a5b";

export const REMOTE_PROCEDURES_DIGEST =
  "77c9b438a027f181c5dc5b6997c91be8c4b8e2927e1f9ed9578d3cab0c3d3d43";
export const REMOTE_CONTRACT = {
  semanticGeneration: 1,
  minimumSdkGeneration: 1,
  semanticIdentities: [
    "installation",
    "command_contract",
    "policy_profile",
    "remote_procedures",
  ],
  procedures: [
    {
      method: "createBudget",
      target: "keynes.remote_create_budget",
      revision: 1,
      mode: "mutation",
      input: "RemoteCreateBudgetCommand",
      output: "RemoteCreateBudgetResult",
    },
    {
      method: "requestBudget",
      target: "keynes.remote_request",
      revision: 1,
      mode: "mutation",
      input: "RemoteRequestBudgetCommand",
      output: "RemoteRequestBudgetResult",
    },
    {
      method: "settleBudget",
      target: "keynes.remote_settle",
      revision: 1,
      mode: "mutation",
      input: "RemoteSettleBudgetCommand",
      output: "RemoteSettleBudgetResult",
    },
    {
      method: "getBudget",
      target: "keynes.remote_get_budget",
      revision: 1,
      mode: "read",
      input: "RemoteGetBudgetQuery",
      output: "RemoteGetBudgetResult",
    },
    {
      method: "getBudgetHistoryPage",
      target: "keynes.remote_get_budget_history_page",
      revision: 1,
      mode: "read",
      input: "GetBudgetHistoryPageQuery",
      output: "GetBudgetHistoryPageResult",
    },
    {
      method: "openBudget",
      target: "keynes.remote_open_budget",
      revision: 1,
      mode: "read",
      input: "OpenBudgetQuery",
      output: "OpenBudgetResult",
    },
    {
      method: "recoverOperation",
      target: "keynes.remote_recover_operation",
      revision: 1,
      mode: "read",
      input: "RecoverOperationQuery",
      output: "RecoverOperationResult",
    },
    {
      method: "getCompatibility",
      target: "keynes.remote_get_compatibility",
      revision: 1,
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
    "kind",
    "availabilityJoin",
    "base",
    "branches",
    "code",
    "details",
    "else",
    "entryId",
    "exponent",
    "function",
    "arguments",
    "name",
    "operationKey",
    "budgetReference",
    "budget",
    "cursor",
    "error",
    "expectedResources",
    "history",
    "operation",
    "operator",
    "left",
    "operand",
    "parentBudgetReference",
    "childBudgetReference",
    "path",
    "resource",
    "resourceType",
    "allocated",
    "definitionEvidence",
    "resourceTypeId",
    "canonicalName",
    "requested",
    "available",
    "ceiling",
    "committed",
    "directUsage",
    "policyName",
    "policyRevision",
    "reason",
    "result",
    "retryAfterMilliseconds",
    "right",
    "rootBudgetReference",
    "rule",
    "scale",
    "sequence",
    "commandId",
    "definition",
    "amount",
    "source",
    "field",
    "subjectBudgetId",
    "budgetId",
    "newlyKnown",
    "parentBudgetId",
    "childBudgetId",
    "rootBudgetId",
    "depth",
    "entries",
    "nextCursor",
    "subtreeObservedUsage",
    "target",
    "revision",
    "inputResources",
    "outputResources",
    "contextSchema",
    "reasons",
    "programVersion",
    "queryProfileVersion",
    "type",
    "unit",
    "accountingBehavior",
    "unresolved",
    "deficit",
    "unresolvedResourceTypeIds",
    "unresolvedResources",
    "lifecycle",
    "isolatedDeficits",
    "resources",
    "context",
    "childPolicies",
    "policies",
    "effectiveCeilings",
    "decision",
    "policyEvidence",
    "replayed",
    "usage",
    "validatorVersion",
    "limitsVersion",
    "policyProfileDigest",
    "program",
    "canonicalSql",
    "remoteProceduresDigest",
    "semanticGeneration",
    "minimumSdkGeneration",
    "procedures",
    "sourceDigest",
    "definitionDigest",
    "value",
    "values",
    "valueType",
    "nullable",
    "where",
    "groupBy",
    "orderBy",
  ].map((field, index) => [field, index]),
);

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

function orderResult<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map(orderResult) as Value;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => {
        const rank =
          (resultFieldRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (resultFieldRank.get(right) ?? Number.MAX_SAFE_INTEGER);
        return rank || left.localeCompare(right);
      })
      .map(([key, member]) => [key, orderResult(member)]),
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

export type RemoteProcedureDescriptor =
  (typeof REMOTE_CONTRACT.procedures)[number];

export interface RemoteCommandExecutor {
  execute(
    procedure: RemoteProcedureDescriptor,
    input: unknown,
  ): Promise<unknown>;
}

export interface RemoteKeynesClient {
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

interface RemoteInvocation<Output> {
  readonly executor: RemoteCommandExecutor;
  readonly procedure: RemoteProcedureDescriptor;
  readonly input: unknown;
  readonly validateOutput: OutputValidator<Output>;
}

function invalidRemoteCommand(
  operation: RemoteProcedureName,
  issues: readonly ValidationIssue[],
): KeynesError {
  const [first, ...rest] = issues;
  if (first === undefined) {
    throw new Error("invalid remote command has no validation issues");
  }
  return new KeynesError({
    kind: "error",
    code: "invalid_command",
    details: { operation, issues: [first, ...rest] },
  });
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
    async createBudget(
      input: RemoteCreateBudgetCommand,
    ): Promise<RemoteCreateBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[0];
      const issues = validateRemoteCreateBudgetCommandIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteCreateBudgetResult,
      });
    },
    async requestBudget(
      input: RemoteRequestBudgetCommand,
    ): Promise<RemoteRequestBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[1];
      const issues = validateRemoteRequestBudgetCommandIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteRequestBudgetResult,
      });
    },
    async settleBudget(
      input: RemoteSettleBudgetCommand,
    ): Promise<RemoteSettleBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[2];
      const issues = validateRemoteSettleBudgetCommandIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteSettleBudgetResult,
      });
    },
    async getBudget(
      input: RemoteGetBudgetQuery,
    ): Promise<RemoteGetBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[3];
      const issues = validateRemoteGetBudgetQueryIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRemoteGetBudgetResult,
      });
    },
    async getBudgetHistoryPage(
      input: GetBudgetHistoryPageQuery,
    ): Promise<GetBudgetHistoryPageResult> {
      const procedure = REMOTE_CONTRACT.procedures[4];
      const issues = validateGetBudgetHistoryPageQueryIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateGetBudgetHistoryPageResult,
      });
    },
    async openBudget(input: OpenBudgetQuery): Promise<OpenBudgetResult> {
      const procedure = REMOTE_CONTRACT.procedures[5];
      const issues = validateOpenBudgetQueryIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateOpenBudgetResult,
      });
    },
    async recoverOperation(
      input: RecoverOperationQuery,
    ): Promise<RecoverOperationResult> {
      const procedure = REMOTE_CONTRACT.procedures[6];
      const issues = validateRecoverOperationQueryIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateRecoverOperationResult,
      });
    },
    async getCompatibility(
      input: GetCompatibilityQuery,
    ): Promise<GetCompatibilityResult> {
      const procedure = REMOTE_CONTRACT.procedures[7];
      const issues = validateGetCompatibilityQueryIssues(input);
      if (issues.length > 0) {
        throw invalidRemoteCommand(procedure.method, issues);
      }
      return invokeRemote({
        executor,
        procedure,
        input,
        validateOutput: validateGetCompatibilityResult,
      });
    },
  };
}
