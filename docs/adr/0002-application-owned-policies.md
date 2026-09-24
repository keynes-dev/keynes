# ADR-0002: Keep Policy evaluation in the application

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

Policy depends on application facts, provider calls, fallback choices, and
retention rules. Keynes owns Budget authority and accounting, not those inputs
or effects.

## Decision

Applications own Policy evaluation. The SDK may invoke an optional customer
callback before a fresh request, but only the prepared Resource request reaches
the accounting authority. Command replay never reruns Policy.

Applications that need durable decisions call Policy directly and persist its
ordinary result before submitting the final command. Decision evidence records
context but grants no authority. Reading a command result does not retry or
resume the command.

## Consequences

- Customer code owns business facts, provider effects, Policy persistence, and recomputation.
- Keynes validates and accounts only the final command submitted to its authority.
- Integrated Policy requests are convenient but are not a durable workflow boundary.
- Command-result lookup never retries or mutates a command.

## Rejected alternatives

- Managed SQL Policies would make Keynes own customer business logic and facts.
- Replaying Policy with a command could repeat customer or provider effects.
- Treating decision evidence as authorization would weaken the accounting boundary.
