#!/usr/bin/env bash
set -e

echo "[entrypoint] ожидание базы данных..."
python - <<'PY'
import os
import time

import psycopg2

url = os.environ.get("DATABASE_URL", "")
dsn = url.replace("postgresql+psycopg2://", "postgresql://")
for attempt in range(60):
    try:
        conn = psycopg2.connect(dsn)
        conn.close()
        print("[entrypoint] база данных доступна")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"[entrypoint] попытка {attempt + 1}: {exc}")
        time.sleep(2)
else:
    raise SystemExit("[entrypoint] не удалось подключиться к базе данных")
PY

echo "[entrypoint] применение миграций..."
alembic upgrade head

echo "[entrypoint] создание администратора по умолчанию..."
python -m app.seed

echo "[entrypoint] запуск API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
