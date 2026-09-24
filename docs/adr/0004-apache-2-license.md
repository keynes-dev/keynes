# ADR-0004: License Keynes under Apache-2.0

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Teams need to inspect, modify, and self-host the correctness-critical Keynes
code under an open-source license.

## Decision

The repository source and release packages use Apache-2.0. This includes the
Budget and command contracts, database implementations, installation code, SDK,
runtime packages, CLI, Policy helpers, and the software needed for basic
self-hosting.

## Consequences

- Users may inspect, modify, redistribute, and self-host the current code under
  Apache-2.0.
- Package metadata and distributed archives must include the matching license.

## Rejected alternatives

- A copyleft license would impose broader redistribution conditions than
  intended.
- A source-available license would restrict use and would not be open source.
- Closing the source would make authority behavior harder to inspect and
  self-host.
