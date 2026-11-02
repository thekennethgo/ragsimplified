---
description: Tick the current step, commit it and open a PR
disable-model-invocation: true
---
1. Tick the current step in PLAN.md.
2. Create a branch named step-<number>-<short-name>. For a Phase 7 step, cut it from `alt-main`.
3. Commit with a conventional commit message (feat:, fix:, chore:, test:, docs:) that names the step.
4. Push and open a PR with gh, summarising what changed and how it was checked. For a Phase 7 step use `gh pr create --base alt-main`; otherwise the base is `main`. Never open a PR from `alt-main` into `main`.
5. Stop after opening the PR. Never merge it; I review and merge PRs myself.
