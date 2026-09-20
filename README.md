# ai-operator-back

Backend API for **Opero** — a personal workspace with an AI assistant that works across Gmail, Google Calendar, Google Drive, notes, tasks and a small CRM (contacts and deals).

**Stack:** Node.js · TypeScript · Express 5 · PostgreSQL · Zod · Passport (Google OAuth) · googleapis · Google Gemini (`@google/genai`)

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Database on Neon](#database-on-neon)
- [Google setup](#google-setup)
- [API overview](#api-overview)
- [Authentication and security](#authentication-and-security)
- [Project structure](#project-structure)
- [Production](#production)
- [Troubleshooting](#troubleshooting)

## Features

- Email + password accounts, sign-in with Google, password reset by e-mail, profile with avatar upload.
- Sessions per device (refresh tokens are stored hashed), automatic access-token refresh.
- Gmail: folders (inbox, starred, sent, trash), search, pagination, read a message, send, and real actions (star, archive, trash, mark read/unread).
- Google Calendar: events for any period, create / update / delete, all-day and multi-day events.
- Google Drive: list recent files.
- Notes (with favorites and search), tasks (todo / in progress / done), CRM contacts and deals.
- AI chat: Gemini with tool calling over all of the above, saved conversations, per-user time zone.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- A Google Cloud project (OAuth client), a Gemini API key and a [Cloudinary](https://cloudinary.com) account (avatar storage)
- Optional: an SMTP account for password-reset e-mails (without it the reset link is printed to the server console)

## Quick start

```bash
git clone https://github.com/BekaBoy26/ai-operator-back.git
cd ai-operator-back

cp .env.example .env     # then fill in the values (see below)
npm install

# create an empty PostgreSQL database first, e.g.: createdb ai-operator
npm run migrate          # creates / updates all tables (safe to run repeatedly)
npm run dev              # http://localhost:5000
```

Check that it is alive: `GET http://localhost:5000/health` → `{"status":"ok"}`.

The web client is a separate Next.js app. It must run at `FRONTEND_URL` (default `http://localhost:3000`) and point to this API with `NEXT_PUBLIC_API_URL=http://localhost:5000`.

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | API port (default `5000`) |
| `FRONTEND_URL` | yes | Origin of the web client (CORS, redirects, links in e-mails) |
| `NODE_ENV` | no | `development` or `production` (production enables `secure` cookies and strict secret checks) |
| `COOKIE_SAMESITE` | no | `lax` (default) when front end and API share a site; `none` for different domains (requires HTTPS) |
| `DATABASE_URL` | one of the two | Connection string of a cloud PostgreSQL such as [Neon](https://neon.tech). When set, `DB_*` are ignored |
| `DATABASE_URL_UNPOOLED` | no | Direct (non-pooler) connection string, used only by `npm run migrate` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | one of the two | Local PostgreSQL (used when `DATABASE_URL` is empty) |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | yes | JWT secrets, **at least 32 random characters**, different from each other |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | OAuth client from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | yes | `http://localhost:5000/auth/google-callback` (must match the OAuth client exactly) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes for avatars | Cloudinary credentials (Dashboard → API Keys). Server-side only — never put them in the front end. Without them the server starts, but avatar uploads return `503 storage_not_configured` |
| `CLOUDINARY_FOLDER` | no | Folder inside Cloudinary (default `opero/avatars`); handy to separate production and staging |
| `GEMINI_API_KEY` | yes | Key for the AI chat |
| `GEMINI_MODEL` | no | Gemini model name (default `gemini-3.6-flash`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Outgoing mail for password reset |

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server with auto-reload (nodemon + ts-node) |
| `npm run migrate` | Applies `src/db/schema.sql` (idempotent) |
| `npm run migrate:avatars` | One-off: moves old avatars from the local `src/uploads` folder to Cloudinary and rewrites `users.avatar` (`-- --dry-run` to preview, `-- --clear-missing` to blank avatars whose file is gone) |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled server (`node dist/index.js`) |

## Database on Neon

1. In the Neon console open your branch → **Connect** → **Postgres database**, keep *Connection pooling* on and copy the connection string.
2. Put it into `.env` as `DATABASE_URL` (with your real password):
   `DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. Create the tables: `npm run migrate`, then start the server: `npm run dev`. The log should say `DB Connected (<host>/neondb)`.

Notes:

- TLS is always on and the server certificate is verified (`sslmode=require` is treated as `verify-full`).
- The database starts empty — register again (or move your data with `pg_dump` / `pg_restore`).
- A Neon compute can be suspended when idle; the first request after a pause may take a few seconds.
- If your password contains special characters they must be URL-encoded (the Neon snippet already does this).
- For migrations Neon recommends a direct connection: put the non-pooled string into `DATABASE_URL_UNPOOLED` (optional).

## Google setup

1. Open Google Cloud Console → create (or pick) a project.
2. **APIs & Services → Library**: enable **Gmail API**, **Google Calendar API**, **Google Drive API**.
3. **OAuth consent screen**: configure it and add yourself as a test user while the app is in *Testing* mode.
   In Testing mode Google expires refresh tokens after 7 days — users then need to press "Reconnect Google" in the app.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Add the authorized redirect URI: `http://localhost:5000/auth/google-callback`.
5. Put the client ID and secret into `.env`.

Scopes requested: `profile`, `email`, `gmail.readonly`, `gmail.send`, `gmail.modify`, `drive.readonly`, `drive.file`, `calendar`.
If you add a scope later, users have to reconnect their Google account once.

## API overview

All routes except `/health`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` and the Google OAuth redirects require `Authorization: Bearer <accessToken>`.
Errors are JSON: `{ "message": "...", "code": "optional_machine_code" }`.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Account | `POST /auth/register` (multipart, optional `avatar`), `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PATCH /auth/profile`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Google OAuth | `POST /auth/google/connect`, `GET /auth/google`, `GET /auth/google-callback` |
| Gmail | `GET /auth/gmail?folder=&q=&pageToken=`, `GET /auth/gmail/:id`, `POST /auth/gmail/send`, `POST /auth/gmail/:id/modify` |
| Calendar | `GET /auth/calendar?timeMin=&timeMax=`, `POST /auth/calendar`, `PATCH /auth/calendar/:id`, `DELETE /auth/calendar/:id` |
| Drive | `GET /auth/drive` |
| Chat | `POST /chat`, `GET /chat/conversations`, `GET /chat/conversations/:id`, `DELETE /chat/conversations/:id` |
| Notes | `GET/POST /notes`, `GET/PATCH/DELETE /notes/:id`, `PATCH /notes/:id/favorite` |
| Tasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`, `PATCH /tasks/:id/status` |
| Contacts | `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id` |
| Deals | `GET/POST /deals`, `GET/PATCH/DELETE /deals/:id`, `PATCH /deals/:id/stage` |

Google-related errors carry a `code`: `google_not_connected`, `google_reconnect` (token expired or revoked), `google_scope` (a permission is missing).
`PATCH` endpoints change only the fields you send.

## Authentication and security

- **Tokens.** A 15-minute access token (sent as Bearer) and a 7-day refresh token in an `httpOnly` cookie (`path=/auth`). Refresh tokens are stored as SHA-256 hashes in `auth_sessions`, one row per device/tab, and are rotated on every refresh (with a 30-second grace period for parallel tabs). Changing the password ends all sessions.
- **Google sign-in** never links automatically to an account created with a password (that would allow account takeover). A signed-in user connects Google with the in-app button (`POST /auth/google/connect`, signed `state`).
- **Rate limiting** (in memory, per IP) on sign-in, registration and password reset.
- **Uploads:** PNG / JPEG / WebP / GIF up to 5 MB; SVG and HTML are rejected. The file is held in memory only, its real content is checked by file signature, and only then is it uploaded to Cloudinary under a random (uuid) name. The database stores the `https://res.cloudinary.com/…` URL, which the browser opens directly. Replacing an avatar deletes the previous image from Cloudinary; Google profile photos are never touched.
- **AI safety.** Tool inputs are validated with the same schemas as the HTTP API. If mail, calendar or Drive data was read during a turn, sending an e-mail in that same turn is blocked until the user confirms in a new message.
- Passwords are hashed with bcrypt; secrets are never logged.
- Google access/refresh tokens are stored in the database as plain text — encrypt the database or the columns in production.

## Project structure

```
src/
  index.ts             server entry point
  createApi.ts         Express app assembly
  config/              Google strategy, Gemini client
  routes/              route definitions
  controllers/         thin HTTP handlers
  services/            business logic (auth, sessions, Google, Gmail, Calendar, Drive, chat, CRUD)
  schemas/             Zod request schemas
  middlewares/         auth, validation, uploads, rate limit, error handling, logger
  plugins/pg.ts        PostgreSQL pool
  db/schema.sql        full idempotent schema
  db/migrate.ts        npm run migrate
  utils/               helpers (tokens, cookies, errors, e-mail, SQL)
```

## Production

```bash
npm ci
npm run migrate
npm run build
NODE_ENV=production npm start     # run from the repository root
```

- Set `NODE_ENV=production`, strong secrets, `FRONTEND_URL` and `GOOGLE_CALLBACK_URL` with your real HTTPS addresses.
- If the API and the web client are on different domains, set `COOKIE_SAMESITE=none` (HTTPS required).
- Put the API behind a reverse proxy (HTTPS, compression). The rate limiter is per process — use a shared store if you run several instances.
- Avatars are stored in Cloudinary, not on the server disk (Render's disk is ephemeral) — set the three `CLOUDINARY_*` variables in *Render → Environment*. The log line `[storage] Cloudinary ready …` after start confirms they are set.
- **Migrating old avatars.** Records created before the Cloudinary switch contain paths like `/uploads/<file>`. Those files lived on the old server's disk and are **not** served on Render. Run `npm run migrate:avatars` once on a machine that still has the `src/uploads` folder (against the same database) to upload them and rewrite the records; records whose file is gone can be blanked with `--clear-missing` (the UI then shows the user's initial).

## Troubleshooting

| Problem | Solution |
|---|---|
| `ACCESS_TOKEN_SECRET is not set` | Fill `.env` (see above); secrets are required |
| `relation "users" does not exist` | Run `npm run migrate` |
| Google asks to reconnect / "missing a permission" | Press "Reconnect Google" in the app (needed after adding a scope, or after 7 days in Testing mode) |
| `redirect_uri_mismatch` from Google | `GOOGLE_CALLBACK_URL` must match the OAuth client redirect URI exactly |
| AI replies "daily request limit reached" | Gemini quota is exhausted for the key — wait or use another key / plan |
| Avatar upload returns `503 storage_not_configured` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` is missing — the server log names the missing variable |
| Password-reset e-mail does not arrive | Configure `SMTP_*`; otherwise the link is printed in the server console |

---

# ai-operator-back (по-русски)

Backend API для **Opero** — персонального рабочего пространства с ИИ-ассистентом, который работает с Gmail, Google Calendar, Google Drive, заметками, задачами и небольшой CRM (контакты и сделки).

**Стек:** Node.js · TypeScript · Express 5 · PostgreSQL · Zod · Passport (Google OAuth) · googleapis · Google Gemini (`@google/genai`)

## Содержание

- [Возможности](#возможности)
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [npm-скрипты](#npm-скрипты)
- [База данных на Neon](#база-данных-на-neon)
- [Настройка Google](#настройка-google)
- [Обзор API](#обзор-api)
- [Аутентификация и безопасность](#аутентификация-и-безопасность)
- [Структура проекта](#структура-проекта)
- [Продакшен](#продакшен)
- [Решение проблем](#решение-проблем)

## Возможности

- Аккаунты по email и паролю, вход через Google, сброс пароля по почте, профиль с загрузкой аватарки.
- Сессии по устройствам (refresh-токены хранятся хешами), автоматическое обновление access-токена.
- Gmail: папки (входящие, помеченные, отправленные, корзина), поиск, постраничная загрузка, чтение письма, отправка и настоящие действия (звезда, архив, корзина, прочитано/непрочитано).
- Google Calendar: события за любой период, создание / изменение / удаление, события на весь день и на несколько дней.
- Google Drive: список последних файлов.
- Заметки (избранное и поиск), задачи (todo / in progress / done), CRM: контакты и сделки.
- ИИ-чат: Gemini с вызовом инструментов по всему перечисленному, сохранённые диалоги, часовой пояс пользователя.

## Требования

- Node.js 20 или новее
- PostgreSQL 14 или новее
- Проект в Google Cloud (OAuth-клиент), ключ Gemini API и аккаунт [Cloudinary](https://cloudinary.com) (хранение аватарок)
- По желанию: SMTP-аккаунт для писем со сбросом пароля (без него ссылка печатается в консоль сервера)

## Быстрый старт

```bash
git clone https://github.com/BekaBoy26/ai-operator-back.git
cd ai-operator-back

cp .env.example .env     # затем заполните значения (см. ниже)
npm install

# сначала создайте пустую базу PostgreSQL, например: createdb ai-operator
npm run migrate          # создаёт / обновляет все таблицы (можно запускать повторно)
npm run dev              # http://localhost:5000
```

Проверка, что сервер жив: `GET http://localhost:5000/health` → `{"status":"ok"}`.

Веб-клиент — отдельное приложение на Next.js. Он должен работать по адресу `FRONTEND_URL` (по умолчанию `http://localhost:3000`) и обращаться к этому API через `NEXT_PUBLIC_API_URL=http://localhost:5000`.

## Переменные окружения

Скопируйте `.env.example` в `.env`.

| Переменная | Обязательна | Описание |
|---|---|---|
| `PORT` | нет | Порт API (по умолчанию `5000`) |
| `FRONTEND_URL` | да | Адрес веб-клиента (CORS, редиректы, ссылки в письмах) |
| `NODE_ENV` | нет | `development` или `production` (в production включаются `secure`-cookie и строгая проверка секретов) |
| `COOKIE_SAMESITE` | нет | `lax` (по умолчанию), если клиент и API на одном сайте; `none` для разных доменов (нужен HTTPS) |
| `DATABASE_URL` | одно из двух | Строка подключения к облачному PostgreSQL, например [Neon](https://neon.tech). Если задана, `DB_*` игнорируются |
| `DATABASE_URL_UNPOOLED` | нет | Прямая строка подключения (не через pooler), используется только в `npm run migrate` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | одно из двух | Локальный PostgreSQL (используется, когда `DATABASE_URL` пуст) |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | да | Секреты JWT, **не короче 32 случайных символов**, разные между собой |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | да | OAuth-клиент из Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | да | `http://localhost:5000/auth/google-callback` (должен точно совпадать с адресом в OAuth-клиенте) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | да, для аватарок | Данные доступа Cloudinary (Dashboard → API Keys). Только на сервере — никогда не кладите их во фронтенд. Без них сервер запустится, но загрузка аватарок вернёт `503 storage_not_configured` |
| `CLOUDINARY_FOLDER` | нет | Папка внутри Cloudinary (по умолчанию `opero/avatars`); удобно разделять production и staging |
| `GEMINI_API_KEY` | да | Ключ для ИИ-чата |
| `GEMINI_MODEL` | нет | Название модели Gemini (по умолчанию `gemini-3.6-flash`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | нет | Исходящая почта для сброса пароля |

Как сгенерировать надёжный секрет:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## npm-скрипты

| Скрипт | Что делает |
|---|---|
| `npm run dev` | Сервер разработки с автоперезапуском (nodemon + ts-node) |
| `npm run migrate` | Применяет `src/db/schema.sql` (идемпотентно) |
| `npm run migrate:avatars` | Разовый перенос старых аватарок из локальной папки `src/uploads` в Cloudinary с заменой `users.avatar` (`-- --dry-run` — только показать, `-- --clear-missing` — очистить аватарки, файл которых потерян) |
| `npm run typecheck` | Проверка типов TypeScript без сборки |
| `npm run build` | Компиляция в `dist/` |
| `npm start` | Запуск собранного сервера (`node dist/index.js`) |

## База данных на Neon

1. В консоли Neon откройте свою ветку → **Connect** → **Postgres database**, оставьте включённым *Connection pooling* и скопируйте строку подключения.
2. Вставьте её в `.env` как `DATABASE_URL` (с настоящим паролем):
   `DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. Создайте таблицы: `npm run migrate`, затем запустите сервер: `npm run dev`. В логе должно появиться `DB Connected (<host>/neondb)`.

Примечания:

- TLS включён всегда, сертификат сервера проверяется (`sslmode=require` трактуется как `verify-full`).
- База начинает пустой — зарегистрируйтесь заново (или перенесите данные через `pg_dump` / `pg_restore`).
- Вычислительный узел Neon засыпает без нагрузки; первый запрос после паузы может занять несколько секунд.
- Если в пароле есть спецсимволы, они должны быть закодированы в URL (сниппет из Neon уже так делает).
- Для миграций Neon рекомендует прямое подключение: положите строку без pooler в `DATABASE_URL_UNPOOLED` (необязательно).

## Настройка Google

1. Откройте Google Cloud Console → создайте (или выберите) проект.
2. **APIs & Services → Library**: включите **Gmail API**, **Google Calendar API**, **Google Drive API**.
3. **OAuth consent screen**: настройте экран согласия и добавьте себя в тестовые пользователи, пока приложение в режиме *Testing*.
   В режиме Testing Google сбрасывает refresh-токены через 7 дней — пользователю потребуется нажать «Reconnect Google» в приложении.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Добавьте разрешённый redirect URI: `http://localhost:5000/auth/google-callback`.
5. Впишите client ID и secret в `.env`.

Запрашиваемые права: `profile`, `email`, `gmail.readonly`, `gmail.send`, `gmail.modify`, `drive.readonly`, `drive.file`, `calendar`.
Если позже добавить новое право, пользователям нужно один раз заново подключить Google-аккаунт.

## Обзор API

Все маршруты, кроме `/health`, `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` и редиректов Google OAuth, требуют заголовок `Authorization: Bearer <accessToken>`.
Ошибки приходят в JSON: `{ "message": "...", "code": "необязательный_машинный_код" }`.

| Раздел | Эндпоинты |
|---|---|
| Здоровье | `GET /health` |
| Аккаунт | `POST /auth/register` (multipart, необязательный `avatar`), `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PATCH /auth/profile`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Google OAuth | `POST /auth/google/connect`, `GET /auth/google`, `GET /auth/google-callback` |
| Gmail | `GET /auth/gmail?folder=&q=&pageToken=`, `GET /auth/gmail/:id`, `POST /auth/gmail/send`, `POST /auth/gmail/:id/modify` |
| Календарь | `GET /auth/calendar?timeMin=&timeMax=`, `POST /auth/calendar`, `PATCH /auth/calendar/:id`, `DELETE /auth/calendar/:id` |
| Drive | `GET /auth/drive` |
| Чат | `POST /chat`, `GET /chat/conversations`, `GET /chat/conversations/:id`, `DELETE /chat/conversations/:id` |
| Заметки | `GET/POST /notes`, `GET/PATCH/DELETE /notes/:id`, `PATCH /notes/:id/favorite` |
| Задачи | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/:id`, `PATCH /tasks/:id/status` |
| Контакты | `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id` |
| Сделки | `GET/POST /deals`, `GET/PATCH/DELETE /deals/:id`, `PATCH /deals/:id/stage` |

Ошибки, связанные с Google, содержат `code`: `google_not_connected`, `google_reconnect` (токен истёк или отозван), `google_scope` (не хватает права).
`PATCH`-запросы меняют только те поля, которые вы прислали.

## Аутентификация и безопасность

- **Токены.** Access-токен на 15 минут (передаётся как Bearer) и refresh-токен на 7 дней в `httpOnly`-cookie (`path=/auth`). Refresh-токены хранятся как SHA-256-хеши в `auth_sessions`, по строке на устройство/вкладку, и ротируются при каждом обновлении (с 30-секундной «отсрочкой» для параллельных вкладок). Смена пароля завершает все сессии.
- **Вход через Google** никогда не склеивается автоматически с аккаунтом, созданным по паролю (это позволило бы захватить чужой аккаунт). Уже вошедший пользователь подключает Google кнопкой в приложении (`POST /auth/google/connect`, подписанный `state`).
- **Ограничение частоты запросов** (в памяти, по IP) на вход, регистрацию и сброс пароля.
- **Загрузки:** PNG / JPEG / WebP / GIF до 5 МБ; SVG и HTML отклоняются. Файл живёт только в памяти, его реальное содержимое проверяется по сигнатуре, и лишь после этого он загружается в Cloudinary под случайным (uuid) именем. В базе хранится ссылка `https://res.cloudinary.com/…`, которую браузер открывает напрямую. При замене аватарки прежняя картинка удаляется из Cloudinary; фото профиля Google не затрагиваются.
- **Безопасность ИИ.** Входные данные инструментов проверяются теми же схемами, что и HTTP-API. Если в текущем ходе были прочитаны письма, календарь или Drive, отправка письма в этом же ходе блокируется до подтверждения пользователем в новом сообщении.
- Пароли хешируются bcrypt; секреты не попадают в логи.
- Токены Google хранятся в базе открытым текстом — в продакшене шифруйте базу или эти колонки.

## Структура проекта

```
src/
  index.ts             точка входа сервера
  createApi.ts         сборка Express-приложения
  config/              стратегия Google, клиент Gemini
  routes/              описание маршрутов
  controllers/         тонкие HTTP-обработчики
  services/            бизнес-логика (аутентификация, сессии, Google, Gmail, Calendar, Drive, чат, CRUD)
  schemas/             Zod-схемы запросов
  middlewares/         аутентификация, валидация, загрузки, лимиты, обработка ошибок, логгер
  plugins/pg.ts        пул PostgreSQL
  db/schema.sql        полная идемпотентная схема
  db/migrate.ts        npm run migrate
  utils/               помощники (токены, cookie, ошибки, email, SQL)
```

## Продакшен

```bash
npm ci
npm run migrate
npm run build
NODE_ENV=production npm start     # запускать из корня репозитория
```

- Задайте `NODE_ENV=production`, надёжные секреты, `FRONTEND_URL` и `GOOGLE_CALLBACK_URL` с реальными HTTPS-адресами.
- Если API и веб-клиент на разных доменах, задайте `COOKIE_SAMESITE=none` (нужен HTTPS).
- Поставьте API за реверс-прокси (HTTPS, сжатие). Лимитер работает на уровне процесса — при нескольких экземплярах используйте общее хранилище.
- Аватарки хранятся в Cloudinary, а не на диске сервера (диск Render временный) — задайте три переменные `CLOUDINARY_*` в *Render → Environment*. Строка `[storage] Cloudinary ready …` в логе после старта подтверждает, что они заданы.
- **Перенос старых аватарок.** Записи, созданные до перехода на Cloudinary, содержат пути вида `/uploads/<файл>`. Эти файлы лежали на диске прежнего сервера и на Render **не отдаются**. Один раз запустите `npm run migrate:avatars` на машине, где ещё есть папка `src/uploads` (с той же базой данных): скрипт загрузит файлы и перепишет записи; записи с потерянным файлом можно очистить флагом `--clear-missing` (в интерфейсе тогда показывается инициал).

## Решение проблем

| Проблема | Решение |
|---|---|
| `ACCESS_TOKEN_SECRET is not set` | Заполните `.env` (см. выше); секреты обязательны |
| `relation "users" does not exist` | Выполните `npm run migrate` |
| Google просит переподключиться / «не хватает права» | Нажмите «Reconnect Google» в приложении (нужно после добавления права или через 7 дней в режиме Testing) |
| `redirect_uri_mismatch` от Google | `GOOGLE_CALLBACK_URL` должен точно совпадать с redirect URI OAuth-клиента |
| ИИ отвечает «достигнут дневной лимит запросов» | Квота Gemini для ключа исчерпана — подождите или используйте другой ключ / тариф |
| Загрузка аватарки возвращает `503 storage_not_configured` | Не задана `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` или `CLOUDINARY_API_SECRET` — в логе сервера указано, какая именно |
| Письмо для сброса пароля не приходит | Настройте `SMTP_*`; иначе ссылка печатается в консоли сервера |
