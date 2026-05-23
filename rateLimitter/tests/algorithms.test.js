const MemoryStore = require('../src/storage/memoryStore');
const FixedWindow = require('../src/algorithms/fixedWindow');
const SlidingWindow = require('../src/algorithms/slidingWindow');
const TokenBucket = require('../src/algorithms/tokenBucket');

function makeStore() {
  return new MemoryStore();
}

// ─── Fixed Window ───────────────────────────────────────────────────────────

describe('FixedWindow', () => {
  test('allows requests within the limit', async () => {
    const limiter = new FixedWindow(makeStore(), { limit: 3, windowMs: 10_000 });
    const r1 = await limiter.consume('client-a');
    const r2 = await limiter.consume('client-a');
    const r3 = await limiter.consume('client-a');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  test('blocks the (limit+1)th request', async () => {
    const limiter = new FixedWindow(makeStore(), { limit: 2, windowMs: 10_000 });
    await limiter.consume('client-b');
    await limiter.consume('client-b');
    const blocked = await limiter.consume('client-b');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test('isolates different clients', async () => {
    const store = makeStore();
    const limiter = new FixedWindow(store, { limit: 1, windowMs: 10_000 });
    const r1 = await limiter.consume('alice');
    const r2 = await limiter.consume('bob');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  test('reports correct algorithm label', async () => {
    const limiter = new FixedWindow(makeStore(), { limit: 5, windowMs: 10_000 });
    const r = await limiter.consume('client-c');
    expect(r.algorithm).toBe('fixed-window');
  });
});

// ─── Sliding Window ──────────────────────────────────────────────────────────

describe('SlidingWindow', () => {
  test('allows requests within the limit', async () => {
    const limiter = new SlidingWindow(makeStore(), { limit: 3, windowMs: 10_000 });
    const r1 = await limiter.consume('sw-a');
    const r2 = await limiter.consume('sw-a');
    const r3 = await limiter.consume('sw-a');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test('blocks after limit is reached', async () => {
    const limiter = new SlidingWindow(makeStore(), { limit: 2, windowMs: 10_000 });
    await limiter.consume('sw-b');
    await limiter.consume('sw-b');
    const blocked = await limiter.consume('sw-b');
    expect(blocked.allowed).toBe(false);
  });

  test('accepts new requests after the window expires', async () => {
    const limiter = new SlidingWindow(makeStore(), { limit: 1, windowMs: 50 });
    const first = await limiter.consume('sw-c');
    expect(first.allowed).toBe(true);

    await new Promise((r) => setTimeout(r, 60)); // wait past window

    const second = await limiter.consume('sw-c');
    expect(second.allowed).toBe(true);
  });

  test('reports correct algorithm label', async () => {
    const limiter = new SlidingWindow(makeStore(), { limit: 5, windowMs: 10_000 });
    const r = await limiter.consume('sw-d');
    expect(r.algorithm).toBe('sliding-window');
  });
});

// ─── Token Bucket ────────────────────────────────────────────────────────────

describe('TokenBucket', () => {
  test('allows requests up to capacity', async () => {
    const limiter = new TokenBucket(makeStore(), { capacity: 3, refillRate: 0.1, tokensPerRequest: 1 });
    const r1 = await limiter.consume('tb-a');
    const r2 = await limiter.consume('tb-a');
    const r3 = await limiter.consume('tb-a');
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  test('blocks when bucket is empty', async () => {
    const limiter = new TokenBucket(makeStore(), { capacity: 2, refillRate: 0.01, tokensPerRequest: 1 });
    await limiter.consume('tb-b');
    await limiter.consume('tb-b');
    const blocked = await limiter.consume('tb-b');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  test('refills tokens over time', async () => {
    const limiter = new TokenBucket(makeStore(), { capacity: 2, refillRate: 100, tokensPerRequest: 1 });
    await limiter.consume('tb-c');
    await limiter.consume('tb-c');
    const blocked = await limiter.consume('tb-c');
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 20)); // 100 tokens/s × 0.02s = 2 tokens refilled

    const allowed = await limiter.consume('tb-c');
    expect(allowed.allowed).toBe(true);
  });

  test('reports correct algorithm label', async () => {
    const limiter = new TokenBucket(makeStore(), { capacity: 5, refillRate: 1 });
    const r = await limiter.consume('tb-d');
    expect(r.algorithm).toBe('token-bucket');
  });
});
