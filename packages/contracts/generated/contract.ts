// Generated from packages/contracts. Do not edit.

export const CONTRACT_DIGEST =
  "046373b4c3c42d50437a120a3ba952ed08f5259fbe5c282d47fda0f04b033766";
export const REMOTE_PROCEDURES_DIGEST =
  "b72a9058b6f827d859168932e6f8c04fedc312f79bef7cb59ebb685478d4eedd";
export const REMOTE_CONTRACT = {
  semanticGeneration: 4,
  minimumSdkGeneration: 4,
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
      revision: 4,
      mode: "mutation",
      input: "RemoteCreateBudgetCommand",
      output: "RemoteCreateBudgetResult",
    },
    {
      method: "requestBudget",
      target: "keynes.remote_request",
      revision: 2,
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
      revision: 2,
      mode: "read",
      input: "RemoteGetBudgetQuery",
      output: "RemoteGetBudgetResult",
    },
    {
      method: "getBudgetHistoryPage",
      target: "keynes.remote_get_budget_history_page",
      revision: 2,
      mode: "read",
      input: "GetBudgetHistoryPageQuery",
      output: "GetBudgetHistoryPageResult",
    },
    {
      method: "openBudget",
      target: "keynes.remote_open_budget",
      revision: 2,
      mode: "read",
      input: "OpenBudgetQuery",
      output: "OpenBudgetResult",
    },
    {
      method: "recoverOperation",
      target: "keynes.remote_recover_operation",
      revision: 2,
      mode: "read",
      input: "RecoverOperationQuery",
      output: "RecoverOperationResult",
    },
    {
      method: "getCompatibility",
      target: "keynes.remote_get_compatibility",
      revision: 2,
      mode: "read",
      input: "GetCompatibilityQuery",
      output: "GetCompatibilityResult",
    },
  ],
} as const;
