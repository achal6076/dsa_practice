# API Rate Limiter

A production-ready API rate limiter built with Node.js and Express. Supports three algorithms and two storage backends, switchable via environment variables — no code changes required.

## Algorithms

| Algorithm | How it works | Best for |
|---|---|---|
| **Token Bucket** | Tokens refill continuously at a fixed rate. Bursts allowed up to bucket capacity. | Most APIs — used by AWS, Stripe, GitHub |
| **Sliding Window Log** | Timestamps are logged per client. Requests outside the window are trimmed. No boundary burst. | Strict per-second enforcement |
| **Fixed Window Counter** | Resets a counter at the start of each time window. Simple and memory-efficient. | Coarse-grained limits (per-minute, per-hour) |

## Storage Backends

| Backend | When used |
|---|---|
| **Redis** | Set `REDIS_URL`. Shared state across multiple server instances. |
| **In-memory** | Fallback when Redis is unavailable or `REDIS_URL` is not set. |

## Quick Start

```bash
# Install dependencies
npm install

# Copy and edit environment config
cp .env.example .env

# Start the server
npm start

# Or with hot-reload (Node 18+)
npm run dev
```

## Configuration

All settings are controlled via environment variables in `.env`:

```env
PORT=3000
REDIS_URL=redis://localhost:6379        # optional

RATE_LIMIT_ALGORITHM=token-bucket       # fixed-window | sliding-window | token-bucket

# Fixed Window / Sliding Window
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_MS=60000

# Token Bucket
TOKEN_BUCKET_CAPACITY=10
TOKEN_BUCKET_REFILL_RATE=1             # tokens per second
TOKEN_BUCKET_COST=1                    # tokens per request
```

## API Endpoints

| Method | Path | Rate Limit |
|---|---|---|
| `GET` | `/api/data` | Configurable via env (default: token bucket) |
| `GET` | `/api/search?q=` | Sliding window — 5 req / 30s |
| `POST` | `/api/auth/login` | Fixed window — 5 req / 60s |
| `GET` | `/health` | No limit |

### Response Headers

Every rate-limited response includes:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1716571200
X-RateLimit-Algorithm: token-bucket
```

On `429 Too Many Requests`:

```
Retry-After: 12
```

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 12s.",
  "retryAfter": 12,
  "algorithm": "token-bucket"
}
```

## Demo

Start the server in one terminal, then run the demo script in another:

```bash
# Terminal 1
npm start

# Terminal 2
node demo.js
```

Expected output (token bucket, capacity=10):

```
=== Rate Limiter Demo (token-bucket) ===
Sending 20 requests with 200ms delay each

[ 1] ✓ 200  remaining=9  algo=token-bucket
[ 2] ✓ 200  remaining=8  algo=token-bucket
...
[10] ✓ 200  remaining=0  algo=token-bucket
[11] ✗ 429  remaining=0  retry-after=8s  algo=token-bucket
...

--- Summary ---
Allowed : 10
Blocked : 10
```

## Tests

```bash
npm test
```

12 unit tests covering all three algorithms: allow-within-limit, block-at-limit, client isolation, time-based reset.

## Using the Middleware in Your Own Express App

```js
const { getStore } = require('./src/storage');
const { createRateLimiter } = require('./src/middleware/rateLimiter');

const store = await getStore(process.env.REDIS_URL);

app.use('/api/', createRateLimiter(store, {
  algorithm: 'token-bucket',
  capacity: 100,
  refillRate: 10,         // 10 tokens/sec
  tokensPerRequest: 1,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
}));
```

## Project Structure

```
.
├── src/
│   ├── algorithms/
│   │   ├── fixedWindow.js
│   │   ├── slidingWindow.js
│   │   └── tokenBucket.js
│   ├── storage/
│   │   ├── memoryStore.js
│   │   └── redisStore.js
│   ├── middleware/
│   │   └── rateLimiter.js
│   ├── config.js
│   └── server.js
├── tests/
│   └── algorithms.test.js
├── demo.js
└── .env.example
```

## Design Decisions

- **No external rate-limit library** — all three algorithms implemented from scratch so the logic is visible and interview-discussable.
- **Redis fallback** — the server starts even if Redis is down, degrading gracefully to in-memory storage.
- **Standard headers** — follows the [IETF RateLimit header draft](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers).
- **Algorithm-agnostic middleware** — swap algorithms without touching route code.
