# Fix: Egress Video Recording - Lưu Video URL vào Incident

## 📋 Vấn Đề

Khi egress recording hoàn thành (vi phạm nặng hoặc pre-suspicion), video URL và objectKey không được lưu vào incident database. Trang video-analysis (`/proctor/video-analysis`) chỉ hiển thị snapshot thay vì video.

## 🔍 Phân Tích

### Flow Hiện Tại (Trước Khi Sửa)

1. **Frontend phát hiện vi phạm:**
   - `useOptimizedDetection` phát hiện vi phạm
   - Gọi `triggerEgressRecording()` để bắt đầu recording
   - Gửi event `EGRESS_RECORDING_STARTED` đến incident service (chỉ có egressId, không có video URL)

2. **Egress recording hoàn thành:**
   - LiveKit gửi webhook đến `/api/egress/webhook`
   - `EgressService.handleEgressWebhook()` được gọi
   - Video được lưu vào MinIO với path: `sessions/{sessionId}/clips/{violationType}_{timestamp}.mp4`
   - **VẤN ĐỀ:** Video URL và objectKey không được gửi đến incident service

3. **Incident được tạo:**
   - Chỉ có snapshot URL (nếu có)
   - Không có video URL
   - Trang video-analysis hiển thị snapshot thay vì video

### Flow Sau Khi Sửa

1. **Frontend phát hiện vi phạm:** (giữ nguyên)
   - Gọi `triggerEgressRecording()`
   - Gửi event `EGRESS_RECORDING_STARTED`

2. **Egress recording hoàn thành:**
   - LiveKit gửi webhook
   - `EgressService.handleEgressWebhook()` được gọi
   - **MỚI:** Gọi `sendEgressCompletedEvent()` để gửi event đến incident service
   - Event type: `EVIDENCE_CLIP`
   - Bao gồm: `evidenceUrl`, `objectKey`, `fileSize`

3. **Incident được tạo/cập nhật:**
   - Incident mới được tạo với video URL và objectKey
   - Trang video-analysis hiển thị video từ MinIO

## 🔧 Các Thay Đổi

### 1. EgressService.java

**File:** `services/session-service/src/main/java/com/example/exam/service/EgressService.java`

**Thay đổi:**
- Thêm `RestTemplate` và `RestTemplateBuilder` dependency
- Thêm `incidentServiceUrl` property (default: `http://incident-service:8082`)
- Thêm method `sendEgressCompletedEvent()` để gửi HTTP POST đến incident service
- Sửa `handleEgressWebhook()` để gọi `sendEgressCompletedEvent()` khi egress hoàn thành
- Sửa `handleEgressComplete()` để gọi `sendEgressCompletedEvent()` khi egress hoàn thành

**Logic mới:**
```java
private void sendEgressCompletedEvent(EgressInfo info, String publicUrl, String objectKey, long fileSize) {
    // Build client event request
    Map<String, Object> request = new HashMap<>();
    request.put("sessionId", info.sessionId.toString());
    request.put("eventType", "EVIDENCE_CLIP");
    request.put("violationType", info.violationType != null ? info.violationType : "UNKNOWN");
    request.put("violationState", "ESCALATED");
    request.put("evidenceUrl", publicUrl);
    request.put("objectKey", objectKey);  // Critical: objectKey for MinIO access
    request.put("fileSize", fileSize);
    request.put("timestamp", info.startTime);
    request.put("source", "EGRESS_RECORDING");
    
    // Send HTTP POST to incident service
    String url = incidentServiceUrl + "/api/incident/client-event";
    // ... HTTP request
}
```

**ObjectKey format:**
- Từ `outputPath`: `sessions/{sessionId}/clips/{violationType}_{timestamp}.mp4`
- ObjectKey: `{evidenceBucket}/{outputPath}`
- Ví dụ: `exam-evidence/sessions/123/clips/looking_away_1234567890.mp4`

### 2. EvidenceViewer.tsx

**File:** `frontends/exam-ui/src/components/EvidenceViewer.tsx`

**Kiểm tra:**
- `isVideoFormat()` đã detect video đúng từ objectKey
- Logic detect: kiểm tra extension `.mp4`, `.webm`, `.ogg` hoặc từ khóa `clip` trong path
- ObjectKey có format `exam-evidence/sessions/.../clips/...mp4` → sẽ được detect là video

**Không cần sửa:** Logic hiện tại đã đúng.

## 📊 Test Cases

### Test Case 1: Egress Recording Hoàn Thành

**Input:**
- Egress recording hoàn thành với status `EGRESS_COMPLETE`
- OutputPath: `sessions/{sessionId}/clips/LOOKING_AWAY_1234567890.mp4`
- FileSize: 1024000 bytes

**Expected:**
- Event được gửi đến incident service với:
  - `eventType`: `EVIDENCE_CLIP`
  - `evidenceUrl`: `http://localhost:9002/exam-evidence/sessions/.../clips/...mp4`
  - `objectKey`: `exam-evidence/sessions/.../clips/...mp4`
  - `fileSize`: 1024000
- Incident mới được tạo với video URL và objectKey
- Trang video-analysis hiển thị video player

### Test Case 2: Pre-Suspicion Egress

**Input:**
- Pre-suspicion detection trigger egress recording
- ViolationType: `PRE_SUSPICIOUS_phone_below`
- Egress recording hoàn thành

**Expected:**
- Event được gửi với `violationType`: `PRE_SUSPICIOUS_phone_below`
- Incident được tạo với video URL
- Video được hiển thị ở trang video-analysis

### Test Case 3: EvidenceViewer Detect Video

**Input:**
- Incident có `objectKey`: `exam-evidence/sessions/123/clips/looking_away_1234567890.mp4`
- `evidenceUrl`: proxy URL hoặc MinIO URL

**Expected:**
- `isVideoFormat()` return `true` (vì có extension `.mp4` và từ khóa `clips`)
- EvidenceViewer hiển thị `<video>` element thay vì `<img>`
- Video player có controls (play, pause, seek)

## 🔍 Các File Đã Sửa

1. `services/session-service/src/main/java/com/example/exam/service/EgressService.java`
   - Thêm `sendEgressCompletedEvent()` method
   - Sửa `handleEgressWebhook()` và `handleEgressComplete()`
   - Thêm `RestTemplate` dependency

## ✅ Kết Quả

Sau khi sửa:
- ✅ Egress recording hoàn thành → gửi event đến incident service
- ✅ Video URL và objectKey được lưu vào incident database
- ✅ Trang video-analysis hiển thị video từ MinIO thay vì snapshot
- ✅ EvidenceViewer detect video format đúng từ objectKey

## 📝 Notes

1. **Incident Duplication:**
   - Hiện tại, mỗi egress recording sẽ tạo incident mới
   - Nếu đã có snapshot incident trước đó, sẽ có 2 incidents (snapshot + video)
   - Có thể cải thiện sau bằng cách tìm và update incident đã tồn tại

2. **Error Handling:**
   - `sendEgressCompletedEvent()` có try-catch để không block egress completion
   - Nếu gửi event fail, chỉ log error, không throw exception

3. **Configuration:**
   - `incident-service.url` có thể config qua `application.yml`:
     ```yaml
     incident-service:
       url: http://incident-service:8082
     ```
   - Default: `http://incident-service:8082`

## 🚀 Testing

1. **Start services:**
   ```bash
   docker-compose up -d
   ```

2. **Trigger egress recording:**
   - Mở exam page
   - Phát hiện vi phạm (LOOKING_AWAY, MULTIPLE_FACES, etc.)
   - Egress recording sẽ tự động bắt đầu

3. **Check incident:**
   - Mở `/proctor/violations`
   - Tìm incident mới được tạo
   - Click vào incident → `/proctor/video-analysis/{incidentId}`
   - Verify video được hiển thị thay vì snapshot

4. **Check logs:**
   - Session-service logs: `Egress completed event sent to incident service`
   - Incident-service logs: `Incident created from client event`

