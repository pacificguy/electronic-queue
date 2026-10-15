.PHONY: help env up down clean logs verify verify-fast ui api

help:
	@echo "Доступные цели:"
	@echo "  make env          - создать .env из .env.example"
	@echo "  make up           - поднять стек (server, db, ui) в фоне"
	@echo "  make down         - остановить стек"
	@echo "  make clean        - остановить стек и удалить volume БД"
	@echo "  make logs         - логи контейнера server"
	@echo "  make verify       - полная проверка пунктов 1-5 (с нуля)"
	@echo "  make verify-fast  - проверка без пересборки и удаления данных"

env:
	@test -f .env || cp .env.example .env
	@echo ".env готов"

up: env
	docker compose up -d --build
	@echo "UI:      http://localhost:$${UI_PORT:-8080}"
	@echo "API:     http://localhost:$${API_PORT:-8000}/api"
	@echo "Swagger: http://localhost:$${API_PORT:-8000}/docs"

down:
	docker compose down

clean:
	docker compose down -v

logs:
	docker compose logs -f server

verify:
	bash scripts/verify.sh

verify-fast:
	bash scripts/verify.sh --fast
