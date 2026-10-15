# Проверка проекта: пункты 1–5

Как запустить:

```bash
make verify            # полная проверка: БД поднимается с нуля (down -v + up --build)
bash scripts/verify.sh --fast   # быстрая проверка без пересборки и удаления данных
```

Скрипт [`scripts/verify.sh`](../scripts/verify.sh) печатает `PASS`/`FAIL` по каждой
проверке и завершается кодом, равным числу провалов.

**Итог последнего прогона: 60 проверок, 60 успешно, 0 провалов — все пункты 1–5 пройдены.**

---

## Пункт 1. Git + описание проекта

Что проверяется и как:

| Проверка | Команда | Ожидание |
|----------|---------|----------|
| Осмысленные коммиты | `git log --oneline` | ≥ 5 коммитов |
| Ветки `main` и `dev` | `git branch -a` | обе существуют локально |
| Удалённый репозиторий | `git remote get-url origin` | GitHub-репозиторий |
| Ветки на GitHub | `git ls-remote --heads origin` | `origin/main`, `origin/dev` |
| `.gitignore` | `git check-ignore -q <path>` | `.env`, `node_modules`, `.venv`, `dist`, `pgdata` игнорируются |
| README | `ls README.md` | файл есть |
| Описание 2–3 стр. | `wc -l docs/project-description.md` | ≥ 80 строк |

Результат: **PASS** (7 коммитов, ветки `main`/`dev` локально и на `origin`,
origin = `https://github.com/pacificguy/electronic-queue.git`, описание — 132 строки).

Репозиторий: https://github.com/pacificguy/electronic-queue

---

## Пункт 2. 60 use cases и 20 MVP

| Проверка | Команда | Ожидание |
|----------|---------|----------|
| Количество историй | `grep -o '| UC-[0-9]*' docs/use-cases.md \| sort -u \| wc -l` | 60 |
| Отметка MVP | `grep '| UC-' docs/use-cases.md \| grep -c '✅'` | 20 |
| Модули | распределение по колонке «Модуль» | авторизация/очередь/талоны/уведомления/админка/отчёты |

Результат: **PASS** — 60 уникальных историй, ровно 20 помечены MVP.

Распределение по модулям (из фактического вывода):

```
10 Авторизация
10 Очередь
12 Талоны
 8 Уведомления
10 Админка
10 Отчёты
```

Файл: [`docs/use-cases.md`](use-cases.md).

---

## Пункт 3. Сервер + БД + UI в Docker-контейнерах

| Проверка | Команда | Ожидание |
|----------|---------|----------|
| Валидность compose | `docker compose config` | без ошибок |
| Три сервиса | `docker compose config --services` | `db server ui` |
| Volume для БД | `docker compose config --volumes` | `pgdata` |
| Запуск одной командой | `docker compose up -d --build` | успех |
| Три контейнера | `docker compose ps --services --status running` | `db server ui` |
| Миграции при старте | `docker compose logs server \| grep 'Running upgrade'` | применены |
| Seed админа | `docker compose logs server \| grep 'создан администратор'` | выполнено |
| Общая сеть | `docker compose config \| grep queue-net` | есть |
| API живо | `curl localhost:8080/api/health` | `{"status":"ok"}` |

Результат: **PASS** — стек поднимается с нуля одной командой; при старте сервер
ждёт БД, применяет `alembic upgrade`, создаёт администратора и услуги, запускает Uvicorn.

Файлы: [`docker-compose.yml`](../docker-compose.yml), [`backend/Dockerfile`](../backend/Dockerfile),
[`frontend/Dockerfile`](../frontend/Dockerfile), описание запуска — [`README.md`](../README.md).

---

## Пункт 4. Два CRUD по двум бизнес-сущностям

### Схема БД (миграции)

- Таблицы: `users`, `services`, `tickets` (проверяется через `psql \dt`).
- История миграций: `docker compose exec server alembic history`.
- Связи: `User 1—N Ticket`, `Service 1—N Ticket` (см. [`backend/app/models.py`](../backend/app/models.py)).

### Service — полный CRUD

| Операция | Метод/маршрут | Проверка | Результат |
|----------|---------------|----------|-----------|
| Create | `POST /api/services` (admin) | 201 | PASS |
| Read (список) | `GET /api/services` | 200 | PASS |
| Read (один) | `GET /api/services/{id}` | 200 | PASS |
| Update | `PUT /api/services/{id}` | duration 55 | PASS |
| Delete | `DELETE /api/services/{id}` | 204 | PASS |

### Ticket — полный CRUD

| Операция | Метод/маршрут | Проверка | Результат |
|----------|---------------|----------|-----------|
| Create | `POST /api/tickets` (client) | 201 | PASS |
| Read (свои) | `GET /api/tickets` | 200 | PASS |
| Read (один) | `GET /api/tickets/{id}` | 200 | PASS |
| Update | `PUT /api/tickets/{id}` (admin → `called`) | 200 | PASS |
| Client cancel | `PUT /api/tickets/{id}` (client → `cancelled`) | 200 | PASS |

### Валидация и обработка ошибок

| Сценарий | Ожидание | Результат |
|----------|----------|-----------|
| `duration_minutes=0` | 422 | PASS |
| Клиент создаёт услугу | 403 | PASS |
| Несуществующая услуга | 404 | PASS |
| Удаление услуги с активными талонами | 409 | PASS |
| Клиент ставит статус `served` | 403 | PASS |
| Клиент отменяет уже вызванный талон | 409 | PASS |

UI-формы и таблицы: страницы `AdminServicesPage`, `TicketsPage`, `ServicesPage`
(см. [`frontend/src/pages/`](../frontend/src/pages/)).

---

## Пункт 5. Авторизация (Client / Admin)

| Проверка | Команда | Ожидание | Результат |
|----------|---------|----------|-----------|
| `GET /auth/me` с токеном | — | 200 | PASS |
| `GET /auth/me` без токена | — | 401 | PASS |
| Повторная регистрация | — | 409 | PASS |
| Клиент → admin-эндпоинт `/users` | — | 403 | PASS |
| Админ → `/users` | — | 200 | PASS |
| Админ → `/stats` | — | 200 | PASS |
| Пароль — bcrypt | SQL `SELECT hashed_password` | префикс `$2b$` | PASS |
| Пароль не в открытом виде | сравнение | не равен исходному | PASS |

Технически: таблица `users` с полем `role`, хеширование bcrypt
([`backend/app/security.py`](../backend/app/security.py)), JWT с `sub`/`role`/`exp`,
проверка роли на сервере ([`backend/app/deps.py`](../backend/app/deps.py)).

---

## Ручной чек-лист UI (проверяется в браузере)

Стек уже мог быть остановлен скриптом — поднимите заново:

```bash
make up        # UI: http://localhost:8080
```

Откройте http://localhost:8080 и пройдите шаги.

1. **Вход администратора.** `/login`, введите `admin@example.com` / `admin12345`.
   Ожидание: переход на страницу «Услуги», в шапке виден бейдж `admin` и пункты
   «Управление услугами», «Пользователи», «Отчёты».
2. **CRUD услуг (форма + таблица).** Откройте «Управление услугами»: слева форма
   создания, справа таблица. Создайте услугу, измените её, удалите.
   Ожидание: таблица обновляется; при попытке удалить услугу с активным талоном —
   сообщение об ошибке (409).
3. **Регистрация клиента.** «Выйти» → «Зарегистрироваться», создайте нового
   пользователя. Ожидание: вход выполнен, в шапке бейдж `client`, нет админ-пунктов меню.
4. **Защита маршрутов.** В адресной строке откройте `/admin/services`.
   Ожидание: перенаправление на `/services` (доступ закрыт).
5. **Создание талона.** На странице «Услуги» нажмите «Записаться».
   Ожидание: сообщение «Талон №N создан…».
6. **Свои талоны.** Откройте «Мои талоны». Ожидание: виден только свой талон,
   доступна кнопка «Отменить» (пока статус «Ожидает»).
7. **Управление очередью (админ).** Войдите снова как админ, откройте «Очередь».
   Ожидание: видны все талоны с колонкой «Клиент»; кнопки «Вызвать» → «Завершить»,
   «Отменить», «Удалить»; фильтр по статусу и «Обновить».
8. **Отчёты.** «Отчёты». Ожидание: карточки итогов и таблица по услугам.
9. **Пользователи.** «Пользователи». Ожидание: смена роли (`client`/`admin`),
   блокировка/разблокировка, удаление (себя удалить нельзя).
10. **Swagger.** http://localhost:8000/docs — все эндпоинты сгруппированы по тегам.
