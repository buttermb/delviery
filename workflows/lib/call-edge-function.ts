export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

export async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const url = `${process.env.SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // 4xx errors are non-retryable (bad input, unauthorized)
    if (res.status >= 400 && res.status < 500) {
      throw new FatalError(`${name} returned ${res.status}: ${text}`);
    }
    // 5xx errors are retryable (server errors, timeouts)
    throw new Error(`${name} returned ${res.status}: ${text}`);
  }

  return res.json();
}
