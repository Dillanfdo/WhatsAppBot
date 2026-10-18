import { createStore, listStores } from "@/lib/stores";
import { createStoreSchema, storeListResponseSchema } from "@/lib/validation";

export async function GET() {
  const stores = await listStores();
  const body = storeListResponseSchema.parse({ stores });
  return Response.json(body);
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = createStoreSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid store payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const store = await createStore(parsed.data);
  return Response.json({ store }, { status: 201 });
}
