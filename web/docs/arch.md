# Frontend architecture

The `web/` app is a Next.js 16 App Router project (React 19). It is the store admin UI, the chatbot test page, and the HTTP API that will later serve WhatsApp. Domain logic lives in server-only libraries. Pages compose feature components and do not own data rules.

## Layers

```
Browser
  app routes (server components) ── compose ── feature components
  client islands ("use client") ── fetch ── app/api route handlers
                                              │
                                              ▼
                                    Zod request schemas
                                              │
                                              ▼
                         lib/ai  ·  lib/booking  ·  lib/db
                                              │
                                              ▼
                                    Postgres (Drizzle + pg)
```

| Layer | Where | Role |
| --- | --- | --- |
| Routes | `src/app` | URL entry points. Pages compose UI. Route handlers validate input and call libraries. |
| Feature UI | `src/components/{home,admin,chat}` | One component per file, used by a single feature. |
| Primitives | `src/components/ui` | shadcn / Base UI pieces (`Button`, `Card`, `Select`, `Table`, …). |
| Shared UI | `src/components/shared` | Reserved for components used by two or more pages. Empty today. |
| Contracts | `src/lib/validation.ts` | Zod schemas shared by the client and the API. |
| Domain | `src/lib/{ai,booking,db,time,env}` | Server logic. `ai`, `booking`, `db`, and `env` import `server-only`. |
| Schema | `src/lib/db/schema.ts` | Drizzle tables. Not defined yet. |
| Seed | `src/scripts/seed.ts` | CLI entry (`npm run seed`). Not implemented yet. |

Import alias `@/` maps to `src/`.

## App shell

`src/app/layout.tsx` is the root layout. It loads Geist and Geist Mono, sets page metadata, renders `{children}`, and mounts the Sonner toaster used by client code for errors.

`next.config.ts` enables `cacheComponents` and `partialPrefetching`, marks `pg` as a server external package, and runs Tailwind 4 through Turbopack.

Styling is Tailwind 4 (`src/app/globals.css`) plus `cn` from `src/lib/utils.ts`.

## Routes

| Path | File | What it does today |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Landing card with links to admin and chat. |
| `/admin` | `src/app/admin/page.tsx` | Empty store list inside the admin layout. |
| `/admin/stores/new` | `src/app/admin/stores/new/page.tsx` | Disabled create-store form. |
| `/admin/stores/[id]` | `src/app/admin/stores/[id]/page.tsx` | Server page. Awaits `params` and shows the store id. |
| `/admin/bookings` | `src/app/admin/bookings/page.tsx` | Empty bookings table. |
| `/chat` | `src/app/chat/page.tsx` | Chat test page. |
| `GET /api/health` | `src/app/api/health/route.ts` | Runs `select 1` against Postgres. |
| `GET /api/stores` | `src/app/api/stores/route.ts` | Returns `{ stores: [] }`. |
| `POST /api/stores` | `src/app/api/stores/route.ts` | Validates a name and echoes it. Does not insert. |
| `POST /api/chat` | `src/app/api/chat/route.ts` | Validates the body and calls `runAgent`. |

`src/app/admin/layout.tsx` wraps every `/admin` page in a sidebar (`Stores`, `Bookings`) and a main column. The sidebar links back to `/`.

Pages are arrow-function server components. The only client boundary in the product UI is the chat feature (`ChatTestPanel` and the pieces it needs for state and events). Admin forms are static placeholders and stay on the server.

## Chat UI

`/chat` renders `ChatTestPanel`, which owns the session through `useChatSession` and composes:

- `StorePicker` — three hardcoded stores in `dummyStores.ts` (salon, dentist, board game cafe). Not loaded from the API.
- `TestPhoneField` — customer phone sent with every message. Default `+919876543210`.
- `SessionBar` — store name and a “New session” control.
- `ChatWindow` — `MessageList` + `Composer`. Remounted when the session key changes so the composer draft resets.
- `DebugPanel` — collapsed placeholder. It does not receive tool traces yet.

`ChatMessage` is `{ id, role: "user" | "assistant", content }`. Messages live in React state only. They are not written to `conversations` / `messages` tables (those tables are not defined yet).

## API contracts

`chatRequestSchema`: `{ storeId, phone, message }`, each a non-empty string.

`agentResultSchema`: `{ reply: string, toolCalls: { name, input, output }[] }`.

`createStoreSchema`: `{ name }` only. Timezone, WhatsApp number, vertical, and policies are still TODO.

`bookingFilterSchema`: optional `storeId`. Date range and status are still TODO.

The chat client parses the response with `agentResultSchema` before rendering it. The route handler parses the request with `chatRequestSchema` and returns `400` plus Zod flatten details on failure.

## Server libraries

### Environment (`src/lib/env.ts`)

Parsed once at import with Zod. Required: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_DEFAULT`, `ANTHROPIC_MODEL_FALLBACK`, `MAX_TOOL_CALLS_PER_MESSAGE`. A bad env throws before the app serves traffic. Values come from `.env.local` (see `.env.example`). The key stays on the server; client components never import this module.

### Database (`src/lib/db`)

`index.ts` creates a `pg` `Pool` from `DATABASE_URL` and a Drizzle client. In development the pool is stored on `globalThis` so hot reload does not open a new pool every time. `pingDatabase()` is the health check.

`schema.ts` lists the intended tables and exports nothing yet: businesses, resources, services, availability rules and exceptions, customers, bookings, booking resources, business documents, conversations, messages. Drizzle Kit reads this file (`drizzle.config.ts`) and writes SQL to `src/db/migrations`.

### Booking (`src/lib/booking`)

`slots.getAvailableSlots` and `bookings.createBooking` / `cancelBooking` / `listBookings` are the engine the agent and the admin UI are meant to share. Inputs carry `storeId` and `customerPhone` from the caller. Implementations are stubs: slots and list return `[]`, create and cancel throw.

### Time (`src/lib/time.ts`)

Luxon helpers. Default zone is `Asia/Kolkata`. This module is safe to import from tests (`src/lib/time.test.ts`, Vitest).

### AI (`src/lib/ai`)

| File | Status |
| --- | --- |
| `client.ts` | Anthropic SDK client using `env.ANTHROPIC_API_KEY`. |
| `prompt.ts` | `buildSystemPrompt` returns a short stub: store name, timezone, current time, and a rule that identity comes from the server. |
| `tools.ts` | Five tool names: `get_slots`, `create_booking`, `cancel_booking`, `list_my_bookings`, `get_policy`. JSON schemas are empty. Handlers are not implemented. |
| `agent.ts` | `runAgent` ignores the model and returns `{ reply: input.message, toolCalls: [] }`. |

Identity rule, already written into the agent stub: `storeId` and customer phone come from the HTTP caller (`input.storeId`, `input.phone`). The model must not supply `business_id` or customer identity. Tool handlers, when built, call `src/lib/booking` with those server values. `MAX_TOOL_CALLS_PER_MESSAGE` is the planned cap on the tool loop and is unused today.

## What is wired vs stubbed

Wired:

- App shell, admin chrome, landing, chat test UI.
- Chat POST validation, echo agent, client-side result validation, toasts.
- Database pool and health ping.
- Env validation and Anthropic client construction.

Stubbed:

- Drizzle schema, migrations, seed data.
- Store list, store create, store settings, bookings table.
- Slot search and booking create / cancel / list.
- System prompt content, tool schemas, tool handlers, and the Anthropic tool-calling loop.
- Debug panel tool traces.
- Conversation persistence. Each chat request sends only the latest message, not prior turns.
