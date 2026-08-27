export class CommittedResponseLostError extends Error {
  constructor() {
    super("Response lost after committed procedure call");
    this.name = "CommittedResponseLostError";
  }
}
