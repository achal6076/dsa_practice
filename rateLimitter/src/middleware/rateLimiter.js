const FixedWindow = require('../algorithms/fixedWindow');
const SlidingWindow = require('../algorithms/slidingWindow');
const TokenBucket = require('../algorithms/tokenBucket');

const ALGORITHMS = {
  'fixed-window': FixedWindow,
  'sliding-window': SlidingWindow,
  'token-bucket': TokenBucket,
};

function createRateLimiter(store, options = {}) {
  const {
    algorithm = 'token-bucket',
    limit = 10,
    windowMs = 60_000,
    capacity = 10,
    refillRate = 1,
    tokensPerRequest = 1,
    keyGenerator = (req) => req.ip,
    onLimitReached = null,
  } = options;

  const AlgorithmClass = ALGORITHMS[algorithm];
  if (!AlgorithmClass) {
    throw new Error(`Unknown algorithm: "${algorithm}". Use: ${Object.keys(ALGORITHMS).join(', ')}`);
  }

  const limiter = new AlgorithmClass(store, { limit, windowMs, capacity, refillRate, tokensPerRequest });

  return async function rateLimiterMiddleware(req, res, next) {
    const clientId = keyGenerator(req);
    const result = await limiter.consume(clientId);

    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    res.setHeader('X-RateLimit-Algorithm', result.algorithm);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', Math.max(1, retryAfter));

      if (onLimitReached) onLimitReached(req, clientId);

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.max(1, retryAfter)}s.`,
        retryAfter: Math.max(1, retryAfter),
        algorithm: result.algorithm,
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
