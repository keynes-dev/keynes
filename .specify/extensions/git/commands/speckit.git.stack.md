---
description: Manage the GitHub PR stack from phase bindings in tasks.md
---

# Manage the phase stack

Run `node .specify/scripts/phase-stack.mjs check --json` before changing the stack.

- Show the current layer: `node .specify/scripts/phase-stack.mjs active --json`
- Adopt the parent branch as the bottom layer: `node .specify/scripts/phase-stack.mjs init`
- Start a published later phase: `node .specify/scripts/phase-stack.mjs start <phase-number>`
- Move through the stack: `gh stack bottom`, `gh stack down`, `gh stack up`, or `gh stack top`
- Rebase corrections through later layers: `gh stack rebase --upstack`
- Push existing layers: `gh stack push`
- Submit or update PRs: `node .specify/scripts/phase-stack.mjs submit`

Use `--dry-run` on `init`, `start`, or `submit` to print the command without changing Git or GitHub. Never generate a branch name. Submit only after an explicit user request.

After submission, read each published phase binding from `tasks.md`. Compare each open PR title with `KEY-N <exact phase title>`. If a title differs, run `gh pr edit <number> --title "KEY-N <exact phase title>"`.
