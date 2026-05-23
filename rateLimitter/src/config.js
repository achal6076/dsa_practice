require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  redisUrl: process.env.REDIS_URL || null,

  rateLimits: {
    // Default algorithm: 'fixed-window' | 'sliding-window' | 'token-bucket'
    algorithm: process.env.RATE_LIMIT_ALGORITHM || 'token-bucket',

    // Fixed Window & Sliding Window
    limit: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),

    // Token Bucket
    capacity: parseInt(process.env.TOKEN_BUCKET_CAPACITY || '10', 10),
    refillRate: parseFloat(process.env.TOKEN_BUCKET_REFILL_RATE || '1'), // tokens/sec
    tokensPerRequest: parseInt(process.env.TOKEN_BUCKET_COST || '1', 10),
  },
};
