[notice] A new release of pip is available: 24.0 -> 26.1.2

[notice] To update, run: pip install --upgrade pip

========================================================================

  🚀  NON-POLICY FULL STACK LOAD TEST

  BFF=http://bff-gateway:8080  AUTH=http://authorization-server:9000  users=200

========================================================================


[1/6] Registering 200 users via BFF (http://bff-gateway:8080/api/register)...

  ✅ 200 new, 0 existing, 0 failed


[2/6] Login 200 users via OIDC Auth Code Flow with PKCE...

  ✅ 168/200 users authenticated via OIDC Code Grant


[3/6] Starting exam sessions via BFF for 168 users...

  ✅ 168/168 sessions started via BFF


[4/6] ⚡ STRESS: 168 users × 10 req/s via BFF (20s)...

  ✅ 6203 requests | 100.0% success | 310.1 RPS


[5/6] Submitting exams via BFF for 168 users...

  ✅ 168/168 submitted


[6/6] ⚡ FLOOD: 168×20=3360 concurrent POSTs via BFF...

  ✅ 3360 reqs in 21.31s | 157.7 RPS | 100.0% success


========================================================================

         📈  FULL STACK PERFORMANCE REPORT

         (Load Test Pod → BFF → Backend Services)

========================================================================

  Wall-clock: 74.66s


  ┌─ POST {BFF}/api/register

  Total    : 200

  Success  : 100.00%  (ok=200, fail=0)

  RPS      : 2.68

  Avg/p50/p95/p99: 2906/2951/3906/3982 ms


  ┌─ POST {AUTH}/oauth2/token [login]

  Total    : 200

  Success  : 84.00%  (ok=168, fail=32)

  RPS      : 2.25

  Avg/p50/p95/p99: 0/0/0/0 ms

  Error [400]: 32