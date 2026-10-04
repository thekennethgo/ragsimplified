.PHONY: format lint test

format:
	cd backend && .venv/bin/ruff format .
	@echo "frontend: no formatter configured yet"

lint:
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npx tsc --noEmit

test:
	cd backend && .venv/bin/pytest
	cd frontend && npm test
