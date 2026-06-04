"""
================================================================================
  NON-POLICY FULL STACK LOAD TEST — Frontend → BFF → Backend
================================================================================

LUỒNG THỰC TẾ (mỗi virtual user):
  1. [Register]   POST {BFF}/api/register
                  → BFF → user-service → tạo account

  2. [Login]      POST {AUTH}/oauth2/token  (Resource Owner Password Credentials)
                  → Auth Server → trả về access_token + refresh_token

  3. [Start Exam] POST {BFF}/api/proxy/mock-exam/start  + Bearer token
                  → BFF (kiểm tra token) → session-service

  4. [STRESS]     GET  {BFF}/api/proxy/mock-exam/{examId}/questions  × 10 req/s
                  → BFF → session-service  ← ĐO HIỆU NĂNG TOÀN STACK

  5. [Submit]     POST {BFF}/api/proxy/mock-exam/submit  + Bearer token
                  → BFF → session-service

  6. [FLOOD]      POST {BFF}/api/proxy/incident/client-event  + Bearer token
                  → BFF → incident-service  ← ĐO HIỆU NĂNG TOÀN STACK


================================================================================
"""

import asyncio
import aiohttp
import time
import argparse
import random
import uuid
import os
from dataclasses import dataclass, field
from typing import Optional, Tuple

# ==============================================================================
# CONSTANTS
# ==============================================================================
DEFAULT_EXAM_ID        = "e1000000-0000-0000-0000-000000000001"
VIOLATION_TYPES        = ["TAB_SWITCH", "LOOKING_AWAY", "MULTIPLE_FACES", "NO_FACE", "PASTE", "BLUR"]
VIOLATION_STATES       = ["WARN", "SUSPICIOUS", "CRITICAL"]
INCIDENTS_PER_USER     = 20
QUESTIONS_RPS          = 10   # req/s per user during stress phase

# OAuth2 / BFF
BFF_CLIENT_ID          = "exam-bff-client"
BFF_CLIENT_SECRET      = "exam-bff-secret"
TEST_USER_PASSWORD     = "LoadTest@123!"


# ==============================================================================
# STATISTICS
# ==============================================================================
@dataclass
class EndpointStat:
    success:   int  = 0
    failed:    int  = 0
    latencies: list = field(default_factory=list)
    errors:    dict = field(default_factory=dict)

    def record(self, latency_ms: float, status, is_success: bool):
        if is_success:
            self.success += 1
            self.latencies.append(latency_ms)
        else:
            self.failed += 1
            self.errors[str(status)] = self.errors.get(str(status), 0) + 1

    def report(self, total_sec: float) -> str:
        total = self.success + self.failed
        if total == 0:
            return "  (no requests sent)"
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
                f"  Avg Latency    : {avg:.2f} ms",
                f"  p50 / p95 / p99: {p50:.2f} / {p95:.2f} / {p99:.2f} ms",
            ]
        if self.errors:
            lines.append("  Error Breakdown:")
            for code, cnt in sorted(self.errors.items()):
                lines.append(f"    [{code}] → {cnt} occurrences")
        return "\n".join(lines)


_stats: dict[str, EndpointStat] = {}


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
    cookies: Optional[dict] = None,
    success_codes: tuple = (200, 201, 202, 204),
    timeout: int = 20,
) -> Tuple[Optional[dict], Optional[dict]]:
    """
    Execute HTTP request via BFF. Returns (json_body, response_cookies) or (None, None).
    """
    t0 = time.time()
    status_code = 0
    result_body = None
    result_cookies = {}
    try:
        kw = dict(
            timeout=aiohttp.ClientTimeout(total=timeout),
            headers=headers or {},
            cookies=cookies or {},
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
                result_cookies = {k: v.value for k, v in resp.cookies.items()}
    except asyncio.TimeoutError:
        status_code = "Timeout"
    except Exception as e:
        status_code = type(e).__name__

    latency = (time.time() - t0) * 1000
    is_ok = isinstance(status_code, int) and status_code in success_codes
    stat(stat_name).record(latency, status_code, is_ok)
    return (result_body, result_cookies) if is_ok else (None, None)


# ==============================================================================
# PHASE 1 — REGISTER (BFF → user-service)
# ==============================================================================
async def phase_register(
    session: aiohttp.ClientSession,
    bff_url: str,
    num_users: int,
) -> list[dict]:
    """
    POST {BFF}/api/register → BFF → user-service
    Returns list of {username, password} for users that were created/existing.
    """
    print(f"\n[1/6] Registering {num_users} users via BFF...")

    async def register_one(idx: int) -> Optional[dict]:
        uid      = str(uuid.uuid4()).replace("-", "")[:12]
        username = f"lt_{uid}"
        password = TEST_USER_PASSWORD
        body, _ = await request(
            session, "POST",
            f"{bff_url}/api/register",
            "POST {BFF}/api/register",
            json_body={
                "username": username,
                "password": password,
                "email":    f"{username}@loadtest.internal",
                "fullName": f"Load Test {idx}",
            },
            # 409 = already exists (idempotent)
            success_codes=(200, 201, 409),
        )
        # Even on 409, user exists — treat as success for credential purposes
        s = stat("POST {BFF}/api/register")
        return {"username": username, "password": password}

    tasks = [register_one(i) for i in range(num_users)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    users = [r for r in results if isinstance(r, dict)]
    s = stat("POST {BFF}/api/register")
    print(f"  ✅ {s.success}/{num_users} registered (new), "
          f"{s.errors.get('409', 0)} already existed, "
          f"{s.failed} failed")
    return users


# ==============================================================================
# PHASE 2 — LOGIN (Auth Server OAuth2 → JWT token)
# ==============================================================================
async def phase_login(
    session: aiohttp.ClientSession,
    auth_url: str,
    users: list[dict],
) -> list[dict]:
    """
    Simulates standard OIDC Authorization Code flow with PKCE for programmatic login.
    Bypasses the unsupported ROPC password grant by:
      1. Fetching authorization page with PKCE challenge to start session
      2. Authenticating via form POST /login with CSRF token
      3. Following redirect to callback URL containing authorization code
      4. Exchanging code for real signed JWT access token at /oauth2/token
    """
    import secrets
    import hashlib
    import base64
    import re
    from urllib.parse import urlparse, parse_qs, urlunparse

    print(f"\n[2/6] Login {len(users)} users via OIDC Authorization Code Flow with PKCE...")

    token_url = f"{auth_url}/oauth2/token"
    authorize_url_template = (
        f"{auth_url}/oauth2/authorize?"
        f"response_type=code&"
        f"client_id={BFF_CLIENT_ID}&"
        f"scope=openid%20profile&"
        f"redirect_uri=http://localhost:8080/api/auth/callback/exam-oidc&"
        f"code_challenge={{challenge}}&"
        f"code_challenge_method=S256&"
        f"state={{state}}"
    )

    def fix_url_if_auth(location: str, base_auth: str) -> str:
        parsed_loc = urlparse(location)
        parsed_base = urlparse(base_auth)
        if "/api/auth/callback" in parsed_loc.path:
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

    async def login_one(user: dict) -> Optional[dict]:
        cookie_jar = aiohttp.CookieJar(unsafe=True)
        async with aiohttp.ClientSession(cookie_jar=cookie_jar) as u_sess:
            try:
                # 1. Generate PKCE values
                verifier = secrets.token_urlsafe(64)
                sha256 = hashlib.sha256(verifier.encode('utf-8')).digest()
                challenge = base64.urlsafe_b64encode(sha256).decode('utf-8').replace('=', '').replace('+', '-').replace('/', '_')
                state = str(uuid.uuid4())

                authorize_url = authorize_url_template.format(challenge=challenge, state=state)

                # 2. Start authorization flow (relative redirect to /login)
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
                        loc = resp.headers.get("Location", "")
                        auth_consent_url = fix_url_if_auth(loc, auth_url)
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
                            token_data = {
                                "grant_type": "authorization_code",
                                "code": code,
                                "redirect_uri": "http://localhost:8080/api/auth/callback/exam-oidc",
                                "client_id": BFF_CLIENT_ID,
                                "client_secret": BFF_CLIENT_SECRET,
                                "code_verifier": verifier
                            }
                            async with u_sess.post(token_url, data=token_data) as t_resp:
                                if t_resp.status == 200:
                                    body = await t_resp.json()
                                    if body and body.get("access_token"):
                                        stat("POST {AUTH}/oauth2/token [login]").record(0, 200, True)
                                        return {**user, "access_token": body["access_token"]}
            except Exception as e:
                pass

            stat("POST {AUTH}/oauth2/token [login]").record(0, 400, False)
            return None

    tasks = [login_one(u) for u in users]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    authed = [r for r in results if isinstance(r, dict) and r]
    s = stat("POST {AUTH}/oauth2/token [login]")
    print(f"  ✅ {len(authed)}/{len(users)} users authenticated via OIDC Code Grant")

    if not authed:
        print("  ⚠️  OIDC flow failed. Falling back to synthetic tokens...")
        authed = [{**u, "access_token": f"synthetic-token-{u['username']}"} for u in users]

    return authed


# ==============================================================================
# PHASE 3 — START EXAM SESSION (BFF proxy → session-service)
# ==============================================================================
async def phase_start_sessions(
    session: aiohttp.ClientSession,
    bff_url: str,
    authed_users: list[dict],
    exam_id: str,
) -> list[dict]:
    """
    POST {BFF}/api/proxy/mock-exam/start
    BFF validates Bearer token → proxies to session-service
    Returns list of {username, access_token, session_id}
    """
    print(f"\n[3/6] Starting exam sessions via BFF for {len(authed_users)} users...")

    async def start_one(user: dict) -> Optional[dict]:
        token  = user["access_token"]
        body, _ = await request(
            session, "POST",
            f"{bff_url}/api/proxy/mock-exam/start",
            "POST {BFF}→session /api/proxy/mock-exam/start",
            json_body={"examId": exam_id, "userId": user["username"]},
            headers={"Authorization": f"Bearer {token}"},
            success_codes=(200, 201),
        )
        if body:
            sid = body.get("sessionId") or body.get("id")
            if sid:
                return {**user, "session_id": sid}
        return None

    tasks   = [start_one(u) for u in authed_users]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    started = [r for r in results if isinstance(r, dict) and r]
    print(f"  ✅ {len(started)}/{len(authed_users)} sessions started via BFF")
    return started


# ==============================================================================
# PHASE 4 — STRESS: Load Questions (BFF → session-service @ 10 req/s per user)
# ==============================================================================
async def phase_stress_questions(
    session: aiohttp.ClientSession,
    bff_url: str,
    exam_id: str,
    session_users: list[dict],
    duration_s: int = 20,
):
    """
    GET {BFF}/api/proxy/mock-exam/{examId}/questions  × 10 req/s per user
    All users hammer simultaneously.

    Full path: Browser → BFF (auth check, proxy) → session-service (cache/DB)
    This tests the entire stack under question-loading spike (common at exam start).
    """
    n   = len(session_users)
    url = f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions"
    stat_name = "GET {BFF}→session /api/proxy/mock-exam/{id}/questions [STRESS 10rps]"

    print(f"\n[4/6] ⚡ STRESS: {n} users × 10 req/s → BFF → session-service ({duration_s}s)...")

    stop = asyncio.Event()

    async def user_worker(user: dict):
        token = user["access_token"]
        hdrs  = {"Authorization": f"Bearer {token}"}
        while not stop.is_set():
            await request(session, "GET", url, stat_name, headers=hdrs)
            await asyncio.sleep(0.1)  # 10 req/s

    tasks = []
    for i, user in enumerate(session_users):
        tasks.append(asyncio.create_task(user_worker(user)))
        if i % 200 == 0 and i > 0:
            await asyncio.sleep(0.01)   # micro-stagger to avoid thundering herd

    await asyncio.sleep(duration_s)
    stop.set()
    await asyncio.gather(*tasks, return_exceptions=True)

    s     = stat(stat_name)
    total = s.success + s.failed
    rps   = s.success / duration_s if duration_s else 0
    print(f"  ✅ Stress done: {total} requests | "
          f"{s.success/(total or 1)*100:.1f}% success | "
          f"{rps:.1f} effective RPS through full stack")


# ==============================================================================
# PHASE 5 — SUBMIT EXAM (BFF → session-service)
# ==============================================================================
async def phase_submit(
    session: aiohttp.ClientSession,
    bff_url: str,
    session_users: list[dict],
    exam_id: str,
    q_ids: list[str],
):
    """
    POST {BFF}/api/proxy/mock-exam/submit
    Simulates student completing and submitting their exam.
    """
    print(f"\n[5/6] Submitting exams via BFF for {len(session_users)} users...")

    async def submit_one(user: dict):
        token = user["access_token"]
        sid   = user["session_id"]
        body = {
            "sessionId":   sid,
            "answers": [
                {
                    "questionId": qid,
                    "answer": "Option 1",
                    "timeSpentMs": random.randint(10_000, 90_000),
                }
                for qid in q_ids
            ]
        }
        await request(
            session, "POST",
            f"{bff_url}/api/proxy/mock-exam/submit",
            "POST {BFF}→session /api/proxy/mock-exam/submit",
            json_body=body,
            headers={"Authorization": f"Bearer {token}"},
        )

    await asyncio.gather(*[submit_one(u) for u in session_users], return_exceptions=True)
    s = stat("POST {BFF}→session /api/proxy/mock-exam/submit")
    print(f"  ✅ {s.success}/{s.success + s.failed} exams submitted via BFF")


# ==============================================================================
# PHASE 6 — FLOOD: All users send all incidents simultaneously (BFF → incident-service)
# ==============================================================================
async def phase_flood_incidents(
    session: aiohttp.ClientSession,
    bff_url: str,
    session_users: list[dict],
    incidents_per_user: int = INCIDENTS_PER_USER,
):
    """
    POST {BFF}/api/proxy/incident/client-event  × (N users × M incidents)
    All requests fired simultaneously to simulate post-exam flush of buffered events.

    Full path: Browser → BFF (Bearer token validation) → incident-service
    This is the highest concurrency spike — all students finish at the same second.
    """
    n         = len(session_users)
    total_req = n * incidents_per_user
    url       = f"{bff_url}/api/proxy/incident/client-event"
    stat_name = "POST {BFF}→incident /api/proxy/incident/client-event [FLOOD]"

    print(f"\n[6/6] ⚡ FLOOD: {n} users × {incidents_per_user} incidents "
          f"= {total_req} concurrent POSTs via BFF...")

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
                session, "POST", url, stat_name,
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

    s     = stat(stat_name)
    done  = s.success + s.failed
    rps   = s.success / elapsed if elapsed else 0
    print(f"  ✅ Flood done in {elapsed:.2f}s | {done} reqs | "
          f"{rps:.1f} effective RPS | {s.success/(done or 1)*100:.1f}% success")


# ==============================================================================
# PRINT FINAL REPORT
# ==============================================================================
def print_report(total_sec: float):
    print("\n" + "=" * 72)
    print("              📈  FULL STACK PERFORMANCE REPORT")
    print("              (Frontend → BFF → Backend)")
    print("=" * 72)
    print(f"  Total wall-clock time: {total_sec:.2f}s\n")
    for name, s in _stats.items():
        if s.success + s.failed == 0:
            continue
        print(f"  ┌─ {name}")
        print(s.report(total_sec))
        print()
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
    print("  🚀  NON-POLICY FULL STACK LOAD TEST")
    print("  Flow: Frontend → BFF (Next.js) → Backend Services")
    print("=" * 72)
    print(f"  Users             : {num_users}")
    print(f"  BFF               : {bff_url}")
    print(f"  Auth Server       : {auth_url}")
    print(f"  Exam ID           : {exam_id}")
    print(f"  Questions duration: {args.questions_duration}s at {QUESTIONS_RPS} req/s")
    print(f"  Incidents/user    : {args.incidents_per_user}")
    print("=" * 72)

    connector = aiohttp.TCPConnector(
        limit          = num_users * 3 + 200,
        limit_per_host = 0,
        ttl_dns_cache  = 600,
        enable_cleanup_closed=True,
    )

    wall_start = time.time()

    async with aiohttp.ClientSession(connector=connector) as http:

        # ── Phase 1: Register via BFF ─────────────────────────────────────────
        if args.skip_register:
            uid_list = [str(uuid.uuid4()).replace("-", "")[:12] for _ in range(num_users)]
            users    = [{"username": f"lt_{uid}", "password": TEST_USER_PASSWORD} for uid in uid_list]
            print(f"\n[1/6] Skipped (--skip-register). Using {num_users} synthetic users.")
        else:
            users = await phase_register(http, bff_url, num_users)

        if not users:
            print("\n❌ No users created. Aborting.")
            return

        # ── Phase 2: Login via Auth Server ────────────────────────────────────
        authed_users = await phase_login(http, auth_url, users)

        if not authed_users:
            print("\n❌ No users authenticated. Check auth-server. Aborting.")
            return

        # ── Phase 3: Start Exam via BFF ───────────────────────────────────────
        session_users = await phase_start_sessions(http, bff_url, authed_users, exam_id)

        if not session_users:
            print("\n❌ No sessions created via BFF. Check BFF→session-service routing. Aborting.")
            return

        # Fetch question IDs for submitting
        q_ids = []
        try:
            q_body, _ = await request(
                http, "GET",
                f"{bff_url}/api/proxy/mock-exam/{exam_id}/questions",
                "GET questions list",
            )
            if q_body and "questions" in q_body:
                q_ids = [q["id"] for q in q_body["questions"]]
        except Exception as e:
            print(f"⚠️ Failed to load questions list: {e}")

        # ── Phase 4: Stress Questions via BFF ─────────────────────────────────
        await phase_stress_questions(
            http, bff_url, exam_id,
            session_users=session_users,
            duration_s=args.questions_duration,
        )

        # ── Phase 5: Submit Exam via BFF ──────────────────────────────────────
        await phase_submit(http, bff_url, session_users, exam_id, q_ids)

        # ── Phase 6: Flood Incidents via BFF ──────────────────────────────────
        await phase_flood_incidents(
            http, bff_url,
            session_users=session_users,
            incidents_per_user=args.incidents_per_user,
        )

    print_report(time.time() - wall_start)


# ==============================================================================
# CLI
# ==============================================================================
def main():
    p = argparse.ArgumentParser(
        description="Full Stack Load Test: Frontend → BFF → Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    # ── Service URLs ───────────────────────────────────────────────────────────
    p.add_argument("--bff",  default=os.getenv("LT_BFF_URL",  "http://bff:8080"),
                   help="BFF (Next.js) base URL — entry point for all requests")
    p.add_argument("--auth", default=os.getenv("LT_AUTH_URL", "http://auth-server:9000"),
                   help="Auth Server base URL — for OIDC token endpoint")

    # ── Load parameters ────────────────────────────────────────────────────────
    p.add_argument("--users",              type=int, default=int(os.getenv("LT_USERS", "1000")),
                   help="Number of concurrent virtual users (default: 1000)")
    p.add_argument("--exam-id",            default=os.getenv("LT_EXAM_ID", DEFAULT_EXAM_ID))
    p.add_argument("--questions-duration", type=int, default=int(os.getenv("LT_QUESTIONS_DURATION", "20")),
                   help="Seconds to stress the questions endpoint (default: 20)")
    p.add_argument("--incidents-per-user", type=int, default=int(os.getenv("LT_INCIDENTS_PER_USER", "20")),
                   help="Incidents flushed per user at end-of-exam (default: 20)")
    p.add_argument("--skip-register", action="store_true",
                   default=os.getenv("LT_SKIP_REGISTER", "false").lower() == "true",
                   help="Skip Phase 1 registration (if users pre-exist)")

    asyncio.run(run(p.parse_args()))


if __name__ == "__main__":
    main()
