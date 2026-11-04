import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ============================================================================
// Custom Telemetry Metrics
// ============================================================================
const orderLatency = new Trend('order_placement_duration', true);
const cacheLatency = new Trend('product_cache_duration', true);
const successfulOrders = new Counter('successful_orders_total');
const cacheHitRate = new Rate('cache_hit_ratio');

// ============================================================================
// Load Profile Configuration (Ramping VUs)
// ============================================================================
export const options = {
  stages: [
    { duration: '15s', target: 20 }, // 1. Warm-up & ramp-up to 20 users
    { duration: '30s', target: 50 }, // 2. High-concurrency peak load at 50 users
    { duration: '15s', target: 0 },  // 3. Cool-down & ramp-down to 0
  ],
  thresholds: {
    // 95% of all HTTP requests must complete within 350ms
    http_req_duration: ['p(95)<350'],
    // Overall HTTP failure rate must stay below 5%
    http_req_failed: ['rate<0.05'],
    // Order placement (ACID row lock + Kafka) 95th percentile under 400ms
    order_placement_duration: ['p(95)<400'],
  },
};

// Target endpoint: Override via CLI with `-e BASE_URL=http://<YOUR_IP>`
const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// ============================================================================
// Setup Phase: Executed once before load testing starts
// ============================================================================
export function setup() {
  const testUser = {
    username: `k6_tester_${Date.now()}`,
    password: 'K6SecurePassword123!',
  };

  const headers = { 'Content-Type': 'application/json' };

  // 1. Register candidate user
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify(testUser),
    { headers }
  );

  check(regRes, {
    'setup: user registered or exists': (r) => r.status === 201 || r.status === 409,
  });

  // 2. Login to obtain JWT
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(testUser),
    { headers }
  );

  let token = null;
  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    token = body.token;
  }

  return { token, testUser };
}

// ============================================================================
// Virtual User (VU) Simulation Loop
// ============================================================================
export default function (data) {
  const commonHeaders = {
    'Content-Type': 'application/json',
  };

  // --------------------------------------------------------------------------
  // Scenario 1: Healthcheck Probe (Testing Nginx routing & Express loop)
  // --------------------------------------------------------------------------
  const healthRes = http.get(`${BASE_URL}/healthz`);
  check(healthRes, {
    'healthz status is 200': (r) => r.status === 200,
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Redis Cache-Aside Product Catalog Read
  // --------------------------------------------------------------------------
  const productStart = Date.now();
  const productRes = http.get(`${BASE_URL}/api/products/1`);
  cacheLatency.add(Date.now() - productStart);

  const productSuccess = check(productRes, {
    'product lookup status is 200': (r) => r.status === 200,
    'product response has valid id': (r) => {
      try {
        const body = JSON.parse(r.body);
        const isHit = body.source === 'cache';
        cacheHitRate.add(isHit ? 1 : 0);
        return body.data && body.data.id === 1;
      } catch (e) {
        return false;
      }
    },
  });

  // --------------------------------------------------------------------------
  // Scenario 3: High-Contention Transactional Checkout
  // (Pessimistic Row Lock + Stock Deduction + Kafka Event Dispatch)
  // --------------------------------------------------------------------------
  if (data.token) {
    const orderHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    };

    const orderPayload = JSON.stringify({
      productId: 1,
      quantity: 1,
    });

    const orderStart = Date.now();
    const orderRes = http.post(
      `${BASE_URL}/api/orders`,
      orderPayload,
      { headers: orderHeaders }
    );
    orderLatency.add(Date.now() - orderStart);

    check(orderRes, {
      'order status is 201 (placed) or 400 (insufficient stock)': (r) =>
        r.status === 201 || r.status === 400,
    });

    if (orderRes.status === 201) {
      successfulOrders.add(1);
    }
  }

  // Sleep between 200ms - 800ms to simulate natural user think time
  sleep(Math.random() * 0.6 + 0.2);
}

// ============================================================================
// Teardown Phase: Executed once after all tests complete
// ============================================================================
export function teardown(data) {
  console.log(`[k6 Teardown] Completed load test execution for: ${BASE_URL}`);
}

