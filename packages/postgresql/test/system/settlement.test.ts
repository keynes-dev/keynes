import { registerSettlementContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerSettlementContractTests(openPostgresqlContractTestHost);
