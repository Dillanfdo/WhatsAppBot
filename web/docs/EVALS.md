# Evals

`npm run eval` in `web/` talks to the model in `.env.local` and writes bookings only in `whatsappbot_test`.

```bash
npm run eval -- --runs 1
```

`--runs N` repeats every case. The script prints `pass` or `fail` per case and a pass rate, then writes `src/evals/last-report.json`.

A case passes when the tool names match the script and the database has a booking only if the case asked for one. Reply wording is not scored, except a clock time in the reply must also appear in a tool result from that conversation.

Model misses (no `get_slots` on a vague time, extra refusal, wrong tool order) are model limits. A booking row without `create_booking`, a `create_booking` for another customer's phone, or a slot the engine should reject are engine bugs.

`npm run test:int` includes a non-LLM check that phone B cannot list or cancel phone A's booking.
