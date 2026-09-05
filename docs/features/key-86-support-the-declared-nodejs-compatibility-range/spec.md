# Support the declared Node.js compatibility range

**Linear issue**: [KEY-86](https://linear.app/keynes/issue/KEY-86/support-the-declared-nodejs-compatibility-range)
**Git branch**: `key-86-support-the-declared-nodejs-compatibility-range`
<!-- linear-issue-id: 2ffd69ef-787f-4980-bf3d-144a7332be15 -->

## Feature story

### The problem

The accepted compatibility policy is node >=24, but SDK package engines exclude intermediate majors. Package tooling and documentation still encode a fixed 24/26 interpretation.

### Why this exists now

Keynes Local completion requires independently accepted features with accurate
runtime and package evidence.

### What changes for users

Consumers can install Keynes under the declared Node.js range, and maintainers can distinguish compatibility declarations from qualification of specific releases.

### What must stay true

SQLite and PostgreSQL implement one command and accounting contract. Authorities
own their state; the SDK adds no fallback ledger. The application owns external
effects. This feature retains exact evidence for its own outcome.

### What this feature does not include

No dependency upgrade campaign, browser/CommonJS support, npm publication, performance-policy change, or guarantee that untested future versions passed.

### Where this leads

This peer feature belongs to Keynes Local. It is independently acceptable after
its stated prerequisites and does not wait for the entire Local project.
The project and issue own scheduling; this specification owns acceptance.

## User Scenarios & Testing

### User story 1 - Accept the bounded outcome (P1)

Consumers can install Keynes under the declared Node.js range, and maintainers can distinguish compatibility declarations from qualification of specific releases.

**Independent test**: Exercise the scenarios below against the candidate source
and the real artifacts they name. Retain exact results before acceptance.

1. Given Node.js below 24, the package declaration rejects unsupported installation.

2. Given Node.js 25, the engine range permits installation and the transition qualification executes the provider-free gate and a clean archive consumer.

3. Given the minimum supported major and the latest available major, one archive digest is qualified across the supported operating systems.

4. Given a new latest Node major, the qualification configuration can replace the previous latest lane while preserving the minimum lane.

5. Given a retained result from an older Node release, reporting names that exact release without promoting it to evidence for another version.

### Edge cases

Given Node.js below 24, the package declaration rejects unsupported installation.

Given a retained result from an older Node release, reporting names that exact release without promoting it to evidence for another version.

## Requirements

- **FR-001**: Declare node >=24 consistently across Keynes TypeScript packages, without excluding intermediate majors or imposing an upper bound.
- **FR-002**: Remove package-tooling assumptions that label a compatible intermediate major unsupported.
- **FR-003**: Run the provider-free gate and one clean packed-archive consumer on Node.js 25 after the engine exclusion is removed.
- **FR-004**: Qualify the same SDK archive on Node.js 24 and the latest available major across the supported Linux x64, macOS arm64, and Windows x64 environments.
- **FR-005**: Retain exact Node.js and SQLite versions, source revision, archive digest, environment, and individual consumer outcomes. Failed or absent lanes cannot count as passed.
- **FR-006**: Align documentation with the distinction between Keynes compatibility and upstream Node.js security support. Preserve runtime semantics.

## Success Criteria

- **SC-001**: Every Keynes TypeScript package declares the same node >=24 floor with no intermediate exclusion.
- **SC-002**: The explicit Node.js 25 transition checks pass against the changed source and exact packed consumer.
- **SC-003**: All six supported OS/Node consumer combinations pass using one archive digest.
- **SC-004**: Evidence identifies actual tested versions and makes no exact-revision claim for unexecuted versions.

## Assumptions and dependencies

No feature prerequisites. At planning time the repository uses Node.js 24 and 26; implementation must verify the latest release before fixing the qualification lanes. Node 25 is a one-time transition check, not an additional permanent matrix lane.

## Current-source boundary

Source inspection at 8aae705 found the root floor already >=24 while the SDK declares >=24 <25 || >=26 <27. No compatibility or archive tests have been run for this specification.

This is a specification, not implementation or acceptance evidence. Detailed
design and tasks will be created by this issue's subsequent Spec Kit steps.
No paid provider or production mutation is required.
