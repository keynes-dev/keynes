# Cloud service

- **Owner:** `@shubsharan`
- **Workspace:** Private, non-publishable `@keynes/cloud`
- **Feature:** `FEAT-0006`

## Responsibility

`services/cloud/` owns the private TypeScript service used to exercise Keynes Cloud. The service authenticates a controlled bearer token, binds each request to one tenant and principal, invokes one allowlisted PostgreSQL procedure, and returns the canonical wire response.

PostgreSQL remains the only durable Budget database. Cloud does not validate Budget commands, decide permissions, implement Resource accounting, store replay results, or write Budget history.

## Procedure edge

`services/cloud/src/generated/procedures.ts` is generated from `contracts/contract.json`. It contains the shared contract digest and the five static parameterized procedure statements. Run `pnpm generate` to update it and `pnpm generate:check` to detect drift.

Cloud does not import a Keynes package, parse repository contract files at runtime, or construct procedure SQL from request data.

## Database boundary

The service requires a preinstalled PostgreSQL database. Startup verifies the installed contract and procedure signatures before the service listens. The Cloud system lane installs disposable databases through the packed `keynes-postgresql` command.

The runtime database role can read the installation ledger and execute the five generated procedures. It cannot read or write private Resource, Budget, command, or history tables. A separate owner connection adds controlled test principals and grants after the packed command finishes, then closes before service traffic starts.

## Authentication

FEAT-0006 uses controlled test identities. Startup configuration stores only SHA-256 bearer-token digests bound to one tenant and principal. The service never accepts tenant, principal, database, SQL, retry, or fault controls from an HTTP request.

## Scope

FEAT-0006 proves the private service, one PostgreSQL database, tenant isolation, restart durability, and exact replay after committed-response loss for its retained revision. The service has no framework, SDK dependency, response cache, automatic retry, routing layer, database movement, or recovery manager.

Managed deployment, external identity integration, TLS and live exposure, the public Cloud SDK and protocol, Policy, backups, failover, multi-region behavior, performance, security qualification, and production readiness remain `NOT RUN`.
