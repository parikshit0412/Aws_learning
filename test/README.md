# Grafana k6 Load Testing Suite

This folder contains the Grafana k6 performance and stress testing script for the backend e-commerce request lifecycle.

---

## 1. Test Profile Overview

The [`test/load-test.js`](file:///d:/AWS_Practice/AWS_learning/test/load-test.js) script executes a realistic end-to-end user lifecycle under ramping concurrency:

1. **Setup Phase (`setup`)**: Registers a test user and acquires a Bearer JWT.
2. **Scenario 1 (Routing & Health)**: Queries `/healthz` to stress-test Nginx reverse proxy buffering.
3. **Scenario 2 (Cache-Aside Engine)**: Repeatedly requests `/api/products/1` to measure Redis cache hit ratio vs. miss latency.
4. **Scenario 3 (High-Contention Checkout)**: Issues authenticated checkout requests (`POST /api/orders`) to stress PostgreSQL pessimistic row-level locking (`.for('update')`) and Kafka event dispatching.
5. **Thresholds (SLAs)**:
   * 95% of all requests must complete within **350ms**.
   * Transactional order placement 95th percentile under **400ms**.
   * Total error rate must stay below **5%**.

---

## 2. How to Run the Load Test

### Option A: Using k6 Binary (Local or EC2)

#### 1. Install k6:
* **Windows (via Winget)**:
  ```powershell
  winget install k6 --source winget
  ```
* **macOS (Homebrew)**:
  ```bash
  brew install k6
  ```
* **Linux (Amazon Linux 2023 / Ubuntu)**:
  ```bash
  sudo dnf install -y https://github.com/grafana/k6/releases/download/v0.50.0/k6-v0.50.0-linux-amd64.rpm
  ```

#### 2. Run the test against localhost:
```bash
k6 run test/load-test.js
```

#### 3. Run the test against your AWS EC2 instance:
```bash
k6 run -e BASE_URL=http://YOUR_EC2_PUBLIC_IP test/load-test.js
```

---

### Option B: Using Docker (Zero Installation)

If you have Docker installed, you do not need to install k6 locally:

```powershell
# Run using the official Grafana k6 container:
docker run --rm -i grafana/k6 run -e BASE_URL=http://host.docker.internal - < test/load-test.js
```

Against your AWS EC2 instance:
```powershell
docker run --rm -i grafana/k6 run -e BASE_URL=http://54.210.xx.xx - < test/load-test.js
```

---

## 3. Custom Metrics Tracked in the Output

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `cache_hit_ratio` | Rate | Percentage of product queries served directly from Redis. |
| `product_cache_duration` | Trend | Latency distribution of product catalog reads. |
| `order_placement_duration`| Trend | Latency distribution for DB row locking + stock deduction + Kafka send. |
| `successful_orders_total` | Counter | Total number of successfully placed orders before stock depleted. |

---

## 4. Correlating with Grafana & Prometheus

While the k6 load test is running:
1. Open your **Prometheus Dashboard** (`http://<IP>:9090`).
   * Query: `rate(ecommerce_http_requests_total[1m])`
   * Watch the request throughput spike in real time!
2. Open **Grafana** (`http://<IP>:3001`).
   * View CPU, memory, and HTTP response distributions under peak 50-user load.

