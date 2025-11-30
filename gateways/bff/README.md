## Exam Platform BFF (Next.js + NextAuth)

### Scripts
- `npm run dev` – start Next.js on port 8080 with hot reload.
- `npm run build && npm run start` – production build + serve.

### Required Environment
Copy `env.sample` → `.env.local` and adjust for your environment:

| Variable | Purpose |
| --- | --- |
| `BFF_CLIENT_ID` / `BFF_CLIENT_SECRET` | OAuth client managed by Admin Service |
| `AUTH_SERVER_ISSUER` | Issuer claim expected in tokens (what the browser sees) |
| `AUTH_SERVER_WELL_KNOWN_URL` | (Optional) Override for metadata discovery URL |
| `AUTH_SERVER_TOKEN_URL` | Token endpoint for refresh flow |
| `UPSTREAM_API_BASE_URL` | Target microservice (e.g., UMS) to proxy `/api/proxy/**` |
| `BFF_SCOPES` | Space-separated scopes to request |
| `BFF_SESSION_COOKIE` | Name of HttpOnly cookie that React app will send |

### API Surface
- `GET /api/session` – returns current user snapshot (or anonymous).
- `GET/POST/... /api/proxy/<path>` – forwards to upstream with stored bearer token.
- `GET /api/auth/signin` – start OIDC login.
- `GET /api/auth/signout` – terminate session & revoke cookie.

