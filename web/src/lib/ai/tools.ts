import "server-only";

export type AgentToolName =
  | "get_slots"
  | "create_booking"
  | "cancel_booking"
  | "list_my_bookings"
  | "get_policy";

export type AgentToolDefinition = {
  name: AgentToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
};

export const agentTools: AgentToolDefinition[] = [
  {
    name: "get_slots",
    description: "List available booking slots for a service.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_booking",
    description: "Create a booking for the current customer.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "cancel_booking",
    description: "Cancel a booking owned by the current customer.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_my_bookings",
    description: "List bookings for the current customer.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_policy",
    description: "Return store booking and cancellation policy.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// TODO: replace empty input_schema stubs with real JSON schemas
// TODO: implement tool handlers that call src/lib/booking (identity from server, not the model)
