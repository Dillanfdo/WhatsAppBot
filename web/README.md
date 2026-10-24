# WhatsAppBot web

The store admin UI, chatbot test page, and HTTP API all run in this Next.js app. Postgres runs separately in Docker.

## Prerequisites

- Node.js LTS (20.19+; 22+ is safer)
- npm
- Docker Desktop

## 1. Database

From the repository root (`WhatsAppBot/`):

```bash
docker compose up -d
```

That starts Postgres 16 and keeps it running in the background.

| Setting  | Value                                      |
| -------- | ------------------------------------------ |
| Host     | `localhost`                                |
| Port     | `5432`                                     |
| Database | `whatsappbot`                              |
| User     | `postgres`                                 |
| Password | `postgres`                                 |

Connection string (already in `.env.example`):

```text
postgres://postgres:postgres@localhost:5432/whatsappbot
```

Check that the container is up:

```bash
docker compose ps
```

Stop the database (data stays in the Docker volume):

```bash
docker compose down
```

## 2. Environment

From `web/`:

```powershell
copy .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Put connection strings and the Ollama settings in `.env.local`. An Anthropic key is required only when `LLM_PROVIDER=anthropic`. Leave `.env.local` out of git.

```bash
ollama pull qwen2.5:7b
ollama serve
npm run llm:check
```

`llama3.1:8b` and `qwen3:8b` are other tool-capable models.

## 3. Install and migrate

From `web/`:

```bash
npm install
npm run db:migrate
```

Optional sample stores:

```bash
npm run seed
```

## 4. UI and backend

The UI and the API are the same process. From `web/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Surface | URL |
| ------- | --- |
| Dashboard | [http://localhost:3000/admin](http://localhost:3000/admin) |
| Stores | [http://localhost:3000/admin/stores](http://localhost:3000/admin/stores) |
| New store wizard | [http://localhost:3000/admin/onboarding](http://localhost:3000/admin/onboarding) |
| Bookings | [http://localhost:3000/admin/bookings](http://localhost:3000/admin/bookings) |
| Chat test | [http://localhost:3000/chat](http://localhost:3000/chat) |
| DB health | [http://localhost:3000/api/health](http://localhost:3000/api/health) |
| LLM health | [http://localhost:3000/api/health/llm](http://localhost:3000/api/health/llm) |

`/api/health` should return `{ "ok": true }` when Postgres is reachable. Other routes live under `src/app/api/` (`/api/stores`, `/api/chat`).

Production-style run after a build:

```bash
npm run build
npm start
```

## Scripts

- `npm run dev` — UI and API (Next.js dev server)
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests
- `npm run test:int` — integration tests against `whatsappbot_test`
- `npm run eval` — model evals (`--runs N`), writes `src/evals/last-report.json`
- `npm run llm:check` — Ollama reachable, model installed, tools advertised
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle
- `npm run seed` — seed stores
- `npm run verify:db` — check the database connection
