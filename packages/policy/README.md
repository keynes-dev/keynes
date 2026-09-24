# Policy tools

`@keynes/policy` provides optional helpers for customer-owned Policy code. The
package defines typed parameters, immutable snapshots, configured Policy
functions, and portable result records. It does not execute providers, persist
state, grant Budget authority, or replace the request validation in
`@keynes/sdk`.

The package is a private ESM workspace for Node.js 24 or later. Import parameter
and toolkit helpers from `@keynes/policy`. Import the optional Zod 4.6.5 adapter
from `@keynes/policy/zod`.

Read the package guides for the complete contracts:

- [Parameters and snapshots](docs/parameters.md)
- [Policy helpers and records](docs/toolkit.md)
- [Policy regression testing](docs/testing.md)

The
[SDK package](https://github.com/keynes-dev/keynes/blob/main/packages/sdk/README.md)
defines Policy invocation through `Budget.request`. Customer code owns business
facts, provider calls, fallback behavior, retention, and recomputation.
