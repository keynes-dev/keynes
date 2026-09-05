import { registerBudgetContractTests } from "@keynes/contracts/contract-tests";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerBudgetContractTests(openPostgresqlContractTestHost);
