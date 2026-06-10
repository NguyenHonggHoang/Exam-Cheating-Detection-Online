# Local API Business Logic Timing Report

This report summarizes internal JVM-side timing metrics collected from Spring Boot Micrometer through the `/actuator/metrics/http.server.requests` endpoint during a limited local Docker/WSL load-test scenario.

The test was constrained by local machine resources and was only run with a small 50-request workload. The numbers below should be treated as local validation data for selected API paths, not as production-scale performance evidence.

These metrics focus on Java Spring Boot business logic and database interaction time inside each service. They do not represent full end-to-end user latency because they exclude network delays, browser behavior, Next.js BFF proxy queues, external gateway overhead, and Istio/Envoy mTLS handshakes.

---

## JVM Backend Metrics From Local 50-Request Scenario

| Microservice | Target API Endpoint | HTTP Method | Total Requests | Average Execution Time (JVM) | Maximum Execution Time (JVM) | Metric Source (Actuator Tag) |
|---|---|---:|---:|---:|---:|---|
| `session-service` | `/api/mock-exam/start` | `POST` | 50 | 13.01 ms | 43.92 ms | `http.server.requests?tag=uri:/api/mock-exam/start` |
| `session-service` | `/api/mock-exam/{examId}/questions` | `GET` | 50 | 2.65 ms | 43.92 ms | `http.server.requests?tag=uri:/api/mock-exam/{examId}/questions` |
| `session-service` | `/api/mock-exam/submit` | `POST` | 50 | 2.32 ms | 43.92 ms | `http.server.requests?tag=uri:/api/mock-exam/submit` |
| `incident-service` | `/api/incident/client-event` | `POST` | 50 | 6.67 ms | 73.50 ms | `http.server.requests?tag=uri:/api/incident/client-event` |
| `authorization-server` | `/login` | `GET` | 100 | 4.53 ms | 231.76 ms | `http.server.requests?tag=uri:/login` |

---

## Practical Takeaways

1. **Selected API paths had low JVM-side processing time in local testing.**
   - The measured Spring Boot handlers completed quickly inside the service containers, with average JVM-side timing ranging from 2.32 ms to 13.01 ms for the selected exam/session and incident APIs.
   - This suggests that the tested handler logic and database access paths were lightweight in the local scenario.

2. **The incident ingestion endpoint remained lightweight at the HTTP handler level.**
   - `/api/incident/client-event` averaged 6.67 ms JVM-side processing time for 50 local requests.
   - This result is useful as local feedback for the current ingestion design, but it should not be described as proof of high throughput or production stability.

3. **Internal JVM timing is different from end-to-end latency.**
   - External load-test latency can be higher because of Docker/WSL resource limits, connection queueing, BFF proxy behavior, network hops, and service-mesh overhead.
   - The Actuator metrics help separate backend handler execution time from those external factors.

4. **Infrastructure-related conclusions should stay limited.**
   - This report does not independently prove the production effectiveness of Kafka, PgBouncer, Kubernetes, Istio/Envoy, Cilium, or other infrastructure components.
   - Those technologies can be mentioned as project exposure or configuration practice only when supported by separate implementation evidence.

---

## CV-Safe Summary

Validated selected Spring Boot APIs with a limited local Docker/WSL 50-request load-test scenario using Actuator/Micrometer metrics, separating JVM-side execution time from external proxy, network, and service-mesh overhead.

## Scope Limitation

Because this test was performed locally with limited Docker/WSL resources and a small request count, the results should not be presented as production-scale benchmarking, real traffic validation, or proof of system-wide scalability.
