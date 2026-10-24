import { checkLlm } from "@/lib/ai/llm/health";

export async function GET() {
  const health = await checkLlm();
  return Response.json(health);
}
