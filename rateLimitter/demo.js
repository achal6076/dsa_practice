/**
 * Demo: hammers the /api/data endpoint to show rate limiting in action.
 * Run: node demo.js [algorithm]
 * Example: node demo.js token-bucket
 */

const http = require('http');

const ALGORITHM = process.argv[2] || 'token-bucket';
const PORT = process.env.PORT || 3000;
const TOTAL_REQUESTS = 20;
const DELAY_MS = 200; // delay between requests

function request(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          remaining: res.headers['x-ratelimit-remaining'],
          algorithm: res.headers['x-ratelimit-algorithm'],
          retryAfter: res.headers['retry-after'],
          body: JSON.parse(body),
        });
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log(`\n=== Rate Limiter Demo (${ALGORITHM}) ===`);
  console.log(`Sending ${TOTAL_REQUESTS} requests with ${DELAY_MS}ms delay each\n`);

  let allowed = 0;
  let blocked = 0;

  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    const result = await request('/api/data');
    const icon = result.status === 200 ? '✓' : '✗';
    const remaining = result.remaining ?? '?';
    const algo = result.algorithm ?? ALGORITHM;

    if (result.status === 200) {
      allowed++;
      console.log(`[${i.toString().padStart(2)}] ${icon} 200  remaining=${remaining}  algo=${algo}`);
    } else if (result.status === 429) {
      blocked++;
      console.log(
        `[${i.toString().padStart(2)}] ${icon} 429  remaining=0  retry-after=${result.retryAfter}s  algo=${algo}`
      );
    } else {
      console.log(`[${i.toString().padStart(2)}] ? ${result.status}  ${result.error || ''}`);
    }

    if (i < TOTAL_REQUESTS) await sleep(DELAY_MS);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Allowed : ${allowed}`);
  console.log(`Blocked : ${blocked}`);
  console.log(`Total   : ${TOTAL_REQUESTS}`);
}

run();
