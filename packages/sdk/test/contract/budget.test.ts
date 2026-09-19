import { registerBudgetContractTests } from "@keynes/contracts/contract-tests";
import { describe } from "vitest";

import {
  openPgliteContractTestHost,
  openSqliteContractTestHost,
} from "./test-host.js";

describe("SQLite shared contract", () => {
  registerBudgetContractTests(openSqliteContractTestHost);
});

describe("PGlite shared contract", () => {
  registerBudgetContractTests(openPgliteContractTestHost);
});
