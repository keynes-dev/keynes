# ADR-0004: Use Apache-2.0 for the open core

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Keynes maintainers

## Context

Keynes needs a license that lets application teams inspect, adopt, modify, and self-host the correctness-critical core without negotiating a commercial agreement first. The repository already carries Apache-2.0 license text, while package metadata does not agree with it.

The business can create value beyond access to Budget semantics. Customers may pay to avoid operating the service and PostgreSQL database, to receive safe upgrades and recovery help, or to meet administrative, compliance, and support requirements.

## Decision

The current repository packages use Apache-2.0.

The open core includes Budget correctness, public contracts, PostgreSQL migrations and procedures, TypeScript SDK behavior, and the software needed for basic self-hosting. Keynes may charge for hosting, upgrades, recovery, administration, enterprise controls, compliance work, and support.

This decision does not define prices, billing units, plan names, promised enterprise features, or locations for future proprietary packages.

## Consequences

- Root, SDK, and Cloud package metadata must identify Apache-2.0.
- Packed SDK qualification must confirm that the archive contains matching Apache-2.0 license text.
- Customers can evaluate and self-host the correctness-critical product without depending on managed Cloud.
- Commercial differentiation must come from operating and supporting Keynes well, not from hiding Budget behavior or weakening the open self-hosted path.
- A later decision may define specific commercial packaging, but it must not silently change the license of code already released under Apache-2.0.
