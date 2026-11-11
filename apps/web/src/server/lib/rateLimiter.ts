import { AppError } from './errors';

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store; resets on serverless cold start (acceptable for university scale)
const store = new Map<string, RateLimitEntry>();

/** Sliding-window rate limiter. Throws AppError.rateLimited when the limit is exceeded. */
export function rateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): void {
  const { key, limit, windowSeconds } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const entry = store.get(key) ?? { timestamps: [] };

  // Slide: remove timestamps older than the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
    store.set(key, entry);
    throw AppError.rateLimited(
      `Rate limit exceeded. Please retry after ${retryAfterSecs} seconds.`,
      retryAfterSecs
    );
  }

  entry.timestamps.push(now);
  store.set(key, entry);
}

/** Clear all rate-limit entries — for use in tests only. */
export function clearRateLimitStore(): void {
  store.clear();
}

/** Helpers for common rate-limit key patterns. */
export const rateLimitKey = {
  byIp: (prefix: string, ip: string) => `rl:${prefix}:ip:${ip}`,
  byAccount: (prefix: string, identifier: string) => `rl:${prefix}:acct:${identifier}`,
  byIpAndAccount: (prefix: string, ip: string, identifier: string) =>
    `rl:${prefix}:ip:${ip}:acct:${identifier}`,
};

/** Extract the real client IP, respecting Vercel/proxy headers. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

