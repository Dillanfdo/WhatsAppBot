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

Open [http://localhost:3000](http://localhost:3000). Useful paths:

- `/` landing
- `/admin` store admin placeholders
- `/chat` chatbot test page
- `/api/health` Postgres `select 1`

Fill in `ANTHROPIC_API_KEY` in `web/.env.local` when you start the AI agent work. Keep that file server-side only.

## Scripts (`web/`)

- `npm run dev` — Next.js dev server
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle
- `npm run seed` — seed script stub

## Planned build order

1. Scaffold (this repo state): app shell, env, Docker Postgres, stubs
2. Drizzle schema and migrations for businesses, resources, services, availability, customers, bookings, conversations
3. Seed three test stores
4. Booking engine: slots, create/cancel/list
5. Admin UI for stores, services, availability, and bookings
6. Anthropic tools + agent loop (identity always from the server)
7. Wire `/chat` to the real agent
8. WhatsApp Cloud API webhook using the same lib functions as `/api/chat`
