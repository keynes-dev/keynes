export type RollbackCheckpoint =
  | "after_command_binding"
  | "after_domain_mutation"
  | "after_result_storage"
  | "after_history_insertion";

export class CommittedResponseLostError extends Error {
  constructor() {
    super("Simulated lost response after committed procedure call");
    this.name = "CommittedResponseLostError";
  }
}
