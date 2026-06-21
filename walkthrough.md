# TruthGuard - Load Testing Walkthrough

This walkthrough details the steps executed to run the baseline/load test for the TruthGuard application.

## Accomplishments
1. **Verified Server Setup**: Identified that the TruthGuard web application runs a Node.js Express server (`server.js` on port 3000).
2. **Server Execution**: Launched the Express server in the background to listen on `http://localhost:3000`.
3. **Load Testing Execution**: Configured and executed a load test simulating **100 concurrent virtual users** running continuously for **1 minute (60 seconds)** using `autocannon`.
4. **Results Compilation**: Generated and analyzed the load test results.

---

## Validation Results

The server successfully completed the load test with zero errors and highly optimized latencies:

- **Total Requests**: 198,000 requests handled
- **Throughput (RPS)**:
  - **Average**: 3,290.74 req/sec
  - **Min**: 2,904 req/sec
  - **Max**: 3,429 req/sec
- **Response Time (Latency)**:
  - **Average**: 29.92 ms
  - **Fastest (2.5%)**: 26 ms
  - **Slowest (Max)**: 68 ms

For a detailed breakdown of all metrics, see the [load_test_results.md](file:///C:/Users/HP/.gemini/antigravity-ide/brain/ec62be4c-650d-44f1-902b-81dd65429606/load_test_results.md) artifact.
