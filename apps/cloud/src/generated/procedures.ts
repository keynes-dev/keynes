// Generated from contracts/. Do not edit.

export const CONTRACT_DIGEST =
  "0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6";

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
    contractDigest:
      "0453c8e661a77bc053254c67b1fb90bf19309bc8af5f5190ecf38c5f205720d6",
  },
] as const;

export const PROCEDURES = {
  defineResource: {
    target: "keynes.define_resource_type",
    statement: "select keynes.define_resource_type($1::jsonb) as response",
    permission: "define_resource_type",
    replay: true,
  },
  createBudget: {
    target: "keynes.create_budget",
    statement: "select keynes.create_budget($1::jsonb) as response",
    permission: "create_root_budget",
    replay: true,
  },
  requestBudget: {
    target: "keynes.request",
    statement: "select keynes.request($1::jsonb) as response",
    permission: "request_budget",
    replay: true,
  },
  settleBudget: {
    target: "keynes.settle",
    statement: "select keynes.settle($1::jsonb) as response",
    permission: "settle_budget",
    replay: true,
  },
  getBudget: {
    target: "keynes.get_budget",
    statement: "select keynes.get_budget($1::jsonb) as response",
    permission: "read_budget",
    replay: false,
  },
} as const;

export type OperationName = keyof typeof PROCEDURES;
