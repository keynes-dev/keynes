# Data model

This feature adds no persisted schema or product entity.

| Existing concept        | Ownership and lifetime                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Native selection        | Existing closed full/Remote/Embedded selection; validated before acquisition                                                    |
| Installation choice     | Source, or packed with an exact prepared CLI path; feedback cannot carry packed requirements                                    |
| Native context          | Vitest provides serializable run identity, selected endpoints and installation choice; credentials stay out of retained reports |
| Service handles         | Global setup owns started PostgreSQL, selected poolers and network until ordinary teardown; Ryuk remains enabled                |
| Ordinary fixture        | Existing helpers own isolated database, roles, clients and real transactions; one installation, explicit close                  |
| Packed archive          | Existing package helper owns archive identity and temporary installed consumer until cleanup                                    |
| Acceptance and sidecars | Existing schemas and exclusive writer; full passing inventory, unchanged source and successful cleanup required                 |

Source/packed is an internal closed choice, not a backend registry or public option.
Feedback has no archive or installed-consumer lifecycle. Full acceptance can include
both source tests and existing installed-artifact tests without conflating their proof.

Follow [design and ownership](plan.md#design-and-ownership) for ordering and
[qualification compatibility](contracts/qualification.md) for preserved evidence.
