import "../unit/support/pglite-snapshot.js";

import { registerBudgetContractTests } from "@keynes/contracts/contract-tests";

import { openPgliteContractTestHost } from "./test-host.js";

registerBudgetContractTests(openPgliteContractTestHost);
