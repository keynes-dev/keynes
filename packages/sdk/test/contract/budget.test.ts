import { registerBudgetContractTests } from "@keynes/contracts/contract-tests";

import { openSqliteContractTestHost } from "./test-host.js";

registerBudgetContractTests(openSqliteContractTestHost);
