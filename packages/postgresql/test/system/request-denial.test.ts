import { registerRequestDenialContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerRequestDenialContractTests(openPostgresqlContractTestHost);
