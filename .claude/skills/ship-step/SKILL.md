---
description: Tick the current step, commit it and ship it (a PR to main, or straight onto alt-main for Phase 7)
disable-model-invocation: true
---
For a Phase 7 step:
1. Check the owner has approved the step's before/after in the browser (frontend steps). If not, stop and say so.
2. Tick the current step in PLAN.md.
3. Commit on the current step branch with a conventional commit message (feat:, fix:, chore:, test:, docs:) that names the step.
4. `git fetch origin && git rebase origin/alt-main`, then `git push origin HEAD:alt-main`. No PR. Never push to `main` and never open a PR from `alt-main` into `main`.
5. Report the new `alt-main` commit and stop.

For any other step:
1. Tick the current step in PLAN.md.
2. Create a branch named step-<number>-<short-name>.
3. Commit with a conventional commit message (feat:, fix:, chore:, test:, docs:) that names the step.
4. Push and open a PR against `main` with gh, summarising what changed and how it was checked.
5. Stop after opening the PR. Never merge it; I review and merge PRs myself.
