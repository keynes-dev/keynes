import { registerBudgetLifecycleContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerBudgetLifecycleContractTests(openPostgresqlContractTestHost);
