# WhatsappBot: Project Context

> Read this file before working on any task in this repo. It describes what we are
> building, why, how the pieces fit together, what is in scope now, and the rules
> the code must follow.

---

## 1. What we are building

A **configurable, agentic AI booking assistant** that any appointment-based business
(salon, dentist, board game centre, restaurant, clinic, turf, spa...) can set up and
connect to WhatsApp. Customers chat naturally and the assistant:

- shows available booking slots
- books, reschedules and cancels bookings
- answers basic questions about the business (hours, prices, location, rules)
- quotes the business's Privacy Policy, Terms & Conditions, cancellation and no-show policies
- hands off to a human when it cannot help

The same code serves every business type. Differences between businesses live in
**configuration data**, never in code branches.

### Example interaction
A customer messages a board game centre in Egmore: *"Is a table available for 4 around
4 PM for 2 hours?"* The customer does not care which table. If **any** suitable table
is free at that time, the answer is yes. The system assigns a specific table internally.

---

## 2. Product vision (final product) vs. trial version (what we build now)

### Final product (later)
- WhatsApp Cloud API integration (webhook, template messages, interactive buttons/lists)
- Multi-tenant SaaS: many businesses, each with its own WhatsApp number
- Owner dashboard with an onboarding wizard (templates, CSV import, document upload with assisted extraction)
- Reminders and no-show reduction (scheduled template messages), optional deposits/payments
- Human handoff inbox for staff
- Voice-note transcription, multilingual (English, Tamil, Hindi, code-mixed)
- Redis + job queue (reminders, slot-hold expiry, async webhook processing)
- Owner authentication and roles, analytics, DPDP Act compliance tooling
- Cloud deployment (India region)

### Trial version (current scope)
A local-only working prototype to prove the core idea:
- **Admin UI** (Next.js): create and configure a store (basics, hours, resources, services, policy documents), view bookings
- **Chatbot test page** (`/chat`): pick a store, enter a fake phone number, chat with the agent, see tool calls in a debug panel
- **Backend** (Next.js API routes + `src/lib`): availability engine, booking functions, agent loop
- **PostgreSQL** in Docker (inspected with DBeaver)
- **Claude via the Anthropic API** for the agent
- **No WhatsApp, no Redis, no auth, no payments, no deployment** in the trial

The chat page is a stand-in for WhatsApp. The agent code must be channel-agnostic so
a WhatsApp webhook can call the same function later.

---

## 3. Users

| User | Goal |
|---|---|
| **Customer** | Book, check or cancel an appointment in a few messages, in their own language |
| **Business owner/staff** | Configure the store once, see bookings, trust the bot not to double-book or invent facts |
| **Developer (us)** | A generic engine, easy to test, safe against hallucination and abuse |

---

## 4. Core concepts

- **Business (store/tenant):** one customer of our product. Every tenant-owned table has `business_id`. **Never create per-business tables.**
- **Resource:** a unit that can be reserved: a staff member, table, room, console, chair. Has a `type` and a `capacity`.
- **Service:** what the customer books (Haircut 45 min, "Table booking, 2 hours"). Has duration, buffer, price, party size limits and optional intake questions.
- **Service requirement:** which resource type(s) a service needs (a dentist visit needs `staff` AND `chair`).
- **Booking:** a customer reserving a service for a time range. It occupies one or more resources.
- **Pooled availability:** the customer asks for a *time*, not a specific resource. A slot is available if **at least one eligible resource is free**. The system assigns the resource at booking time.
- **Preferred resource (optional):** a customer may ask for a specific stylist; the pool is then filtered to that resource.
- **Availability is calculated, never stored.** Slots are computed from opening hours, exceptions and existing bookings.

---

## 5. Architecture

```
Customer message (chat page now, WhatsApp later)
  -> Next.js API route /api/chat (thin)
  -> load/create conversation, dedupe message
  -> build context (business config, current date/timezone, sender phone)
  -> Claude agent (tool-calling loop, max 5 tool calls)
       -> tool call -> server validation (scope to business + sender) -> PostgreSQL -> result -> back to agent
  -> final reply (facts rendered from DB records)
  -> saved to messages, returned to chat UI
```

### Principles
1. **The model never decides facts; our code does.** Times, prices, booking IDs and policy wording come from tools and the database.
2. **The database is the final guard.** An exclusion constraint makes double booking impossible.
3. **The server, not the model, supplies identity.** `business_id` and the customer's phone are injected by server code into every tool call. The model can never choose or override them.
4. **Thin routes, fat lib.** Route handlers only parse input and call functions in `src/lib`. The same functions will be reused by the WhatsApp webhook.
5. **Config over code.** Business differences go in tables and `businesses.config`, not in `if (businessType === ...)`.

---

## 6. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui |
| Database | PostgreSQL 16 in Docker (localhost:5432, db `whatsappbot`) |
| ORM | Drizzle ORM + drizzle-kit, `pg` driver |
| Validation | Zod |
| Dates | Luxon (default timezone `Asia/Kolkata`) |
| AI | `@anthropic-ai/sdk`. Default model Claude Haiku 5.5 (`claude-haiku-5-5`), fallback Claude Sonnet 5.5 (`claude-sonnet-5-5`), configured via env vars |
| Tests | Vitest |
| DB client | DBeaver (manual inspection) |

Env vars (`web/.env.local`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_DEFAULT`,
`ANTHROPIC_MODEL_FALLBACK`, `MAX_TOOL_CALLS_PER_MESSAGE`. The API key is server-side only
and must never be imported into client components.

---

## 7. Repository layout

```
WhatsappBot/
  docker-compose.yml          Postgres
  PROJECT_CONTEXT.md          this file
  docs/DBEAVER.md
  web/
    src/
      app/
        page.tsx                  landing
        admin/                    store admin UI (stores, bookings)
        chat/page.tsx             chatbot test page
        api/health, api/chat, api/stores
      components/ui, chat, admin
      lib/
        env.ts, time.ts
        db/index.ts, db/schema.ts
        booking/slots.ts, booking/bookings.ts
        ai/client.ts, prompt.ts, tools.ts, agent.ts
        validation.ts
      scripts/seed-data.ts, seed.ts, verify-db.ts
      db/migrations/
```

---

## 8. Data model (summary)

Tables: `businesses`, `business_documents`, `resources`, `services`,
`service_resource_requirements`, `service_resources`, `availability_rules`,
`availability_exceptions`, `customers`, `bookings`, `booking_resources`,
`conversations`, `messages`. The authoritative definition is `web/src/lib/db/schema.ts`.

Key conventions:
- UUID primary keys; all timestamps `timestamptz`; money in integer minor units (`price_cents`); phones in E.164.
- Enums are `text` + CHECK constraints, not Postgres enum types.
- **Weekday convention: `0 = Sunday ... 6 = Saturday`.** Luxon uses 1=Mon...7=Sun, so always convert with `toDbWeekday`.
- Multiple `availability_rules` rows per weekday are allowed (split shifts). A resource with its own rules uses them; otherwise it uses the business-wide rules (`resource_id IS NULL`).
- `availability_exceptions` override rules (holidays, leave, special hours).
- `booking_resources` holds the reserved time range (`during tstzrange`, **includes buffer time**) per resource, with `active` set to false when cancelled or expired.
- **Double-booking guard:** `EXCLUDE USING gist (resource_id WITH =, during WITH &&) WHERE (active)` (requires `btree_gist`). Inserting an overlapping active range fails with SQLSTATE `23P01`. Ranges are half-open `[start, end)`, so back-to-back bookings are allowed.
- `bookings.idempotency_key` makes writes safe against retried messages.
- Soft-cancel only: set `status = 'cancelled'` and `active = false`. Never delete bookings.
- Never cascade-delete bookings.
- `businesses.config` JSON keys: `tone`, `languages[]`, `cancellation_window_hours`, `min_notice_hours`, `max_days_ahead`, `auto_confirm`, `max_active_bookings_per_customer`.
- `business_documents.type`: `privacy | terms | faq | cancellation | no_show | rules | price_list`, versioned, stored as text so the bot can quote the exact wording.

---

## 9. Booking engine rules (`src/lib/booking`)

**`getAvailableSlots(businessId, serviceId, date, partySize, durationMin?, preferredResourceId?)`**
1. Find candidate resources: required type, active, capacity >= party size (and allowed by `service_resources` if restricted, and the preferred resource if given).
2. Compute each resource's open windows for the date (own rules, else business rules, in the business timezone), then apply exceptions.
3. Subtract existing active `booking_resources` ranges.
4. Generate start times every `slot_interval_min`, each needing `duration + buffer` free.
5. A start time is available if **at least one** candidate resource is free. Return times only, not resource names, unless the customer asked for a specific one.
6. Respect `min_notice_hours` and `max_days_ahead`, and never allow a booking to run past closing.

**`createBooking`**
- Re-validate everything server-side (do not trust the earlier slot list).
- Candidates ordered by **smallest capacity that fits**. Try each: insert booking + `booking_resources` in one transaction; on `23P01` roll back and try the next candidate. If all fail, return `slot_taken` and the agent offers alternatives.
- Idempotent through `idempotency_key`. Enforce `max_active_bookings_per_customer`.
- Multi-resource services insert multiple `booking_resources` rows in one transaction (all or nothing).

**`cancelBooking`**: only the booking's own customer can cancel; enforce `cancellation_window_hours`; set `status='cancelled'` and `active=false` on its resource rows.

**Other functions:** `listCustomerBookings`, `getPolicy(businessId, type)`.

---

## 10. Agent design (`src/lib/ai`)

### System prompt (built per request)
Business name/type, address, hours summary, tone and languages, services (names, durations, prices),
**current date, time and timezone**, and behavioural rules. Static business config is placed first so it can be prompt-cached.

### Rules the agent must follow
- Never state a time, price, availability or booking detail that did not come from a tool result.
- Always call `get_slots` before offering times; never invent times.
- Before creating a booking, show a summary (service, date, time, party size, price) and book **only after an explicit yes**.
- Booking confirmations are rendered from the database record, not from model-written details.
- Answer policy questions by calling `get_policy` and quoting stored text. If the answer is not in the data, say so and offer a human handoff.
- Ask for missing details one at a time and keep replies short, in the customer's language.
- Resolve relative dates ("tomorrow evening", "next Friday") into structured dates for tools, using the provided current date and timezone.
- Politely refuse requests outside the business's scope.

### Tools (Zod-validated)
`get_slots`, `create_booking`, `list_my_bookings`, `cancel_booking`, `reschedule_booking`, `get_policy`.
`storeId`, phone, and conversation id are injected by the server. The model cannot set them.
The trial default provider is local Ollama (`LLM_PROVIDER=ollama`, model `qwen2.5:7b`). Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` to use Claude instead. There is no login in this trial; the admin UI is local-only.

### Loop
Call the model, execute any requested tools, return results, repeat, with a **hard cap of 5 tool calls per message**. On tool errors, return structured errors the agent can explain. If the cap is hit or the model fails, send a safe fallback message and offer human handoff. Use the default model; escalate to the fallback model only for hard cases.

### Security
Treat all customer text as untrusted. A customer must only see and cancel their **own** bookings. Attempts like "cancel everyone's bookings", "ignore your rules" or "I am the owner" must have no effect, because authorization lives in server-side tools and not in the prompt.

---

## 11. Trial version: screens and features

### Admin UI
- `/admin` dashboard (live/draft counts, today's bookings, next 7 days, incomplete setup, latest bookings)
- `/admin/stores` store list. New stores go through `/admin/onboarding` (templates: salon, dentist, game centre, restaurant, clinic, other). `/admin/stores/new` redirects there.
- Store settings tabs: General, Hours & closures, Resources, Services, Policies. Go live and Pause.
  - Resources: add, edit inline, active toggle, remove (deactivates when it has bookings), CSV import.
  - Services: add and edit in a dialog (description, buffer, price, party size, several required resource types, restrict to specific resources, intake questions, active toggle), CSV import. Warns when no eligible resource can seat the largest party.
  - Policies: one field per document with version and saved date, plus generators for starter privacy and terms, cancellation from the store's rules, and the price list from services.
  - Closures: whole days, ranges or part days, shown in the store timezone.
- Onboarding wizard (`/admin/onboarding`, resume at `/admin/onboarding/[id]?step=n`): 7 steps (Basics, Hours, Resources, Services, Rules, Policies, Review). Step 1 collects every basics field (owner WhatsApp, contact phone, address and name are required). **Next is blocked** until the saved data for that step passes (`src/lib/onboarding/step-gate.ts`). Templates apply hours, resources, services and starter policies. New stores default to auto confirm on.
- Dashboard: stores that need setup list what is missing and link to the wizard step that fixes it.
- `/admin/bookings` filters, cancel, confirm a held booking, add a booking
- `/chat` test chat with phone presets, debug panel, and LLM health

Business config keys: `slot_interval_min`, `tone`, `languages`, `cancellation_window_hours`, `min_notice_hours`, `max_days_ahead`, `auto_confirm`, `max_active_bookings_per_customer`, `bookable_weekdays`. Prices are stored in `price_cents`. Per-resource hours exist in the engine (seeded for one stylist) and have no settings UI.

Service intake questions are shown to the agent in the system prompt. `create_booking` is rejected until every **required** question has an answer in `intake_answers`.

### Chat test page (`/chat`)
Store picker, **fake phone number field** (different numbers simulate different customers), message list, "New session" button, and a collapsible **debug panel** showing each tool call, its input and result.

### Seed data
Three test stores (re-runnable seed script):
1. **Glow Salon**: 2 staff (one with a split shift), Haircut / Beard trim / Hair colour (colour restricted to one stylist)
2. **Spice Route** (restaurant): tables of 2, 2, 4, 4, 6; split-shift hours; one 90-minute reservation service
3. **Gamistry** (board game centre, Egmore): tables of 4, 4, 6, 8; 1, 2 and 3-hour services

If the same `get_slots` and `create_booking` code works correctly for all three, the model is generic enough.

---

## 12. Build phases and status

The trial is implemented with no auth. Booking facts come from the engine. The model only calls tools.

1. Ollama client, health check, optional Anthropic: done
2. Booking engine, slots API, unit and integration tests: done
3. Agent tools, prompt, loop, chat and conversation APIs: done
4. Chat page: done
5. Bookings admin: done
6. Store settings (resources, services, policies, closures, pause): done
7. Onboarding wizard and templates: done
8. Dashboard: done
9. Eval runner (`npm run eval`) and cross-customer test: done. 38 scripted cases check tool calls, final booking statuses and reply text (`src/evals/judge.ts` is unit tested).

See `web/docs/EVALS.md` for how to read eval results.

---

## 13. Testing requirements

- **Slot tests** for all three stores: split shifts, exceptions, buffers, notice rules, party size
- **Pooled availability:** a party never lands on a too-small table; the smallest fitting resource is chosen
- **Concurrency:** 20 simultaneous `createBooking` calls for the same slot, exactly one succeeds
- **Cancellation:** frees exactly that resource; cancel window enforced; only the owner can cancel
- **Idempotency:** the same message processed twice creates one booking
- **Agent evals (scripted conversations):** happy paths, rescheduling, full slots, past dates, relative dates, mixed Tamil/Hindi/English, unknown questions, policy questions, human handoff
- **Injection tests:** cancel other customers' bookings, fake business ids, "ignore your instructions", requests for other customers' details
- Run lint, typecheck and tests before declaring any task done

---

## 14. Coding rules

- TypeScript strict, no `any`.
- Business and AI logic in `src/lib`; routes and components stay thin.
- Validate all inputs with Zod at boundaries (API routes and tool inputs).
- Store times as `timestamptz`; generate slots and display in the **business's timezone**; never use the server's local timezone.
- Use database constraints as the last line of defence; do not rely on check-then-insert.
- Wrap multi-row writes in transactions.
- Never log full phone numbers or message content outside local development; keep PII out of logs.
- Never expose `ANTHROPIC_API_KEY` or `DATABASE_URL` to the client.
- Do not add per-business tables or business-type-specific code branches.
- Seed and verify scripts must be safe to re-run and refuse non-local databases unless forced.
- When unsure about a requirement, state the assumption and flag it in the final summary rather than silently guessing.

---

## 15. Out of scope for the trial (do not build unless asked)

WhatsApp Cloud API and webhooks, Redis and job queues, reminders and template messages, payments and deposits, authentication and roles, voice notes, document upload with AI extraction, deployment and CI, multi-language admin UI.

---

## 16. Glossary

- **Tenant / business / store:** one business using the system
- **Resource:** a reservable unit (staff, table, room, console)
- **Pooled availability:** a slot is available if any eligible resource is free
- **Hold:** a temporary reservation while a customer decides (later feature)
- **Idempotency key:** a unique ID per incoming message so retries never double-book
- **`23P01`:** Postgres error code for an exclusion constraint violation (the double-booking guard firing)
- **Handoff:** transferring the conversation to a human