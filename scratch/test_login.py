import asyncio
import aiohttp
import re
import secrets
import hashlib
import base64
import uuid
from urllib.parse import urlparse, urlunparse, parse_qs

TEST_USER_PASSWORD = "LoadTest@123!"
BFF_CLIENT_ID = "exam-bff-client"
BFF_CLIENT_SECRET = "exam-bff-secret"
auth_url = "http://authorization-server:9000"
bff_url = "http://istio-ingressgateway.istio-system"

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

async def test_login():
    cookie_jar = aiohttp.CookieJar(unsafe=True)
    async with aiohttp.ClientSession(cookie_jar=cookie_jar) as u_sess:
        # First register a fresh test user
        uid = str(uuid.uuid4()).replace("-", "")[:12]
        username = f"diag_{uid}"
        print(f"Registering user: {username} ...")
        async with u_sess.post(f"{bff_url}/api/register", json={
            "username": username,
            "password": TEST_USER_PASSWORD,
            "email": f"{username}@test.com",
            "fullName": "Diagnostic User"
        }) as r:
            print(f"Register status: {r.status}")
            if r.status not in (200, 201):
                print(f"Failed to register user: {await r.text()}")
                return

        # Start PKCE Login
        verifier = secrets.token_urlsafe(64)
        sha256 = hashlib.sha256(verifier.encode('utf-8')).digest()
        challenge = base64.urlsafe_b64encode(sha256).decode('utf-8').replace('=', '').replace('+', '-').replace('/', '_')
        state = str(uuid.uuid4())

        authorize_url_template = (
            f"{auth_url}/oauth2/authorize?"
            f"response_type=code&"
            f"client_id={BFF_CLIENT_ID}&"
            f"scope=openid%20profile&"
            f"redirect_uri=http://localhost:8080/api/auth/callback/exam-oidc&"
            f"code_challenge={challenge}&"
            f"code_challenge_method=S256&"
            f"state={state}"
        )

        print("\nStep 1: Fetching authorize URL...")
        async with u_sess.get(authorize_url_template, allow_redirects=False) as resp:
            print(f"Status: {resp.status}")
            loc = resp.headers.get("Location", "")
            print(f"Redirect Location: {loc}")
            login_page_url = fix_url_if_auth(loc, auth_url)
            print(f"Fixed login page URL: {login_page_url}")

        print("\nStep 2: Fetching login page to retrieve CSRF token...")
        async with u_sess.get(login_page_url, allow_redirects=False) as resp:
            print(f"Status: {resp.status}")
            html = await resp.text()

        csrf_match = re.search(r'name="_csrf"\s+value="([^"]+)"', html)
        if not csrf_match:
            csrf_match = re.search(r'value="([^"]+)"\s+name="_csrf"', html)
        csrf_token = csrf_match.group(1) if csrf_match else ""
        print(f"CSRF Token: {csrf_token}")

        if not csrf_token:
            print("ERROR: CSRF token not found in login page!")
            return

        # 4. Form login submit
        login_data = {
            "username": username,
            "password": TEST_USER_PASSWORD,
            "_csrf": csrf_token
        }
        post_login_url = f"{auth_url}/login"
        print("\nStep 3: Submitting login credentials...")
        async with u_sess.post(post_login_url, data=login_data, allow_redirects=False) as resp:
            print(f"Status: {resp.status}")
            loc = resp.headers.get("Location", "")
            print(f"Redirect Location: {loc}")
            auth_consent_url = fix_url_if_auth(loc, auth_url)
            print(f"Fixed auth consent URL: {auth_consent_url}")

        print("\nStep 4: Calling authorization consent/redirect page...")
        async with u_sess.get(auth_consent_url, allow_redirects=False) as resp:
            print(f"Status: {resp.status}")
            loc = resp.headers.get("Location", "")
            print(f"Redirect Location: {loc}")
            
            if resp.status == 302:
                parsed = urlparse(loc)
                qs = parse_qs(parsed.query)
                code = qs.get("code", [None])[0]
                print(f"Authorization Code: {code}")
                
                if code:
                    token_url = f"{auth_url}/oauth2/token"
                    token_data = {
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": "http://localhost:8080/api/auth/callback/exam-oidc",
                        "client_id": BFF_CLIENT_ID,
                        "client_secret": BFF_CLIENT_SECRET,
                        "code_verifier": verifier
                    }
                    print("\nStep 5: Exchanging authorization code for token...")
                    async with u_sess.post(token_url, data=token_data) as t_resp:
                        print(f"Token Exchange Status: {t_resp.status}")
                        body = await t_resp.json()
                        print(f"Token response: {body}")
                else:
                    print("ERROR: No code parameter in redirection location query!")
            else:
                print("ERROR: Consent redirect did not return 302!")

asyncio.run(test_login())
