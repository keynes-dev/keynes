import type { OpenContractTestHost } from "../host.ts";

import { registerBudgetLifecycleContractTests } from "./budget-lifecycle.ts";
import { registerReplayContractTests } from "./replay.ts";
import { registerRequestDenialContractTests } from "./request-denial.ts";
import { registerRollbackContractTests } from "./rollback.ts";
import { registerSettlementContractTests } from "./settlement.ts";

export {
  registerBudgetLifecycleContractTests,
  registerReplayContractTests,
  registerRequestDenialContractTests,
  registerRollbackContractTests,
  registerSettlementContractTests,
};

export function registerBudgetContractTests(
  openHost: OpenContractTestHost,
): void {
  registerBudgetLifecycleContractTests(openHost);
  registerReplayContractTests(openHost);
  registerRequestDenialContractTests(openHost);
  registerRollbackContractTests(openHost);
  registerSettlementContractTests(openHost);
}
