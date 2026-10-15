# Электронная очередь (Electronic Queue)

Учебный MVP-проект веб-системы электронной очереди: клиенты записываются на
услуги и получают талоны, администраторы управляют услугами и очередью.

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic
- **DB:** PostgreSQL 16
- **Frontend:** React 18 + Vite (раздаётся Nginx)
- **Аутентификация:** JWT, роли `Client` / `Admin`, пароли — bcrypt
- **Запуск:** Docker Compose (три сервиса: `db`, `server`, `ui`)

## Документация

- [`docs/project-description.md`](docs/project-description.md) — описание проекта,
  цель, роли, стек, архитектура.
- [`docs/use-cases.md`](docs/use-cases.md) — 60 пользовательских историй,
  20 отмечены как MVP.

## Быстрый старт (Docker)

Требуется установленный Docker с плагином Compose.

```bash
cp .env.example .env          # при желании отредактируйте переменные
docker compose up --build     # поднимает БД, API и UI с нуля одной командой
```

После запуска:

| Сервис | URL |
|--------|-----|
| Web-интерфейс | http://localhost:8080 |
| REST API | http://localhost:8000/api |
| Swagger UI | http://localhost:8000/docs |

**Администратор по умолчанию:** `admin@example.com` / `admin12345`
(задаётся переменными `ADMIN_EMAIL` и `ADMIN_PASSWORD`).

**Клиент по умолчанию:** `client@example.com` / `client12345`
(задаётся переменными `DEMO_CLIENT_EMAIL` и `DEMO_CLIENT_PASSWORD`).
Клиент видит только свою электронную очередь (свои талоны) и не имеет доступа
к разделам администратора.

Остановить: `docker compose down`, остановить и удалить данные БД:
`docker compose down -v`.

При старте контейнер `server` сам ждёт готовности БД, применяет миграции
Alembic (`alembic upgrade head`), создаёт администратора и демонстрационные
услуги, после чего запускает Uvicorn.

## Переменные окружения

Задаются в `.env` (см. `.env.example`):

| Переменная | Назначение | По умолчанию |
|------------|-----------|--------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | реквизиты БД | `queue` / `queue` / `queue` |
| `DATABASE_URL` | строка подключения SQLAlchemy | `postgresql+psycopg2://queue:queue@db:5432/queue` |
| `SECRET_KEY` | ключ подписи JWT | `please-change-this-secret-key` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | время жизни токена | `240` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | стартовый администратор | `admin@example.com` / `admin12345` / `Administrator` |
| `DEMO_CLIENT_EMAIL` / `DEMO_CLIENT_PASSWORD` / `DEMO_CLIENT_NAME` | демо-клиент | `client@example.com` / `client12345` / `Demo Client` |
| `UI_PORT` / `API_PORT` | публикуемые порты UI и API | `8080` / `8000` |

## Архитектура

```
Браузер → UI (React + Nginx :8080) → API (FastAPI :8000) → PostgreSQL :5432
```

Nginx раздаёт собранную статику и проксирует `/api/*` на контейнер `server`,
поэтому CORS в production-сборке не требуется.

## Бизнес-сущности и API

### Service (услуги) — управляет Admin

| Метод | Маршрут | Доступ |
|-------|---------|--------|
| GET | `/api/services` | все пользователи (клиент видит только активные) |
| GET | `/api/services/{id}` | все пользователи |
| POST | `/api/services` | только Admin |
| PUT | `/api/services/{id}` | только Admin |
| DELETE | `/api/services/{id}` | только Admin |

### Ticket (талоны) — Client создаёт и отменяет свои

| Метод | Маршрут | Доступ |
|-------|---------|--------|
| GET | `/api/tickets` | Admin — все, Client — только свои |
| GET | `/api/tickets/{id}` | владелец или Admin |
| POST | `/api/tickets` | авторизованный пользователь |
| PUT | `/api/tickets/{id}` | Admin меняет статус; Client может только отменить свой |
| DELETE | `/api/tickets/{id}` | только Admin |

### Прочее

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/users`, `PUT /api/users/{id}`, `DELETE /api/users/{id}` — только Admin
- `GET /api/stats` — агрегированная статистика — только Admin
- `GET /api/health`

## Локальная разработка (без Docker)

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg2://queue:queue@localhost:5432/queue"
export SECRET_KEY="dev-secret"
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, /api проксируется на localhost:8000
```

## Структура репозитория

```
.
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── project-description.md
│   └── use-cases.md
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/           # миграции
│   └── app/
│       ├── main.py        # точка входа FastAPI
│       ├── config.py      # настройки из окружения
│       ├── database.py    # движок и сессии SQLAlchemy
│       ├── models.py      # User, Service, Ticket, Role, TicketStatus
│       ├── schemas.py     # Pydantic-схемы (валидация)
│       ├── security.py    # bcrypt + JWT
│       ├── deps.py        # зависимости аутентификации/авторизации
│       ├── seed.py        # стартовый админ и услуги
│       └── routers/       # auth, services, tickets, users, stats
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api.js
        ├── AuthContext.jsx
        ├── components/    # Layout, ProtectedRoute
        └── pages/         # Login, Register, Services, Tickets, Admin*
```

## Ветки и процесс разработки

- `main` — стабильная версия.
- `dev` — текущая разработка; сюда вносятся изменения, затем вливаются в `main`.

## Устранение неполадок

**Администратор заблокировал сам себя и не может войти.** Начиная с текущей
версии администратор не может заблокировать собственную учётную запись, а также
последнего активного администратора — сервер вернёт `400`. Если блокировка уже
случилась, перезапустите сервер: seed вернёт администратору роль `admin` и активность.

```bash
docker compose restart server
```

Альтернативно можно разблокировать вручную в БД:

```bash
docker compose exec -T db psql -U queue -d queue \
  -c "update users set is_active = true, role = 'admin' where email = 'admin@example.com';"
```
