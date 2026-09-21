// Generated from packages/database/contract.json. Do not edit.
export const DIRECT_PROCEDURES = {
  defineResource: {
    target: "keynes.define_resource_type",
    permission: "define_resource_type",
  },
  defineResources: {
    target: "keynes.define_resources",
    permission: "define_resource_type",
  },
  validateResources: {
    target: "keynes.validate_resources",
    permission: "create_root_budget",
  },
  createBudget: {
    target: "keynes.create_budget",
    permission: "create_root_budget",
  },
  requestBudget: { target: "keynes.request", permission: "request_budget" },
  settleBudget: { target: "keynes.settle", permission: "settle_budget" },
  getBudget: { target: "keynes.get_budget", permission: "read_budget" },
} as const;
