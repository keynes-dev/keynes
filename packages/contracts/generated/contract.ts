// Generated from packages/contracts. Do not edit.

export const CONTRACT_DIGEST =
  "365386e907e27e6ddab7a178677865cf231fd8969d82623e010201308fd49c4f";
export const REMOTE_PROCEDURES_DIGEST =
  "36571ea4085453a0a0775fed58dbaabecd39e53ca4a4ec9b57250cee79b63253";
export const REMOTE_CONTRACT = {
  semanticGeneration: 2,
  minimumSdkGeneration: 2,
  semanticIdentities: [
    "installation",
    "command_contract",
    "policy_profile",
    "remote_procedures",
  ],
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
      method: "createBudget",
      target: "keynes.remote_create_budget",
      revision: 2,
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
