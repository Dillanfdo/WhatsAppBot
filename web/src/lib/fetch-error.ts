type ErrorBody = { error?: { message?: string } | string } | null;

export const errorMessage = async (response: Response, fallback: string): Promise<string> => {
  const body = (await response.json().catch(() => null)) as ErrorBody;
  if (body && typeof body.error === "object" && body.error?.message) {
    return body.error.message;
  }
  if (body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
};
