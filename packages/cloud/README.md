# Cloud service

- **Owner:** `@shubsharan`
- **Workspace:** Private, non-publishable `@keynes/cloud`
- **Functional status:** Nonfunctional in FEAT-0001

## Responsibility

`packages/cloud/` owns the future private TypeScript service for Keynes Cloud.
That service will own authentication, tenant and Budget authorization, routing,
pooling, retries, recovery fencing, and translation between the public protocol
and authoritative PostgreSQL procedures.

FEAT-0001 creates only a private workspace shell. It implements no service,
endpoint, authentication, provider integration, or Keynes behavior.

## Allowed and public edges

The future external edge is the versioned Cloud protocol defined by shared
contracts. Within the repository, Cloud may consume public contract artifacts
and invoke versioned public database procedures.

Cloud must not import `packages/sdk/`, private database storage, `scripts/`, or
another area's owner-local tests. Clients never receive database credentials or
use arbitrary SQL through Cloud.

## Private internals

Authentication, tenant routing, connection management, retry and recovery
mechanics, operational overlays, and service-local tests remain private. None of
these concerns may redefine Budget transitions or Policy evaluation.

## Source policy

Use TypeScript only. Keep service tests beside the source they exercise. The
FEAT-0001 manifest is private and makes no deployment, availability, provider,
protocol-compatibility, or publication claim.

## Deferred work

Cloud runtime behavior, managed infrastructure, credentials, security testing,
recovery testing, operational qualification, and public protocol support belong
to later roadmap stages and remain `NOT RUN`.
