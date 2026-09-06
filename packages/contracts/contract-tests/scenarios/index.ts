import type { OpenContractTestHost } from "../host.ts";

import { registerBudgetLifecycleContractTests } from "./budget-lifecycle.ts";
import { registerReplayContractTests } from "./replay.ts";
import { registerRequestDenialContractTests } from "./request-denial.ts";
import { registerResourceBoundRootContractTests } from "./resource-bound-root.ts";
import { registerResourceDefinitionsContractTests } from "./resource-definitions.ts";
import { registerRollbackContractTests } from "./rollback.ts";
import { registerSettlementContractTests } from "./settlement.ts";
import { registerRemoteContractTests } from "./remote.ts";

export {
  registerBudgetLifecycleContractTests,
  registerReplayContractTests,
  registerRequestDenialContractTests,
  registerResourceBoundRootContractTests,
  registerResourceDefinitionsContractTests,
  registerRollbackContractTests,
  registerSettlementContractTests,
  registerRemoteContractTests,
};

export function registerBudgetContractTests(
  openHost: OpenContractTestHost,
): void {
  registerBudgetLifecycleContractTests(openHost);
  registerReplayContractTests(openHost);
  registerRequestDenialContractTests(openHost);
  registerResourceBoundRootContractTests(openHost);
  registerResourceDefinitionsContractTests(openHost);
  registerRollbackContractTests(openHost);
  registerSettlementContractTests(openHost);
}
