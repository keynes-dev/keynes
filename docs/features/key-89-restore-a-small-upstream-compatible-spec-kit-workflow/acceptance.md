# Acceptance: KEY-89

Implementation source: `faac3cd80976947349c3d37d77c40d4f9bb0d2d3`.
Draft PR: [#40](https://github.com/keynes-dev/keynes/pull/40).
Prerequisite: [KEY-74 / PR #39](https://github.com/keynes-dev/keynes/pull/39).
Local checks passed; merge and GitHub CI are separate delivery evidence. KEY-89
remains In Progress until its prerequisite, merge, and required acceptance complete.

## Environment and method

macOS arm64, Darwin 25.5.0; Specify CLI 1.0.4; Python 3.12.4 for Specify;
Python 3.12.4 for the probe and fixture; Node 26.5.0; pnpm 11.21.0. The ordinary worktree shell initially selected Node
25.9.0, which the unchanged SDK engine constraint rejected. Installation succeeded
with Node 26 and the frozen lockfile. No Node engine or dependency changes were made.

The retained [tooling probe](evidence/verify-tooling.py) runs real CLI installs,
upgrades, path resolution, and Git worktrees in disposable repositories. It is
acceptance evidence, not an installed command or CI workflow. Run it from the
repository root with a clean staged index; it writes results under .artifacts.
It checks committed/staged files and deliberately ignores unrelated working edits.

## Executed verification

- `specify integration status --json`: status ok; zero missing or modified files.
- `python3 docs/features/key-89-restore-a-small-upstream-compatible-spec-kit-workflow/evidence/verify-tooling.py`:
  passed on the implementation commit. See [commands and results](evidence/tooling-verification.json).
- Two `specify integration upgrade codex --script sh` runs in an exported checkout:
  all 22 managed files and authored artifacts unchanged. The Codex install timestamp
  may change; this is upstream installer metadata, not authored content.
- Independent `specify init ... --integration codex --script sh --non-interactive
--ignore-agent-tools`: all 22 rendered managed files match the migration exactly.
- Exported fresh checkout: all ten stock skills present; no tracked feature pointer,
  installed extension, identity engine, or customized workflow.
- Real worktree checks: missing selection fails; read-only path resolution writes
  nothing; setup-plan preserves KEY-74's authored plan; two selections are independent
  and ignored. Stock JSON's BRANCH field can be a feature-directory label; actual
  branch identity is checked with Git, not inferred from that field.
- Preservation: all 168 pre-existing feature and ADR files from base `8a432f0` retain
  identical bytes. Constitution core principles and product constraints are unchanged.
- `pnpm test:repository`: all eight tests passed.
- `pnpm format`: passed after formatting the two new checklist/task files.
- `pnpm test:pr`: passed on the implementation commit; generator, repository,
  package tests, quality, types, and dependency boundaries passed.
- Local Markdown links and `git diff --check`: passed.

## Stock lifecycle demonstration

The agent followed the installed stock specify, plan, tasks, analyze, and implement
instructions for a disposable greeting CLI on `fixture/key-89-small-feature`, with
an explicit directory independent of the branch. Clarification was unnecessary;
inputs fully defined the four scenarios. Helper scripts resolved the artifacts,
analysis mapped both requirements to tasks and applied the constitution, and review
checked stdout, stderr, exit codes, and absence of state or external effects.

All four tests failed before implementation and passed afterward. The retained
[example](evidence/stock-lifecycle/spec.md), [review](evidence/stock-lifecycle/review.md),
[red result](evidence/fixture-red.txt), and [green result](evidence/fixture-green.txt)
show the result. From evidence/stock-lifecycle, run
`PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_greet.py` to replay its code tests.

This was an agent-followed lifecycle, not a separate model or workflow-runner run.
No Linear child issue was created and no status-completion hook ran. The issue
itself remains open; tests finishing is not permission to close it.

## Evidence boundaries

Native PostgreSQL, packed SDK qualification, supported OS/Node matrix, and Hosted
or Embedded qualification: NOT RUN for this tooling-only change. The provider-free
PR suite passing does not establish those lanes. GitHub CI for the final evidence
commit must be read from the PR. The original KEY-74 checkout and its authored
artifacts were preserved; this migration lives in its own worktree.

When adopting this branch in an existing checkout, inspect any ignored local
`speckit-git-*` skill directories left by the old installation and remove only those
retired skills. They are absent from the verified fresh checkout. Other local
engineering skills are not part of this migration and must be preserved.
