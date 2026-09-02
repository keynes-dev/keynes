export const PROFILE_VERSIONS = {
  program: "keynes-policy-program/v1",
  query: "keynes-policy-query/v1",
  validator: "keynes-policy-validator/v1",
  limits: "keynes-policy-limits/v1",
} as const;

export const PROFILE_LIMITS = {
  policiesPerBudget: 16,
  inputResourcesPerPolicy: 64,
  outputResourcesPerPolicy: 64,
  contextFields: 32,
  canonicalContextBytes: 8192,
  contextTextBytes: 256,
  sourceBytesPerPolicy: 16384,
  sourceBytesPerPolicySet: 65536,
  programNodes: 512,
  programDepth: 32,
  requestedRows: 64,
  availabilityRowsPerPolicy: 64,
  resultRows: 64,
  operationsPerPolicy: 65536,
} as const;

export const WORK_KEYS = [
  "base",
  "perRequestedRow",
  "perAvailabilityRow",
  "perGroupTransition",
  "perResultSortComparison",
  "perJoinedRow",
  "perMember",
  "perBranch",
  "perArgument",
  "perExponentStep",
  "perInputRow",
] as const;
