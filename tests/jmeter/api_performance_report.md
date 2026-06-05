# API Internal Processing Time Performance Report

This report extracts the internal API processing time (estimated as **Latency - Connect Time**) to filter out connection handshake overhead.

### Detailed API Metrics (all times in ms)

| API Label | Requests | Success Rate | Avg Total Time | Avg API Proc Time | Min API Proc | Max API Proc | 90% Line | 95% Line |
|---|---|---|---|---|---|---|---|---|
| 1. POST /api/register | 50 | 100.00% | 57496.4 | **57374.1** | 54727 | 59032 | 58834 | 58857 |
| 10. POST /api/proxy/incident/client-event (Telemetry) | 50 | 100.00% | 7050.0 | **7048.6** | 5795 | 8322 | 8045 | 8167 |
| 2. GET /login (Extract CSRF) | 50 | 100.00% | 941.2 | **775.6** | 46 | 1956 | 1335 | 1743 |
| 3. POST /login (Authenticate) | 50 | 100.00% | 14306.2 | **14304.4** | 8291 | 18396 | 17199 | 17398 |
| 4. GET /oauth2/authorize (Obtain Auth Code) | 50 | 100.00% | 5889.0 | **5887.4** | 993 | 14497 | 10196 | 10696 |
| 5. POST /oauth2/token (Exchange Token) | 50 | 100.00% | 21863.1 | **21837.2** | 17298 | 23497 | 23196 | 23287 |
| 6. GET /userinfo (Verify Session) | 50 | 100.00% | 2476.7 | **2411.6** | 1697 | 2850 | 2792 | 2796 |
| 7. POST /api/proxy/mock-exam/start | 50 | 100.00% | 13763.4 | **13723.2** | 12555 | 14984 | 14590 | 14792 |
| 8. GET /api/proxy/mock-exam/{id}/questions | 50 | 100.00% | 3030.3 | **2996.4** | 1343 | 4377 | 4159 | 4227 |
| 9. POST /api/proxy/mock-exam/submit | 50 | 100.00% | 3444.8 | **3428.9** | 2436 | 4279 | 4176 | 4251 |