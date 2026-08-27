import type { CommandExecutor } from "../../../packages/sdk/src/command-executor.js";
import type { SqliteMutationStage } from "../../../packages/sdk/src/local/sqlite-command-executor.js";
import { CommittedResponseLostError } from "../../../packages/sdk/src/replay.js";

export { CommittedResponseLostError };
export type RollbackCheckpoint = SqliteMutationStage;

export function loseCommittedResponseOnce(
  executor: CommandExecutor,
  enabled: boolean,
): CommandExecutor {
  let pending = enabled;
  return {
    async execute(operation, input) {
      const result = await executor.execute(operation, input);
      if (pending) {
        pending = false;
        throw new CommittedResponseLostError();
      }
      return result;
    },
  };
}
