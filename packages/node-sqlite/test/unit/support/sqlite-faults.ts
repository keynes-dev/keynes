import type { CommandExecutor } from "@keynes/sdk";
import type { OperationName } from "@keynes/sdk";
import type {
  SqliteMutationObserver,
  SqliteMutationStage,
} from "../../../src/local/sqlite-command-executor.js";

export function failAtMutationStage(selected: SqliteMutationStage): {
  readonly observe: SqliteMutationObserver;
  readonly arm: () => void;
} {
  let armed = false;
  return {
    arm() {
      armed = true;
    },
    observe(current) {
      if (armed && current === selected) {
        armed = false;
        throw new Error(`test rollback checkpoint: ${current}`);
      }
    },
  };
}

export function dropCommittedResponses(
  executor: CommandExecutor,
  operation: OperationName,
  count: number,
  onCall: (input: unknown) => void,
): CommandExecutor {
  let remaining = count;
  return {
    async execute(calledOperation, input) {
      const result = await executor.execute(calledOperation, input);
      if (calledOperation !== operation) return result;
      onCall(input);
      if (remaining > 0) {
        remaining -= 1;
        const { CommittedResponseLostError } = await import("@keynes/sdk");
        throw new CommittedResponseLostError();
      }
      return result;
    },
  };
}
