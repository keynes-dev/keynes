# Package contracts

## SDK

- Package identity remains `@keynes/sdk`.
- The export map contains only `.` and resolves to `dist/index.js` and `dist/index.d.ts`.
- Every current package-root value and type export remains available.
- `Keynes.create()` accepts zero arguments and opens private in-memory SQLite.
- Deep imports remain unsupported.
- The archive contains only declared metadata, `dist/index.*`, `dist/generated/**`, `dist/local/**`, and the SDK README.
- The production dependency graph is empty.

## PostgreSQL

- Package identity remains `@keynes/postgresql`.
- The installed executable remains `keynes-postgresql`.
- `keynes-postgresql install --config <path>` retains its configuration and behavior.
- The JavaScript export map is empty. Root, former private, arbitrary deep, CommonJS, ESM, and TypeScript imports fail.
- The archive contains only declared metadata, `dist/**`, `generated/**`, `migrations/**`, README, and license.
- `pg` is the only production dependency.
- Unit tests use relative source imports. Package and system tests use the packed executable.

## Cloud

- The HTTP wire request and response do not change.
- Authentication still maps a controlled bearer token to one tenant and principal.
- PostgreSQL invocation still uses a transaction-local identity and one allowlisted procedure.
- Database unavailability remains explicit and never falls back to SQLite.
- Production depends on `pg` and no Keynes package.
