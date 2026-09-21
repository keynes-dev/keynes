# Validation: KEY-89

Use Specify CLI 1.0.4, Bash, Git, Python 3, and the repository Node/pnpm versions.

1. Run `specify integration status --json`; expect status ok and zero findings.
2. Select an existing feature with `SPECIFY_FEATURE_DIRECTORY`, then run
   `.specify/scripts/bash/check-prerequisites.sh --json --paths-only`.
3. Run `.specify/scripts/bash/setup-plan.sh --json` against an authored plan;
   compare its digest before and after. Expect no change.
4. In disposable worktrees, follow the stock skills for one small feature using
   a branch with a slash and an explicit directory. Check each local pointer
   is ignored and the other worktree's selection is unchanged.
5. In a disposable copy, run `specify integration upgrade codex --script sh` twice.
   Compare authored-file and managed-file digests and integration status.
6. Run `pnpm test:repository` and `pnpm format` in this feature checkout.

The fixture and exact outcomes are recorded in acceptance.md. These are tooling
checks, not native-runtime or package acceptance. Do not mark KEY-89 Done before merge.
