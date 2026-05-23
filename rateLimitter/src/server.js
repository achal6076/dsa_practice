const express = require('express');
const config = require('./config');
const { getStore } = require('./storage');
const { createRateLimiter } = require('./middleware/rateLimiter');

async function startServer() {
  const store = await getStore(config.redisUrl);
  const app = express();
  app.use(express.json());

  // Default limiter uses config values (algorithm switchable via env)
  const defaultLimiter = createRateLimiter(store, {
    ...config.rateLimits,
    onLimitReached: (req, clientId) =>
      console.warn(`[rate-limit] ${clientId} exceeded limit on ${req.path}`),
  });

  // Stricter limiter for auth routes — fixed window, 5 req/min
  const authLimiter = createRateLimiter(store, {
    algorithm: 'fixed-window',
    limit: 5,
    windowMs: 60_000,
    keyGenerator: (req) => `auth:${req.ip}`,
  });

  // Public API — uses the default configurable algorithm
  app.get('/api/data', defaultLimiter, (req, res) => {
    res.json({ message: 'Here is your data!', timestamp: new Date().toISOString() });
  });

  // Simulate a search endpoint — sliding window for precise control
  app.get('/api/search', createRateLimiter(store, {
    algorithm: 'sliding-window',
    limit: 5,
    windowMs: 30_000,
  }), (req, res) => {
    res.json({ results: [], query: req.query.q });
  });

  // Auth endpoint — strict fixed window
  app.post('/api/auth/login', authLimiter, (req, res) => {
    res.json({ token: 'demo-jwt-token' });
  });

  // Health check — no rate limiting
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', algorithm: config.rateLimits.algorithm });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port}`);
    console.log(`[server] Active algorithm: ${config.rateLimits.algorithm}`);
  });

  return app;
}

startServer().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});

module.exports = { startServer };
