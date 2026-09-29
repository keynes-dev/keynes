# Contributing to Keynes

Bug reports, documentation fixes and focused code changes are welcome. Use
[GitHub issues](https://github.com/keynes-dev/keynes/issues) for bugs and
feature discussion. Discuss larger changes before implementing them.

## Set up a checkout

Install Node.js 24 or newer and pnpm 11.21.0, then fork and clone the
repository. From its root, run:

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm exec turbo run build
pnpm test:pr
```

Native PostgreSQL tests additionally need Docker and OpenSSL; see the
[testing reference](docs/testing.md) for commands and prerequisites.

Run `pnpm example:local` to try a complete Local request and settlement. For a
faster Local feedback loop, run `pnpm test:local`. Local uses an ephemeral
in-process SQLite database.

## Send a change

1. Create a branch and keep the change focused on one problem.
2. Follow nearby code conventions. For behavior changes, add a test that fails
   before the fix. Check formatting and links for documentation changes.
3. Run `pnpm format:fix` and the relevant checks from the testing reference.
4. Open a pull request explaining the problem, change and verification. Include
   any checks you could not run and update documentation when behavior changes.

Major features need an agreed design before implementation: describe the
behavior, API compatibility and testing in a GitHub issue or PR. Maintainers own
any optional planning records. Follow the
[pre-merge checklist](docs/workflow.md#before-merge) to update permanent docs
and remove temporary plans.

## Community and license

Be respectful, keep criticism about the work, and protect others' privacy.
Harassment and discriminatory behavior are not welcome. Maintainer
[@shubsharan](https://github.com/shubsharan) handles public contribution
questions and may remove abusive content or restrict participation.

Report conduct concerns privately to Shubhankar Sharan at
[shub@shub.gg](mailto:shub@shub.gg). Reports are handled by the repository
owner.

Use the private channel in [security reporting](SECURITY.md) for suspected
vulnerabilities.

Contributions are made under the repository's [Apache-2.0 license](LICENSE).
Only submit work you have the right to contribute, and preserve third-party
license and attribution notices.

CI runs documentation formatting for approved documentation-only changes. Policy
and CLI changes run the root checks and affected package typechecks/tests;
shared core and tooling changes run the full provider-free and native PostgreSQL
lanes. Keep using `pnpm test:pr` for full local verification. To reproduce an
affected run with fetched comparison commits:

```sh
TURBO_SCM_BASE=<merge-base-sha> TURBO_SCM_HEAD=<head-sha> pnpm test:pr:affected
```

See the [testing reference](docs/testing.md#pull-request-classification) for
routing, cache invalidation, and skipped-lane evidence.
