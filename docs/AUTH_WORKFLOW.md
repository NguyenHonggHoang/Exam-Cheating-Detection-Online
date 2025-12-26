# Authentication Workflow

## Tổng quan kiến trúc

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   BFF (Next.js) │────▶│  Auth Server    │
│   (Port 5173)   │     │   (Port 8080)   │     │  (Port 9000)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  User Service   │
                        │  (Port 8100)    │
                        └─────────────────┘
```

## OAuth2 + PKCE Flow

Hệ thống sử dụng OAuth2 Authorization Code Flow với PKCE (Proof Key for Code Exchange) để bảo mật.

---

## 1. Login Flow

### Sequence Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  React   │     │   BFF    │     │  Auth    │     │  User    │
│   App    │     │          │     │  Server  │     │ Service  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Click Login │                │                │
     │───────────────▶│                │                │
     │                │                │                │
     │ 2. Redirect    │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │ 3. Redirect to Auth Server      │                │
     │────────────────────────────────▶│                │
     │                │                │                │
     │ 4. User enters credentials      │                │
     │◀───────────────────────────────▶│                │
     │                │                │                │
     │ 5. Redirect with auth code      │                │
     │◀────────────────────────────────│                │
     │                │                │                │
     │ 6. Callback to BFF              │                │
     │───────────────▶│                │                │
     │                │                │                │
     │                │ 7. Exchange code for tokens     │
     │                │───────────────▶│                │
     │                │                │                │
     │                │ 8. Return tokens               │
     │                │◀───────────────│                │
     │                │                │                │
     │                │ 9. Get user info               │
     │                │───────────────▶│                │
     │                │                │                │
     │                │ 10. Return profile             │
     │                │◀───────────────│                │
     │                │                │                │
     │ 11. Set session cookie & redirect               │
     │◀───────────────│                │                │
     │                │                │                │
     │ 12. Get userinfo                │                │
     │───────────────▶│                │                │
     │                │                │                │
     │ 13. Return user data            │                │
     │◀───────────────│                │                │
     │                │                │                │
```

### Chi tiết các bước

#### Bước 1-2: Khởi tạo Login

**Frontend (AuthContext.tsx)**
```typescript
const loginWithOAuth2 = () => {
  apiClient.login();
};

// client.ts
async login(): Promise<void> {
  const callbackUrl = window.location.origin;
  window.location.href = `/api/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
```

#### Bước 3: BFF tạo PKCE và redirect

**BFF (pages/api/auth/login.js)**
```javascript
// Tạo PKCE code verifier và challenge
const { codeVerifier, codeChallenge } = generatePKCE();
const state = generateState();

// Lưu vào cookie để verify sau
res.setHeader('Set-Cookie', `pkce_data=${encodeURIComponent(pkceData)}; ...`);

// Redirect đến Auth Server
const authUrl = `${authServerUrl}/oauth2/authorize?` +
  `client_id=${clientId}&` +
  `scope=${scope}&` +
  `response_type=code&` +
  `redirect_uri=${bffCallbackUri}&` +
  `state=${state}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

res.redirect(302, authUrl);
```

#### Bước 4-5: User đăng nhập tại Auth Server

User nhập username/password tại Auth Server. Sau khi xác thực thành công, Auth Server redirect về BFF với authorization code.

#### Bước 6-10: Token Exchange

**BFF (pages/api/auth/callback/exam-oidc.js hoặc callback-oauth.js)**
```javascript
// Verify state để chống CSRF
if (state !== pkceData.state) {
  return res.redirect('/login?error=state_mismatch');
}

// Exchange code for tokens
const tokenResponse = await fetch(`${authServerUrl}/oauth2/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: bffCallbackUri,
    code_verifier: pkceData.codeVerifier,
  }),
});

const tokens = await tokenResponse.json();

// Lưu refresh token vào database
await TokenRepository.saveRefreshToken(userProfile.sub, tokens.refresh_token);

// Set session cookie
const sessionData = {
  user: { id, name, email },
  accessToken: tokens.access_token,
  idToken: tokens.id_token,
};
res.setHeader('Set-Cookie', `bff_session=${encodeURIComponent(JSON.stringify(sessionData))}; ...`);
```

#### Bước 11-13: Frontend nhận user info

**Frontend (AuthContext.tsx)**
```typescript
useEffect(() => {
  const initAuth = async () => {
    const response = await axios.get('/api/auth/userinfo');
    const profile = response.data;
    
    const roles = extractRolesFromProfile(profile);
    const userData: User = {
      id: profile.sub,
      username: profile.preferred_username,
      role: getUserRoleFromRoles(roles),
      roles,
    };
    setUser(userData);
  };
  initAuth();
}, []);
```

---

## 2. Logout Flow

### Sequence Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  React   │     │   BFF    │     │  Auth    │
│   App    │     │          │     │  Server  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     │ 1. Click Logout│                │
     │───────────────▶│                │
     │                │                │
     │                │ 2. Delete refresh token from DB
     │                │────────────────│
     │                │                │
     │                │ 3. Clear cookies
     │                │────────────────│
     │                │                │
     │ 4. Return logout URL            │
     │◀───────────────│                │
     │                │                │
     │ 5. Redirect to Auth Server logout
     │────────────────────────────────▶│
     │                │                │
     │ 6. Clear Auth Server session    │
     │◀────────────────────────────────│
     │                │                │
     │ 7. Redirect to login page       │
     │◀────────────────────────────────│
     │                │                │
```

### Chi tiết các bước

#### Bước 1: Frontend gọi logout

**Frontend (AuthContext.tsx)**
```typescript
const logout = async () => {
  setUser(null);
  await apiClient.logout();
};

// client.ts
async logout(): Promise<void> {
  const response = await axios.post('/api/auth/logout');
  if (response.data?.redirectUrl) {
    window.location.href = response.data.redirectUrl;
  }
}
```

#### Bước 2-4: BFF xử lý logout

**BFF (pages/api/auth/logout.js)**
```javascript
// Xóa refresh token từ database
await TokenRepository.deleteRefreshToken(userId);

// Clear tất cả cookies
const cookiesToClear = [
  'bff_session',
  'next-auth.session-token',
];
res.setHeader('Set-Cookie', expiredCookies);

// Trả về URL logout của Auth Server
const authServerLogoutUrl = `${authServerUrl}/connect/logout?` +
  `post_logout_redirect_uri=${postLogoutRedirectUri}&` +
  `id_token_hint=${idToken}`;

return res.status(200).json({
  success: true,
  redirectUrl: authServerLogoutUrl
});
```

#### Bước 5-7: Auth Server logout

Frontend redirect đến Auth Server logout URL. Auth Server xóa session và redirect về login page.

---

## 3. Token Refresh Flow

### Khi nào refresh?

Token được refresh tự động khi:
- Access token sắp hết hạn (trước 60 giây)
- Có request API và token đã expired

### Flow

```javascript
// lib/auth-options.js
async jwt({ token }) {
  const now = Date.now();
  const BUFFER_TIME = 60 * 1000; // 60 seconds

  // Token còn hạn
  if (now < token.accessTokenExpires - BUFFER_TIME) {
    return token;
  }

  // Token hết hạn, refresh
  const storedRefreshToken = await TokenRepository.getRefreshToken(token.sub);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: storedRefreshToken,
    }),
  });

  const refreshedTokens = await response.json();
  
  // Lưu refresh token mới
  await TokenRepository.saveRefreshToken(token.sub, refreshedTokens.refresh_token);

  return {
    ...token,
    accessToken: refreshedTokens.access_token,
    accessTokenExpires: Date.now() + (refreshedTokens.expires_in * 1000),
  };
}
```

---

## 4. Session Management

### Cookies được sử dụng

| Cookie | Mục đích | HttpOnly | Secure |
|--------|----------|----------|--------|
| `bff_session` | Lưu access token, user info | ✅ | Production |
| `next-auth.session-token` | NextAuth session | ✅ | Production |
| `pkce_data` | PKCE verifier (tạm thời) | ✅ | ❌ |

### Token Storage

- **Access Token**: Lưu trong cookie `bff_session` (HttpOnly)
- **Refresh Token**: Lưu trong database (server-side only)
- **ID Token**: Lưu trong cookie `bff_session` (dùng cho logout)

---

## 5. Role-based Access Control

### Roles

| Role | Mô tả |
|------|-------|
| `ADMIN` | Quản trị viên hệ thống |
| `PROCTOR` | Giám thị |
| `REVIEWER` | Người review incidents |
| `CANDIDATE` | Thí sinh |

### Role Detection

```typescript
const getUserRoleFromRoles = (roles: string[]): UserRole => {
  if (roles.includes('ROLE_ADMIN') || roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('ROLE_REVIEWER') || roles.includes('REVIEWER')) return 'PROCTOR';
  if (roles.includes('ROLE_PROCTOR') || roles.includes('PROCTOR')) return 'PROCTOR';
  if (roles.includes('ROLE_CANDIDATE') || roles.includes('CANDIDATE')) return 'CANDIDATE';
  return 'CANDIDATE'; // Default
};
```

---

## 6. Error Handling

### Login Errors

| Error | Nguyên nhân | Xử lý |
|-------|-------------|-------|
| `state_mismatch` | CSRF attack hoặc session expired | Redirect về login |
| `token_exchange_failed` | Auth server error | Hiển thị error message |
| `session_expired` | PKCE cookie hết hạn | Redirect về login |

### Session Errors

| Error | Nguyên nhân | Xử lý |
|-------|-------------|-------|
| `RefreshAccessTokenError` | Refresh token invalid | Force logout |
| `SessionInvalidated` | User đã logout ở nơi khác | Force logout |
| `not_authenticated` | Không có session | Redirect về login |

---

## 7. Environment Variables

```env
# Auth Server
AUTH_SERVER_URL=http://localhost:9000
AUTH_SERVER_EXTERNAL_URL=http://localhost:9000
AUTH_SERVER_ISSUER=http://localhost:9000
AUTH_SERVER_TOKEN_URL=http://localhost:9000/oauth2/token
AUTH_SERVER_USERINFO_URL=http://localhost:9000/userinfo

# BFF Client
BFF_CLIENT_ID=exam-bff-client
BFF_CLIENT_SECRET=exam-bff-secret
NEXTAUTH_URL=http://localhost:8080
NEXTAUTH_SECRET=your-secret-key

# Frontend
REACT_CLIENT_URL=http://localhost:5173
```

---

## 8. Security Best Practices

1. **PKCE**: Sử dụng S256 code challenge method
2. **State Parameter**: Chống CSRF attacks
3. **HttpOnly Cookies**: Tokens không accessible từ JavaScript
4. **Server-side Refresh Token**: Refresh token chỉ lưu ở server
5. **Token Rotation**: Refresh token mới sau mỗi lần refresh
6. **Short-lived Access Tokens**: Access token expire sau 5 phút
