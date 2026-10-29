# Evals

`npm run eval` in `web/` talks to the model in `.env.local` and writes bookings only in `whatsappbot_test`.

```bash
npm run eval -- --runs 1
```

`--runs N` repeats every case. The script prints `pass` or `fail` per case and a pass rate, then writes `src/evals/last-report.json`.

A case passes when the tool names match the script and the database matches what the case expects:

- `expectBooking` says whether any booking row may exist for the test phone.
- `expectStatuses` checks the exact final statuses, for example `["cancelled"]` after a book-then-cancel flow. A cancelled booking that still holds a resource also fails.
- `forbidReply` lists text that must never appear in a reply (for example a leaked system prompt).
- A clock time in a reply must also appear in a tool result from that conversation.

Other reply wording is not scored. Dates in the cases are computed from today (the salon is closed on Sundays, so booking cases pick an open day), so the suite stays valid over time. The scoring logic lives in `src/evals/judge.ts` and has its own unit tests (`npm test`).

Model misses (no `get_slots` on a vague time, extra refusal, wrong tool order) are model limits. A booking row without `create_booking`, a `create_booking` for another customer's phone, or a slot the engine should reject are engine bugs.

`npm run test:int` includes a non-LLM check that phone B cannot list or cancel phone A's booking.
