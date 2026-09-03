# External PostgreSQL qualification contract

## Decision

The optional external-provider lane uses the same provider-neutral
qualification scenarios as the required local TLS lane. Its target adapter
attaches to an operator-prepared PostgreSQL 18.6 database and never creates,
resizes, restarts, or deletes provider infrastructure. A local target can
supply PostgreSQL, PgBouncer, and test certificates through Testcontainers
without changing the scenario contract.

The external qualifier is separate from the SDK package runner's narrow
`--authorized-database` walkthrough. That walkthrough remains the timed
clean-user path for T049 and runs against a fresh local TLS target. It continues
to report external-provider evidence as `NOT RUN` unless that optional lane ran.

## Inputs and ownership

The caller supplies exact SDK and PostgreSQL archives, one validated
secret-free provider profile, a new evidence-record path, and approved database
URLs through environment variables. URLs, passwords, role names, tenant and
principal identifiers, database names, and endpoint addresses must not enter
retained evidence.

Before connecting, the qualifier copies both archives into a private temporary
directory, hashes those copies, and executes only those copies. It removes the
staging directory before publishing evidence, so a concurrent change to the
caller-owned paths cannot change the bytes under qualification.

The operator owns the provider account, database lifecycle, network access,
endpoint, roles, credentials, certificate prerequisites, and final disposal.
The runner owns only its connections, exact package installations, Keynes test
mutations, local temporary files, scenario ordering, and evidence publication.
A cleanup failure prevents a passing record from being written.

## Required observations

The fixed scenario inventory covers:

- semantic compatibility before mutation;
- create, request, inspect, settle, reconnect, reopen, and recovery;
- two-tenant isolation with overlapping Resource names and operation keys;
- disablement, enablement, rotation, revocation, and recreated-role rejection;
- denial of private objects, administration, role assumption, identity
  override, and arbitrary SQL from runtime credentials;
- positive certificate-chain and hostname verification;
- rejection of unsafe TLS modes, an untrusted chain, and a hostname mismatch;
  and
- credential-secret-safe TLS failure diagnostics, including structured errors,
  stacks, and causes.

The qualifier uses the existing `pg` dependency for PostgreSQL SSLRequest
negotiation. It queries `pg_stat_ssl` for the current backend's negotiated TLS
version and cipher. It also narrows that same connection's stream to a Node.js
`TLSSocket` and uses `X509Certificate` to retain only certificate fingerprints,
validity, and hostname-verification outcome. It does not implement a PostgreSQL
or TLS handshake.

The initial qualifier accepts only a direct topology. A pooler would make the
Node socket observe the client-to-pooler hop while `pg_stat_ssl` observes the
pooler-to-PostgreSQL hop. Pooler qualification therefore needs a two-hop record
and remains `NOT RUN`; the direct record must not infer downstream state.

## Evidence boundary

A passing `keynes.acceptance.external-postgresql/v1` record binds one clean
source revision to both archive digests, the live PostgreSQL 18.6 profile,
certificate and topology facts, semantic and procedure identities, the exact
required scenario set, cleanup, duration, and every remaining `NOT RUN` lane.

The writer validates a closed record, rejects prohibited secret-bearing
content, requires the same clean revision before and after execution, and uses
exclusive creation with mode `0600`. A missing prerequisite or scenario is a
failed qualification, not a skipped passing case.

`packages/postgresql/test/qualification/required-scenarios.ts` owns the shared
scenarios. The local adapter owns lifecycle and certificates; the external
adapter owns prepared URLs and provider facts.

## Rejected alternatives

- Extending the narrow package flag would conflate package installation, the
  human walkthrough, and full external acceptance.
- Provider SDKs or provider-resource automation would require broad authority
  and make a provider-neutral evidence lane own infrastructure lifecycle.
- A second PostgreSQL driver, custom SSLRequest implementation, proxy, or
  certificate generator inside the attach-only external adapter would duplicate
  existing runtime or target-lifecycle behavior.
- Copying remote test bodies would create competing owners for scenario
  identity. Shared scenarios must remain behind the target adapter.
