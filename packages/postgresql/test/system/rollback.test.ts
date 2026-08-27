import { registerRollbackContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerRollbackContractTests(openPostgresqlContractTestHost);
