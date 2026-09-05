# Implementation plan: Deliver each Spec Kit feature through one issue and PR

**Linear issue**: [KEY-74](https://linear.app/keynes/issue/KEY-74/deliver-each-spec-kit-feature-through-one-issue-and-pr) | **Branch**: `key-74-deliver-each-spec-kit-feature-through-one-issue-and-pr` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Summary

Retain version 3 identity. Remove phase publication and stack orchestration.
Align governance, templates, skills, hooks, and PR guidance around internal
checkpoints and independent feature acceptance.

## Technical context

Markdown skills/templates, YAML workflows, existing Node.js identity scripts,
Bash preparation, and node:test fixtures. No dependency or product API change.

## Constitution check

The approved plan replaces the mandatory phase/sub-issue rule. Amend 6.0.0 to
7.0.0 for this incompatible delivery-governance change. Budget authority,
application effects, Policy security, and runtime state are unchanged and N/A.
Shared-runtime acceptance remains required for behavior features.

## Design

- Retain feature-identity.mjs and the existing manifest shape.
- Remove phase-stack.mjs, dedicated tests, publication skill, stack command,
  related hooks, and package-script registration.
- Use a short tasks template with adaptable internal phases and checkpoints.
- Update tracked tasks/analyze/implement/specify skills, workflow, constitution,
  ADR guidance, AGENTS.md, and the PR template. Preserve historical feature files.
- Exercise the real branch hook, artifact preparation, and implementation
  prerequisites in an isolated identity-test fixture.
- Do not introduce another command registry, manifest, or synchronization system.

## Verification

Run node --test .specify/tests/feature-identity.test.mjs; exercise the preparation
scripts; validate skills and formatting; run pnpm check:repo and pnpm test:pr.
Review active references and the historical diff. Native PostgreSQL, package
consumers, and hosted matrix qualification are outside this workflow feature.

## Independent acceptance

This branch starts from main with no unmerged feature prerequisites. Linear owns
the backlog. Other ready feature specifications use separate branches. No
automatic merge or final Linear completion.
