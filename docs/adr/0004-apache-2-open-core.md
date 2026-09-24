# ADR-0004: Use Apache-2.0 for the open core

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Teams need to inspect, modify, and self-host the correctness-critical Keynes
code without negotiating a commercial agreement. The project also needs room to
offer operational or support services later.

## Decision

The repository source and release packages use Apache-2.0. The open core
includes the Budget and command contracts, database implementations,
installation code, SDK, runtime packages, CLI, Policy helpers, and the software
needed for basic self-hosting.

The license does not require future hosted operations, enterprise controls, or
support services to live in this repository. This decision does not claim that
any paid offering exists.

## Consequences

- Users may inspect, modify, redistribute, and self-host the current code under
  Apache-2.0.
- Package metadata and distributed archives must include the matching license.
- Future commercial work must keep the correctness-critical contract usable in
  the open core.

## Rejected alternatives

- A copyleft license would impose broader redistribution conditions than
  intended.
- A source-available license would restrict use and would not be open source.
- Closing the core would make authority behavior harder to inspect and
  self-host.
