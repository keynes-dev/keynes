# PostgreSQL identity and TLS contract

## URL boundary

The SDK accepts one `postgresql:` URL. It parses the URL once, rejects duplicate or unknown parameters, requires exactly one `sslmode=verify-full`, and constructs one normalized pool configuration. It does not pass an untrusted raw connection string beside a separate TLS object.

The accepted parameter set must be enumerated in code and contract tests. Parameters that weaken verification, redirect credentials, choose a certificate hostname, inject libpq behavior, or create another routing source are forbidden.

## TLS profile

- TLS 1.2 or newer
- certificate-chain verification
- hostname verification against the URL host
- process or operating-system trust roots, with one explicitly supported root-certificate path when required
- PostgreSQL `SSLRequest` negotiation for the first profile
- no plaintext fallback

Direct, session-pooled, and transaction-pooled profiles require separate evidence. A pooler's downstream TLS connection is operator-owned and cannot be inferred from SDK-to-pooler evidence.

## Runtime identity

PostgreSQL authenticates one scoped `LOGIN` role. A protected mapping records its OID, role name, tenant, principal, and enabled state. Each remote wrapper:

1. Reads `session_user`.
2. Resolves exactly one enabled mapping.
3. Verifies both the role OID and role name.
4. Establishes transaction-local Keynes identity from the mapping.
5. Executes the canonical core procedure under a restricted execution role.
6. Clears transaction-local state through transaction completion.

The caller cannot submit tenant or principal identity. A missing, duplicated, stale, disabled, or revoked mapping returns an authorization-safe error and changes no Budget state.

## Role boundaries

- The owner role owns private schema objects and does not log in.
- The execution role can invoke canonical core procedures and does not log in.
- A runtime login can connect and invoke only supported remote wrappers.
- An administrative role can invoke private credential procedures but cannot act as an ordinary application principal by default.

Runtime logins cannot select private tables, call core procedures directly, assume privileged roles, change role mappings, execute arbitrary caller-selected SQL through the SDK, or invoke private administration.

## Credential administration

Private PostgreSQL procedures create, rotate, disable, enable, revoke, and inspect credential metadata. Secret generation and delivery stay outside retained repository evidence. The procedures return only the information needed to deliver or audit the credential and never write reusable secrets to logs or history.

Rotation creates a new login mapping and disables the old mapping in one administrative transaction. Revocation disables the mapping. A remote call that completed its identity check before that transaction commits may finish. Every call that begins after commit fails, including calls on an existing pooled session, because each wrapper checks the mapping. Password rotation alone does not revoke an established session. Operators use mapping disablement or revocation for that guarantee.
