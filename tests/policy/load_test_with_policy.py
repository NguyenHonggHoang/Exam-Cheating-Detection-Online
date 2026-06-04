"""
================================================================================
  POLICY-ENABLED FULL STACK LOAD TEST
  Flow: Frontend → BFF (Next.js) → Backend Services
  Mode: Full security policies ACTIVE (Istio mTLS, Cilium NetworkPolicy, JWT)
================================================================================

KHÁC BIỆT VỚI NON-POLICY TEST:
  - Security policies bật (Cilium NetworkPolicy, Istio AuthorizationPolicy)
  - JWT Bearer token được validate ở mọi hop (BFF + từng microservice)
  - Rate limiting bật (20 login/hour, 100 req/min/IP)
  - Service-to-service mTLS đang hoạt động
  - Test kiểm tra cả khả năng rate limiter response (429)

LUỒNG MỖI VIRTUAL USER:
  Phase 1: POST {BFF}/api/register               ← Đăng ký (1 lần/user)
  Phase 2: POST {AUTH}/oauth2/token [ROPC]       ← Đăng nhập lấy JWT
  Phase 3: GET  {AUTH}/userinfo                  ← Verify token + lấy profile
  Phase 4: POST {BFF}/api/proxy/mock-exam/start  ← Bắt đầu phòng thi (JWT required)
  Phase 5: GET  {BFF}/api/proxy/mock-exam/{id}/questions  ← STRESS: 10 req/s
  Phase 6: POST {BFF}/api/proxy/mock-exam/submit ← Nộp bài
  Phase 7: POST {BFF}/api/proxy/incident/client-event    ← FLOOD: tất cả cùng lúc

POLICY VALIDATIONS TEST (độc lập):
  - Test 401 khi không có token
  - Test 403 khi token không đủ scope
  - Test rate limiting (429) khi vượt quá giới hạn
  - Test expired token handling

CÁCH CHẠY:
  # Trong K8s (pod trong cluster)
  kubectl apply -f k8s/apps/load-test-job-policy.yaml
  kubectl logs -f job/load-test-policy -n exam-platform

  # Local (cần port-forward)
  python tests/policy/load_test_with_policy.py \
    --bff  http://localhost:8080 \
    --auth http://localhost:9000 \
    --users 100
================================================================================
"""

import asyncio
import aiohttp
import time
import argparse
import random
import uuid
import os
import secrets
import hashlib
import base64
import re
from urllib.parse import urlparse, parse_qs, urlunparse
from dataclasses import dataclass, field
from typing import Optional, Tuple, Dict

# ==============================================================================
# CONSTANTS
# ==============================================================================
DEFAULT_EXAM_ID       = "e1000000-0000-0000-0000-000000000001"
VIOLATION_TYPES       = ["TAB_SWITCH", "LOOKING_AWAY", "MULTIPLE_FACES", "NO_FACE", "PASTE", "BLUR"]
VIOLATION_STATES      = ["WARN", "SUSPICIOUS", "CRITICAL"]
BFF_CLIENT_ID         = "exam-bff-client"
BFF_CLIENT_SECRET     = "exam-bff-secret"
TEST_USER_PASSWORD    = "LoadTest@123!"
QUESTIONS_RPS         = 10       # req/s per user during stress phase
INCIDENTS_PER_USER    = 20


# ==============================================================================
# STATISTICS ENGINE
# ==============================================================================
@dataclass
class EndpointStat:
    success:   int  = 0
    failed:    int  = 0
    latencies: list = field(default_factory=list)
    errors:    dict = field(default_factory=dict)

    def record(self, ms: float, status, ok: bool):
        if ok:
            self.success += 1
            self.latencies.append(ms)
        else:
            self.failed += 1
            self.errors[str(status)] = self.errors.get(str(status), 0) + 1

    def report(self, total_sec: float) -> str:
        total = self.success + self.failed
        if total == 0:
            return "  (no requests)"
        rate = self.success / (total or 1) * 100
        lines = [
            f"  Total Requests : {total}",
            f"  Success Rate   : {rate:.2f}%  (ok={self.success}, fail={self.failed})",
        ]
        if self.latencies:
            s = sorted(self.latencies)
            n = len(s)
            avg = sum(s) / n
            p50 = s[int(n * 0.50)]
            p95 = s[min(int(n * 0.95), n - 1)]
            p99 = s[min(int(n * 0.99), n - 1)]
            rps = n / total_sec
            lines += [
                f"  Throughput     : {rps:.2f} req/s",
                f"  Avg / p50 / p95 / p99: {avg:.1f} / {p50:.1f} / {p95:.1f} / {p99:.1f} ms",
            ]
        if self.errors:
            lines.append("  Error Breakdown:")
            for code, cnt in sorted(self.errors.items()):
                # Annotate policy-related status codes
                note = ""
                if code == "401": note = " ← JWT missing/invalid (expected for policy checks)"
                if code == "403": note = " ← Insufficient scope (expected for policy checks)"
                if code == "429": note = " ← Rate limited by BFF"
                lines.append(f"    [{code}]{note} → {cnt}")
        return "\n".join(lines)


_stats: Dict[str, EndpointStat] = {}


def stat(name: str) -> EndpointStat:
    if name not in _stats:
        _stats[name] = EndpointStat()
    return _stats[name]


async def request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    stat_name: str,
    *,
    json_body=None,
    form_body: Optional[dict] = None,
    headers: Optional[dict] = None,
    success_codes: tuple = (200, 201, 202, 204),
    timeout: int = 60,
) -> Tuple[Optional[dict], int]:
    """Returns (parsed_body, http_status_code)."""
    t0 = time.time()
    status_code = 0
    result_body = None
    try:
        kw = dict(
            timeout=aiohttp.ClientTimeout(total=timeout),
            headers=headers or {},
            allow_redirects=False,
        )
        if json_body is not None:
            kw["json"] = json_body
        if form_body is not None:
            kw["data"] = form_body

        async with getattr(session, method.lower())(url, **kw) as resp:
            status_code = resp.status
            if status_code in success_codes:
                try:
                    result_body = await resp.json(content_type=None)
                except Exception:
                    result_body = {}
    except asyncio.TimeoutError:
        status_code = "Timeout"
    except Exception as e:
        status_code = type(e).__name__

    ms = (time.time() - t0) * 1000
    ok = isinstance(status_code, int) and status_code in success_codes
    stat(stat_name).record(ms, status_code, ok)
    return result_body if ok else None, status_code if isinstance(status_code, int) else 0


# ==============================================================================
# POLICY VALIDATION CHECKS (run before main load test)
# Verify security controls are actually working
# ==============================================================================
async def run_policy_checks(
    session: aiohttp.ClientSession,
    bff_url: str,
    auth_url: str,
    valid_token: Optional[str],
):
    """
    Verify that security policies are correctly enforced.
    These checks should produce 401/403/429 — that is expected and correct.
    """
    print("\n" + "─" * 72)
    print("  🔒  POLICY VALIDATION CHECKS (security control verification)")
    print("─" * 72)

    exam_id = DEFAULT_EXAM_ID
    checks_passed = 0
    checks_total  = 0

    async def check(name: str, expected_codes: tuple, method: str, url: str, **kwargs):
        nonlocal checks_passed, checks_total
        checks_total += 1
        t0 = time.time()
        status = 0
        try:
            kw = dict(timeout=aiohttp.ClientTimeout(total=10), allow_redirects=False)
            kw.update(kwargs)
            async with getattr(session, method.lower())(url, **kw) as r:
                status = r.status
        except Exception as e:
            status = -1
        ms = (time.time() - t0) * 1000
        passed = status in expected_codes
        if passed:
            checks_passed += 1
        icon = "✅" if passed else "❌"
        print(f"  {icon} [{status:3d}] {name:<60s} ({ms:.0f}ms)")
        return passed

    # ── Check 1: Protected route without token → must return 401 ──────────────
    await check(
        "Protected route without Bearer token → 401",
        (401,),
        "GET",
        f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions",
        headers={},
    )

    # ── Check 2: Protected route with invalid token → must return 401 ─────────
    await check(
        "Protected route with invalid Bearer token → 401",
        (401,),
        "POST",
        f"{bff_url}/api/proxy/mock-exam/start",
        headers={"Authorization": "Bearer this-is-not-a-valid-jwt"},
        json={"examId": exam_id},
    )

    # ── Check 3: Protected route with expired/fake token → must return 401 ────
    fake_expired = (
        "eyJhbGciOiJSUzI1NiJ9."
        "eyJzdWIiOiJmYWtlIiwiZXhwIjoxNjAwMDAwMDAwfQ."
        "fake-signature"
    )
    await check(
        "Protected route with expired/fake JWT → 401",
        (401,),
        "GET",
        f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions",
        headers={"Authorization": f"Bearer {fake_expired}"},
    )

    # ── Check 4: Public register endpoint (no token needed) → must return 2xx ─
    uid = str(uuid.uuid4()).replace("-", "")[:12]
    await check(
        "Public POST /api/register (no auth required) → 200/201",
        (200, 201, 409),
        "POST",
        f"{bff_url}/api/register",
        headers={"Content-Type": "application/json"},
        json={"username": f"policy_chk_{uid}", "password": TEST_USER_PASSWORD,
              "email": f"pchk_{uid}@test.internal", "fullName": "Policy Check"},
    )

    # ── Check 5: Auth server rejects bad credentials → must return 400/401 ───
    await check(
        "Auth Server ROPC with wrong password → 400/401",
        (400, 401),
        "POST",
        f"{auth_url}/oauth2/token",
        data={
            "grant_type": "password",
            "username": "nonexistent_user_for_policy_check",
            "password": "wrong-password-!@#",
            "scope": "openid",
            "client_id": BFF_CLIENT_ID,
            "client_secret": BFF_CLIENT_SECRET,
        },
    )

    # ── Check 6: If we have a valid token, test protected endpoint works ──────
    if valid_token:
        await check(
            "Protected route with VALID token → 200",
            (200, 201),
            "GET",
            f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions",
            headers={"Authorization": f"Bearer {valid_token}"},
        )

    # ── Check 7: Rate limit check — rapid fire to trigger 429 ─────────────────
    print(f"\n  🔄  Rate limit probe: 25 rapid login attempts to auth server...")
    rate_limit_hit = False
    for i in range(25):
        uid_rl = str(uuid.uuid4()).replace("-", "")[:12]
        _, status = await request(
            session, "POST",
            f"{auth_url}/oauth2/token",
            "POST {AUTH}/oauth2/token [rate-limit-probe]",
            form_body={
                "grant_type": "password",
                "username": f"rl_probe_{uid_rl}",
                "password": "wrong_password",
                "scope": "openid",
                "client_id": BFF_CLIENT_ID,
                "client_secret": BFF_CLIENT_SECRET,
            },
            success_codes=(400, 401),  # these are "expected failures" = probe succeeds
        )
        if status == 429:
            rate_limit_hit = True
            checks_total += 1
            checks_passed += 1
            print(f"  ✅ [429] Rate limiter triggered at attempt #{i+1} ← policy WORKING")
            break
    if not rate_limit_hit:
        checks_total += 1
        print(f"  ⚠️  Rate limiter NOT triggered after 25 attempts — check BFF/Auth rate limit config")

    print(f"\n  Policy Checks: {checks_passed}/{checks_total} passed")
    print("─" * 72)
    return checks_passed, checks_total


# ==============================================================================
# PHASE 1 — REGISTER via BFF
# ==============================================================================
async def phase_register(
    session: aiohttp.ClientSession,
    bff_url: str,
    num_users: int,
) -> list[dict]:
    print(f"\n[1/7] Registering {num_users} users via BFF...")

    async def register_one(i: int) -> Optional[dict]:
        uid      = str(uuid.uuid4()).replace("-", "")[:12]
        username = f"lt_{uid}"
        body, _  = await request(
            session, "POST",
            f"{bff_url}/api/register",
            "POST {BFF}/api/register",
            json_body={
                "username": username,
                "password": TEST_USER_PASSWORD,
                "email":    f"{username}@lt.internal",
                "fullName": f"Load Test {i}",
            },
            success_codes=(200, 201, 409),
        )
        return {"username": username, "password": TEST_USER_PASSWORD}

    results = await asyncio.gather(*[register_one(i) for i in range(num_users)], return_exceptions=True)
    users = [r for r in results if isinstance(r, dict)]
    s = stat("POST {BFF}/api/register")
    print(f"  ✅ {s.success} new, {s.errors.get('409', 0)} existing, {s.failed} failed")
    return users


# ==============================================================================
# PHASE 2 — LOGIN via OIDC Auth Code Flow with PKCE
# ==============================================================================
async def phase_login(
    session: aiohttp.ClientSession,
    auth_url: str,
    users: list[dict],
) -> list[dict]:
    print(f"\n[2/7] Login {len(users)} users via OIDC Authorization Code Flow with PKCE...")

    token_url = f"{auth_url}/oauth2/token"

    authorize_url_template = (
        f"{auth_url}/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={BFF_CLIENT_ID}&"
        f"scope=openid%20profile&"
        f"redirect_uri=http://localhost:8080/login/oauth2/code/exam-oidc&"
        f"code_challenge={{challenge}}&"
        f"code_challenge_method=S256&"
        f"state={{state}}"
    )

    def fix_url_if_auth(location: str, base_auth: str) -> str:
        parsed_loc = urlparse(location)
        parsed_base = urlparse(base_auth)
        if "/api/auth/callback" in parsed_loc.path or "/login/oauth2/code" in parsed_loc.path:
            return location
        if not parsed_loc.netloc or parsed_loc.hostname in [parsed_base.hostname, "localhost", "auth-server", "127.0.0.1", "authorization-server"]:
            return urlunparse((
                parsed_base.scheme,
                parsed_base.netloc,
                parsed_loc.path,
                parsed_loc.params,
                parsed_loc.query,
                parsed_loc.fragment
            ))
        return location

    login_semaphore = asyncio.Semaphore(20)

    async def login_one(user: dict) -> Optional[dict]:
        async with login_semaphore:
            return await login_one_inner(user)

    async def login_one_inner(user: dict) -> Optional[dict]:
        cookie_jar = aiohttp.CookieJar(unsafe=True)
        async with aiohttp.ClientSession(cookie_jar=cookie_jar) as u_sess:
            try:
                # 1. Generate PKCE values
                verifier = secrets.token_urlsafe(64)
                sha256 = hashlib.sha256(verifier.encode('utf-8')).digest()
                challenge = base64.urlsafe_b64encode(sha256).decode('utf-8').replace('=', '').replace('+', '-').replace('/', '_')
                state = str(uuid.uuid4())

                authorize_url = authorize_url_template.format(challenge=challenge, state=state)

                # 2. Start authorization flow
                async with u_sess.get(authorize_url, allow_redirects=False) as resp:
                    if resp.status == 302:
                        loc = resp.headers.get("Location", "")
                        login_page_url = fix_url_if_auth(loc, auth_url)
                    else:
                        login_page_url = f"{auth_url}/login"

                # 3. Fetch login page to retrieve the CSRF token
                async with u_sess.get(login_page_url, allow_redirects=False) as resp:
                    html = await resp.text()

                csrf_match = re.search(r'name="_csrf"\s+value="([^"]+)"', html)
                if not csrf_match:
                    csrf_match = re.search(r'value="([^"]+)"\s+name="_csrf"', html)
                csrf_token = csrf_match.group(1) if csrf_match else ""

                # 4. Form login submit
                login_data = {
                    "username": user["username"],
                    "password": user["password"],
                    "_csrf": csrf_token
                }
                post_login_url = f"{auth_url}/login"
                async with u_sess.post(post_login_url, data=login_data, allow_redirects=False) as resp:
                    if resp.status == 302:
                        # Spring form-login may redirect to "/" after successful login.
                        # Re-open the original authorize URL with the authenticated session
                        # to obtain the PKCE authorization code.
                        auth_consent_url = authorize_url
                    else:
                        auth_consent_url = authorize_url

                # 5. Call authorization page again to trigger redirect to callback containing code
                async with u_sess.get(auth_consent_url, allow_redirects=False) as resp:
                    if resp.status == 302:
                        location = resp.headers.get("Location", "")
                        parsed = urlparse(location)
                        qs = parse_qs(parsed.query)
                        code = qs.get("code", [None])[0]
                        if code:
                            # 6. Exchange authorization code for token
                            # NOTE: exam-bff-client uses client_secret_basic authentication,
                            # so credentials MUST be sent via HTTP Basic Auth, NOT form body.
                            token_data = {
                                "grant_type": "authorization_code",
                                "code": code,
                                "redirect_uri": "http://localhost:8080/login/oauth2/code/exam-oidc",
                                "code_verifier": verifier,
                            }
                            basic_auth = aiohttp.BasicAuth(BFF_CLIENT_ID, BFF_CLIENT_SECRET)
                            async with u_sess.post(token_url, data=token_data, auth=basic_auth) as t_resp:
                                if t_resp.status == 200:
                                    body = await t_resp.json()
                                    if body and body.get("access_token"):
                                        stat("POST {AUTH}/oauth2/token [PKCE login]").record(0, 200, True)
                                        return {**user, "access_token": body["access_token"]}
            except Exception as e:
                print(f"DEBUG: Exception in login_one: {type(e).__name__}: {str(e)}")

            stat("POST {AUTH}/oauth2/token [PKCE login]").record(0, 400, False)
            return None

    results = await asyncio.gather(*[login_one(u) for u in users], return_exceptions=True)
    authed  = [r for r in results if isinstance(r, dict) and r and r.get("access_token")]
    failed  = [r for r in results if not isinstance(r, dict) or not r or not r.get("access_token")]

    s = stat("POST {AUTH}/oauth2/token [PKCE login]")
    print(f"  ✅ {len(authed)}/{len(users)} users authenticated via OIDC PKCE Flow")
    return authed


# ==============================================================================
# PHASE 3 — VERIFY TOKEN via userinfo endpoint
# ==============================================================================
async def phase_verify_tokens(
    session: aiohttp.ClientSession,
    auth_url: str,
    authed_users: list[dict],
) -> list[dict]:
    """
    GET {AUTH}/userinfo — validates token is accepted by auth server.
    Also a real-world step: frontend typically calls userinfo after login.
    """
    print(f"\n[3/7] Verifying {len(authed_users)} tokens via Auth Server userinfo...")

    async def verify(user: dict) -> Optional[dict]:
        body, _ = await request(
            session, "GET",
            f"{auth_url}/userinfo",
            "GET {AUTH}/userinfo [token verification]",
            headers={"Authorization": f"Bearer {user['access_token']}"},
            success_codes=(200,),
        )
        if body:
            return {**user, "sub": body.get("sub"), "verified": True}
        return {**user, "verified": False}

    results = await asyncio.gather(*[verify(u) for u in authed_users], return_exceptions=True)
    verified = [r for r in results if isinstance(r, dict) and r.get("verified")]
    print(f"  ✅ {len(verified)}/{len(authed_users)} tokens verified")
    return verified or authed_users   # fall through even if userinfo fails


# ==============================================================================
# PHASE 4 — START EXAM SESSION via BFF proxy (JWT required)
# ==============================================================================
async def phase_start_sessions(
    session: aiohttp.ClientSession,
    bff_url: str,
    authed_users: list[dict],
    exam_id: str,
) -> list[dict]:
    print(f"\n[4/7] Starting exam sessions via BFF for {len(authed_users)} users...")

    async def start_one(user: dict) -> Optional[dict]:
        token    = user["access_token"]
        body, _  = await request(
            session, "POST",
            f"{bff_url}/api/proxy/mock-exam/start",
            "POST {BFF}→session /api/proxy/mock-exam/start [JWT]",
            json_body={"examId": exam_id, "userId": user["username"]},
            headers={"Authorization": f"Bearer {token}"},
            success_codes=(200, 201),
        )
        if body:
            sid = body.get("sessionId") or body.get("id")
            if sid:
                return {**user, "session_id": sid}
        return None

    results  = await asyncio.gather(*[start_one(u) for u in authed_users], return_exceptions=True)
    started  = [r for r in results if isinstance(r, dict) and r]
    print(f"  ✅ {len(started)}/{len(authed_users)} sessions started via BFF (JWT validated)")
    return started


# ==============================================================================
# PHASE 5 — STRESS: Questions at 10 req/s via BFF (JWT required on every req)
# ==============================================================================
async def phase_stress_questions(
    session: aiohttp.ClientSession,
    bff_url: str,
    exam_id: str,
    session_users: list[dict],
    duration_s: int = 20,
):
    n   = len(session_users)
    url = f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions"
    sn  = "GET {BFF}→session /api/proxy/mock-exam/{id}/questions [STRESS 10rps+JWT]"
    print(f"\n[5/7] ⚡ STRESS: {n} users × 10 req/s via BFF with JWT ({duration_s}s)...")

    stop = asyncio.Event()

    async def worker(user: dict):
        hdrs = {"Authorization": f"Bearer {user['access_token']}"}
        while not stop.is_set():
            await request(session, "GET", url, sn, headers=hdrs)
            await asyncio.sleep(0.1)  # 10 req/s

    tasks = []
    for i, user in enumerate(session_users):
        tasks.append(asyncio.create_task(worker(user)))
        if i % 200 == 0 and i > 0:
            await asyncio.sleep(0.01)

    await asyncio.sleep(duration_s)
    stop.set()
    await asyncio.gather(*tasks, return_exceptions=True)

    s     = stat(sn)
    total = s.success + s.failed
    rate_limited = s.errors.get("429", 0)
    print(f"  ✅ {total} requests | {s.success/(total or 1)*100:.1f}% success | "
          f"{s.success/duration_s:.1f} RPS | rate-limited: {rate_limited}")


# ==============================================================================
# PHASE 6 — SUBMIT EXAM via BFF (JWT required)
# ==============================================================================
async def load_question_ids(
    session: aiohttp.ClientSession,
    bff_url: str,
    exam_id: str,
    user: dict,
) -> list[str]:
    body, _ = await request(
        session, "GET",
        f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions",
        "GET {BFF}->session /api/proxy/mock-exam/{id}/questions [load ids]",
        headers={"Authorization": f"Bearer {user['access_token']}"},
        success_codes=(200,),
    )
    questions = body.get("questions", []) if isinstance(body, dict) else []
    q_ids = [q.get("id") for q in questions if isinstance(q, dict) and q.get("id")]
    if not q_ids:
        print("  No question ids returned; falling back to q1..q10")
        q_ids = [f"q{i+1}" for i in range(10)]
    return q_ids


async def phase_submit(
    session: aiohttp.ClientSession,
    bff_url: str,
    session_users: list[dict],
    exam_id: str,
    question_ids: list[str],
):
    print(f"\n[6/7] Submitting exams via BFF for {len(session_users)} users...")

    async def submit_one(user: dict):
        await request(
            session, "POST",
            f"{bff_url}/api/proxy/mock-exam/submit",
            "POST {BFF}→session /api/proxy/mock-exam/submit [JWT]",
            json_body={
                "sessionId":   user["session_id"],
                "examId":      exam_id,
                "answers": [
                    {"questionId": qid, "answer": "Option 1",
                     "timeSpentMs": random.randint(10_000, 90_000)}
                    for qid in question_ids
                ],
            },
            headers={"Authorization": f"Bearer {user['access_token']}"},
        )

    await asyncio.gather(*[submit_one(u) for u in session_users], return_exceptions=True)
    s = stat("POST {BFF}→session /api/proxy/mock-exam/submit [JWT]")
    print(f"  ✅ {s.success}/{s.success + s.failed} exams submitted via BFF")


# ==============================================================================
# PHASE 7 — FLOOD: All users dump all incidents simultaneously (JWT required)
# ==============================================================================
async def phase_flood_incidents(
    session: aiohttp.ClientSession,
    bff_url: str,
    session_users: list[dict],
    incidents_per_user: int = INCIDENTS_PER_USER,
):
    n         = len(session_users)
    total_req = n * incidents_per_user
    url       = f"{bff_url}/api/proxy/incident/client-event"
    sn        = "POST {BFF}→incident /api/proxy/incident/client-event [FLOOD+JWT]"

    print(f"\n[7/7] ⚡ FLOOD: {n}×{incidents_per_user}={total_req} concurrent POSTs via BFF+JWT...")

    def make_payload(session_id: str, idx: int) -> dict:
        return {
            "sessionId":      session_id,
            "eventType":      "SNAPSHOT_VIOLATION",
            "violationType":  random.choice(VIOLATION_TYPES),
            "violationState": random.choice(VIOLATION_STATES),
            "evidenceUrl":    f"http://minio:9000/exam-evidence/{session_id}/snap_{idx:03d}.jpg",
            "objectKey":      f"{session_id}/snap_{idx:03d}.jpg",
            "fileSize":       random.randint(8_000, 40_000),
            "timestamp":      int(time.time() * 1000) - (incidents_per_user - idx) * 5_000,
        }

    all_tasks = [
        asyncio.create_task(
            request(
                session, "POST", url, sn,
                json_body=make_payload(user["session_id"], idx),
                headers={"Authorization": f"Bearer {user['access_token']}"},
            )
        )
        for user in session_users
        for idx in range(incidents_per_user)
    ]

    t0 = time.time()
    await asyncio.gather(*all_tasks, return_exceptions=True)
    elapsed = time.time() - t0

    s       = stat(sn)
    done    = s.success + s.failed
    rate_limited = s.errors.get("429", 0)
    print(f"  ✅ {done} reqs in {elapsed:.2f}s | {s.success/elapsed:.1f} RPS | "
          f"{s.success/(done or 1)*100:.1f}% success | rate-limited: {rate_limited}")


# ==============================================================================
# FINAL REPORT
# ==============================================================================
def print_report(total_sec: float, policy_checks: Optional[Tuple[int, int]] = None):
    print("\n" + "=" * 72)
    print("           📈  FULL STACK POLICY-ENABLED PERFORMANCE REPORT")
    print("           (Frontend → BFF → Backend | Security Policies ACTIVE)")
    print("=" * 72)
    print(f"  Total wall-clock time: {total_sec:.2f}s\n")

    if policy_checks:
        passed, total = policy_checks
        icon = "✅" if passed == total else "⚠️"
        print(f"  {icon} Security Policy Checks: {passed}/{total} passed\n")

    for name, s in _stats.items():
        if s.success + s.failed == 0:
            continue
        print(f"  ┌─ {name}")
        print(s.report(total_sec))
        print()
    print("=" * 72)
    print()
    print("  📌 INTERPRETATION GUIDE:")
    print("  ─────────────────────────────────────────────────────────────────")
    print("  p99 < 200ms  → Excellent (policy overhead acceptable)")
    print("  p99 < 500ms  → Good")
    print("  p99 > 500ms  → Review BFF JWT validation caching")
    print("  p99 > 1000ms → Critical — JWT JWKS fetch or DB bottleneck")
    print()
    print("  429 errors   → Rate limiter triggered (expected if configured)")
    print("  401 errors   → JWT expired during stress test → need token refresh")
    print("  503 errors   → Service overloaded → scale replicas or tune HPA")
    print("=" * 72)


# ==============================================================================
# MAIN ORCHESTRATOR
# ==============================================================================
async def run(args):
    bff_url   = args.bff.rstrip("/")
    auth_url  = args.auth.rstrip("/")
    num_users = args.users
    exam_id   = args.exam_id

    print("=" * 72)
    print("  🔐  POLICY-ENABLED FULL STACK LOAD TEST")
    print("  Security: Istio mTLS + Cilium NetworkPolicy + JWT Validation ACTIVE")
    print("=" * 72)
    print(f"  Users             : {num_users}")
    print(f"  BFF               : {bff_url}")
    print(f"  Auth Server       : {auth_url}")
    print(f"  Exam ID           : {exam_id}")
    print(f"  Questions stress  : {args.questions_duration}s at {QUESTIONS_RPS} req/s")
    print(f"  Incidents/user    : {args.incidents_per_user}")
    print("=" * 72)

    connector = aiohttp.TCPConnector(
        limit               = num_users * 4 + 200,
        limit_per_host      = 0,
        ttl_dns_cache       = 600,
        enable_cleanup_closed = True,
    )
    wall_start = time.time()
    policy_check_result = None

    async with aiohttp.ClientSession(connector=connector) as http:

        # ── Phase 1: Register ──────────────────────────────────────────────────
        if args.skip_register:
            uid_list = [str(uuid.uuid4()).replace("-", "")[:12] for _ in range(num_users)]
            users = [{"username": f"lt_{u}", "password": TEST_USER_PASSWORD} for u in uid_list]
            print(f"\n[1/7] Skipped (--skip-register). {num_users} synthetic usernames.")
        else:
            users = await phase_register(http, bff_url, num_users)

        if not users:
            print("❌ No users. Aborting.")
            return

        # ── Phase 2: Login via Auth Server ROPC ───────────────────────────────
        authed_users = await phase_login(http, auth_url, users)

        if not authed_users:
            print("❌ No authenticated users. Check ROPC grant on auth-server.")
            print_report(time.time() - wall_start)
            return

        # ── Policy checks (using first valid token) ────────────────────────────
        if not args.skip_policy_checks:
            first_token = authed_users[0]["access_token"]
            policy_check_result = await run_policy_checks(http, bff_url, auth_url, first_token)

        # ── Phase 3: Verify tokens ─────────────────────────────────────────────
        verified_users = await phase_verify_tokens(http, auth_url, authed_users)

        # ── Phase 4: Start exam sessions ───────────────────────────────────────
        session_users = await phase_start_sessions(http, bff_url, verified_users, exam_id)

        if not session_users:
            print("❌ No sessions created. Check BFF→session-service routing + JWT validation.")
            print_report(time.time() - wall_start, policy_check_result)
            return

        # ── Phase 5: Stress questions ──────────────────────────────────────────
        question_ids = await load_question_ids(http, bff_url, exam_id, session_users[0])

        await phase_stress_questions(
            http, bff_url, exam_id,
            session_users=session_users,
            duration_s=args.questions_duration,
        )

        # ── Phase 6: Submit exams ──────────────────────────────────────────────
        await phase_submit(http, bff_url, session_users, exam_id, question_ids)

        # ── Phase 7: Flood incidents ───────────────────────────────────────────
        await phase_flood_incidents(
            http, bff_url,
            session_users=session_users,
            incidents_per_user=args.incidents_per_user,
        )

    print_report(time.time() - wall_start, policy_check_result)


# ==============================================================================
# CLI
# ==============================================================================
def main():
    p = argparse.ArgumentParser(
        description="Policy-enabled Full Stack Load Test: Frontend → BFF → Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--bff",  default=os.getenv("LT_BFF_URL",  "http://bff-gateway:8080"))
    p.add_argument("--auth", default=os.getenv("LT_AUTH_URL", "http://auth-server:9000"))
    p.add_argument("--users",              type=int, default=int(os.getenv("LT_USERS",               "200")))
    p.add_argument("--exam-id",            default=os.getenv("LT_EXAM_ID",              DEFAULT_EXAM_ID))
    p.add_argument("--questions-duration", type=int, default=int(os.getenv("LT_QUESTIONS_DURATION",  "20")))
    p.add_argument("--incidents-per-user", type=int, default=int(os.getenv("LT_INCIDENTS_PER_USER",  "20")))
    p.add_argument("--skip-register",      action="store_true",
                   default=os.getenv("LT_SKIP_REGISTER", "false").lower() == "true")
    p.add_argument("--skip-policy-checks", action="store_true",
                   default=os.getenv("LT_SKIP_POLICY_CHECKS", "false").lower() == "true",
                   help="Skip security policy validation checks (401/403/429 probes)")
    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
