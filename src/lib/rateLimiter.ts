// Mock rate limiter until tables are created
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  limit: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  return { allowed: true, remaining: limit - 1 };
}

export async function recordRateLimitViolation(
  identifier: string,
  endpoint: string,
  ipAddress?: string
) {
  console.log('Rate limit violation:', { identifier, endpoint, ipAddress });
}
