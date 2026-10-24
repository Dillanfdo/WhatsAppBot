import { runAgent } from "@/lib/ai/agent";
import { chatRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_state", message: "Expected a JSON body." } },
      { status: 400 },
    );
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_state", message: "Invalid chat request." } },
      { status: 400 },
    );
  }
  const result = await runAgent(parsed.data);
  return Response.json(result);
}
