import type { OperationName } from "../generated/types.js";

export interface CommandExecutor {
  execute(operation: OperationName, input: unknown): Promise<unknown>;
}
