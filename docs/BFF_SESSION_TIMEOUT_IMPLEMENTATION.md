# BFF Session Timeout Implementation Report

## 📋 Tổng Quan

Báo cáo này xác nhận việc triển khai đầy đủ các tính năng auto refresh token và auto logout khi user inactive ở BFF layer, dựa trên các đề xuất trong phân tích ban đầu.

---

## ✅ Các Tính Năng Đã Triển Khai

### 1. ✅ Last Activity Tracking

**Status:** Đã triển khai đầy đủ

**Implementation:**
- **Database:** Column `last_activity_at` đã được thêm vào bảng `refresh_tokens`
- **JWT Token:** Field `lastActivityAt` được cập nhật mỗi request
- **Repository:** Method `updateLastActivity()` được gọi trong JWT callback

**Files:**
- `gateways/bff/lib/token-repository.js:125-138` - `updateLastActivity()`
- `gateways/bff/lib/auth-options.js:150-151` - Update trong JWT callback
- `infra/docker/postgres/init/04-bff-session-timeout.sql` - Database migration

**Logic:**
```javascript
// Mỗi request đều update last_activity_at
await TokenRepository.updateLastActivity(token.sub);
token.lastActivityAt = Date.now();
```

---

### 2. ✅ Idle Timeout (30 phút)

**Status:** Đã triển khai đầy đủ

**Implementation:**
- **Timeout:** 30 phút không hoạt động → tự động logout
- **Check:** Được thực hiện trong JWT callback qua `checkSessionTimeout()`
- **Error:** Trả về `IdleTimeout` error trong token

**Files:**
- `gateways/bff/lib/token-repository.js:140-181` - `checkSessionTimeout()`
- `gateways/bff/lib/auth-options.js:141-147` - Check trong JWT callback

**Logic:**
```javascript
// Check idle timeout (30 minutes)
const idleTimeout = 30 * 60 * 1000; // 30 minutes
const idleTime = now - lastActivityAt;

if (idleTime > idleTimeout) {
  return { valid: false, reason: 'IdleTimeout' };
}
```

---

### 3. ✅ Absolute Session Timeout (24 giờ)

**Status:** Đã triển khai đầy đủ

**Implementation:**
- **Timeout:** 24 giờ từ lúc sign in → tự động logout
- **Database:** Column `session_expires_at` được set khi sign in
- **JWT Token:** Field `sessionExpiresAt` được sync từ database
- **Check:** Được thực hiện trong JWT callback qua `checkSessionTimeout()`
- **Error:** Trả về `SessionExpired` error trong token

**Files:**
- `gateways/bff/lib/token-repository.js:140-181` - `checkSessionTimeout()`
- `gateways/bff/lib/auth-options.js:134` - Set khi sign in
- `gateways/bff/lib/auth-options.js:141-147` - Check trong JWT callback
- `infra/docker/postgres/init/04-bff-session-timeout.sql` - Database migration

**Logic:**
```javascript
// Khi sign in
sessionExpiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours

// Check absolute timeout
if (now > sessionExpiresAt) {
  return { valid: false, reason: 'SessionExpired' };
}
```

---

### 4. ✅ Auto Refresh Token Khi User Active

**Status:** Đã triển khai đầy đủ (từ trước)

**Implementation:**
- **Trigger:** Tự động refresh khi token sắp hết hạn (trước 60 giây)
- **Transparent:** User không cảm nhận được việc refresh
- **Error Handling:** Xử lý lỗi và đánh dấu `error` trong token nếu refresh fail

**Files:**
- `gateways/bff/lib/auth-options.js:3-62` - `refreshAccessToken()`
- `gateways/bff/lib/auth-options.js:153-167` - Logic trong JWT callback

**Logic:**
```javascript
const BUFFER_TIME = 60 * 1000; // 60 giây buffer

if (now < token.accessTokenExpires - BUFFER_TIME) {
  return token; // Token còn valid
}

// Token sắp hết hạn → refresh
return refreshAccessToken(token);
```

---

### 5. ✅ Frontend Heartbeat

**Status:** Đã triển khai đầy đủ

**Implementation:**
- **Interval:** Gửi heartbeat mỗi 5 phút
- **Endpoint:** `/api/auth/session`
- **Error Handling:** Tự động logout nếu session expired hoặc có error
- **Auto Redirect:** Redirect về login page nếu session invalid

**Files:**
- `frontends/exam-ui/src/auth/AuthContext.tsx:123-181` - Heartbeat logic

**Logic:**
```typescript
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

const sendHeartbeat = async () => {
  const response = await fetch('/api/auth/session', { 
    credentials: 'include',
    method: 'GET'
  });
  
  if (session.error) {
    // Logout và redirect
  }
};

setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
```

---

## 🔄 Cải Thiện Mới (2024)

### Sync sessionExpiresAt từ Database

**Vấn đề:** JWT token có thể không sync với database về `sessionExpiresAt`

**Giải pháp:** Sync `sessionExpiresAt` từ database trong JWT callback

**Files:**
- `gateways/bff/lib/auth-options.js:149-156` - Sync trong JWT callback
- `gateways/bff/lib/auth-options.js:43-52` - Sync sau khi refresh token

**Logic:**
```javascript
// Sync sessionExpiresAt from database
const storedTokenData = await TokenRepository.getRefreshToken(token.sub);
if (storedTokenData?.sessionExpiresAt) {
  token.sessionExpiresAt = storedTokenData.sessionExpiresAt;
}
```

---

## 📊 So Sánh Trước và Sau

| Tính Năng | Trước | Sau |
|-----------|-------|-----|
| **Auto refresh khi active** | ✅ Có | ✅ Có (giữ nguyên) |
| **Track last activity** | ❌ Không | ✅ Có |
| **Idle timeout** | ❌ Không | ✅ Có (30 phút) |
| **Absolute session timeout** | ❌ Không | ✅ Có (24 giờ) |
| **Frontend heartbeat** | ❌ Không | ✅ Có (5 phút) |
| **Sync sessionExpiresAt** | ❌ Không | ✅ Có (mới thêm) |

---

## 🔍 Chi Tiết Implementation

### Database Schema

```sql
-- Columns đã thêm vào refresh_tokens table
ALTER TABLE refresh_tokens 
ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE refresh_tokens 
ADD COLUMN session_expires_at TIMESTAMP WITH TIME ZONE;

-- Indexes
CREATE INDEX idx_refresh_tokens_last_activity_at ON refresh_tokens(last_activity_at);
CREATE INDEX idx_refresh_tokens_session_expires_at ON refresh_tokens(session_expires_at);
```

### JWT Callback Flow

```
1. Initial Sign In
   ├─ Save refresh token → database
   ├─ Set lastActivityAt = now
   └─ Set sessionExpiresAt = now + 24h

2. Subsequent Requests
   ├─ Check session timeout (idle + absolute)
   │  ├─ If idle > 30 min → return IdleTimeout error
   │  └─ If session > 24h → return SessionExpired error
   ├─ Update last activity
   ├─ Sync sessionExpiresAt from database
   └─ Check if access token needs refresh
      └─ If yes → refreshAccessToken()
```

### Error Handling

Các error codes được trả về trong token:
- `IdleTimeout`: User không hoạt động > 30 phút
- `SessionExpired`: Session đã hết hạn > 24 giờ
- `SessionInvalidated`: Refresh token không tồn tại trong database
- `RefreshAccessTokenError`: Lỗi khi refresh token

Frontend sẽ detect các error này và tự động logout.

---

## 🎯 Kết Luận

### Hiện Trạng:

- ✅ **Auto refresh token:** Hoạt động tốt khi user active
- ✅ **Auto logout khi inactive:** Đã được implement đầy đủ
- ✅ **Last activity tracking:** Đã được implement
- ✅ **Idle timeout:** Đã được implement (30 phút)
- ✅ **Absolute session timeout:** Đã được implement (24 giờ)
- ✅ **Frontend heartbeat:** Đã được implement (5 phút)
- ✅ **Sync sessionExpiresAt:** Đã được cải thiện

### Security Impact:

- **Trước:** Medium risk (session có thể tồn tại vô thời hạn)
- **Sau:** Low risk (session có timeout hợp lý: 30 phút idle, 24 giờ absolute)

### Best Practices:

- ✅ Session timeout được implement đúng cách
- ✅ Idle timeout phù hợp với production
- ✅ Absolute timeout đảm bảo security
- ✅ Frontend heartbeat giữ session alive khi user active
- ✅ Error handling đầy đủ và rõ ràng

---

## 📝 Files Modified

1. `gateways/bff/lib/auth-options.js` - Cải thiện sync sessionExpiresAt
2. `gateways/bff/lib/token-repository.js` - Đã có đầy đủ methods
3. `infra/docker/postgres/init/04-bff-session-timeout.sql` - Database migration
4. `frontends/exam-ui/src/auth/AuthContext.tsx` - Frontend heartbeat

---

## 🚀 Testing Recommendations

1. **Test Idle Timeout:**
   - Đăng nhập và không hoạt động > 30 phút
   - Verify session bị logout tự động

2. **Test Absolute Timeout:**
   - Đăng nhập và giữ session > 24 giờ
   - Verify session bị logout tự động

3. **Test Heartbeat:**
   - Đăng nhập và để tab mở
   - Verify heartbeat gửi mỗi 5 phút
   - Verify session không bị logout khi có heartbeat

4. **Test Auto Refresh:**
   - Đăng nhập và sử dụng ứng dụng
   - Verify token được refresh tự động khi sắp hết hạn

---

## 📚 References

- Original Analysis: `docs/BFF_TOKEN_REFRESH_ANALYSIS.md` (nếu có)
- Database Migration: `infra/docker/postgres/init/04-bff-session-timeout.sql`
- Token Repository: `gateways/bff/lib/token-repository.js`
- Auth Options: `gateways/bff/lib/auth-options.js`
- Frontend Auth: `frontends/exam-ui/src/auth/AuthContext.tsx`

