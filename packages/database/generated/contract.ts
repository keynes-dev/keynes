// Generated from packages/database. Do not edit.

export const CONTRACT_DIGEST =
  "8877d5eb086a2304a61e7983c02e9ca2bfa42d4f8d692cdedc5c9d94591cffbe";
export const REMOTE_PROCEDURES_DIGEST =
  "bff2d60270987fda182a690e028202bfa9c826590b3cc6557f891ec004dd1d9c";
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
      revision: 4,
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
