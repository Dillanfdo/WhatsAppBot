# Frontend workflow

How a person moves through the app today, and what each request does on the server. Steps marked **stub** describe the intended path; the code stops before that work.

## Landing

1. Open `/`.
2. The server renders `LandingIntro` and `LandingLinks` inside a card.
3. **Admin** goes to `/admin`. **Chat test** goes to `/chat`.

## Admin

`src/app/admin/layout.tsx` wraps every admin page. The sidebar is fixed: **Stores** (`/admin`) and **Bookings** (`/admin/bookings`). The brand link returns to `/`.

### Store list (`/admin`)

The page renders a header and `EmptyStoreList`. It does not call `GET /api/stores`.

**Stub:** load businesses from Postgres and link each row to `/admin/stores/[id]`.

### New store (`/admin/stores/new`)

`CreateStoreForm` shows name, timezone (`Asia/Kolkata`), and policy notes. Every control is disabled, including Save. The form does not submit.

**Stub:** POST `/api/stores` with `createStoreSchema`, insert a business, then open its settings page.

`POST /api/stores` already validates `{ name }` and, on success, responds `201` with `{ store: parsed.data }`. It does not write a row. Invalid JSON shape returns `400`.

`GET /api/stores` always returns `{ stores: [] }`.

### Store settings (`/admin/stores/[id]`)

The page is an async server component. It awaits `params`, reads `id`, and passes it to `StoreSettingsCard`, which prints the id. Nothing is loaded or saved.

**Stub:** edit business settings, services, resources, and availability for that id.

### Bookings (`/admin/bookings`)

`EmptyBookingsTable` renders column headers (When, Customer, Service, Status) and a single empty row. It does not call `listBookings`.

**Stub:** query bookings (filters from `bookingFilterSchema`) and fill the table.

## Chat test

`/chat` renders `ChatTestPanel`. All session state is client-side in `useChatSession`.

### Session setup

1. Store defaults to the first dummy store (`store_salon`, Sunrise Salon). The picker also offers Green Park Dental and Meeple Board Game Cafe. These ids are local constants, not database ids.
2. Phone defaults to `+919876543210`. Changing it affects the next send only; earlier bubbles stay as they are.
3. **New session** clears `messages` and increments `sessionKey`. `ChatWindow` is keyed by that number, so it remounts and the composer draft resets. Store and phone stay as selected.

Messages are not stored on the server. Refreshing the page drops the transcript.

### Sending a message

1. `Composer` trims the draft. Empty text, a send already in flight, or `disabled` does nothing.
2. It sets `sending`, which disables the input and the Send button, then calls `sendMessage`.
3. `useChatSession` appends a user `ChatMessage` immediately (`crypto.randomUUID()`).
4. The browser `POST`s `/api/chat`:

```json
{ "storeId": "<selected id>", "phone": "<field value>", "message": "<trimmed text>" }
```

Only this turn is sent. Prior messages are not included.

5. On a non-OK response, Sonner shows “Chat request failed” and the assistant bubble is not added. The user bubble remains.
6. On OK, the body is parsed with `agentResultSchema`. A bad shape shows “Unexpected chat response”.
7. A valid body appends an assistant message whose content is `reply`.
8. `Composer` clears the draft in a `finally` and re-enables the form.

`DebugPanel` can be expanded. It does not list `toolCalls` from the response. The client currently discards `toolCalls` after schema validation.

## `POST /api/chat`

1. Read JSON.
2. `chatRequestSchema.safeParse`. Failure → `400` with `{ error, details }` where `details` is Zod’s flattened error.
3. `runAgent(parsed.data)`.
4. `Response.json(result)`.

`runAgent` today returns the user text as `reply` and an empty `toolCalls` array. The chat page therefore echoes what was typed. The Anthropic client, system prompt, and tool list are not called.

### Intended agent loop (**stub**)

1. Load the business for `input.storeId` (timezone, services, hours, policy).
2. `buildSystemPrompt(business, now)`.
3. Call Anthropic (`ANTHROPIC_MODEL_DEFAULT`, then `ANTHROPIC_MODEL_FALLBACK`) with `agentTools`.
4. On each tool use, run the matching handler in `src/lib/booking` or the policy reader. Pass `storeId` and `phone` from the request, not from the model.
5. Stop after `MAX_TOOL_CALLS_PER_MESSAGE` (default 5).
6. Return `{ reply, toolCalls }` for the chat UI and, later, the WhatsApp webhook.

Tool names reserved in `src/lib/ai/tools.ts`:

| Tool | Library it should call |
| --- | --- |
| `get_slots` | `getAvailableSlots` |
| `create_booking` | `createBooking` |
| `cancel_booking` | `cancelBooking` |
| `list_my_bookings` | `listBookings` scoped to the request phone |
| `get_policy` | business policy from the store record |

`createBooking` and `cancelBooking` throw until implemented. `getAvailableSlots` and `listBookings` return `[]`.

## Health check

`GET /api/health` calls `pingDatabase()` (`select 1` through the shared Drizzle pool) and returns `{ ok: true }`. If Postgres is down or `DATABASE_URL` is wrong, the handler fails. Env is validated when `src/lib/env.ts` is first imported, so a missing variable fails at startup rather than inside this route.

## Process and data that sit beside the UI

- `npm run dev` — Next.js dev server, usually `http://localhost:3000`.
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle Kit against `src/lib/db/schema.ts` and `src/db/migrations`. Schema is empty, so there is nothing to migrate yet.
- `npm run seed` — runs `src/scripts/seed.ts`, which logs that seeding is not implemented. Planned rows: a salon, a dentist, and a board game centre, matching the three dummy chat stores.
- `npm test` — Vitest. `src/lib/time.test.ts` covers timezone helpers.
- Postgres is expected from Docker (`DATABASE_URL` in `.env.example` points at `localhost:5432/whatsappbot`).

WhatsApp is not in this app yet. The planned webhook should call the same `runAgent` and booking functions as `POST /api/chat`, with the store and customer phone taken from the verified webhook payload.
