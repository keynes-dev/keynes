# Private Cloud service retirement contract

`apps/cloud` remains active until direct PostgreSQL coverage owns each assertion that is still required. Historical FEAT-0006 documents and retained evidence never change.

Before deletion, inventory every Cloud edge in workspace discovery, generation, root commands, structural checks, package dependencies, tests, documentation, and workflows. Classify each edge as:

- replaced by a named SDK or PostgreSQL test;
- obsolete because it tests the rejected HTTP data path; or
- deferred to a later self-hosted or managed feature.

The replacement map must cover authenticated tenant isolation, procedure allowlisting, replay and conflict behavior, response loss, reconnect after process loss, database unavailability, safe errors, and any shared Budget assertions not already owned elsewhere.

Delete the active service only after the map has no unexplained edge and the replacement tests pass at the same revision. Remove its generation, unit, system, workspace, root-script, and repository-layout references in the same change. Do not delete historical feature artifacts or rewrite old evidence as proof of the direct PostgreSQL path.
