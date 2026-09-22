import {
  configurePolicy,
  createParameterSnapshot,
  defineParameters,
  restoreParameterSnapshot,
} from "@keynes/policy";

import { riskPolicy } from "./risk-policy.js";

const declaration = defineParameters({
  orderLimit: { schema: { type: "number" }, initial: 3 },
});
const snapshot = createParameterSnapshot(declaration);
const restored = restoreParameterSnapshot(declaration, snapshot);
if (restored.snapshotId !== snapshot.snapshotId)
  throw new Error("Configured snapshot did not restore");
const configured = configurePolicy({
  declaration,
  snapshot: restored,
  run: (proposal, values) =>
    (proposal.usdCents ?? 0) <= values.orderLimit
      ? { kind: "prepared", request: proposal }
      : { kind: "rejected", code: "order_limit_exceeded" },
});
if ((await configured.policy({ usdCents: 3 })).kind !== "prepared")
  throw new Error("Configured policy did not use the restored snapshot");
if (
  (
    await riskPolicy({ kind: "unavailable", code: "assessment_unavailable" })({
      usdCents: 1,
    })
  ).kind !== "failed"
)
  throw new Error("Recorded unavailable assessment did not stay distinct");
if (
  (
    await riskPolicy(
      { kind: "unavailable", code: "assessment_unavailable" },
      { kind: "review_required", code: "manual_review" },
    )({ usdCents: 1 })
  ).kind !== "review_required"
)
  throw new Error("Recorded assessment fallback did not run");
const optionalZod = "zod";
try {
  await import(optionalZod);
  throw new Error("Core consumer unexpectedly installed zod");
} catch (error: unknown) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ERR_MODULE_NOT_FOUND"
  )
    throw error;
}
