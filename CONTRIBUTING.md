# Contributing

Thanks for taking a look. This project is built one small step at a time, driven by [PLAN.md](PLAN.md).

## Running it

The apps are still being built (see the phases in [PLAN.md](PLAN.md)), so there is little to run yet. What exists today:

1. Copy `.env.example` to `.env` and replace the fake values with your own keys. Never commit `.env`.
2. Once the Makefile lands (step 1.4), `make lint` and `make test` check both apps.

This section will gain real run commands as the backend (`backend/`) and frontend (`frontend/`) appear.

## Opening a PR

1. Branch from `main`, one branch per step (for example `step-0.5-contributing`).
2. Make the change, then run `make lint` and `make test` once they exist.
3. Open a PR with `gh pr create`. Describe what changed and how to verify it.
4. The owner reviews and merges every PR. `main` is protected: no direct pushes, no force pushes.

## The PLAN-driven workflow

- [PLAN.md](PLAN.md) is the source of truth. Work only on the first unticked step.
- Do exactly what that step says. No extra features, refactors or unrelated fixes. Each step lists what is out of scope.
- If a step is unclear or conflicts with the code, stop and ask rather than guess.
- Steps marked **(You)** are done by hand, outside Claude Code. Every other step is one `/next-step` cycle, one commit and one PR.
- With Claude Code: run `/next-step` to get a plan for the step, approve it, and review the report. `/ship-step` then ticks the step, commits and pushes.

## Secrets

Read every key from environment variables. Never commit secrets.
