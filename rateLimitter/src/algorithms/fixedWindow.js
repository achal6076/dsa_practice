/**
 * Fixed Window Counter
 *
 * Divides time into fixed windows (e.g., each minute).
 * Resets the counter at the start of each window.
 *
 * Trade-off: simple and memory-efficient, but allows a burst of 2x
 * the limit at window boundaries (last second of window N + first
 * second of window N+1 both count fresh).
 */
class FixedWindow {
  constructor(store, { limit = 100, windowMs = 60_000 } = {}) {
    this.store = store;
    this.limit = limit;
    this.windowMs = windowMs;
  }

  _windowKey(clientId) {
    const windowId = Math.floor(Date.now() / this.windowMs);
    return `fw:${clientId}:${windowId}`;
  }

  async consume(clientId) {
    const key = this._windowKey(clientId);
    const count = await this.store.incrBy(key, 1, this.windowMs * 2);
    const remaining = Math.max(0, this.limit - count);
    const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
    const resetAt = windowStart + this.windowMs;

    return {
      allowed: count <= this.limit,
      limit: this.limit,
      remaining,
      resetAt,
      algorithm: 'fixed-window',
    };
  }
}

module.exports = FixedWindow;
