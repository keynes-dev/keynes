import { registerBudgetContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerBudgetContractTests(openPostgresqlContractTestHost);
