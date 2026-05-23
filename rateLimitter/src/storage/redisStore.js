const Redis = require('ioredis');

class RedisStore {
  constructor(redisUrl) {
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', () => {}); // handled by caller via connect()
  }

  async connect() {
    await this.client.connect();
  }

  async get(key) {
    const val = await this.client.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  async set(key, value, ttlMs) {
    const serialized = JSON.stringify(value);
    if (ttlMs) {
      await this.client.set(key, serialized, 'PX', ttlMs);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key) {
    await this.client.del(key);
  }

  async incrBy(key, delta, ttlMs) {
    const next = await this.client.incrby(key, delta);
    if (ttlMs && next === delta) {
      // Only set TTL on first creation to avoid resetting it mid-window
      await this.client.pexpire(key, ttlMs);
    }
    return next;
  }

  async listPush(key, value, ttlMs) {
    const serialized = JSON.stringify(value);
    await this.client.rpush(key, serialized);
    if (ttlMs) await this.client.pexpire(key, ttlMs);
    const all = await this.client.lrange(key, 0, -1);
    return all.map((v) => JSON.parse(v));
  }

  async listTrim(key, minTimestamp, ttlMs) {
    const all = await this.client.lrange(key, 0, -1);
    const parsed = all.map((v) => JSON.parse(v));
    const trimmed = parsed.filter((ts) => ts > minTimestamp);
    if (trimmed.length !== parsed.length) {
      await this.client.del(key);
      if (trimmed.length > 0) {
        await this.client.rpush(key, ...trimmed.map((v) => JSON.stringify(v)));
        if (ttlMs) await this.client.pexpire(key, ttlMs);
      }
    }
    return trimmed;
  }

  async quit() {
    await this.client.quit();
  }
}

module.exports = RedisStore;
