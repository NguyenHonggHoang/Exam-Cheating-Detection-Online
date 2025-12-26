# Detection Logic Testing Guide

Hướng dẫn test các logic detection, warning, upload evidence, và pre-suspicion video trong hệ thống.

## 📊 1. VIOLATION STATE MACHINE

### 1.1. Luồng xử lý vi phạm

```
Detection → State Machine → Warning → Evidence Capture → Upload
```

### 1.2. Các trạng thái (States)

| State | Ý nghĩa | Khi nào |
|-------|---------|---------|
| `OK` | Bình thường | count = 0 hoặc < warningThreshold |
| `WARN` | Cảnh báo | count >= warningThreshold |
| `SUSPICIOUS` | Nghi ngờ | count >= suspiciousThreshold |
| `ESCALATED` | Nghiêm trọng | count >= escalatedThreshold |

### 1.3. Cấu hình cho từng loại vi phạm

#### **LOOKING_AWAY** (Nhìn ra ngoài)
```javascript
{
  severity: 'LOW',
  debounceMs: 3000,        // 3s giữa mỗi detection
  warningThreshold: 2,     // 2 lần → WARN
  suspiciousThreshold: 4,  // 4 lần → SUSPICIOUS
  escalatedThreshold: 6    // 6 lần → ESCALATED
}
```

**Cách test:**
1. Xoay đầu trái/phải > 25° hoặc lên/xuống > 20°
2. Giữ tư thế 5s → detection đầu tiên
3. Xoay lại sau 3s → detection thứ 2 → **WARN** → Hiện warning overlay
4. Tiếp tục 2 lần nữa → **SUSPICIOUS**
5. Tiếp tục 2 lần nữa → **ESCALATED**

**Evidence:**
- WARN: Snapshot (ảnh tĩnh)
- SUSPICIOUS/ESCALATED: Clip (video 10s)

#### **TAB_SWITCH** (Chuyển tab)
```javascript
{
  severity: 'HIGH',
  debounceMs: 0,           // Không debounce - bắt mọi lần
  warningThreshold: 1,     // 1 lần → WARN
  suspiciousThreshold: 2,  // 2 lần → SUSPICIOUS
  escalatedThreshold: 3    // 3 lần → ESCALATED
}
```

**Cách test:**
1. Nhấn `Alt+Tab` hoặc click ra ngoài Chrome → **WARN** ngay lập tức
2. Chuyển lại 1 lần nữa → **SUSPICIOUS**
3. Chuyển lần thứ 3 → **ESCALATED**

**Evidence:**
- Ngay cả ở WARN vẫn capture **CLIP** (vì severity = HIGH)

#### **MULTIPLE_FACES** (Nhiều người)
```javascript
{
  severity: 'HIGH',
  debounceMs: 3000,
  warningThreshold: 1,     // 1 lần → WARN
  suspiciousThreshold: 2,
  escalatedThreshold: 3
}
```

**Cách test:**
1. Cho người thứ 2 vào frame camera
2. Face detection nhận > 1 face → **WARN** ngay
3. Tiếp tục sau 3s → **SUSPICIOUS**

#### **NO_FACE** (Không thấy mặt)
```javascript
{
  severity: 'MEDIUM',
  debounceMs: 4000,
  warningThreshold: 2,     // Cần 2 lần mới WARN
  suspiciousThreshold: 4,
  escalatedThreshold: 6
}
```

**Cách test:**
1. Che mặt hoặc ra ngoài frame
2. Detection đầu tiên - chưa warning
3. Sau 4s, vẫn không thấy mặt → **WARN**
4. Warning **KHÔNG tự động ẩn** cho đến khi face detected lại

#### **PASTE** (Dán text)
```javascript
{
  severity: 'HIGH',
  debounceMs: 0,
  warningThreshold: 1,     // 1 lần paste → WARN
  suspiciousThreshold: 1,  // Nghi ngờ cao ngay
  escalatedThreshold: 2
}
```

**Cách test:**
1. `Ctrl+V` trong textarea câu trả lời → **WARN** + **SUSPICIOUS** cùng lúc
2. Event listener bắt paste event
3. Capture CLIP ngay lập tức

#### **BLUR** (Window mất focus)
```javascript
{
  severity: 'MEDIUM',
  debounceMs: 1000,
  warningThreshold: 2,
  suspiciousThreshold: 4,
  escalatedThreshold: 6
}
```

**Cách test:**
1. Click ra Desktop hoặc app khác
2. Window blur event → count++
3. Sau 2 lần → **WARN**
4. Có thể phát hiện split-screen nếu blur/focus nhanh

---

## 🎥 2. EVIDENCE CAPTURE

### 2.1. Khi nào capture evidence?

```typescript
shouldCaptureEvidence(type: ViolationType): 'snapshot' | 'clip' | null
```

**Cooldown giữa các lần capture (tránh spam):**
- LOW severity: 30s
- MEDIUM severity: 20s
- HIGH severity: 10s

### 2.2. Quy tắc capture

| State | Evidence Type | Điều kiện |
|-------|---------------|-----------|
| WARN | Snapshot | Mọi violation |
| WARN | **Clip** | Nếu severity = HIGH (TAB_SWITCH, PASTE, MULTIPLE_FACES) |
| SUSPICIOUS | Clip | Mọi violation |
| ESCALATED | Clip | Mọi violation |

### 2.3. Luồng upload evidence

#### **Option 1: LiveKit Egress (Preferred)**
```
Violation detected → StateMachine.shouldCaptureEvidence()
→ Returns 'clip'
→ Call captureSnapshot() with clipSeconds
→ LiveKit Egress API clips video from ongoing stream
→ Get egress_id and wait for completion
→ Download video from Egress storage
→ Upload to MinIO
→ Return public URL
```

**Test Egress recording:**
1. Start exam → LiveKit room được tạo + Egress recording bắt đầu
2. Trigger violation → Check logs:
```
[Evidence] 🎬 Requesting clip from Egress
[Evidence] Egress clip requested: egress_id=...
[Evidence] ⏳ Waiting for Egress clip completion...
[Evidence] ✅ Clip uploaded: https://minio.../clip_...mp4
```

#### **Option 2: Local recording (Fallback)**
Nếu Egress không available hoặc fail:
```
→ createClip(preBuffer, postBuffer)
→ Uses buffer của frames đã ghi trước đó
→ Upload blob to MinIO
```

**Cấu hình buffer:**
- `clipPreBuffer`: 5s (5 giây trước vi phạm)
- `clipPostBuffer`: 5s (5 giây sau vi phạm)
- Total: 10s clip

### 2.4. Test upload flow

**Test thành công:**
```bash
# 1. Start MinIO
docker-compose up -d minio

# 2. Trigger violation → Check console
[StateMachine] → Capture CLIP for TAB_SWITCH
[Evidence] 🎬 Requesting clip from Egress
[Evidence] ✅ Clip uploaded: https://...

# 3. Verify file in MinIO
# Browser: http://localhost:9001
# Bucket: exam-evidence/clips/
```

**Test failure scenarios:**
```javascript
// Nếu Egress fail → fallback to local
[Evidence] Egress clip failed: timeout
[Evidence] Falling back to local recording...
[Evidence] ✅ Local clip uploaded

// Nếu upload fail → retry logic
[Evidence] Upload failed (attempt 1/3)
[Evidence] Retrying in 2s...
```

---

## 🚨 3. WARNING OVERLAY

### 3.1. Khi nào hiển thị warning?

```typescript
onViolation: (type, severity) => {
  if (severity !== 'OK') {
    setShowWarningOverlay(true);
  }
}
```

**State machine gọi callback này khi:**
- Violation được detected VÀ qua debounce
- State != 'OK' (tức là WARN, SUSPICIOUS, hoặc ESCALATED)

### 3.2. Auto-hide logic

| Violation Type | Auto-hide? | Duration |
|----------------|------------|----------|
| NO_FACE | ❌ Không | Cho đến khi face detected |
| LOOKING_AWAY | ✅ Có | WARN: 3s, SUSPICIOUS: 5s, ESCALATED: không ẩn |
| TAB_SWITCH | ✅ Có | WARN: 3s, SUSPICIOUS: 5s |
| MULTIPLE_FACES | ✅ Có | WARN: 3s, SUSPICIOUS: 5s |
| PASTE | ✅ Có | WARN: 3s, SUSPICIOUS: 5s |

### 3.3. Test warning overlay

1. Trigger violation (e.g., TAB_SWITCH)
2. Warning overlay xuất hiện với message: "Tab switching detected!"
3. Đếm thời gian:
   - WARN → 3s tự ẩn
   - SUSPICIOUS → 5s tự ẩn
   - ESCALATED → không tự ẩn (phải acknowledge)
4. Click "I Understand" để đóng manually

**UI Location:**
```tsx
{showWarningOverlay && currentViolation && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    <AlertTriangle className="w-16 h-16 text-red-500" />
    <h2>{currentViolation.message}</h2>
    <p>Severity: {currentViolation.severity}</p>
    <button onClick={() => setShowWarningOverlay(false)}>
      I Understand
    </button>
  </div>
)}
```

---

## 🔍 4. PRE-SUSPICION DETECTION

### 4.1. Concept

**Pre-suspicion** = phát hiện **hành vi chuẩn bị gian lận** trước khi thực sự gian lận.

**Ví dụ:**
- Nhìn xuống dưới (kiểm tra điện thoại)
- Nghiêng đầu sang trái (nhìn giấy bên cạnh)
- Micro-pause pattern (dừng đều đặn để đọc từ nguồn khác)

### 4.2. Calibration phase

**Khi bắt đầu exam:**
```
1. 5s countdown: "Get ready..."
2. 10s calibration: "Look at the screen naturally"
   - Record baseline head pose
   - Record baseline iris gaze
   - Calculate thresholds
3. Start exam with personalized thresholds
```

**Test calibration:**
```javascript
// Check logs
[PreSuspicion] Starting calibration...
[PreSuspicion] Calibration: sample 1/10
...
[PreSuspicion] ✅ Calibration complete
[PreSuspicion] Baseline: pitch=-5.2° yaw=1.3° iris_h=0.02
```

### 4.3. Detection signals

#### Signal 1: Head pose delta
```javascript
const headDelta = {
  pitch: Math.abs(currentPitch - baselinePitch),
  yaw: Math.abs(currentYaw - baselineYaw)
};

// Looking down to phone
if (headDelta.pitch > 15 && currentPitch > 0) {
  signal.phonePrep = true;
}
```

**Test:**
1. Hoàn thành calibration
2. Nhìn xuống dưới 15-20°
3. Check console:
```
[PreSuspicion] Signal: phonePrep=true (pitch delta=18.3°)
```

#### Signal 2: Gaze direction (iris)
```javascript
// Looking down via eyes only (head stable)
if (irisGaze.verticalGaze > 0.3) {  // Eyes looking down
  signal.eyesDown = true;
}
```

**Test:**
1. Giữ đầu thẳng
2. Chỉ nhìn xuống bằng mắt
3. Iris tracking detect vertical gaze > 0.3

#### Signal 3: Combined head + iris (Effective Gaze)
```javascript
const effectiveGaze = {
  pitch: headPose.pitch + (irisGaze.vertical * 15),
  yaw: headPose.yaw + (irisGaze.horizontal * 10)
};
```

**Giờ hiển thị real-time bên camera:**
```
Head pose: pitch=14.3° yaw=2.3°
Iris: h=-0.04 v=-0.15
Effective gaze: pitch=9.7° yaw=1.1°
Face dist: 1.05x (68px)
Screen: 1920x1080 (16:9) DPR:1
```

#### Signal 4: Face Distance (NEW)
**Ảnh hưởng đến detection:**
- **Gần camera (>1.2x baseline)**: Stricter thresholds (giảm 20%)
  - Vì movements nhỏ cũng rất rõ ràng trên camera
  - Example: Ở gần, xoay đầu 20° trông như 25° khi xa
- **Xa camera (<0.8x baseline)**: Looser thresholds (tăng 30%)
  - Cần movements lớn hơn để detect rõ ràng
  - Example: Ở xa, phải xoay 35° mới tương đương 25° khi gần

**Cách tính:**
- Interocular distance (khoảng cách giữa 2 mắt) làm proxy cho depth
- Distance càng lớn (px) = càng gần camera
- Relative = current / baseline (1.0 = baseline từ calibration)

**Test distance adjustment:**
```javascript
// Test 1: Di chuyển gần camera
// Face dist: 1.25x → Thresholds giảm 20%
// MAX_YAW: 25° → 20° (stricter)

// Test 2: Di chuyển xa camera  
// Face dist: 0.75x → Thresholds tăng 30%
// MAX_YAW: 25° → 32.5° (looser)

// Check logs:
[LookAway] User very close to camera (1.25x) - stricter thresholds (x0.8)
[LookAway] User far from camera (0.75x) - looser thresholds (x1.3)
```

#### Signal 5: Screen Metrics (NEW)
**Ảnh hưởng đến detection:**
- **Screen size**: Larger screens → user sits farther
  - 27" monitor vs 13" laptop → farther distance
- **Aspect ratio**: Different ratios affect viewing angle
  - 16:9 (widescreen) vs 4:3 (square) → different head movements
  - Ultrawide (21:9) → more horizontal head movement to see edges
- **Device Pixel Ratio (DPR)**: High-res displays (Retina, 4K)
  - DPR=2 (Retina MacBook) → sharper detection possible
  - DPR=1 (standard display) → may need more tolerance

**Cách sử dụng:**
```javascript
// Log screen metrics once at start
Screen: 1920x1080 (16:9) DPR:1      // Standard Full HD
Screen: 2560x1440 (16:9) DPR:1      // 2K QHD
Screen: 3840x2160 (16:9) DPR:2      // 4K Retina
Screen: 2560x1080 (21:9) DPR:1      // Ultrawide
Screen: 1440x900 (16:10) DPR:2      // MacBook Pro 13"
```

**Test cases:**
1. **Small screen (laptop 13-15")**: User typically closer
2. **Large monitor (24"+)**: User typically farther
3. **Ultrawide**: More horizontal head movement expected
4. **High DPR**: More precise detection possible

**Future improvements** (not implemented yet):
- Auto-adjust MAX_YAW based on screen width
- Different thresholds for ultrawide vs standard ratio
- Use DPR to adjust confidence thresholds

### 4.4. Pattern detection

```javascript
// Pattern: "Phone prep"
conditions: [
  { signal: 'phonePrep', duration: 2000 },      // Looking down 2s
  { signal: 'microPause', count: 2 }            // 2 pauses (reading)
]
confidence: 85%
```

**Khi pattern detected:**
1. `preSuspicion.isActive = true`
2. Log: `[PreSuspicion] 🚨 Active - pattern: phone_prep (85%)`
3. Record to composite detector
4. Mark answers submitted during pre-suspicion

### 4.5. Composite violation detection

**Composite pattern** = kết hợp nhiều event trong time window:

```javascript
// Pattern: "Split screen usage"
{
  pattern: 'SPLIT_SCREEN_USAGE',
  timeWindow: 30000,  // 30s
  events: [
    { type: 'BLUR', minCount: 5 },           // 5+ blur events
    { type: 'PRE_SUSPICION', minCount: 1 },  // 1+ pre-suspicion
    { type: 'TAB_SWITCH', minCount: 1 }      // 1+ tab switch
  ],
  confidence: 95%
}
```

**Test composite:**
1. Trigger 5 blur events trong 30s
2. Trigger 1 pre-suspicion (looking down)
3. Switch tab 1 lần
4. → Pattern detected:
```
[CompositeDetector] 🚨 PATTERN DETECTED: SPLIT_SCREEN_USAGE (95% confidence)
Description: Rapidly switching between windows while showing pre-suspicion behavior
```

### 4.6. Pre-suspicion video recording

**Flow:**
```
1. Pre-suspicion detected → preSuspicion.isActive = true
2. Record event to CompositeDetector with metadata
3. If composite pattern triggered → capture evidence
4. Answer submitted during pre-suspicion → marked with flag
5. Backend analysis: answers submitted after pre-suspicion
```

**KHÔNG có dedicated "pre-suspicion video"** như riêng biệt. Thay vào đó:
- Pre-suspicion events được ghi vào timeline
- Nếu có composite pattern → capture clip của toàn bộ sequence
- Clip này chứa cả pre-suspicion behavior + actual violation

---

## 📋 5. TESTING CHECKLIST

### 5.1. Basic violations

- [ ] LOOKING_AWAY: Xoay đầu trái/phải/lên/xuống
- [ ] NO_FACE: Che mặt hoặc ra khỏi frame
- [ ] MULTIPLE_FACES: 2 người vào frame
- [ ] TAB_SWITCH: Alt+Tab hoặc click ra ngoài
- [ ] PASTE: Ctrl+V trong textarea
- [ ] BLUR: Click ra Desktop

### 5.2. State transitions

- [ ] OK → WARN: Check warning overlay hiển thị
- [ ] WARN → SUSPICIOUS: Check severity tăng
- [ ] SUSPICIOUS → ESCALATED: Check message nghiêm trọng hơn
- [ ] Auto-hide: WARN (3s), SUSPICIOUS (5s)
- [ ] NO_FACE không tự ẩn

### 5.3. Evidence capture

- [ ] WARN + LOW severity → Snapshot
- [ ] WARN + HIGH severity → Clip
- [ ] SUSPICIOUS → Clip
- [ ] ESCALATED → Clip
- [ ] Cooldown: không capture quá nhiều lần trong thời gian ngắn
- [ ] LiveKit Egress: clip từ stream recording
- [ ] Local fallback: clip từ buffer

### 5.4. Upload

- [ ] MinIO upload thành công
- [ ] Public URL trả về
- [ ] File có thể access được
- [ ] Retry logic khi fail

### 5.5. Pre-suspicion

- [ ] Calibration: 10s hoàn thành
- [ ] Baseline được lưu
- [ ] Signal detection: phonePrep, eyesDown
- [ ] Pattern detection: phone_prep, side_glance
- [ ] Composite patterns: split_screen, frequent_switching
- [ ] Answer marking: hadPreSuspicionDuring = true

### 5.6. Real-time display

- [ ] 3 dòng params hiển thị bên camera:
  - Head pose: pitch=X° yaw=Y°
  - Iris: h=X v=Y
  - Effective gaze: pitch=X° yaw=Y°
- [ ] Update real-time mỗi frame
- [ ] Giá trị chính xác (không truncate)

---

## 🔧 6. DEBUG COMMANDS

### Check state machine
```javascript
// Trong browser console
window.stateMachine = getViolationStateMachine();
console.log(window.stateMachine.getStats());
// Output: { LOOKING_AWAY: { count: 3, state: 'SUSPICIOUS' }, ... }
```

### Check buffer status
```javascript
console.log(bufferStatus);
// { size: 150, duration: 5.0, isBuffering: false }
```

### Force capture
```javascript
// Trigger manual snapshot
captureSnapshot();

// Check if evidence pending
console.log(uploading);  // true/false
```

### Check pre-suspicion
```javascript
console.log(preSuspicion.isActive);        // true/false
console.log(preSuspicion.result?.pattern); // 'phone_prep'
console.log(preSuspicion.result?.confidence); // 85
```

---

## 📊 7. MONITORING & LOGS

### Console logs to watch

**Detection:**
```
[Detection] Violation state changed: LOOKING_AWAY → WARN
[StateMachine] LOOKING_AWAY: count=2 state=OK→WARN
[StateMachine] → Capture SNAPSHOT for LOOKING_AWAY
```

**Evidence:**
```
[Evidence] 🎬 Requesting clip from Egress
[Evidence] Egress clip requested: egress_id=...
[Evidence] ⏳ Waiting for clip completion (0s)...
[Evidence] ✅ Clip uploaded: https://minio.../clip_123.mp4
```

**Pre-suspicion:**
```
[PreSuspicion] Signal: phonePrep=true gazeDelta=18.3°
[PreSuspicion] 🚨 Active - pattern: phone_prep (85%)
[CompositeDetector] Recorded: PRE_SUSPICION
```

**Composite:**
```
[CompositeDetector] 🚨 PATTERN DETECTED: SPLIT_SCREEN_USAGE (95%)
[CompositeDetector] Events: BLUR(5) PRE_SUSPICION(1) TAB_SWITCH(1)
```

---

## ✅ EXPECTED BEHAVIOR SUMMARY

1. **Violation Detection** → State Machine increments count
2. **State Transition** → onViolation callback → Warning overlay
3. **Evidence Capture** → shouldCaptureEvidence → snapshot/clip
4. **Upload** → LiveKit Egress (or local fallback) → MinIO → public URL
5. **Pre-suspicion** → Pattern detection → Mark answers → Composite analysis
6. **Reporting** → All events sent to backend for incident analysis

**Toàn bộ flow được log chi tiết trong console để debug dễ dàng!**
