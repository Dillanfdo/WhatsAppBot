import type { AgentResult } from "@/lib/validation";

export type EvalCase = {
  id: string;
  storeId: string;
  phone: string;
  turns: string[];
  requireTools?: string[];
  forbidTools?: string[];
  /** true: at least one booking row must exist for the phone; false: none may exist. */
  expectBooking?: boolean;
  /** Exact statuses (sorted) of the phone's bookings once the conversation ends. */
  expectStatuses?: string[];
  /** Substrings that must never appear in any reply (case-insensitive), for example a leaked system prompt. */
  forbidReply?: string[];
};

export type BookingSnapshot = { count: number; statuses: string[] };

const clockTimes = (text: string) => [...text.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)].map((match) => match[0]);

export const judgeCase = (item: EvalCase, turns: AgentResult[], snapshot: BookingSnapshot): string[] => {
  const names = turns.flatMap((turn) => turn.toolCalls.map((call) => call.name));
  const reasons: string[] = [];
  for (const tool of item.requireTools ?? []) {
    if (!names.includes(tool)) reasons.push(`missing ${tool}`);
  }
  for (const tool of item.forbidTools ?? []) {
    if (names.includes(tool)) reasons.push(`used ${tool}`);
  }
  if (item.expectBooking === true && snapshot.count < 1) reasons.push("no booking row");
  if (item.expectBooking === false && snapshot.count > 0) reasons.push("unexpected booking row");
  if (item.expectStatuses) {
    const wanted = [...item.expectStatuses].sort().join(",");
    const actual = [...snapshot.statuses].sort().join(",");
    if (wanted !== actual) reasons.push(`statuses [${actual}] expected [${wanted}]`);
  }
  for (const text of item.forbidReply ?? []) {
    if (turns.some((turn) => turn.reply.toLowerCase().includes(text.toLowerCase()))) {
      reasons.push(`reply contains "${text}"`);
    }
  }
  const usedSlotTools = names.some((name) => name === "get_slots" || name === "create_booking" || name === "reschedule_booking");
  if (usedSlotTools) {
    const allowed = new Set(turns.flatMap((turn) => turn.toolCalls.flatMap((call) => clockTimes(JSON.stringify(call.output)))));
    for (const turn of turns) {
      for (const time of clockTimes(turn.reply)) {
        if (!allowed.has(time)) reasons.push(`ungrounded time ${time}`);
      }
    }
  }
  return reasons;
};
