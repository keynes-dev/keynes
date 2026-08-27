import { registerReplayContractTests } from "@keynes/contracts/conformance";

import { openPostgresqlContractTestHost } from "./support/test-keynes.js";

registerReplayContractTests(openPostgresqlContractTestHost);
