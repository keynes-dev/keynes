# Package tests

`package-tests/` proves the behavior of packed SDK and PostgreSQL archives from an external consumer boundary.

SDK install, compatibility, and performance code lives under `package-tests/sdk/`. PostgreSQL archive, import-blocking, and CLI code lives under `package-tests/postgresql/`. These tests consume archives and do not provide runtime helpers to product packages.

Write new package-test records under `artifacts/package-tests/`. A package pass does not prove provider, system, hosted-matrix, security, recovery, or production behavior.
