class MemoryStore {
  constructor() {
    this.store = new Map();
    // Periodic cleanup every 60s to prevent unbounded growth
    setInterval(() => this._cleanup(), 60_000).unref();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiry: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  async del(key) {
    this.store.delete(key);
  }

  // Atomic increment — returns new value after adding delta
  async incrBy(key, delta, ttlMs) {
    const current = (await this.get(key)) ?? 0;
    const next = current + delta;
    await this.set(key, next, ttlMs);
    return next;
  }

  // Append to a list stored as JSON array
  async listPush(key, value, ttlMs) {
    const current = (await this.get(key)) ?? [];
    current.push(value);
    await this.set(key, current, ttlMs);
    return current;
  }

  // Remove list elements older than minTimestamp
  async listTrim(key, minTimestamp, ttlMs) {
    const current = (await this.get(key)) ?? [];
    const trimmed = current.filter((ts) => ts > minTimestamp);
    await this.set(key, trimmed, ttlMs);
    return trimmed;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiry && now > entry.expiry) this.store.delete(key);
    }
  }
}

module.exports = MemoryStore;
