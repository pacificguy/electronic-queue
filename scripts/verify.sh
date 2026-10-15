#!/usr/bin/env bash
#
# Автоматическая проверка всех пунктов 1-5 проекта «Электронная очередь».
#
# Запуск:
#   bash scripts/verify.sh            # полная проверка, БД поднимается с нуля
#   bash scripts/verify.sh --fast     # без пересборки образов и без удаления volume
#
# Скрипт печатает PASS/FAIL по каждой проверке и завершается кодом,
# равным числу проваленных проверок.
#
set -u

# ---------------------------------------------------------------------------
# Настройки и утилиты
# ---------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

if [ -t 1 ]; then
  GREEN=$'\e[32m'; RED=$'\e[31m'; YEL=$'\e[33m'; CYN=$'\e[36m'; BOLD=$'\e[1m'; NC=$'\e[0m'
else
  GREEN=""; RED=""; YEL=""; CYN=""; BOLD=""; NC=""
fi

PASS=0
FAIL=0
FRESH=1
[ "${1:-}" = "--fast" ] && FRESH=0

section() { printf "\n${CYN}${BOLD}== %s ==${NC}\n" "$1"; }
info()    { printf "   ${YEL}·${NC} %s\n" "$1"; }
ok()      { PASS=$((PASS + 1)); printf "   ${GREEN}PASS${NC} %s\n" "$1"; }
ko()      { FAIL=$((FAIL + 1)); printf "   ${RED}FAIL${NC} %s\n" "$1"; }

expect_eq() { # описание ожидаемое фактическое
  if [ "$2" = "$3" ]; then ok "$1 → $3"; else ko "$1 → ожидалось '$2', получено '$3'"; fi
}
expect_ge() { # описание минимум фактическое
  if [ "$3" -ge "$2" ] 2>/dev/null; then ok "$1 → $3"; else ko "$1 → ожидалось ≥$2, получено '$3'"; fi
}
expect_status() { # описание ожидаемый_код метод url [data...]
  local desc="$1" expected="$2" method="$3" url="$4"
  shift 4
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$url" "$@")"
  if [ "$code" = "$expected" ]; then ok "$desc → HTTP $code"; else ko "$desc → ожидалось HTTP $expected, получено $code"; fi
}

# Docker Compose (v2 или v1)
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi

# Переменные окружения (из .env, если есть)
if [ -f .env ]; then set -a; . ./.env; set +a; fi
PGUSER="${POSTGRES_USER:-queue}"
PGPASS="${POSTGRES_PASSWORD:-queue}"
PGDB="${POSTGRES_DB:-queue}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin12345}"
UI_PORT="${UI_PORT:-8080}"
BASE="http://localhost:${UI_PORT}/api"

cleanup() { printf "\n${YEL}Останавливаю стек...${NC}\n"; $DC down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

# ---------------------------------------------------------------------------
# ПУНКТ 1. Git + описание проекта
# ---------------------------------------------------------------------------
section "ПУНКТ 1. Git, ветки, .gitignore, описание проекта"

COMMITS="$(git rev-list --count HEAD 2>/dev/null || echo 0)"
expect_ge "количество коммитов" 5 "$COMMITS"
info "История коммитов:"
git log --oneline | sed 's/^/        /' || true

for b in main dev; do
  if git show-ref --verify --quiet "refs/heads/$b"; then ok "локальная ветка $b существует"; else ko "нет локальной ветки $b"; fi
done

REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
if [ -n "$REMOTE" ]; then ok "remote origin = $REMOTE"; else ko "не настроен remote origin"; fi
if git ls-remote --heads origin >/dev/null 2>&1; then
  RAW="$(git ls-remote --heads origin 2>/dev/null)"
  echo "$RAW" | grep -q 'refs/heads/main' && ok "origin/main существует" || ko "origin/main не найден"
  echo "$RAW" | grep -q 'refs/heads/dev'  && ok "origin/dev существует"  || ko "origin/dev не найден"
else
  info "remote недоступен — пропускаю проверку origin (оффлайн)"
fi

# фактические пути, которые существуют в рабочей копии
for p in .env frontend/node_modules backend/.venv; do
  if [ -e "$p" ]; then
    if git check-ignore -q "$p" 2>/dev/null; then ok "$p игнорируется git"; else ko "$p НЕ игнорируется"; fi
  fi
done
# шаблоны-защиты в .gitignore (важны даже если файлов ещё нет)
for pat in "node_modules/" ".venv/" "dist/" "pgdata/" ".env"; do
  if grep -qF "$pat" .gitignore; then ok "шаблон '$pat' есть в .gitignore"; else ko "нет шаблона '$pat' в .gitignore"; fi
done

[ -f README.md ] && ok "README.md присутствует" || ko "нет README.md"
if [ -f docs/project-description.md ]; then
  LINES="$(wc -l < docs/project-description.md)"
  expect_ge "описание проекта (строк)" 80 "$LINES"
else
  ko "нет docs/project-description.md"
fi

# ---------------------------------------------------------------------------
# ПУНКТ 2. 60 use cases и 20 MVP
# ---------------------------------------------------------------------------
section "ПУНКТ 2. 60 пользовательских историй и 20 MVP"

UC_FILE="docs/use-cases.md"
if [ -f "$UC_FILE" ]; then
  UNIQUE="$(grep -o '| UC-[0-9]*' "$UC_FILE" | sort -u | wc -l | tr -d ' ')"
  expect_eq "уникальных user stories" 60 "$UNIQUE"
  MVP="$(grep '| UC-' "$UC_FILE" | grep -c '✅')"
  expect_eq "историй, помеченных MVP" 20 "$MVP"
  info "Распределение по модулям:"
  grep -E '^\| UC-[0-9]+ \|' "$UC_FILE" | grep -E '\| (Client|Admin) \|' \
    | cut -d'|' -f3 | sed 's/^ *//;s/ *$//' | sort | uniq -c | sed 's/^/        /'
else
  ko "нет $UC_FILE"
fi

# ---------------------------------------------------------------------------
# ПУНКТ 3. Docker: server + db + ui
# ---------------------------------------------------------------------------
section "ПУНКТ 3. Docker-контейнеры (server, db, ui)"

if $DC config >/dev/null 2>&1; then ok "docker-compose.yml валиден"; else ko "docker-compose.yml невалиден"; fi

SERVICES="$($DC config --services 2>/dev/null | sort | tr '\n' ' ' | sed 's/ *$//')"
expect_eq "состав сервисов" "db server ui" "$SERVICES"

VOLUMES="$($DC config --volumes 2>/dev/null | sort | tr '\n' ' ' | sed 's/ *$//')"
if echo "$VOLUMES" | grep -q 'pgdata'; then ok "volume для БД (pgdata) объявлен"; else ko "нет volume pgdata"; fi

if [ "$FRESH" = "1" ]; then
  info "Поднимаю стек с нуля: down -v + up --build (это может занять пару минут)..."
  $DC down -v >/dev/null 2>&1 || true
  if $DC up -d --build >/tmp/verify_compose.log 2>&1; then ok "docker compose up --build выполнен"; else ko "docker compose up --build упал (см. /tmp/verify_compose.log)"; fi
else
  info "Быстрый режим: up -d без пересборки"
  $DC up -d >/dev/null 2>&1 || true
fi

info "Ожидаю готовности API..."
READY=0
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health" 2>/dev/null)" = "200" ]; then READY=1; break; fi
  sleep 2
done
[ "$READY" = "1" ] && ok "API отвечает на /api/health" || ko "API не поднялся за отведённое время"

RUNNING="$($DC ps --services --status running 2>/dev/null | sort | tr '\n' ' ' | sed 's/ *$//')"
expect_eq "запущенные контейнеры" "db server ui" "$RUNNING"

if $DC logs server 2>/dev/null | grep -q 'Running upgrade'; then ok "миграции Alembic применены при старте"; else info "лог миграций не найден"; fi
if $DC logs server 2>/dev/null | grep -q 'создан администратор\|уже существует'; then ok "seed администратора выполнен"; else ko "seed администратора не выполнен"; fi

NET="$($DC config 2>/dev/null | grep -c 'queue-net')"
expect_ge "упоминаний общей сети queue-net" 1 "$NET"

# ---------------------------------------------------------------------------
# ПУНКТ 4. Два CRUD по двум сущностям
# ---------------------------------------------------------------------------
section "ПУНКТ 4. Два CRUD (Service и Ticket), БД и валидация"

# --- Схема БД ---
TABLES="$($DC exec -T db psql -U "$PGUSER" -d "$PGDB" -tAc \
  "select tablename from pg_tables where schemaname='public' order by tablename" 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
for t in services tickets users; do
  echo "$TABLES" | grep -q "$t" && ok "таблица $t существует" || ko "нет таблицы $t"
done
if $DC exec -T server alembic history >/dev/null 2>&1; then ok "история миграций Alembic доступна"; else ko "alembic history недоступен"; fi

# --- Токены ---
EMAIL="verify_$(date +%s)@example.com"
PASSWORD="secret123"

REG_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"full_name\":\"Verify User\",\"password\":\"$PASSWORD\"}")"
expect_eq "регистрация клиента" 201 "$REG_CODE"

CTOKEN="$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)"
[ -n "$CTOKEN" ] && ok "вход клиента, получен JWT" || ko "не удалось получить JWT клиента"

ATOKEN="$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)"
[ -n "$ATOKEN" ] && ok "вход администратора, получен JWT" || ko "не удалось получить JWT администратора"

CAUTH=(-H "Authorization: Bearer $CTOKEN")
AAUTH=(-H "Authorization: Bearer $ATOKEN")
JSON=(-H 'Content-Type: application/json')

# --- CRUD: Services (Admin) ---
SID="$(curl -s -X POST "$BASE/services" "${AAUTH[@]}" "${JSON[@]}" \
  -d '{"name":"Verify Service","description":"created by verify","duration_minutes":30}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)"
[ -n "$SID" ] && ok "CREATE service (admin) → id=$SID" || ko "CREATE service не удался"

expect_status "READ список services" 200 GET "$BASE/services" "${CAUTH[@]}"
expect_status "READ один service" 200 GET "$BASE/services/$SID" "${AAUTH[@]}"

NEWDUR="$(curl -s -X PUT "$BASE/services/$SID" "${AAUTH[@]}" "${JSON[@]}" \
  -d '{"duration_minutes":55}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("duration_minutes",""))' 2>/dev/null)"
expect_eq "UPDATE service duration" 55 "$NEWDUR"

expect_status "валидация: duration=0 → 422" 422 POST "$BASE/services" "${AAUTH[@]}" "${JSON[@]}" -d '{"name":"Bad","duration_minutes":0}'
expect_status "клиент не может создать service → 403" 403 POST "$BASE/services" "${CAUTH[@]}" "${JSON[@]}" -d '{"name":"Nope"}'
expect_status "READ несуществующей услуги → 404" 404 GET "$BASE/services/999999" "${AAUTH[@]}"
expect_status "DELETE service (admin)" 204 DELETE "$BASE/services/$SID" "${AAUTH[@]}"

# --- CRUD: Tickets ---
SVC_ID="$(curl -s "$BASE/services" "${CAUTH[@]}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")' 2>/dev/null)"
[ -n "$SVC_ID" ] && ok "получен id услуги для записи (service_id=$SVC_ID)" || ko "нет доступных услуг для записи"

TID="$(curl -s -X POST "$BASE/tickets" "${CAUTH[@]}" "${JSON[@]}" \
  -d "{\"service_id\":$SVC_ID,\"comment\":\"verify\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)"
[ -n "$TID" ] && ok "CREATE ticket (client) → id=$TID" || ko "CREATE ticket не удался"

expect_status "READ список tickets (client)" 200 GET "$BASE/tickets" "${CAUTH[@]}"
expect_status "READ один ticket" 200 GET "$BASE/tickets/$TID" "${CAUTH[@]}"
expect_status "READ весь список tickets (admin)" 200 GET "$BASE/tickets" "${AAUTH[@]}"

# клиент успешно отменяет свой талон в статусе waiting
TID_C="$(curl -s -X POST "$BASE/tickets" "${CAUTH[@]}" "${JSON[@]}" \
  -d "{\"service_id\":$SVC_ID}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)"
CSTATUS="$(curl -s -X PUT "$BASE/tickets/$TID_C" "${CAUTH[@]}" "${JSON[@]}" \
  -d '{"status":"cancelled"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status",""))' 2>/dev/null)"
expect_eq "CLIENT отменяет свой waiting-талон" cancelled "$CSTATUS"

# admin вызывает талон
NEWSTATUS="$(curl -s -X PUT "$BASE/tickets/$TID" "${AAUTH[@]}" "${JSON[@]}" \
  -d '{"status":"called"}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status",""))' 2>/dev/null)"
expect_eq "UPDATE ticket status (admin→called)" called "$NEWSTATUS"
expect_status "клиент не может ставить статус served → 403" 403 PUT "$BASE/tickets/$TID" "${CAUTH[@]}" "${JSON[@]}" -d '{"status":"served"}'
expect_status "клиент не может отменить вызванный талон → 409" 409 PUT "$BASE/tickets/$TID" "${CAUTH[@]}" "${JSON[@]}" -d '{"status":"cancelled"}'

# --- Удаление услуги с активным талоном → 409 ---
SID2="$(curl -s -X POST "$BASE/services" "${AAUTH[@]}" "${JSON[@]}" \
  -d '{"name":"Busy Service","duration_minutes":10}' | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)"
curl -s -X POST "$BASE/tickets" "${CAUTH[@]}" "${JSON[@]}" -d "{\"service_id\":$SID2}" >/dev/null 2>&1
expect_status "DELETE занятой услуги → 409" 409 DELETE "$BASE/services/$SID2" "${AAUTH[@]}"

# ---------------------------------------------------------------------------
# ПУНКТ 5. Авторизация (Client / Admin), bcrypt
# ---------------------------------------------------------------------------
section "ПУНКТ 5. Авторизация, роли, bcrypt"

expect_status "GET /auth/me с токеном" 200 GET "$BASE/auth/me" "${AAUTH[@]}"
expect_status "GET /auth/me без токена → 401" 401 GET "$BASE/auth/me"

DUP="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"full_name\":\"dup\",\"password\":\"$PASSWORD\"}")"
expect_eq "повторная регистрация → 409" 409 "$DUP"

expect_status "клиент на admin-эндпоинт /users → 403" 403 GET "$BASE/users" "${CAUTH[@]}"
expect_status "админ на /users → 200" 200 GET "$BASE/users" "${AAUTH[@]}"
expect_status "админ на /stats → 200" 200 GET "$BASE/stats" "${AAUTH[@]}"

# bcrypt-хеш в БД
HASH="$($DC exec -T db psql -U "$PGUSER" -d "$PGDB" -tAc \
  "select hashed_password from users where email='$EMAIL'" 2>/dev/null | tr -d '[:space:]')"
if printf '%s' "$HASH" | grep -q '^\$2[aby]\$'; then ok "пароль хранится как bcrypt-хеш"; else ko "пароль не похож на bcrypt (получено '${HASH:0:10}...')"; fi
if [ "$HASH" != "$PASSWORD" ]; then ok "пароль не хранится в открытом виде"; else ko "пароль хранится в открытом виде!"; fi

# ---------------------------------------------------------------------------
# Итог
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
printf "\n${BOLD}================ ИТОГ ================${NC}\n"
printf "  Всего проверок: %s\n" "$TOTAL"
printf "  ${GREEN}Успешно: %s${NC}\n" "$PASS"
printf "  ${RED}Провалено: %s${NC}\n" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf "  ${GREEN}${BOLD}ВСЕ ПУНКТЫ 1-5 ПРОЙДЕНЫ${NC}\n"
else
  printf "  ${RED}${BOLD}ЕСТЬ ПРОВАЛЫ${NC}\n"
fi
printf "${BOLD}======================================${NC}\n"

exit "$FAIL"
