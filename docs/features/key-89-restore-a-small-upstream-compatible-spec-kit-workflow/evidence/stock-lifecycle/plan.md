# Implementation Plan: Greet one named contributor

**Branch**: `fixture/key-89-small-feature` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Summary

Implement a dependency-free Python command-line greeting with argument-count validation.

## Technical Context

Python 3 standard library; no persistent storage, runtime services, or dependencies.
A subprocess-based unittest suite verifies stdout, stderr, and exit codes.

## Constitution Check

One independently tested fixture outcome; no Budget, Policy, runtime, or package changes.
Tests precede code. No shared-runtime evidence is claimed. This is a disposable
verification task inside KEY-89, not a second Linear feature or published child issue.

## Project Structure

`greet.py` implements the CLI. `test_greet.py` exercises all acceptance cases.
Feature documents stay in the explicitly selected fixture directory.

## Design

Require exactly one argument. Print usage to stderr and return 2 otherwise.
Print the greeting to stdout and return 0 for one argument. No state or cleanup.
