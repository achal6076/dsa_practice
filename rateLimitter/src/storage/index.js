const MemoryStore = require('./memoryStore');
const RedisStore = require('./redisStore');

let _store = null;

async function createStore(redisUrl) {
  if (redisUrl) {
    try {
      const redis = new RedisStore(redisUrl);
      await redis.connect();
      console.log('[store] Connected to Redis');
      return redis;
    } catch (err) {
      console.warn(`[store] Redis unavailable (${err.message}), falling back to in-memory store`);
    }
  }
  console.log('[store] Using in-memory store');
  return new MemoryStore();
}

async function getStore(redisUrl) {
  if (!_store) _store = await createStore(redisUrl);
  return _store;
}

module.exports = { getStore };
