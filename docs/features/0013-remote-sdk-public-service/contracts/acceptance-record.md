# Acceptance record contract

Each retained record binds its claims to one source revision and exact artifact identities. A passing lane proves only the behavior it exercised.

## Provider-free repository lane

Record the source revision and outcomes for feature identity, generated-contract checks, formatting, lint, types, dependency boundaries, unit tests, and pull-request tests. This lane uses no external provider and does not prove native PostgreSQL, packaging, TLS, or remote access.

## Native PostgreSQL lane

Record the PostgreSQL archive digest, server version, installation identity, migration checksums, contract identities, procedure capabilities, direct-connection scenarios, pooled-connection scenarios, concurrency, rollback, replay, recovery, history paging, identity isolation, credential lifecycle, and database-unavailable outcomes.

## SDK package lane

Record one SDK archive digest, production dependency tree, supported Node.js and operating-system consumers, public type checks, direct and pooled connection fixtures, and package contents. The archive must not include PostgreSQL, a database directory, a service process, or undeclared workspace fallback.

## Authorized remote-database lane

This lane requires explicit authorization because it sends credentials to an external endpoint. Record:

- source revision and SDK archive digest;
- PostgreSQL provider and server profile without retaining account secrets;
- database host class and certificate identity;
- direct or pooler topology and downstream TLS ownership;
- semantic and procedure identities;
- credential lifecycle scenario IDs;
- TLS rejection and identity-isolation outcomes; and
- every untested provider, recovery, security, fault, benchmark, and operational claim.

## Later lanes

Self-hosted packaging, managed Cloud, backup restoration, disaster recovery, failover, upgrades, hostile-role assessment, capacity, incident response, compliance, support, and production readiness retain separate records. FEAT-0013 cannot mark them passed.

## Cloud retirement evidence

Before removing `apps/cloud` from active paths, map each retained FEAT-0006 assertion to a direct PostgreSQL test or an explicit obsolete-service disposition. Preserve old documents and evidence at their original revision. Record no new Cloud-service qualification for FEAT-0013.
