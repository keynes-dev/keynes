import { registerBudgetContractTests } from "@keynes/database/contract-tests";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerBudgetContractTests(openPostgresqlContractTestHost);
