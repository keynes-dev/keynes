# Conceptual model for the documentation

This is an ownership model for prose and examples, not a new database schema or exported type contract. Exact request fields belong to KEY-114; helper interfaces belong to KEY-116/117/118.

| Concept             | Relevant information                                                                  | Owner and validation                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Customer evaluation | Facts, chosen parameters, optional structured assessment, request or rejection        | Customer validates inputs and outputs and handles failures/fallback. Any language or customer-chosen hosting is allowed.        |
| Parameter snapshot  | Configuration values and a customer/tooling identity or version                       | Optional tooling creates/loads snapshots; customer chooses which to evaluate. It is not live Budget availability.               |
| Request             | Resource names and exact quantities addressed to a Budget through a supported command | Customer constructs; authority validates, checks permissions/constraints/availability and atomically denies or allocates.       |
| Decision evidence   | Claimed inputs, parameters, evaluator identity and result when retained               | Customer-supplied; never proof of execution, authority or correctness. Exclude secrets. No mandatory evidence shape introduced. |
| Budget              | Resource membership, quantities, controls, lifecycle and lineage                      | One SQLite or PostgreSQL authority under the current contract. Workers/workflows/steps use the same concept.                    |
| Command outcome     | Identity, canonical input and recorded result/history                                 | Keynes owns atomic recording, exact replay and conflict rejection.                                                              |

## Transitions and failure ownership

1. Customer evaluation may reject or fail before any Keynes command exists. Any fallback or recomputation belongs to the customer.
2. A submitted request can fail validation or permission/lifecycle checks, or receive a recorded quantity denial under the command contract. Syntax validity does not guarantee approval.
3. Approval atomically allocates the requested quantity and creates the child. It says nothing about policy execution or external work.
4. Applications execute work and report usage. Keynes enforces settlement and keeps missing usage/overage explicit; evidence does not mint quantity.
5. Exact command replay returns the recorded outcome without reevaluation. Changed canonical input with the same identity conflicts. Reevaluation or a new attempt must be explicit and customer-owned.

Customer SQL can run in a caller-owned PostgreSQL transaction with supported Keynes commands; the caller controls commit/rollback and results are provisional until commit. Separate databases or evaluation services do not gain a shared atomic transaction. First Local exposes no database handle or caller-owned PostgreSQL transaction.

KEY-122 owns any later amendment to cross-authority ownership and funding. No transfers, delegation states, durable Local schema or reconciliation protocol are defined here.
