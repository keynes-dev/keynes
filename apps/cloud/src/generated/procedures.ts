// Generated from contracts/. Do not edit.

export const CONTRACT_DIGEST =
  "cb9e2a1744efb693b83daeaf7dea92673518cf9d3809b19688355a7a73ec78c5";

export const INSTALLATION_MIGRATIONS = [
  {
    id: "0001-storage",
    byteChecksum:
      "1f1745d223274d9ddafa253b01ae61cc6e11fe9e65841667123f9914cad470dd",
    contractDigest: null,
  },
  {
    id: "0002-budget",
    byteChecksum:
      "464fabeb3119048d1f08c5d387268aede428d92db97513ec9e168b16783c6e6b",
    contractDigest: null,
  },
  {
    id: "0003-public",
    byteChecksum:
      "b5870fb835851e014e6ac0ccdafe2259482f57d1539bbddf9f996949cf4ec753",
    contractDigest: null,
  },
  {
    id: "0004-policy",
    byteChecksum:
      "d354c351b1144fe069def514c4700bcc92864f181079a6194cb832049bc4f28c",
    contractDigest:
      "f0aae48573f0c2e2fc017223d0762a43eb3cbc553924faa783eb963c9eed71a7",
  },
  {
    id: "0005-resource-bound-budget",
    byteChecksum:
      "4ce2f2eaf9a9e0c892f27311fe436334dfdbf2529482299ac6c3bfb9e67b8929",
    contractDigest:
      "cb9e2a1744efb693b83daeaf7dea92673518cf9d3809b19688355a7a73ec78c5",
  },
] as const;

export const PROCEDURES = {
  defineResource: {
    target: "keynes.define_resource_type",
    statement: "select keynes.define_resource_type($1::jsonb) as response",
    permissions: ["define_resource_type"],
    replay: true,
  },
  createBudget: {
    target: "keynes.create_budget",
    statement: "select keynes.create_budget($1::jsonb) as response",
    permissions: ["define_resource_type", "create_root_budget"],
    replay: true,
  },
  requestBudget: {
    target: "keynes.request",
    statement: "select keynes.request($1::jsonb) as response",
    permissions: ["request_budget"],
    replay: true,
  },
  settleBudget: {
    target: "keynes.settle",
    statement: "select keynes.settle($1::jsonb) as response",
    permissions: ["settle_budget"],
    replay: true,
  },
  getBudget: {
    target: "keynes.get_budget",
    statement: "select keynes.get_budget($1::jsonb) as response",
    permissions: ["read_budget"],
    replay: false,
  },
} as const;

export type OperationName = keyof typeof PROCEDURES;
