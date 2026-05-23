/**
 * Token Bucket
 *
 * Each client has a bucket that holds up to `capacity` tokens.
 * Tokens refill at `refillRate` tokens/second continuously.
 * Each request costs `tokensPerRequest` tokens.
 *
 * Trade-off: allows controlled bursting up to `capacity` while
 * enforcing a smooth average rate. Used by AWS, Stripe, and GitHub.
 */
class TokenBucket {
  constructor(store, { capacity = 10, refillRate = 1, tokensPerRequest = 1, windowMs = 60_000 } = {}) {
    this.store = store;
    this.capacity = capacity;
    this.refillRate = refillRate;         // tokens added per second
    this.tokensPerRequest = tokensPerRequest;
    this.windowMs = windowMs;
    this.ttlMs = Math.ceil((capacity / refillRate) * 1000) * 10; // generous TTL
  }

  async consume(clientId) {
    const key = `tb:${clientId}`;
    const now = Date.now();

    let bucket = await this.store.get(key);

    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefill: now };
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const refilled = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + refilled);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= this.tokensPerRequest;
    if (allowed) {
      bucket.tokens -= this.tokensPerRequest;
    }

    await this.store.set(key, bucket, this.ttlMs);

    const secondsUntilToken = allowed
      ? 0
      : Math.ceil((this.tokensPerRequest - bucket.tokens) / this.refillRate);

    return {
      allowed,
      limit: this.capacity,
      remaining: Math.floor(bucket.tokens),
      resetAt: Date.now() + secondsUntilToken * 1000,
      algorithm: 'token-bucket',
    };
  }
}

module.exports = TokenBucket;
