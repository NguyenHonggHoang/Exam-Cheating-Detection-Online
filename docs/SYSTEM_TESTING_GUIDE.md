# HƯỚNG DẪN KIỂM THỬ HỆ THỐNG
## HỆ THỐNG PHÁT HIỆN GIAN LẬN THI CỬ TRỰC TUYẾN

---

## MỤC LỤC

1. [Tổng Quan Kiểm Thử](#1-tổng-quan-kiểm-thử)
2. [Cấu Trúc Test Hiện Có](#2-cấu-trúc-test-hiện-có)
3. [Kiểm Thử Backend (Spring Boot)](#3-kiểm-thử-backend-spring-boot)
4. [Kiểm Thử Frontend (React)](#4-kiểm-thử-frontend-react)
5. [Kiểm Thử Tích Hợp](#5-kiểm-thử-tích-hợp)
6. [Kiểm Thử Chức Năng Thủ Công](#6-kiểm-thử-chức-năng-thủ-công)
7. [Kiểm Thử Hiệu Năng](#7-kiểm-thử-hiệu-năng)
8. [Công Cụ Hỗ Trợ](#8-công-cụ-hỗ-trợ)

---

## 1. TỔNG QUAN KIỂM THỬ

### 1.1. Chiến Lược Kiểm Thử

Hệ thống áp dụng **kim tự tháp kiểm thử** (Testing Pyramid):

```
                    ┌─────────┐
                    │  E2E    │  ← Manual + Integration Tests
                   /│ (Ít)   │\
                  / └─────────┘ \
                 / ┌───────────┐ \
                /  │Integration│  ← API + Component Tests
               /   │ (Vừa)    │   \
              /    └───────────┘    \
             /    ┌───────────────┐  \
            /     │  Unit Tests   │   \
           /      │   (Nhiều)     │    \
          /       └───────────────┘     \
         ────────────────────────────────
```

### 1.2. Các Loại Test Trong Dự Án

| Loại Test | Công Nghệ | Số Lượng | Mục Đích |
|-----------|-----------|----------|----------|
| **Unit Test Backend** | JUnit 5 + Mockito | 8 file | Test logic nghiệp vụ |
| **Unit Test Frontend** | Vitest | 6 file | Test components + utils |
| **Integration Test** | Spring Test + Testcontainers | 2 file | Test API endpoints |
| **E2E Test** | Manual + Browser DevTools | - | Test luồng hoàn chỉnh |

### 1.3. Yêu Cầu Môi Trường Test

**Backend:**
- Java 17+
- Gradle 8.x
- Docker (cho Testcontainers)

**Frontend:**
- Node.js 18+
- pnpm/npm

---

## 2. CẤU TRÚC TEST HIỆN CÓ

### 2.1. Backend Test Files

```
services/session-service/src/test/java/com/example/exam/
├── controller/
│   ├── IngestControllerTest.java      # Test thu thập dữ liệu
│   └── SessionControllerTest.java     # Test quản lý phiên thi
├── repository/
│   └── AnswerLogRepositoryPropertyTest.java  # Property-based test
├── security/
│   ├── AdminSecurityTest.java         # Test phân quyền Admin
│   ├── IngestSecurityTest.java        # Test xác thực Ingest API
│   └── ReviewSecurityTest.java        # Test phân quyền Review
└── service/
    └── IngestServiceTest.java         # Test business logic
```

### 2.2. Frontend Test Files

```
frontends/exam-ui/src/
├── components/
│   ├── AnswerBehaviorDashboard.test.ts
│   ├── AnswerLogsPanel.test.ts
│   └── EvidenceViewer.test.ts
├── integration/
│   └── proctor-video-analysis.integration.test.ts
└── lib/utils/
    ├── formatters.test.ts
    └── violationLabels.test.ts
```

---

## 3. KIỂM THỬ BACKEND (SPRING BOOT)

### 3.1. Chạy Test Backend

```bash
# Chạy tất cả tests
cd services/session-service
./gradlew test

# Chạy một class test cụ thể
./gradlew test --tests "SessionControllerTest"

# Chạy với báo cáo chi tiết
./gradlew test --info

# Xem báo cáo HTML
# File: build/reports/tests/test/index.html
```

### 3.2. Ví Dụ Unit Test - SessionController

```java
@WebMvcTest(controllers = SessionController.class)
@AutoConfigureMockMvc(addFilters = false)
class SessionControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    SessionRepository sessionRepository;

    @Test
    void startSession_happyPath() throws Exception {
        // Arrange
        UUID examId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        Session saved = new Session();
        saved.setExamId(examId);
        saved.setStatus(SessionStatus.ACTIVE);
        
        when(sessionRepository.save(any())).thenReturn(saved);
        
        // Act & Assert
        mvc.perform(post("/api/sessions/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"examId\":\"" + examId + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void startSession_invalidUuid_returns400() throws Exception {
        mvc.perform(post("/api/sessions/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"examId\":\"not-a-uuid\"}"))
            .andExpect(status().isBadRequest());
    }
}
```

### 3.3. Test Annotations Quan Trọng

| Annotation | Mục Đích |
|------------|----------|
| `@WebMvcTest` | Test controller layer, tự động cấu hình MockMvc |
| `@MockBean` | Tạo mock cho Spring beans |
| `@SpringBootTest` | Load full application context |
| `@DataJpaTest` | Test repository layer với in-memory DB |
| `@WithMockUser` | Giả lập user authenticated |

### 3.4. Test Security

```java
@SpringBootTest
@AutoConfigureMockMvc
class AdminSecurityTest {

    @Test
    void adminEndpoint_withoutToken_returns401() throws Exception {
        mvc.perform(get("/api/admin/users"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminEndpoint_withAdminRole_returns200() throws Exception {
        mvc.perform(get("/api/admin/users"))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "USER")
    void adminEndpoint_withUserRole_returns403() throws Exception {
        mvc.perform(get("/api/admin/users"))
            .andExpect(status().isForbidden());
    }
}
```

---

## 4. KIỂM THỬ FRONTEND (REACT)

### 4.1. Chạy Test Frontend

```bash
cd frontends/exam-ui

# Chạy tất cả tests
pnpm test

# Chạy với watch mode
pnpm test:watch

# Chạy với coverage
pnpm test:coverage

# Chạy một file cụ thể
pnpm test src/lib/utils/formatters.test.ts
```

### 4.2. Cấu Hình Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 4.3. Ví Dụ Test Utility Function

```typescript
// src/lib/utils/formatters.test.ts
import { describe, it, expect } from 'vitest'
import { formatDuration, formatTimestamp } from './formatters'

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(90)).toBe('1:30')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('handles hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatTimestamp', () => {
  it('formats ISO timestamp to readable format', () => {
    const input = '2024-12-30T21:00:00Z'
    expect(formatTimestamp(input)).toMatch(/Dec 30/)
  })
})
```

### 4.4. Ví Dụ Test Component

```typescript
// src/components/EvidenceViewer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EvidenceViewer } from './EvidenceViewer'

describe('EvidenceViewer', () => {
  const mockEvidence = {
    id: '1',
    type: 'SNAPSHOT',
    url: 'https://example.com/image.jpg',
    timestamp: '2024-12-30T21:00:00Z'
  }

  it('renders evidence image', () => {
    render(<EvidenceViewer evidence={mockEvidence} />)
    
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', mockEvidence.url)
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<EvidenceViewer evidence={mockEvidence} onClose={onClose} />)
    
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

---

## 5. KIỂM THỬ TÍCH HỢP

### 5.1. Integration Test với Testcontainers

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class SessionIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    TestRestTemplate restTemplate;

    @Test
    void fullSessionLifecycle() {
        // 1. Start session
        var startRequest = Map.of("examId", UUID.randomUUID());
        var startResponse = restTemplate.postForEntity(
            "/api/sessions/start", 
            startRequest, 
            Session.class
        );
        assertThat(startResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        
        var sessionId = startResponse.getBody().getId();

        // 2. Send telemetry
        var telemetry = Map.of("type", "TAB_SWITCH", "timestamp", Instant.now());
        restTemplate.postForEntity(
            "/api/ingest/telemetry?sessionId=" + sessionId,
            telemetry,
            Void.class
        );

        // 3. End session
        var endResponse = restTemplate.postForEntity(
            "/api/sessions/" + sessionId + "/end",
            null,
            Session.class
        );
        assertThat(endResponse.getBody().getStatus()).isEqualTo(SessionStatus.ENDED);
    }
}
```

### 5.2. Frontend Integration Test

```typescript
// proctor-video-analysis.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProctorVideoAnalysis } from '@/hooks/useProctorVideoAnalysis'

describe('Proctor Video Analysis Integration', () => {
  it('fetches and analyzes video frames', async () => {
    const { result } = renderHook(() => useProctorVideoAnalysis({
      sessionId: 'test-session',
      enabled: true
    }))

    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(true)
    })

    // Simulate violation detection
    result.current.processFrame(mockFrame)

    await waitFor(() => {
      expect(result.current.violations).toHaveLength(1)
    })
  })
})
```

---

## 6. KIỂM THỬ CHỨC NĂNG THỦ CÔNG

### 6.1. Checklist Kiểm Thử Theo Ca Sử Dụng

#### 📝 UC-01: Đăng Nhập Hệ Thống

| # | Bước Thực Hiện | Kết Quả Mong Đợi | Pass/Fail |
|---|---------------|------------------|-----------|
| 1 | Truy cập trang đăng nhập | Form login hiển thị | |
| 2 | Nhập email/password đúng | Chuyển đến dashboard | |
| 3 | Nhập email sai | Hiện thông báo lỗi | |
| 4 | Nhập password sai | Hiện thông báo lỗi | |
| 5 | Bỏ trống fields | Validation error | |

#### 📝 UC-02: Bắt Đầu Phiên Thi

| # | Bước Thực Hiện | Kết Quả Mong Đợi | Pass/Fail |
|---|---------------|------------------|-----------|
| 1 | Click "Bắt đầu thi" | Request camera permission | |
| 2 | Cho phép camera | Preview camera hiển thị | |
| 3 | Click "Xác nhận" | Phiên thi được tạo, đếm ngược bắt đầu | |
| 4 | Calibration hoàn thành | Hiển thị câu hỏi đầu tiên | |

#### 📝 UC-03: Phát Hiện Gian Lận

| # | Hành Vi Test | Kết Quả Mong Đợi | Pass/Fail |
|---|-------------|------------------|-----------|
| 1 | Xoay đầu trái >25° | Warning overlay hiện | |
| 2 | Che mặt 5 giây | NO_FACE warning | |
| 3 | Alt+Tab ra ngoài | TAB_SWITCH warning + clip | |
| 4 | Ctrl+V paste text | PASTE warning | |
| 5 | 2 người trong frame | MULTIPLE_FACES warning | |

#### 📝 UC-04: Xem Xét Incident (Proctor)

| # | Bước Thực Hiện | Kết Quả Mong Đợi | Pass/Fail |
|---|---------------|------------------|-----------|
| 1 | Đăng nhập tài khoản Proctor | Dashboard hiển thị | |
| 2 | Xem danh sách incidents | List incidents load | |
| 3 | Click xem evidence | Modal với ảnh/video | |
| 4 | Click "Confirm" | Status → CONFIRMED | |
| 5 | Click "Reject" | Status → REJECTED | |

### 6.2. Hướng Dẫn Test Detection Logic

Chi tiết xem: **[DETECTION_LOGIC_TESTING_GUIDE.md](./DETECTION_LOGIC_TESTING_GUIDE.md)**

Tóm tắt các test scenarios:

```
LOOKING_AWAY:
├── Xoay đầu trái/phải > 25°
├── Ngẩng lên > 20° hoặc cúi xuống > 30°
├── Giữ 3s → Detection
└── 2 lần → WARN, 4 lần → SUSPICIOUS

TAB_SWITCH:
├── Alt+Tab hoặc click ra ngoài
├── Ngay lập tức → WARN
└── 3 lần → ESCALATED

MULTIPLE_FACES:
├── 2+ khuôn mặt trong frame
├── BlazeFace detect > 1 face
└── Ngay lập tức → WARN với clip

NO_FACE:
├── Che mặt hoặc ra khỏi frame
├── Face count = 0 sau 4s → WARN
└── Warning KHÔNG tự ẩn đến khi thấy mặt

PRE_SUSPICION:
├── Nhìn xuống điện thoại (pitch > 12°)
├── Liếc ngang (yaw > 15°)
├── Confidence ≥ 40 + duy trì 1.8s → Active
└── 2+ lần trong 60s → Escalate
```

---

## 7. KIỂM THỬ HIỆU NĂNG

### 7.1. Metrics Cần Đo

| Metric | Mục Tiêu | Cách Đo |
|--------|----------|---------|
| Detection latency | < 3s | Console timestamp |
| Frame processing | > 5 FPS | Performance.now() |
| API response time | < 500ms | Network tab |
| Memory usage | < 500MB | Chrome Task Manager |
| Upload time | < 5s/image | Console log |

### 7.2. Stress Test Endpoints

```bash
# Sử dụng Apache Bench hoặc k6

# Test session API
ab -n 100 -c 10 http://localhost:8080/api/sessions

# Test ingest API
ab -n 1000 -c 50 -p telemetry.json -T application/json \
   http://localhost:8080/api/ingest/telemetry?sessionId=xxx
```

### 7.3. Frontend Performance

```javascript
// Trong browser console
performance.mark('detection-start')
// ... detection code ...
performance.mark('detection-end')
performance.measure('detection-time', 'detection-start', 'detection-end')

const measures = performance.getEntriesByName('detection-time')
console.log(`Detection time: ${measures[0].duration}ms`)
```

---

## 8. CÔNG CỤ HỖ TRỢ

### 8.1. Browser DevTools

**Console Logs để theo dõi:**
```javascript
[Detection] Violation state changed: LOOKING_AWAY → WARN
[Evidence] ✅ Clip uploaded: https://minio.../clip_xxx.mp4
[PreSuspicion] 🚨 Active - pattern: phone_below (85%)
```

**Network Tab:**
- Kiểm tra API calls
- Xác nhận payload request/response
- Đo response time

### 8.2. Postman Collection

Import collection để test API:

```json
{
  "sessions": {
    "start": "POST /api/sessions/start",
    "end": "POST /api/sessions/{id}/end",
    "list": "GET /api/sessions"
  },
  "ingest": {
    "telemetry": "POST /api/ingest/telemetry",
    "snapshot": "POST /api/ingest/snapshot"
  },
  "incidents": {
    "list": "GET /api/incidents",
    "confirm": "POST /api/incidents/{id}/confirm",
    "reject": "POST /api/incidents/{id}/reject"
  }
}
```

### 8.3. Docker Compose Test Environment

```bash
# Khởi động môi trường test
docker-compose -f docker-compose.test.yml up -d

# Services included:
# - PostgreSQL (test database)
# - MinIO (object storage)
# - Redis (caching)
# - RabbitMQ (messaging)

# Chạy test
./gradlew test

# Dọn dẹp
docker-compose -f docker-compose.test.yml down -v
```

---

## 9. BÁO CÁO KIỂM THỬ

### 9.1. Template Báo Cáo

```markdown
# Báo Cáo Kiểm Thử - [Ngày]

## Tổng Quan
- Tổng số test cases: XX
- Passed: XX
- Failed: XX
- Skipped: XX
- Coverage: XX%

## Chi Tiết

### Backend Tests
| Module | Tests | Passed | Failed |
|--------|-------|--------|--------|
| Controller | 10 | 10 | 0 |
| Service | 5 | 5 | 0 |
| Security | 6 | 6 | 0 |

### Frontend Tests
| Module | Tests | Passed | Failed |
|--------|-------|--------|--------|
| Components | 8 | 8 | 0 |
| Utils | 12 | 12 | 0 |
| Integration | 2 | 2 | 0 |

## Issues Found
1. [Bug ID] - Description

## Recommendations
1. ...
```

---

*Tài liệu cập nhật: Tháng 12/2024*
