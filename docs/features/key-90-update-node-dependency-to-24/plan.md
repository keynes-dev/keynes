# Implementation Plan: KEY-90 Update node dependency to 24+

**Branch**: `main` by user request | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

Apply the accepted architecture policy to package manifests, conformance preflight, packed archive validation, SDK documentation, and the package workflow.

## Technical Context

TypeScript 7, Node.js >=24, pnpm 11.21.0, Vitest 4.1.11. No dependencies added. Existing SQLite and PostgreSQL authority ownership is unchanged. Existing ESM package consumers cover runtime behavior. Local installed runtimes are 24.11.0, 25.4.0, and 26.5.0. These versions are evidence targets, not repository pins.

## Constitution Check

Before and after design: pass. No Budget, Policy, persistence, transaction, replay, or authorization changes. Existing test fixtures will first demonstrate the version-check failure. Source tests cannot establish hosted archive qualification. Record NOT RUN for unavailable hosted lanes. The user explicitly overrides feature-branch creation by asking for work on main. No generated Spec Kit files are modified.

## Project Structure

- `packages/{contracts,postgresql,sdk,testkit}/package.json` and `apps/web/package.json`: engine declarations.
- `scripts/run-conformance.ts` and its test: minimum version check.
- `packages/sdk/test/package/qualify.ts` and its test: archive metadata.
- `packages/sdk/README.md`: compatibility and qualification distinction.
- `.github/workflows/sdk-package.yml`: minimum/latest matrix and retained consumer evidence.
- This directory: specification, tasks, research, validation guide, acceptance record.

## Verification

Observe focused regression failures before implementation. Run frozen installation and pnpm test:pr on Node.js 25. Build one archive and run clean consumers under installed Node.js 24, 25, and 26, retaining digest and exact versions. Run package tooling tests, formatting, and diff checks. Hosted Linux/Windows and the complete latest-release matrix require a published revision; do not claim those locally.
