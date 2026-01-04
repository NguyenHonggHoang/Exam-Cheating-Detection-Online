# REVIEW BÁO CÁO: THESIS_DEFENSE_QA.md

## Ngày Review: 03/01/2026
## Mục đích: Xác minh Q&A bám sát vào dự án thực tế

---

## TỔNG KẾT

| Tiêu Chí | Kết Quả |
|----------|---------|
| Tổng số câu hỏi | 40 |
| Câu hỏi chính xác | 34 |
| Câu hỏi cần chỉnh sửa | 6 |
| Tỷ lệ chính xác | **85%** |

---

## CÁC SAI LỆCH CẦN SỬA

### 1. Câu 10 (Pre-Suspicion): Sai thông số threshold

**Sai lệch:**
```markdown
// Trong QA document (sai):
- phonePrep: head pitch > baseline + 25°
- sideGlance: head yaw > baseline + 20°
- Window duration để trigger: 2s (implied)

// Trong code thực tế (preSuspicionDetector.ts):
PHONE_PREP_THRESHOLDS = {
    PITCH_DOWN_DELTA: 25,      // Đúng, nhưng là delta không phải baseline+25
    YAW_DELTA: 20,             // Đúng
    WINDOW_DURATION: 2500,     // 2.5s, KHÔNG phải 1.8s như QA nói
    CONFIDENCE_THRESHOLD: 35,  // QA không đề cập đến weighted scoring
}
```

**Cần sửa trong QA:**
- Thời gian sustained: 2.5s (không phải 2s hay 1.8s)
- Thêm giải thích về weighted confidence scoring (35/100 threshold)
- Nêu rõ weights: PITCH_DOWN(25), GAZE_DOWN(20), YAW_SIDE(25), GAZE_SIDE(20)

---

### 2. Câu 9 (Looking Away): Threshold không khớp

**Sai lệch:**
```markdown
// Trong QA document:
Threshold Check: Nếu |yaw| > 25° hoặc |pitch| > 20° sustained 2.5s → Violation

// Trong code thực tế (faceAnalysis.ts - LOOK_AWAY_THRESHOLDS):
MAX_PITCH_UP: 20,
MAX_PITCH_DOWN: 30,         // DOWN là 30°, không phải 20°
MAX_YAW: 25,                // Đúng
SUSTAINED_SECONDS: 3.0,     // 3s, không phải 2.5s
```

**Cần sửa trong QA:**
- pitch up: 20°, pitch down: 30° (asymmetric)
- Sustained: 3.0s (không phải 2.5s)

---

### 3. Câu 10: Calibration duration sai

**Sai lệch:**
```markdown
// Trong QA:
Calibration (10 giây đầu): Thu thập baseline

// Trong code thực tế (preSuspicionDetector.ts):
CALIBRATION_THRESHOLDS = {
    CALIBRATION_DURATION: 30000,  // 30 giây, KHÔNG phải 10 giây
    MIN_SAMPLES: 60               // 60 samples minimum
}
```

**Cần sửa trong QA:**
- Calibration duration: 30s (không phải 10s)

---

### 4. Câu 4 (Kiến trúc): Thiếu admin-service

**Sai lệch:**
```markdown
// Trong QA: 6 services
exam-ui, bff-gateway, auth-server, session-service, incident-service, user-service

// Thực tế có thêm:
- admin-service (quản lý hệ thống)
```

**Cần sửa:** Thêm admin-service vào diagram

---

### 5. Câu 8 (AI Models): Thiếu chi tiết về landmark counts

**Sai lệch:**
```markdown
// Trong QA:
MediaPipe FaceMesh: 468 facial landmarks

// Thực tế:
MediaPipe FaceMesh: 478 facial landmarks (bao gồm 10 iris landmarks)
```

**Cần sửa:** 468 → 478 landmarks

---

### 6. Câu 21 (Latency): Detection FPS có thể khác

**Sai lệch:**
```markdown
// Trong QA:
Detection FPS: 5 FPS (200ms/frame throttled)

// Trong code (useOptimizedDetection.ts):
const fullConfig = { detectionIntervalMs: 200 }  // Default 200ms = ~5 FPS ✓

// Nhưng có thể config khác:
config = { detectionIntervalMs: customValue }
```

**Ít quan trọng:** Giá trị default đúng, nhưng có thể thay đổi

---

## CÁC ĐIỂM ĐÃ KIỂM TRA VÀ CHÍNH XÁC

✅ **Kappa Angle Correction** - Đã verify trong `faceAnalysis.ts`:
```typescript
export const KAPPA_ANGLE = {
    LEFT_EYE_HORIZONTAL: 0.05,   // ~5% nasal
    RIGHT_EYE_HORIZONTAL: -0.05, // ~5% nasal (opposite direction)
    VERTICAL: 0.02,              // ~2% upward
};
```

✅ **One Euro Filter** - Đã verify trong `oneEuroFilter.ts`:
- OneEuroFilter, OneEuroFilter2D, OneEuroFilter3D classes tồn tại
- createIrisFilter(), createHeadPoseFilter() factory functions

✅ **calculateEffectiveGaze** - Đã verify trong `faceAnalysis.ts`:
- Kết hợp headPose + irisGaze
- Dynamic distance adjustment

✅ **InsightFace** - Đã verify trong `ai-worker/face_verifier.py`:
```python
import insightface
from insightface.app import FaceAnalysis
```

✅ **Pre-Suspicion Weighted Scoring** - Đã verify:
```typescript
WEIGHTS: {
    PITCH_DOWN: 25,
    GAZE_DOWN: 20,
    YAW_SIDE: 25,
    GAZE_SIDE: 20,
    DISTANCE_CHANGE: 15,
    BLINK_SUPPRESSED: 10,
    FACE_STABLE: 5
}
```

✅ **Composite Violation Detection** - Đã verify trong `compositeViolationDetector.ts`

✅ **LiveKit Egress** - Được đề cập trong nhiều files

---

## KHUYẾN NGHỊ

### Ưu tiên 1: Sửa các con số sai
1. Calibration: 10s → 30s
2. Sustained Looking Away: 2.5s → 3.0s
3. Pre-Suspicion Window: 1.8s → 2.5s
4. FaceMesh landmarks: 468 → 478

### Ưu tiên 2: Bổ sung chi tiết
1. Thêm admin-service vào kiến trúc
2. Giải thích weighted scoring chi tiết hơn
3. Nêu rõ asymmetric pitch thresholds (up: 20°, down: 30°)

### Ưu tiên 3: Cập nhật diagram
- Thêm admin-service
- Cập nhật số liệu FaceMesh

---

## KẾT LUẬN

Document Q&A **85% chính xác** và bám sát vào dự án. Các sai lệch chủ yếu là:
- Số liệu threshold outdated (code đã update, QA chưa)
- Một số con số làm tròn hoặc estimate

**Khuyến nghị:** Update 6 điểm sai lệch trước khi bảo vệ để tránh bị hỏi chi tiết.

---

*Review bởi: Antigravity AI Assistant*
*Ngày: 03/01/2026*
