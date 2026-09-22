import type { Policy, PolicyOutput, ResourceAmounts } from "@keynes/sdk";

import type { DeepReadonly, ParameterDeclaration } from "./parameters.ts";
import {
  createParameterSnapshot,
  restoreParameterSnapshot,
} from "./snapshot.ts";

export interface ConfiguredPolicy<
  ProposalNames extends string,
  FinalNames extends string,
> {
  readonly policy: Policy<ProposalNames, FinalNames>;
  readonly definitionId: string;
  readonly snapshotId: string;
}

type ConfigurePolicyOptions<
  ProposalNames extends string,
  FinalNames extends string,
  Values,
> = {
  readonly declaration: ParameterDeclaration<Values>;
  readonly snapshot?: unknown;
  readonly run: (
    proposal: ResourceAmounts<ProposalNames>,
    values: DeepReadonly<Values>,
  ) => PolicyOutput<FinalNames> | Promise<PolicyOutput<FinalNames>>;
};

export function configurePolicy<
  ProposalNames extends string,
  FinalNames extends string,
  Values,
>(
  options: ConfigurePolicyOptions<ProposalNames, FinalNames, Values>,
): ConfiguredPolicy<ProposalNames, FinalNames> {
  const run = captureRun(options);
  const selected =
    options.snapshot === undefined
      ? createParameterSnapshot(options.declaration)
      : restoreParameterSnapshot(options.declaration, options.snapshot);
  const policy: Policy<ProposalNames, FinalNames> = (proposal) =>
    run(proposal, selected.values);
  return Object.freeze({
    policy,
    definitionId: selected.definitionId,
    snapshotId: selected.snapshotId,
  });
}

function captureRun<
  ProposalNames extends string,
  FinalNames extends string,
  Values,
>(
  options: ConfigurePolicyOptions<ProposalNames, FinalNames, Values>,
): ConfigurePolicyOptions<ProposalNames, FinalNames, Values>["run"] {
  const descriptor = Object.getOwnPropertyDescriptor(options, "run");
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "function"
  )
    throw new TypeError("Invalid run");
  return descriptor.value;
}
