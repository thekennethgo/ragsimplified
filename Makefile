.PHONY: format lint test migrate seed eval

format:
	cd backend && .venv/bin/ruff format .
	@echo "frontend: no formatter configured yet"

lint:
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npx tsc --noEmit

test:
	cd backend && .venv/bin/pytest
	cd frontend && npm test

migrate:
	cd backend && set -a && { [ ! -f ../.env ] || . ../.env; } && set +a && .venv/bin/python -m app.migrate

seed:
	cd backend && set -a && { [ ! -f ../.env ] || . ../.env; } && set +a && .venv/bin/python -m app.seed

eval:
	cd backend && set -a && { [ ! -f ../.env ] || . ../.env; } && set +a && .venv/bin/python -m app.eval_runner $(ARGS)
