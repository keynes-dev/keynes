import { registerBudgetContractTests } from "@keynes/database/contract-tests";

import { openSqliteContractTestHost } from "./test-host.js";

registerBudgetContractTests(openSqliteContractTestHost);
