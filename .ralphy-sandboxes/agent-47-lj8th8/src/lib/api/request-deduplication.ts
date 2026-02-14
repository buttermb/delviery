/**
 * Request Deduplication
 * Deduplicate identical API requests within a time window
 */

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();
const CACHE_TTL = 100; // 100ms window for deduplication
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes max cache age

/**
 * Generate a cache key from request parameters
 */
function generateCacheKey(
  url: string,
  method: string = 'GET',
  body?: unknown
): string {
  const bodyStr = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyStr}`;
}

/**
 * Clean up old pending requests
 */
function cleanupOldRequests(): void {
  const now = Date.now();
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > MAX_CACHE_AGE) {
      pendingRequests.delete(key);
    }
  }
}

/**
 * Deduplicate a request
 * If the same request is made within CACHE_TTL ms, return the existing promise
 */
export async function deduplicateRequest<T>(
  url: string,
  requestFn: () => Promise<T>,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  // Clean up old requests periodically
  if (Math.random() < 0.1) {
    // 10% chance to cleanup on each request
    cleanupOldRequests();
  }

  const cacheKey = generateCacheKey(url, method, body);
  const now = Date.now();
  const existing = pendingRequests.get(cacheKey);

  // If request exists and is recent, return existing promise
  if (existing && now - existing.timestamp < CACHE_TTL) {
    return existing.promise as Promise<T>;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    // Remove from pending after completion
    setTimeout(() => {
      pendingRequests.delete(cacheKey);
    }, CACHE_TTL);
  });

  pendingRequests.set(cacheKey, {
    promise,
    timestamp: now,
  });

  return promise;
}

/**
 * Clear all pending requests (useful for testing or cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

