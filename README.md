# WhatsAppBot

Configurable booking assistant for businesses (salons, dentists, board game centres). The Next.js app in `web/` will host the store admin UI, a chatbot test page, and API routes.

## Prerequisites

- Node.js LTS (20.19+ recommended; 22+ is safer for current tooling)
- npm
- Docker Desktop

## Setup

```bash
docker compose up -d
cd web
npm install
copy .env.example .env.local
npm run dev
```

On macOS/Linux, copy env with `cp .env.example .env.local`.

Open [http://localhost:3000](http://localhost:3000).

- `/` landing
- `/admin` dashboard
- `/admin/stores` stores
- `/admin/onboarding` new-store wizard
- `/admin/bookings` bookings
- `/chat` chatbot test page
- `/api/health` Postgres
- `/api/health/llm` Ollama or Anthropic

The trial has no login. Admin pages are for local use. The agent uses Ollama and does not need `ANTHROPIC_API_KEY`.

```bash
ollama pull qwen2.5:7b
ollama serve
cd web
npm run llm:check
```

`llama3.1:8b` and `qwen3:8b` are other tool-capable models. Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` to switch to Claude.

## Scripts (`web/`)

- `npm run dev` — Next.js dev server
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests
- `npm run test:int` — integration tests on `whatsappbot_test`
- `npm run eval` — scripted model evals
- `npm run llm:check` — model health
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle
- `npm run seed` — three sample stores
- `npm run verify:db` — database check

There is no WhatsApp webhook in this trial. Per-resource opening hours work in the booking engine and are not editable in the hours screen.
