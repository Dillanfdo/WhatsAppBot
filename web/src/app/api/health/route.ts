import { pingDatabase } from "@/lib/db";

export async function GET() {
  await pingDatabase();
  return Response.json({ ok: true });
}
