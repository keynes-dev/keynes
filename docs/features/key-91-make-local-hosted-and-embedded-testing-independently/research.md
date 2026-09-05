# KEY-91 design decisions after scope correction

## Why the design changed

The original issue asks for independent commands using existing runners and thin
root orchestration. Implementation through `a50ee5b` added 5,969 net code/test
lines against `5b294f4`. Per-phase complexity reviews did not challenge the total
cost of the new orchestration, manifests, TLS fixture system and consumer driver.
The user rejected that expansion and chose separate feedback and acceptance.

This decision supersedes the earlier selected-evidence, TLS-provisioning, and
consumer-composition decisions. Their original rationale remains in Git at
`a50ee5b`. Current target behavior is defined in spec.md and plan.md; the reduced
implementation is pending T055-T061.

## Reuse and removal decisions

| Decision                                                                | Reason                                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Use existing SDK source groups for Local                                | Contributors need source feedback without packaging or services. Existing installed qualification remains separate.                    |
| Select modes/files in the native runner                                 | Startup and cleanup already exist. A second deployment orchestrator duplicates their ownership.                                        |
| Remove selected manifests and copied Local/shared assertion inventories | Full acceptance already owns durable evidence validation. Feedback can use existing suite registration and ordinary results.           |
| Remove separate TLS provisioning and remote consumer protocol           | Those systems expanded KEY-91 beyond test selection. Their removal leaves an explicit installed remote acceptance gap.                 |
| Keep simple product-unavailable messages                                | Missing Hosted and installed Embedded products do not need a manifest system to explain their absence.                                 |
| Retain demonstrated existing-runner repairs                             | Package preparation races, child termination and container/network cleanup failures remain correctness problems for surviving callers. |
| Review cumulative changes per phase                                     | A locally simple component can still be an unnecessary addition to the whole design.                                                   |

## Existing evidence and product limits

The completed [study](testing-strategy.md) adopted removal of duplicate contracts
execution in `test:pr`, retained the standalone alias and verified failure
propagation through Turbo. Its timings and coverage apply to its recorded source.
No new measurement campaign is required for the correction. Preserve its files
and evidence index unchanged; do not claim a new speedup from historical timing.

Installer recheck removal, packaging CI restructuring, unused remote registrar
activation, and broad Policy migration remain deferred. Preserve shared and
boundary-specific assertions in their current owners.

The last recorded KEY-10/KEY-11 read found both unfinished, and current fixtures
provide application grants beyond a supported Embedded profile. Their phase
observations remain in acceptance.md. Fixture success cannot establish installed
Embedded support. Hosted product delivery must provide its environment and
operating contract before live acceptance. The authorized-database walkthrough
is not a substitute for either missing product contract.
