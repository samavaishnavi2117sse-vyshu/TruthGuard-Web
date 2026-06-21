# TruthGuard Web Application - Baseline/Load Testing Results

This report documents the performance of the TruthGuard Web Application server under a baseline load test simulating concurrent users.

## Test Configuration
- **Target URL**: `http://localhost:3000/` (Express static file server)
- **Virtual Users (Concurrency)**: 100 concurrent connections
- **Duration**: 1 minute (60.12 seconds total)
- **Testing Tool**: Autocannon (Node.js load-testing utility)

---

## Performance Summary

The server demonstrated exceptional stability and speed under the load of 100 concurrent users. 

| Metric | Result |
| :--- | :--- |
| **Total Requests Handled** | 198,000 |
| **Total Data Read** | 1.66 GB |
| **Average Requests per Second (RPS)** | **3,290.74 req/sec** |
| **Average Response Time** | **29.92 ms** |
| **Min Response Time (2.5% percentile)** | **26 ms** |
| **Max Response Time (Slowest)** | **68 ms** |

---

## Detailed Metrics

### 1. Requests Per Second (RPS)
The server successfully handled over 3,000 requests per second continuously with very low standard deviation, indicating highly stable throughput.

- **Average**: 3,290.74 req/sec
- **Min**: 2,904 req/sec
- **Max (97.5% percentile)**: 3,429 req/sec
- **Standard Deviation**: 83.56 req/sec

### 2. Response Time (Latency Distribution)
Response times remained consistently fast, with the slowest response peaking at only 68ms.

- **Fastest (2.5% percentile)**: 26 ms
- **Average**: 29.92 ms
- **Median (50% percentile)**: 30 ms
- **97.5% percentile**: 34 ms
- **99% percentile**: 35 ms
- **Slowest (Max)**: 68 ms
- **Standard Deviation**: 1.85 ms

---

## Analysis & Recommendations
1. **Excellent Throughput**: Handling ~3.3k requests/sec is an extremely strong result for a single-threaded Node.js Express server. This is primarily because the server is serving static frontend assets (HTML, CSS, and JS) from memory/disk cache.
2. **Sub-35ms Latency**: 99% of all requests were served in under 35 milliseconds, ensuring a highly responsive user experience.
3. **Database & External APIs**: The web application connects directly to Firebase Firestore on the client-side (`app.js` using Firestore SDK CDN). Therefore, database reads/writes bypass this local Express server and go directly to Firebase. As a result, the backend server itself only handles static serving, making it highly resilient to load.
