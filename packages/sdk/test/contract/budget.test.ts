import { registerBudgetContractTests } from "@keynes/contracts/contract-tests";
import { describe } from "vitest";

import { openPgliteContractTestHost } from "./test-host.js";

describe("PGlite shared contract", () => {
  registerBudgetContractTests(openPgliteContractTestHost);
});
