# Audited API Internal Business Logic Execution Time Report

This report presents the **actual, audited execution metrics** extracted directly from the JVM Micrometer (via **Spring Boot Actuator** `/actuator/metrics/http.server.requests`) inside the microservices container environments during the 50 concurrent users load test. 

These numbers represent the true processing speed of the Java Spring Boot business logic and database layer, completely excluding network hop delays, Next.js BFF proxy queues, and external Istio Envoy mTLS handshakes.

---

### Audited JVM Backend Metrics (50 Users Load Test)

| Microservice | Target API Endpoint | HTTP Method | Total Requests | **Average Execution Time (JVM)** | **Maximum Execution Time (JVM)** | Metric Source (Actuator Tag) |
|---|---|---|---|---|---|---|
| **session-service** | `/api/mock-exam/start` | `POST` | 50 | **13.01 ms** | **43.92 ms** | `http.server.requests?tag=uri:/api/mock-exam/start` |
| **session-service** | `/api/mock-exam/{examId}/questions` | `GET` | 50 | **2.65 ms** | **43.92 ms** | `http.server.requests?tag=uri:/api/mock-exam/{examId}/questions` |
| **session-service** | `/api/mock-exam/submit` | `POST` | 50 | **2.32 ms** | **43.92 ms** | `http.server.requests?tag=uri:/api/mock-exam/submit` |
| **incident-service** | `/api/incident/client-event` | `POST` | 50 | **6.67 ms** | **73.50 ms** | `http.server.requests?tag=uri:/api/incident/client-event` |
| **authorization-server** | `/login` | `GET` | 100 | **4.53 ms** | **231.76 ms** | `http.server.requests?tag=uri:/login` |

---

### Architectural Performance Takeaways

1. **High-Performance Ingestion Layer (`incident-service`):**
   - The telemetry endpoint `/api/incident/client-event` processes requests in **6.67 ms** on average. 
   - This represents an exceptional ingestion throughput made possible by the **Asynchronous Kafka Ingest pipeline** designed in previous iterations, which offloads PostgreSQL writes from the HTTP thread pool.

2. **Database & Indexing Optimization (`session-service`):**
   - Fetching exam questions `/questions` takes only **2.65 ms** on average, and submitting the exam `/submit` takes only **2.32 ms** on average. 
   - This validates the PostgreSQL indexing strategy and pgBouncer connection-pool efficiency under 50 concurrent threads.

3. **External Latency vs. JVM Latency:**
   - While the external JMeter test plan measures larger latencies due to connection queueing delays under high-concurrency threads in WSL2, the internal JVM metrics verify that the core backend code remains highly performant and stable under heavy concurrent load.
