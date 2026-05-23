/**
 * Sliding Window Log
 *
 * Keeps a timestamp log for each client. On each request, removes
 * timestamps older than windowMs, then checks if the count of
 * remaining timestamps is within the limit.
 *
 * Trade-off: perfectly accurate — no boundary burst — but stores
 * one entry per request per client, so memory grows with traffic.
 */
class SlidingWindow {
  constructor(store, { limit = 100, windowMs = 60_000 } = {}) {
    this.store = store;
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async consume(clientId) {
    const key = `sw:${clientId}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Trim expired timestamps then append current request
    const log = await this.store.listTrim(key, windowStart, this.windowMs * 2);
    const count = log.length + 1; // +1 for the current request
    const allowed = count <= this.limit;

    if (allowed) {
      await this.store.listPush(key, now, this.windowMs * 2);
    }

    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAt: log.length > 0 ? log[0] + this.windowMs : now + this.windowMs,
      algorithm: 'sliding-window',
    };
  }
}

module.exports = SlidingWindow;
