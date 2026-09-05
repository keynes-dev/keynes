import { registerBudgetContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerBudgetContractTests(openPostgresqlContractTestHost);

import { afterEach, expect } from "vitest";
let firstDemonstration = true;
afterEach(() => {
  if (firstDemonstration) {
    firstDemonstration = false;
    expect("KEY-75 deliberate native failure").toBe("passing");
  }
});
