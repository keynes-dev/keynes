import { registerBudgetContractTests } from "@keynes/contracts/conformance";

import { openSqliteContractTestHost } from "./test-host.js";

registerBudgetContractTests(openSqliteContractTestHost);
