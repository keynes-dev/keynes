# Research decisions

- Decision: Start from remote main 6dba2517580da18a088a22f0b05c95bdf594ea0a. Rationale: KEY-75 is merged; the user chose to exclude local KEY-90. Alternative: local main would introduce an unrelated prerequisite.
- Decision: No backward-compatible exports, commands, or evidence reader. Rationale: explicit user choice after noting the schema already shipped. Alternative: retaining the old identifier was rejected. Historical evidence is unchanged and interpreted at its original revision.
- Decision: Replace the required check atomically after observing the new candidate context. Rationale: live main protection requires Repository and tests and SQLite and PostgreSQL conformance, both app 15368, with strict updates and admin enforcement. Effective rules endpoint returned an empty list. Alternative: deleting the old requirement first would weaken enforcement.
- Decision: Preserve completed feature history and ADRs. Rationale: their commands and revision-specific paths describe prior revisions. Update current guidance and KEY-75's normative check contract, without rewriting dated evidence.
- No new technology choices or unresolved research questions remain; direct repository and policy inspection resolved the relevant facts.
