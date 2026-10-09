/**
 * Sliding-window rate limiter. In-memory, so limits are per server instance;
 * swap the store for Redis/Upstash when running more than one instance.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    const since = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return { ok: false, retryAfterSec: Math.ceil((list[0]! + this.windowMs - now) / 1000) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(since);
    return { ok: true, retryAfterSec: 0 };
  }

  private prune(since: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => t > since)) this.hits.delete(k);
  }
}

export const limiters = {
  ingest: new RateLimiter(12, 60_000),
  officialSync: new RateLimiter(6, 60_000),
  oauth: new RateLimiter(10, 10 * 60_000),
  mutate: new RateLimiter(60, 60_000),
  assistant: new RateLimiter(30, 10 * 60_000),
};
