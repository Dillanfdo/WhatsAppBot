import { runAgent } from "@/lib/ai/agent";
import { chatRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid chat request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await runAgent(parsed.data);
  return Response.json(result);
}
