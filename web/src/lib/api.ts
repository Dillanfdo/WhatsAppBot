import { z } from "zod";
import { bookingResponse } from "@/lib/booking/http";

export const readStoreId = async (params: Promise<{ id: string }>) => {
  const { id } = await params;
  return z.uuid().safeParse(id).success ? id : null;
};

export const readJson = async (request: Request) => {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
};

export const invalid = (message: string) =>
  Response.json({ error: { code: "invalid_state", message } }, { status: 400 });

export const missingStore = () =>
  Response.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });

export const respond = async <T>(work: () => Promise<T>, status = 200) => {
  try {
    return Response.json(await work(), { status });
  } catch (error) {
    return bookingResponse(error);
  }
};
