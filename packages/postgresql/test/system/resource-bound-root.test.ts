import { registerResourceBoundRootContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerResourceBoundRootContractTests(openPostgresqlContractTestHost);
