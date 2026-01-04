# CÂU HỎI VÀ TRẢ LỜI BẢO VỆ KHÓA LUẬN TỐT NGHIỆP

## Đề tài: HỆ THỐNG PHÁT HIỆN GIAN LẬN THI CỬ TRỰC TUYẾN
### (Online Exam Cheating Detection System)

---

## PHẦN A: CÂU HỎI TỔNG QUAN VÀ LÝ DO CHỌN ĐỀ TÀI

### Câu 1: Vì sao bạn chọn đề tài này? Tính cấp thiết của đề tài như thế nào?

**Trả lời:**

Đề tài được chọn dựa trên 3 lý do chính:

1. **Nhu cầu thực tiễn sau COVID-19**: Theo EDUCAUSE (2022), hơn 73% cơ sở giáo dục đại học Mỹ duy trì thi trực tuyến sau đại dịch. Nghiên cứu KPMG (2021) cho thấy 30-40% thí sinh thừa nhận từng gian lận trong môi trường online.

2. **Chi phí giám thị thủ công cao**: Chi phí $15-25/phiên thi khiến nhiều tổ chức nhỏ không thể triển khai, tạo khoảng trống cho giải pháp tự động hóa.

3. **Khoảng trống công nghệ**: Các hệ thống hiện tại hoặc quá đơn giản (rule cứng nhắc) hoặc quá phức tạp (cần giám thị xem full-time). Cần giải pháp **hybrid** kết hợp rule-based với AI hỗ trợ.

---

### Câu 2: Mục tiêu chính của đồ án là gì?

**Trả lời:**

Đồ án có 7 mục tiêu cụ thể với chỉ tiêu định lượng:

| # | Mục tiêu | Chỉ tiêu định lượng | Kết quả đạt được |
|---|----------|---------------------|------------------|
| 1 | Phát hiện No-Face | ≥95% chính xác, latency <3s | ~97% |
| 2 | Phát hiện Multi-Face | ≥90% chính xác, latency <3s | ~93% |
| 3 | Phát hiện Tab Abuse | 100% capture | ✅ |
| 4 | Phát hiện Paste | 100% ghi nhận | ✅ |
| 5 | Pre-Suspicion Detection | Phát hiện sớm hành vi nghi vấn | ~85% precision |
| 6 | Evidence Collection | 100% incident có ảnh/video | ✅ |
| 7 | Review Workflow | Proctor xác nhận <30s/incident | ✅ |

---

### Câu 3: Đề tài có gì mới so với các hệ thống hiện có (Proctorio, ProctorU)?

**Trả lời:**

| Tiêu chí | Proctorio/ExamSoft | Đề tài này |
|----------|-------------------|------------|
| **Mã nguồn** | Proprietary | Mở, có thể tùy biến |
| **Detection** | AI hoàn toàn (false positive cao) | Hybrid rule-based + AI |
| **Pre-suspicion** | Không có | Có - phát hiện hành vi chuẩn bị gian lận |
| **Review workflow** | Cơ bản | Đầy đủ với SSE real-time notification |
| **Evidence** | Screenshot | Snapshot + Video clip (Egress) |
| **Kiến trúc** | Monolithic | Microservices, dễ scale |
| **Chi phí** | $15-25/phiên | Self-hosted, không phí per-session |

**Đóng góp mới:**
- **Multi-signal Fusion**: Kết hợp head pose + iris gaze + face distance với weighted scoring
- **Kappa Angle Correction**: Hiệu chỉnh góc Kappa (~5°) cho gaze estimation chính xác hơn
- **Temporal Pattern Analysis**: Phân tích hành vi theo thời gian

---

## PHẦN B: CÂU HỎI VỀ KIẾN TRÚC HỆ THỐNG

### Câu 4: Mô tả kiến trúc tổng thể của hệ thống?

**Trả lời:**

Hệ thống sử dụng kiến trúc **microservices** với 6 services chính:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  exam-ui     │───▶│ bff-gateway  │───▶│ auth-server  │
│  (React)     │    │  (Next.js)   │    │ (Spring)     │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│session-service│   │incident-service│  │ user-service │
│  (Spring)    │    │  (Spring)     │   │  (Spring)    │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Các layer:**
- **Frontend**: React + TensorFlow.js + LiveKit SDK
- **Gateway**: BFF (Backend-for-Frontend) với Express.js
- **Backend**: Spring Boot microservices
- **AI**: Python workers (InsightFace, DeepFace)
- **Infrastructure**: LiveKit (WebRTC), MinIO (Object Storage), RabbitMQ, PostgreSQL

---

### Câu 5: Tại sao chọn kiến trúc microservices thay vì monolithic?

**Trả lời:**

| Tiêu chí | Monolithic | Microservices (đã chọn) |
|----------|------------|-------------------------|
| **Scalability** | Toàn bộ app | Scale từng service riêng |
| **Độc lập deploy** | Không | Có - CI/CD riêng mỗi service |
| **Fault isolation** | Crash = down all | Crash 1 service không ảnh hưởng khác |
| **Tech stack** | Một ngôn ngữ | Đa ngôn ngữ (Java, Python, TypeScript) |
| **Team work** | Xung đột code | Mỗi team 1 service |

**Lý do cụ thể:**
1. **AI Worker cần Python**: Face verification dùng InsightFace/PyTorch - không thể chạy trong Spring Boot
2. **Scale độc lập**: Incident Service có thể scale riêng khi có nhiều violation
3. **Real-time requirements**: LiveKit, SSE cần tối ưu riêng

---

### Câu 6: BFF Gateway là gì và tại sao cần nó?

**Trả lời:**

**BFF (Backend-for-Frontend)** là layer trung gian giữa frontend và backend services.

**Chức năng chính:**
1. **API Aggregation**: Gom nhiều request thành 1 (giảm latency)
2. **Authentication**: Validate JWT, refresh tokens
3. **Rate Limiting**: Chống spam/DDoS
4. **Request routing**: Điều hướng /api/sessions → Session Service, /api/incidents → Incident Service

**Tại sao không để Frontend gọi thẳng Backend?**
- **Security**: Không expose internal service addresses
- **CORS**: BFF xử lý CORS tập trung
- **Token management**: BFF quản lý session, cookies

---

### Câu 7: Hệ thống giao tiếp giữa các service như thế nào?

**Trả lời:**

Có 3 patterns giao tiếp:

**1. Synchronous (REST API):**
```
Frontend → BFF → Session Service → PostgreSQL
```
Dùng cho: CRUD operations, authentication

**2. Asynchronous (Message Queue - RabbitMQ):**
```
Session Service → RabbitMQ → AI Worker → RabbitMQ → Incident Service
```
Dùng cho: AI processing (face verification) - không block request

**3. Event-Driven (SSE - Server-Sent Events):**
```
Incident Service → SSE → Proctor Dashboard
```
Dùng cho: Real-time notifications khi có violation mới

**4. CDC (Change Data Capture - Debezium):**
```
identity_db.users → Debezium → Kafka → session_service.user_shadow
```
Dùng cho: Sync data giữa các service databases

---

## PHẦN C: CÂU HỎI VỀ AI VÀ DETECTION LOGIC

### Câu 8: Hệ thống sử dụng những mô hình AI nào?

**Trả lời:**

| Mô hình | Công dụng | Vị trí chạy | Hiệu suất |
|---------|-----------|-------------|-----------|
| **BlazeFace** | Face detection | Client (TensorFlow.js) | ~20ms/frame |
| **MediaPipe FaceMesh** | 478 facial landmarks | Client (TensorFlow.js) | ~30ms/frame |
| **MediaPipe Iris** | 10 iris landmarks | Client (TensorFlow.js) | Included in FaceMesh |
| **ArcFace/InsightFace** | Face verification | Server (Python) | ~100ms/face |

**Tại sao chạy AI trên client?**
1. **Privacy**: Video không gửi lên server, AI xử lý local
2. **Latency**: Không có network delay, detection <100ms
3. **Scalability**: Server không cần GPU, client dùng WebGL

---

### Câu 9: Làm thế nào để phát hiện "nhìn ra ngoài màn hình" (Looking Away)?

**Trả lời:**

Sử dụng **Effective Gaze** - kết hợp Head Pose và Iris Gaze:

```javascript
effectiveGaze = {
  pitch: headPose.pitch + (irisGaze.vertical * 15),
  yaw: headPose.yaw + (irisGaze.horizontal * 10)
};
```

**Các bước:**
1. **Head Pose Estimation**: Dùng thuật toán PnP từ 6 landmarks (mũi, cằm, tai, mắt) → pitch, yaw, roll
2. **Iris Gaze**: Tính vị trí tương đối của iris trong mắt → horizontal/vertical offset
3. **Kappa Correction**: Điều chỉnh góc Kappa (~5%) vì trục thị giác không trùng trục quang học
4. **Threshold Check**:
   - Pitch UP > 20° hoặc Pitch DOWN > 30°
   - |Yaw| > 25°
   - Sustained >= 3.0 giây → Violation

**Dynamic Thresholds:**
- Gần camera (>1.2x baseline): Ngưỡng giảm 20% (stricter)
- Xa camera (<0.8x baseline): Ngưỡng tăng 30% (looser)

---

### Câu 10: Pre-Suspicion Detection là gì và hoạt động như thế nào?

**Trả lời:**

**Pre-Suspicion** = Phát hiện hành vi chuẩn bị gian lận TRƯỚC khi thực sự gian lận.

**Ví dụ:** Thí sinh nhìn xuống dưới 2.5 giây (kiểm tra điện thoại) rồi mới nhìn lại màn hình.

**Quy trình:**
1. **Calibration** (30 giây đầu): Thu thập baseline head pose, iris gaze (tối thiểu 60 samples)
2. **Signal Detection**: So sánh real-time với baseline
   - `pitchDelta`: head pitch delta > 25° (nhìn xuống)
   - `yawDelta`: head yaw delta > 20° (nhìn ngang)
   - `gazeDown`: iris vertical > 0.25 (mắt nhìn xuống, đầu thẳng)
   - `gazeSide`: iris horizontal > 0.20 (mắt liếc ngang)

3. **Weighted Confidence Scoring** (tổng weights cần >= 35):
   ```javascript
   WEIGHTS = {
     PITCH_DOWN: 25,      // Cúi đầu xuống
     GAZE_DOWN: 20,       // Mắt nhìn xuống
     YAW_SIDE: 25,        // Quay đầu ngang
     GAZE_SIDE: 20,       // Mắt liếc ngang
     DISTANCE_CHANGE: 15, // Nghiêng người tới
     BLINK_SUPPRESSED: 10,// Ít chớp mắt (tập trung đọc)
     FACE_STABLE: 5       // Mặt không di chuyển
   }
   // Ví dụ: PITCH_DOWN(25) + GAZE_DOWN(20) = 45 >= 35 → pattern detected
   ```

4. **Sustained Detection**: Cần duy trì >= 2.5 giây để trigger

5. **Escalation Logic**:
   - 2+ pre-suspicions trong 60s → Upgrade to Violation
   - Sustained >= 3.5s liên tục → Immediate Violation

---

### Câu 11: Làm thế nào để giảm False Positive?

**Trả lời:**

**False Positive** = Cảnh báo sai (ví dụ: cúi đầu đọc câu hỏi dài bị nhận là nhìn điện thoại)

**Giải pháp đã áp dụng:**

1. **Sustained Detection**: Không cảnh báo ngay, cần duy trì hành vi:
   - Looking Away: 2.5 giây liên tục
   - Pre-suspicion: 2 giây liên tục

2. **Debouncing**: Khoảng cách tối thiểu giữa 2 detection
   - Looking Away: 3 giây
   - Tab Switch: 0 giây (vì là action rõ ràng)

3. **State Machine**: Cần vượt threshold mới cảnh báo
   - LOOKING_AWAY: 2 lần → WARN, 4 lần → SUSPICIOUS

4. **Calibration cá nhân hóa**: Baseline riêng cho mỗi thí sinh dựa trên tư thế ngồi ban đầu

5. **Dynamic Thresholds**: Điều chỉnh ngưỡng theo khoảng cách camera

6. **Human-in-the-loop**: Proctor review và confirm/reject alerts

---

### Câu 12: Độ chính xác của hệ thống đo như thế nào?

**Trả lời:**

| Detection Type | Metric | Giá trị |
|----------------|--------|---------|
| No-Face | Accuracy | ~97% |
| Multi-Face | Accuracy | ~93% |
| Looking Away | Sustained detection | >90% (với threshold 2.5s) |
| Tab Switch | Capture rate | 100% (event-driven) |
| Paste | Capture rate | 100% (event-driven) |
| Pre-Suspicion | Precision | ~85% |

**Cách đo:**
- **Manual testing**: Developer tự trigger violations
- **Confusion matrix**: True Positive, False Positive, True Negative, False Negative
- **End-to-end latency**: <500ms từ detection đến warning display

---

## PHẦN D: CÂU HỎI VỀ WEBRTC VÀ REAL-TIME

### Câu 13: Tại sao chọn LiveKit thay vì Jitsi hoặc OpenVidu?

**Trả lời:**

| Tiêu chí | Jitsi | OpenVidu | LiveKit (đã chọn) |
|----------|-------|----------|-------------------|
| **SFU Performance** | Tốt | Trung bình | Xuất sắc |
| **Egress (Recording)** | Cần plugin | Built-in | Built-in, native |
| **Scalability** | Trung bình | Tốt | Rất tốt |
| **Latency** | ~200ms | ~150ms | <100ms |
| **Modern SDK** | Cũ | Trung bình | React SDK hiện đại |
| **Simulcast** | Có | Có | Có, tự động |

**Lý do chọn LiveKit:**
1. **Egress Service**: Ghi video server-side cho evidence, không phụ thuộc client
2. **Low Latency**: <100ms glass-to-glass
3. **React SDK**: Dễ tích hợp với frontend React

---

### Câu 14: Egress Recording hoạt động như thế nào?

**Trả lời:**

**Egress** = Server-side video recording của LiveKit.

**Flow:**
```
1. Violation detected (client-side)
2. Request Egress clip via API (10-15 giây)
3. Egress service clips from ongoing stream
4. Video file → MinIO storage
5. URL returned → Attach to incident
```

**Tại sao cần Egress thay vì client recording?**
- **Reliability**: Client có thể refresh/close tab, Egress vẫn ghi
- **Tamper-proof**: Thí sinh không thể can thiệp server recording
- **Pre-buffer**: Ghi được video TRƯỚC thời điểm violation (5 giây trước)

---

### Câu 15: Hệ thống xử lý kết nối mạng yếu như thế nào?

**Trả lời:**

**Chiến lược đa tầng:**

1. **Simulcast (LiveKit)**: Gửi video 3 chất lượng (low/medium/high), server chọn phù hợp bandwidth

2. **Adaptive Bitrate**: Tự động giảm quality khi mạng yếu

3. **Local Detection**: TensorFlow.js chạy local, không phụ thuộc network reliability

4. **Fallback Recording**: Nếu Egress fail → Local buffer recording

5. **Retry Logic**: Upload evidence có retry 3 lần với exponential backoff

6. **Graceful Degradation**: Nếu mất kết nối, hệ thống vẫn ghi violations locally và sync sau

---

## PHẦN E: CÂU HỎI VỀ STORAGE VÀ DATABASE

### Câu 16: Tại sao sử dụng MinIO thay vì lưu file trực tiếp trên server?

**Trả lời:**

| Tiêu chí | File system | MinIO (đã chọn) |
|----------|-------------|-----------------|
| **Scalability** | Giới hạn disk | Horizontal scaling |
| **S3 Compatible** | Không | Có - dễ migrate lên AWS |
| **Presigned URLs** | Không | Có - secure time-limited access |
| **CDN Ready** | Không | Dễ integrate CDN |
| **Replication** | Manual | Built-in |

**Presigned URL flow:**
```
1. Frontend request upload URL từ Session Service
2. Session Service → MinIO: Generate presigned URL (5 phút)
3. Frontend upload trực tiếp lên MinIO (không qua backend)
4. Frontend gửi objectKey → Incident Service để lưu reference
```

**Lợi ích:** Backend không handle binary data, giảm memory/bandwidth

---

### Câu 17: Hệ thống có bao nhiêu database và tại sao tách ra?

**Trả lời:**

**4 databases riêng biệt:**

| Database | Service | Nội dung |
|----------|---------|----------|
| `identity_db` | Auth, User Service | Users, roles, credentials |
| `session_db` | Session Service | Exams, sessions, questions |
| `incident_db` | Incident Service | Violations, reviews, behavior |
| `bff_db` | BFF Gateway | Sessions, cache |

**Tại sao tách?**
- **Microservices principle**: Database per service - độc lập
- **Scalability**: Session DB có thể scale riêng khi có nhiều exams
- **Fault isolation**: identity_db crash không ảnh hưởng sessions
- **Compliance**: Incident data có thể ở region riêng

**Data sync giữa services:**
- CDC (Debezium) → Shadow tables
- Ví dụ: `incident_db.user_shadow` sync từ `identity_db.users`

---

## PHẦN F: CÂU HỎI VỀ SECURITY

### Câu 18: Hệ thống authentication hoạt động như thế nào?

**Trả lời:**

**OAuth 2.0 + PKCE + JWT RS256**

**Flow:**
```
1. User login → Auth Server
2. Auth Server verify credentials
3. Issue JWT (RS256 signed)
4. Frontend store token (memory, không localStorage)
5. Mỗi request: Bearer token trong header
6. BFF validate token với Auth Server public key
7. Forward request nếu valid
```

**Tại sao RS256 thay vì HS256?**
- **Asymmetric**: Private key chỉ Auth Server có, public key share được
- **Verification**: Services có thể verify mà không cần secret

**RBAC (4 roles):**
- `ADMIN`: Quản lý toàn bộ
- `PROCTOR`: Xem violations, review incidents
- `INSTRUCTOR`: Quản lý exams của mình
- `STUDENT`: Làm bài thi

---

### Câu 19: Hệ thống đảm bảo privacy của thí sinh như thế nào?

**Trả lời:**

**Nguyên tắc Privacy-by-Design:**

1. **Client-side AI**: Video không gửi lên server, TensorFlow.js xử lý local

2. **Minimal Data**: Chỉ lưu evidence khi có violation, không record toàn bộ exam

3. **Presigned URLs**: Evidence có time-limited access (1 giờ)

4. **Retention Policy**: Video tự động xóa sau 30 ngày

5. **No Face Storage**: Không lưu face embeddings, chỉ verify real-time

6. **HTTPS everywhere**: Dữ liệu encrypted in transit

7. **Role-based Access**: Proctor chỉ xem students được assign

---

### Câu 20: Làm sao để chống thí sinh bypass detection?

**Trả lời:**

**Các attack vectors và countermeasures:**

| Attack | Countermeasure |
|--------|----------------|
| Che webcam | No-Face detection → immediate warning |
| Virtual camera | Safe Exam Browser (SEB) blocks virtual devices |
| Tab switch | visibilitychange + blur events |
| Copy từ phone | Pre-suspicion detection (nhìn xuống) |
| Nhờ người khác làm | Face verification trước thi + Multi-face detection |
| Giả mạo danh tính | Face verification với ID photo |
| Screenshot | Keyboard listener + clipboard monitor |
| Dual monitor | Screen capture + window focus tracking |

**SEB (Safe Exam Browser) Integration:**
- Kiosk mode: không chuyển app
- Block chuột phải, PrintScreen
- Config download từ admin dashboard

---

## PHẦN G: CÂU HỎI VỀ HIỆU NĂNG VÀ SCALABILITY

### Câu 21: Hệ thống phát hiện gian lận với độ trễ bao nhiêu?

**Trả lời:**

| Metric | Giá trị | Chi tiết |
|--------|---------|----------|
| **Detection FPS** | 5 FPS | 200ms/frame (throttled để giảm CPU) |
| **Face Detection** | ~20ms | BlazeFace inference |
| **FaceMesh** | ~30ms | 468 landmarks |
| **Gaze Calculation** | ~5ms | Head pose + iris gaze |
| **End-to-end** | <500ms | Detection → Warning display |
| **WebRTC Latency** | <100ms | Glass-to-glass |

**Tại sao 5 FPS thay vì 30 FPS?**
- CPU usage giảm từ 80% xuống 30%
- 5 FPS đủ để detect hành vi (không cần realtime như gaming)
- Memory leak giảm đáng kể

---

### Câu 22: Hệ thống có thể scale đến bao nhiêu concurrent users?

**Trả lời:**

**Hiện tại (Docker Compose):** Đã test 50 concurrent users

**Production-ready scaling:**

1. **Horizontal Scaling (Kubernetes):**
   ```yaml
   replicas:
     session-service: 3
     incident-service: 5  # Nhiều hơn vì handle nhiều events
     bff-gateway: 3
   ```

2. **Database Scaling:**
   - PostgreSQL read replicas
   - Connection pooling (HikariCP)

3. **LiveKit Scaling:**
   - Multiple SFU instances
   - Load balancer phân phối rooms

4. **Message Queue:**
   - RabbitMQ cluster
   - Dead letter queues

**Bottleneck dự kiến:** AI Worker (face verification) - giải pháp: add more workers

---

### Câu 23: CPU/Memory usage của frontend detection như thế nào?

**Trả lời:**

| Resource | Idle | Detection Active |
|----------|------|------------------|
| **CPU** | 5% | 30-50% |
| **Memory** | 200MB | 400-600MB |
| **GPU (WebGL)** | 0% | 20-30% |

**Optimization đã áp dụng:**

1. **WebGL Backend**: TensorFlow.js dùng GPU thay vì CPU
2. **Model Warm-up**: Load models khi page load, không load khi detect
3. **5 FPS Throttle**: Giảm từ 30 FPS xuống 5 FPS
4. **Canvas Downscale**: Process 640px thay vì full HD
5. **One Euro Filter**: Làm mượt landmarks, giảm jitter (và computation)

**Known Issues:**
- Memory leak sau 2 giờ → Recommend page reload

---

## PHẦN H: CÂU HỎI BẪY VÀ ĐÁO SÂU

### Câu 24: Tại sao không train model riêng cho cheating detection thay vì dùng pre-trained?

**Trả lời:**

**Lý do KHÔNG train model riêng:**

1. **Không có dataset chuẩn**: Không tồn tại dataset "gian lận thi cử" đủ lớn và đa dạng
2. **Privacy concerns**: Thu thập video thí sinh gian lận để train là vấn đề đạo đức
3. **Overfitting risk**: Dataset nhỏ → model không generalize
4. **Maintenance burden**: Custom model cần retrain khi có edge cases mới

**Chiến lược thay thế:**
- Dùng pre-trained models (BlazeFace, FaceMesh) đã train trên hàng triệu faces
- **Rule-based logic** trên output của models (head pose, gaze direction)
- Dễ điều chỉnh thresholds mà không cần retrain

**Minh họa:**
```
Pre-trained Model → Head Pose (pitch=25°) → Rule: |pitch| > 20° → Violation
```

---

### Câu 25: Nếu thí sinh có tật mắt/lác mắt, hệ thống xử lý sao?

**Trả lời:**

**Vấn đề:** Strabismus (lác mắt), Amblyopia (mắt lười) làm iris tracking không chính xác.

**Giải pháp:**
1. **Head Pose Priority**: Dựa chính vào head pose thay vì iris gaze
2. **Calibration cá nhân hóa**: Baseline được lưu trong 10 giây đầu - bao gồm cả "bình thường" của thí sinh
3. **Admin Override**: Proctor có thể disable iris tracking cho specific students
4. **Threshold Adjustment**: Hệ thống tự động nới lỏng ngưỡng nếu detect high variance trong calibration

**Chiến lược phát triển:**
- Thêm option "Accessibility Mode" khi register exam
- Multi-signal fusion giảm phụ thuộc vào một signal đơn lẻ

---

### Câu 26: Làm sao biết chắc thí sinh không dùng Virtual Machine để bypass SEB?

**Trả lời:**

**Limitations hiện tại:**
- SEB không thể detect tất cả VM environments
- Sophisticated VMs có thể fake hardware info

**Countermeasures:**

1. **Hardware Fingerprinting** (planned):
   - GPU info, CPU cores, memory size
   - VMs thường có generic hardware

2. **Behavioral Analysis**:
   - Mouse movements trong VM khác native
   - Typing patterns

3. **Multi-layered Defense**:
   - Ngay cả trong VM, detection vẫn hoạt động
   - Pre-suspicion vẫn catch nhìn xuống điện thoại

4. **Proctoring Integrity**:
   - Face verification đảm bảo đúng người
   - Evidence video cho phép human review

**Quan điểm:** Không có giải pháp 100% chống bypass, nhưng hệ thống tạo sufficient friction để deter hầu hết cheating attempts.

---

### Câu 27: Độ chính xác 97% No-Face detection có đủ tin cậy để kỷ luật thí sinh không?

**Trả lời:**

**Quan điểm quan trọng:** Hệ thống KHÔNG tự động kỷ luật.

**Workflow thực tế:**
```
Detection (AI) → Alert (System) → Review (Human Proctor) → Decision (Admin)
```

**Evidence-based approach:**
1. Mỗi alert có snapshot/video clip
2. Proctor xem evidence trước khi confirm
3. False positives được reject với 1 click
4. Chỉ confirmed violations mới vào report

**Thiết kế có chủ đích:**
- Alert threshold thấp → Bắt hết potential violations
- Human review → Filter false positives
- Transparent evidence → Thí sinh có thể appeal

**Kết luận:** 97% accuracy là đủ cho **alerting**, nhưng **quyết định cuối** luôn thuộc về con người.

---

### Câu 28: Nếu ánh sáng kém hoặc backlight, hệ thống có còn hoạt động không?

**Trả lời:**

**Thách thức:**
- BlazeFace accuracy giảm trong low light
- Backlight làm face thành silhouette
- Webcam tự adjust exposure chậm

**Countermeasures hiện tại:**

1. **Pre-exam Check**: 
   - Yêu cầu thí sinh điều chỉnh lighting
   - Show preview với face detection overlay
   - Block start nếu face detection fail

2. **Face Confidence Score**:
   - BlazeFace trả về confidence [0-1]
   - Nếu confidence < 0.7, warning thí sinh adjust lighting

3. **Fallback to Head Detection**:
   - Dùng larger bounding box khi face unclear
   - Chỉ track movement, không track gaze

**Known Limitations:**
- Rất tối (< 10 lux) → No-Face liên tục
- Strong backlight → Không reliable

**Recommendation:** Thí sinh làm bài ở nơi có đủ ánh sáng (requirement trong hướng dẫn)

---

## PHẦN I: CÂU HỎI VỀ TESTING VÀ DEPLOYMENT

### Câu 29: Hệ thống được test như thế nào?

**Trả lời:**

**Multi-layer testing:**

1. **Unit Tests:**
   - Spring Boot services: JUnit 5
   - React components: Jest + React Testing Library

2. **Integration Tests:**
   - API tests: Postman/Newman collections
   - Database migrations: Flyway verify

3. **End-to-End Tests:**
   - Manual testing với checklist chi tiết
   - State machine transitions
   - Evidence upload flow

4. **Detection Testing:**
   - Trigger violations manually (xoay đầu, che mặt)
   - Verify state: OK → WARN → SUSPICIOUS → ESCALATED
   - Verify evidence capture

**Debug Tools:**
```javascript
window.stateMachine.getStats()  // View current violation counts
console.log(bufferStatus)       // Video buffer status
```

---

### Câu 30: Làm sao deploy hệ thống lên production?

**Trả lời:**

**Development (Current):**
- Docker Compose với tất cả services
- Local PostgreSQL, Redis, RabbitMQ, MinIO

**Production (Recommended):**

```yaml
Infrastructure:
  - Kubernetes cluster (EKS/GKE)
  - PostgreSQL managed (RDS/Cloud SQL)
  - Redis managed (ElastiCache)
  - S3 cho storage (thay MinIO)
  - CloudFront CDN

Deployment:
  - GitHub Actions CI/CD
  - Docker images push to ECR
  - Rolling updates với zero downtime
  - Health checks on all services

Monitoring:
  - Prometheus + Grafana
  - ELK stack for logs
  - Sentry for error tracking
```

---

## PHẦN J: CÂU HỎI VỀ HẠN CHẾ VÀ HƯỚNG PHÁT TRIỂN

### Câu 31: Hạn chế chính của hệ thống là gì?

**Trả lời:**

| Hạn chế | Mức độ | Lý do |
|---------|--------|-------|
| **False Positives** | Trung bình | Pre-suspicion có thể trigger sai khi đọc câu hỏi dài |
| **Lighting Dependency** | Trung bình | Accuracy giảm trong ánh sáng yếu |
| **Single Camera** | Thấp | Không detect phone bằng camera phụ |
| **Mobile Support** | Trung bình | Chưa tối ưu cho mobile |
| **CPU Usage** | Trung bình | 30-50% với TensorFlow.js |
| **Audio Monitoring** | Chưa có | Privacy concerns, complexity |
| **Screen Recording** | Chưa có | Bandwidth, storage constraints |

---

### Câu 32: Nếu tiếp tục phát triển, bạn sẽ ưu tiên tính năng nào?

**Trả lời:**

**Short-term (3-6 tháng):**
1. **Adaptive Thresholds**: ML auto-tune ngưỡng từ calibration
2. **Liveness Detection**: Chống spoofing bằng ảnh/video
3. **Mobile Responsive**: Hỗ trợ tablet

**Medium-term (6-12 tháng):**
1. **Audio Analysis**: Phát hiện giọng nói/tiếng ồn bất thường
2. **Object Detection**: Phát hiện điện thoại, tài liệu trong khung hình (YOLO)
3. **Behavioral Biometrics**: Typing patterns, mouse movements

**Long-term (12-24 tháng):**
1. **Multi-tenant SaaS**: Phục vụ nhiều tổ chức
2. **Plagiarism Detection**: So sánh câu trả lời giữa thí sinh
3. **LLM Integration**: AI assistant cho proctors

---

### Câu 33: Nếu bắt đầu lại từ đầu, bạn sẽ làm khác gì?

**Trả lời:**

1. **Monorepo thay vì Multi-repo**: Dễ quản lý dependencies, shared types

2. **GraphQL thay vì REST (một số nơi)**: Giảm over-fetching, better API evolution

3. **WebSocket from start**: Thay vì SSE + REST polling hỗn hợp

4. **E2E Tests sớm hơn**: Integration tests bắt bugs mà unit tests miss

5. **Feature Flags**: Cho phép enable/disable features mà không deploy lại

6. **Observability first**: Setup Prometheus, Grafana từ đầu

---

## PHẦN K: CÂU HỎI VỀ CÔNG NGHỆ CỤ THỂ

### Câu 34: Giải thích cách MediaPipe FaceMesh hoạt động?

**Trả lời:**

**MediaPipe FaceMesh** = Real-time face mesh detection với 468 facial landmarks.

**Architecture:**
```
Input Image → Face Detection (BlazeFace) → Crop Face → Landmark Regression → 468 Points
```

**Landmark Groups:**
- **Silhouette (36)**: Viền mặt
- **Left/Right Eye (32 each)**: Mắt + eyelids
- **Iris (10)**: Đồng tử
- **Lips (40)**: Môi
- **Nose (13)**: Mũi

**Sử dụng trong đồ án:**
1. **6 landmarks cho Head Pose**: Nose tip, chin, ears, eyes → PnP algorithm → pitch/yaw/roll
2. **Iris landmarks**: Tính iris position relative to eye corners → gaze direction
3. **Interocular distance**: Khoảng cách 2 mắt → estimate face distance to camera

---

### Câu 35: Head Pose được tính như thế nào? (Geometric Method vs PnP)

**Trả lời:**

> ⚠️ **LƯU Ý QUAN TRỌNG**: Đồ án sử dụng **Geometric Ratios** thay vì PnP vì lý do performance và simplicity. Phần PnP bên dưới là kiến thức lý thuyết để trả lời nếu bị hỏi sâu.

**PHƯƠNG PHÁP THỰC TẾ TRONG CODE (Geometric Ratios):**

```javascript
// YAW (left/right): so sánh khoảng cách mũi-mắt
const leftEyeToNose = Math.abs(noseTip.x - leftEyeInner.x);
const rightEyeToNose = Math.abs(noseTip.x - rightEyeInner.x);
const asymmetry = (leftEyeToNose - rightEyeToNose) / eyeDistance;
const rawYaw = asymmetry * 120; // Scale to degrees

// PITCH (up/down): tỷ lệ vị trí mũi trong khuôn mặt
const noseToForeheadRatio = (noseTip.y - forehead.y) / faceHeight;
const noseToChinRatio = (chin.y - noseTip.y) / faceHeight;
const rawPitch = (noseToForeheadRatio - noseToChinRatio) * 180;

// ROLL: góc nghiêng đầu từ hai mắt
const rawRoll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);
```

**Ưu điểm Geometric:**
- Không cần OpenCV.js (8MB bundle)
- Không cần camera matrix
- Nhanh hơn (vài phép tính số học)
- Đủ accurate với calibration

---

**KIẾN THỨC LÝ THUYẾT: PnP Algorithm (nếu bị hỏi)**

**PnP (Perspective-n-Point)** = Ước tính pose từ 2D-3D point correspondences.

```javascript
// KHÔNG sử dụng trong đồ án vì bundle size và complexity
const [success, rvec, tvec] = cv.solvePnP(
  model3DPoints, image2DPoints, cameraMatrix, distCoeffs
);
// Sau đó extract Euler: atan2(R21/R11), asin(-R31), atan2(R32/R33)
```

**Tại sao không dùng PnP:**
- OpenCV.js bundle lớn (~8MB)
- Webcam không cung cấp camera intrinsics
- Geometric method đủ accurate cho detection use case


---

### Câu 36: One Euro Filter là gì và tại sao cần nó?

**Trả lời:**

**One Euro Filter** = Adaptive low-pass filter để smooth noisy signals.

**Vấn đề:** FaceMesh landmarks có jitter (rung) 1-3 pixels mỗi frame, gây false detections.

**Giải pháp:**
```javascript
// Không có filter: landmark nhảy liên tục
frame 1: point = (100, 100)
frame 2: point = (102, 98)   // jitter
frame 3: point = (99, 101)   // jitter

// Có One Euro Filter: smooth
frame 1: smoothed = (100, 100)
frame 2: smoothed = (100.5, 99.5)  // damped
frame 3: smoothed = (100.1, 100.1) // stable
```

**Parameters:**
- **minCutoff**: Minimum cutoff frequency (lower = smoother)
- **beta**: Speed coefficient (higher = faster response)
- **dCutoff**: Derivative cutoff frequency

**Trade-off:** Smooth quá → miss quick movements. Đồ án này cần detect sustained behavior (2.5s) nên smooth là acceptable.

---

### Câu 37: Kappa Angle Correction là gì?

**Trả lời:**

**Kappa Angle** = Góc giữa trục thị giác (visual axis) và trục quang học (optical axis) của mắt.

**Vấn đề:** Khi bạn nhìn thẳng vào camera, pupil KHÔNG nằm chính giữa mắt mà lệch ~5° về phía mũi.

**Không có Kappa Correction:**
```
User nhìn thẳng → Iris lệch nasal → System: "Nhìn sang trái!"
```

**Có Kappa Correction:**
```javascript
correctedGaze = rawGaze - kappaOffset;  // kappaOffset ≈ 5°

User nhìn thẳng → Raw: lệch 5° → Corrected: 0° → System: "Nhìn thẳng"
```

**Implementation trong đồ án:**
- Kappa offset được estimate trong calibration phase
- Hoặc sử dụng population average (~5°)

---

## PHẦN L: CÂU HỎI TỔNG KẾT

### Câu 38: Bài học lớn nhất bạn học được từ đồ án này là gì?

**Trả lời:**

1. **Microservices không hề đơn giản**: Distributed systems có độ phức tạp cao hơn nhiều so với monolith. Data consistency, service discovery, failure handling đều cần design cẩn thận.

2. **AI on Client là viable**: TensorFlow.js đủ mạnh cho real-time detection, nhưng cần optimize kỹ để không drain resources.

3. **Human-in-the-loop là bắt buộc**: Không AI nào 100% accurate. Design system để human review và override là critical.

4. **Real-time có nhiều trade-offs**: Latency vs accuracy, CPU vs precision, privacy vs convenience.

5. **Integration tests quan trọng hơn unit tests**: Trong distributed systems, bugs thường ở interaction giữa services, không phải logic đơn lẻ.

---

### Câu 39: Đề tài này có thể ứng dụng trong lĩnh vực nào ngoài giáo dục?

**Trả lời:**

1. **Tuyển dụng Online**: Phỏng vấn video, coding tests
2. **Chứng chỉ nghề nghiệp**: AWS, Azure, CCNA remote exams
3. **Đánh giá nhân sự**: Performance reviews, skill assessments
4. **Bảo hiểm**: Claim verification qua video
5. **Ngân hàng**: KYC (Know Your Customer) video verification
6. **Telehealth**: Patient identity verification
7. **Remote Driver's Tests**: Lý thuyết lái xe online

---

### Câu 40: Nếu có thêm 6 tháng nữa, tính năng nào bạn sẽ thêm đầu tiên?

**Trả lời:**

**Priority 1: Object Detection (Phone/Notes)**

**Lý do:**
- Pre-suspicion catch hành vi "nhìn xuống", nhưng không chứng minh có điện thoại
- Object detection sẽ capture visual evidence của forbidden items

**Approach:**
- YOLO v5/v8 chạy server-side (AI Worker)
- Egress video → AI Worker → Detect phone/notes → Flag thời điểm cụ thể
- Return timestamps + bounding boxes cho proctor review

**Expected Impact:**
- Từ "nghi ngờ nhìn điện thoại" → "Phát hiện điện thoại trong khung hình"
- Evidence mạnh hơn, ít dispute hơn

---

*Tài liệu được tạo tự động từ phân tích dự án - Cập nhật: Tháng 01/2026*

---

## PHẦN M: CÂU HỎI NÂNG CAO VỀ KỸ THUẬT (9/10)

### Câu 41: Temporal Pattern Analyzer hoạt động như thế nào và phát hiện được những patterns gì?

**Trả lời:**

**Temporal Pattern Analyzer** (`temporalPatternAnalyzer.ts`) là module phân tích hành vi theo thời gian để phát hiện patterns đáng ngờ mà single-event detection bỏ sót.

**7 Patterns được phát hiện:**

| Pattern | Tiêu chí | Weight | Mô tả |
|---------|----------|--------|-------|
| `repeated_head_down` | ≥3 lần trong 5 phút, CV < 0.3 | 25% | Nhìn xuống lặp lại đều đặn |
| `regular_micro_pauses` | ≥5 pauses, interval đều đặn | 20% | Dừng 0.5-3s định kỳ (đọc từ phone) |
| `answer_latency_spikes` | >2x avg time, >20% câu hỏi | 30% | Thời gian trả lời bất thường |
| `pre_suspicion_correlation` | >30% câu có pre-suspicion | 25% | Nghi vấn tương quan với trả lời |
| `impossible_typing_speed` | >15 chars/sec | 30% | Tốc độ gõ bất thường (copy-paste) |
| `answer_burst` | 3+ câu trong 10s | 20% | Trả lời liên tiếp (đã có đáp án sẵn) |
| `frequent_blur` | ≥5 blur trong 30s | 20% | Split-screen usage |

**Công thức Risk Score:**
```javascript
overallRiskScore = Σ (pattern.score × pattern.weight)
// Cap tại 100
```

**Coefficient of Variation (CV):**
```javascript
CV = stdDev(intervals) / mean(intervals)
// CV < 0.3 = regular pattern = suspicious
// Ví dụ: CV = 0.2 → nhìn xuống mỗi 30±6 giây
```

---

### Câu 42: Giải thích chi tiết cách tính Iris Gaze với Kappa Correction?

**Trả lời:**

**Bước 1: Raw Iris Position**
```javascript
// Lấy vị trí iris trong mắt (0-1, tâm = 0.5)
leftRawHorizontal = (iris.x - eyeLeft.x) / eyeWidth;
leftRawVertical = (iris.y - eyeTop.y) / eyeHeight;
```

**Bước 2: Kappa Angle Correction**
```javascript
KAPPA_ANGLE = {
    LEFT_EYE_HORIZONTAL: 0.05,   // +5% nasal
    RIGHT_EYE_HORIZONTAL: -0.05, // -5% nasal (opposite)
    VERTICAL: 0.02               // +2% upward
};

// Apply correction
leftCorrectedH = leftRawH + KAPPA_ANGLE.LEFT_EYE_HORIZONTAL;
leftCorrectedV = leftRawV + KAPPA_ANGLE.VERTICAL;
```

**Bước 3: Average Both Eyes**
```javascript
horizontalGaze = (leftCorrectedH + rightCorrectedH) / 2;
verticalGaze = (leftCorrectedV + rightCorrectedV) / 2;
// Range: -1 (right/up) to 1 (left/down)
```

**Tại sao cần Kappa?**
- Trục thị giác (visual axis) lệch ~5° so với trục quang học (optical axis)
- Không correction → nhìn thẳng vẫn bị detect là nhìn sang trái

---

### Câu 43: State Machine cho Violation Detection được thiết kế như thế nào?

**Trả lời:**

**4 States:**
```
OK → WARN (warning) → SUSPICIOUS → ESCALATED
```

**State Transitions (ví dụ LOOKING_AWAY):**
```javascript
{
  severity: 'LOW',
  debounceMs: 3000,        // 3s giữa mỗi detection
  warningThreshold: 2,     // 2 lần → WARN
  suspiciousThreshold: 4,  // 4 lần → SUSPICIOUS
  escalatedThreshold: 6    // 6 lần → ESCALATED
}
```

**Evidence Capture Logic:**
| State | Severity LOW | Severity HIGH |
|-------|--------------|---------------|
| WARN | Snapshot | **Clip** |
| SUSPICIOUS | Clip | Clip |
| ESCALATED | Clip | Clip |

**Cooldown để tránh spam:**
- LOW: 30s
- MEDIUM: 20s
- HIGH: 10s

---

### Câu 44: Làm thế nào để phát hiện Split-Screen Usage?

**Trả lời:**

**Composite Pattern Detection:**
```javascript
// Trong 30 giây gần nhất:
if (blurCount >= 5 && preSuspicionCount >= 1 && tabSwitchCount >= 1) {
    pattern = 'SPLIT_SCREEN_USAGE';
    confidence = 95;
}
```

**Signals kết hợp:**
1. **High-frequency blur**: ≥5 blur events trong 30s
2. **Pre-suspicion**: Nhìn xuống/sang lặp lại
3. **Tab/Window switching**: Ít nhất 1 lần

**Tại sao cần kết hợp?**
- Single blur = có thể vô tình
- Blur + nhìn xuống + tab switch = rất có thể đang dùng split screen

---

### Câu 45: Weighted Confidence Scoring cho Pre-Suspicion hoạt động như thế nào?

**Trả lời:**

**7 Signals với Weights:**
```javascript
WEIGHTS = {
    PITCH_DOWN: 25,        // Cúi đầu xuống > 25°
    GAZE_DOWN: 20,         // Mắt nhìn xuống > 0.25
    YAW_SIDE: 25,          // Quay đầu > 20°
    GAZE_SIDE: 20,         // Mắt liếc > 0.20
    DISTANCE_CHANGE: 15,   // Face area tăng 8% (nghiêng tới)
    BLINK_SUPPRESSED: 10,  // Blink rate < 0.8x baseline
    FACE_STABLE: 5         // Face drift < 20px
}
// Total possible: 120
// Threshold: 35 (need ~2 strong signals)
```

**Ví dụ kịch bản:**
| Kịch bản | Signals | Score | Result |
|----------|---------|-------|--------|
| Đọc câu hỏi dài | PITCH_DOWN (25) + FACE_STABLE (5) | 30 | ❌ Không trigger |
| Nhìn điện thoại | PITCH_DOWN (25) + GAZE_DOWN (20) | 45 | ✅ Trigger |
| Liếc giấy bên cạnh | YAW_SIDE (25) + GAZE_SIDE (20) | 45 | ✅ Trigger |
| Nghiêng tới bàn | PITCH_DOWN (25) + DISTANCE_CHANGE (15) | 40 | ✅ Trigger |

---

### Câu 46: Làm sao đảm bảo Evidence không bị tamper?

**Trả lời:**

**Multi-layer Integrity:**

1. **Server-side Recording (Egress):**
   - Video ghi bởi LiveKit server, không phải client
   - Client không thể can thiệp vào stream đã ghi

2. **Presigned URLs:**
   - Upload trực tiếp lên MinIO, không qua backend
   - URL có thời hạn (5 phút), không thể reuse

3. **Immutable Storage:**
   - MinIO object storage với versioning
   - Cấm DELETE trong production bucket

4. **Metadata Binding:**
   - Evidence gắn với incident_id, timestamp
   - Không thể swap evidence giữa các incidents

5. **Audit Trail:**
   - Mọi review action được log với reviewer_id, timestamp

---

### Câu 47: Depth Estimation từ Iris Size hoạt động như thế nào?

**Trả lời:**

**Nguyên lý:**
```javascript
IRIS_CONSTANTS = {
    AVERAGE_DIAMETER_MM: 11.7,  // Human average
    ASSUMED_FOCAL_LENGTH: 550   // Webcam ~60° FOV at 640px
};

// Apparent size (px) inversely proportional to distance
estimatedDepthRatio = baselineIrisDiameter / currentIrisDiameter;
// > 1.0 = farther than baseline
// < 1.0 = closer than baseline
```

**Sử dụng:**
1. **Dynamic Thresholds:**
   - Gần camera (ratio < 0.9): Giảm threshold 20%
   - Xa camera (ratio > 1.1): Tăng threshold 30%

2. **Leaning Detection:**
   - Face area tăng 8% = nghiêng về phía trước
   - Có thể đang xem điện thoại trên bàn

---

### Câu 48: Answer Latency Spike Detection phát hiện gì và công thức tính?

**Trả lời:**

**Mục đích:** Phát hiện thí sinh dành nhiều thời gian bất thường cho một số câu (lookup behavior).

**Công thức:**
```javascript
// Group answers by difficulty
byDifficulty = { easy: [], medium: [], hard: [] };

// Per difficulty:
avgTime = mean(times);
spike = time > avgTime * 2.0;  // SPIKE_RATIO = 2.0

// Scoring:
spikeRatio = spikeCount / totalQuestions;
score = min(100, spikeRatio * 200);  // 50% spikes = 100 score
isAnomalous = spikeRatio > 0.2;      // >20% spikes
```

**Ví dụ:**
- Easy question avg: 30s
- Câu 5 (easy): 75s → Spike (>60s)
- 3/10 câu có spike = 30% → Score = 60

---

### Câu 49: Tại sao cần Calibration và calibration data được dùng như thế nào?

**Trả lời:**

**Mục đích Calibration:**
- Mỗi người có tư thế ngồi khác nhau
- Baseline cá nhân hóa giảm false positive

**Calibration Process:**
```javascript
CALIBRATION_THRESHOLDS = {
    CALIBRATION_DURATION: 30000,  // 30 giây
    MIN_SAMPLES: 60               // 60 frames minimum
};

// Thu thập:
samples = [
    { pitch, yaw, gaze, faceBox, brightness, timestamp },
    ...
];

// Tính baseline:
baseline = {
    headPose: { pitch: median(pitches), yaw: median(yaws) },
    irisGaze: { horizontal: median(h), vertical: median(v) },
    baselineDistance: median(faceAreas)
};
```

**Sử dụng baseline:**
- Pre-suspicion: So sánh delta với baseline
- Dynamic thresholds: Điều chỉnh theo baselineDistance
- Validation: Kiểm tra xem calibration có hợp lệ (không che mặt, đủ ánh sáng)

---

### Câu 50: Composite Violation Detector phát hiện những patterns nào?

**Trả lời:**

**5 Composite Patterns:**

| Pattern | Events Required | Time Window | Confidence |
|---------|-----------------|-------------|------------|
| `TAB_PASTE` | TAB_SWITCH + PASTE | 5s | 90% |
| `BLUR_PASTE` | BLUR + PASTE | 10s | 85% |
| `LOOKUP_PATTERN` | PRE_SUSPICION → quick answer | 30s | 80% |
| `SPLIT_SCREEN_USAGE` | 5 BLUR + PRE_SUSPICION + TAB | 30s | 95% |
| `MULTI_EVENT_BURST` | Any 5 violations | 60s | 75% |

**Code logic:**
```javascript
detectPatterns() {
    // Get events in time window
    const recent = this.getEventsInWindow(30000);
    
    // Check each pattern
    if (preSuspicion.length > 0 && tabOrBlur.length > 0 && pastes.length > 0) {
        return {
            pattern: 'SPLIT_SCREEN_USAGE',
            confidence: 95,
            events: [...preSuspicion, ...tabOrBlur, ...pastes]
        };
    }
}
```

---

### Câu 51: Làm sao hệ thống xử lý Multiple Faces phát hiện nhầm do ảnh trên tường/áo?

**Trả lời:**

**Vấn đề thực tế:**
- Poster có mặt người
- Ảnh gia đình trên bàn
- In hình người trên áo

**Giải pháp:**

1. **Size Filter:**
   - Primary face: > 10% of frame
   - Ignore faces < 5% (likely poster/photo)

2. **Movement Detection:**
   - Real faces có micro-movements
   - Poster faces hoàn toàn static

3. **Depth Consistency:**
   - Real face: consistent interocular distance
   - Photo: thường bị distort

4. **BlazeFace Confidence:**
   - Reject detections < 0.85 confidence
   - Photos thường có lower confidence

5. **Human Review:**
   - All multi-face alerts có evidence
   - Proctor verify trước khi confirm

---

### Câu 52: SSE (Server-Sent Events) được dùng như thế nào cho real-time notifications?

**Trả lời:**

**Use case:** Notify Proctor dashboard khi có violation mới.

**Backend (Spring Boot):**
```java
@GetMapping(value = "/api/incidents/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<IncidentDto>> streamIncidents() {
    return incidentSink.asFlux()
        .map(incident -> ServerSentEvent.builder(incident)
            .event("new-incident")
            .build());
}
```

**Frontend (React):**
```typescript
useEffect(() => {
    const eventSource = new EventSource('/api/incidents/stream');
    
    eventSource.addEventListener('new-incident', (e) => {
        const incident = JSON.parse(e.data);
        addToNotifications(incident);
    });
    
    return () => eventSource.close();
}, []);
```

**Tại sao SSE thay vì WebSocket?**
- One-way (server → client) là đủ cho notifications
- SSE auto-reconnect built-in
- Simpler than WebSocket for this use case

---

### Câu 53: One Euro Filter được configure như thế nào cho Iris vs Head Pose?

**Trả lời:**

**Iris Filter (aggressive smoothing):**
```javascript
createIrisFilter() {
    return new OneEuroFilter2D({
        minCutoff: 0.5,    // Very smooth
        beta: 0.5,         // Slower response
        dCutoff: 1.0       // Derivative cutoff
    });
}
```

**Head Pose Filter (less smoothing):**
```javascript
createHeadPoseFilter() {
    return new OneEuroFilter({
        minCutoff: 1.0,    // Less smooth
        beta: 0.7,         // Faster response
        dCutoff: 1.0
    });
}
```

**Tại sao khác nhau?**
- Iris: jitter nhiều (1-3px), cần smooth mạnh
- Head pose: movement lớn hơn, cần response nhanh để không miss quick turns

---

### Câu 54: Face Distance Adjustment cho Thresholds hoạt động như thế nào?

**Trả lời:**

**Nguyên lý:**
```javascript
// Interocular distance as proxy for face distance
currentDistance = distance(leftEyeCenter, rightEyeCenter);
distanceRatio = currentDistance / baselineDistance;

if (distanceRatio > 1.2) {
    // Very close to camera
    multiplier = 0.8;  // 20% stricter
} else if (distanceRatio < 0.8) {
    // Far from camera
    multiplier = 1.3;  // 30% looser
} else {
    multiplier = 1.0;
}

adjustedThreshold = baseThreshold * multiplier;
```

**Lý do:**
- Gần camera: Movements nhỏ trông lớn → cần ngưỡng nhỏ hơn
- Xa camera: Movements lớn mới thấy rõ → cần ngưỡng lớn hơn

---

### Câu 55: Làm sao đảm bảo Detection không ảnh hưởng đến UX của thí sinh?

**Trả lời:**

**Performance Optimizations:**

1. **5 FPS Detection (not 30):**
   - CPU từ 80% → 30%
   - Đủ cho behavior detection

2. **WebGL Backend:**
   - TensorFlow.js dùng GPU
   - Không block main thread

3. **Canvas Downscale:**
   - Process 640px thay vì full HD
   - 4x faster inference

4. **Lazy Model Loading:**
   - Models load khi page load
   - Không delay khi bắt đầu thi

5. **Debounced Warnings:**
   - Không spam warnings
   - Minimum 3s giữa các alerts

**UX Design:**
- Warning overlay có dismiss button
- Auto-hide sau 3-5s (trừ NO_FACE)
- Không block input fields

---

## PHẦN N: CÂU HỎI VỀ EDGE CASES VÀ ERROR HANDLING

### Câu 56: Điều gì xảy ra nếu calibration fail?

**Trả lời:**

**Calibration Validation:**
```javascript
validateCalibration(samples) {
    const issues = [];
    
    // Check sample count
    if (samples.length < 60) {
        issues.push({ type: 'insufficient_samples', message: 'Cần tối thiểu 60 samples' });
    }
    
    // Check brightness
    if (avgBrightness < 0.3) {
        issues.push({ type: 'low_light', message: 'Ánh sáng không đủ' });
    }
    
    // Check face stability
    if (faceBoxDrift > 50) {
        issues.push({ type: 'unstable_face', message: 'Giữ yên đầu để calibrate' });
    }
    
    return { valid: issues.length === 0, issues };
}
```

**Fallback khi fail:**
1. Re-request calibration với guidance cụ thể
2. Nếu fail 3 lần → Use default thresholds
3. Log để admin review

---

### Câu 57: Hệ thống handle network disconnection như thế nào?

**Trả lời:**

**Frontend:**
```javascript
// Offline detection
window.addEventListener('offline', () => {
    setNetworkStatus('offline');
    // Queue events locally
});

window.addEventListener('online', () => {
    setNetworkStatus('online');
    // Sync queued events
    syncQueuedEvents();
});
```

**Evidence Upload:**
```javascript
uploadWithRetry(file, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await upload(file);
        } catch (e) {
            await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
        }
    }
    // Queue for later
    queueForLater(file);
}
```

**LiveKit (WebRTC):**
- Auto-reconnect built-in
- Simulcast adapts to bandwidth

---

### Câu 58: Làm sao avoid memory leak khi chạy detection trong thời gian dài?

**Trả lời:**

**Known Issues & Mitigations:**

1. **TensorFlow.js Tensor Leak:**
   ```javascript
   tf.tidy(() => {
       // All tensors created here are auto-disposed
       const prediction = model.predict(tensor);
       return prediction.dataSync();
   });
   ```

2. **Event Array Growth:**
   ```javascript
   // Keep only last 30 minutes
   const cutoff = Date.now() - 30 * 60 * 1000;
   this.events = this.events.filter(e => e.timestamp > cutoff);
   ```

3. **Canvas Context:**
   ```javascript
   // Reuse canvas instead of creating new ones
   const canvas = useRef(document.createElement('canvas'));
   ```

4. **Model Disposal:**
   ```javascript
   useEffect(() => {
       return () => {
           model?.dispose();  // Cleanup on unmount
       };
   }, []);
   ```

**Recommendation:** Page reload mỗi 2 giờ để đảm bảo

---

### Câu 59: Hệ thống có thể bị attack bằng cách nào và làm sao mitigate?

**Trả lời:**

| Attack Vector | Risk | Mitigation |
|---------------|------|------------|
| **Video replay** | High | Liveness detection (planned), face movement check |
| **Virtual camera** | High | SEB blocks virtual devices |
| **Photo of face** | Medium | Blink detection, movement required |
| **Slow motion** | Low | Temporal pattern analysis |
| **Parallel browser** | Medium | Tab switch + blur detection |
| **Remote desktop** | High | Frame rate analysis (planned) |
| **API manipulation** | Low | JWT auth, server-side validation |
| **Evidence tampering** | Low | Server-side recording (Egress) |

**Honest Assessment:**
- Không có giải pháp 100% secure
- Goal: Tạo đủ friction để deter casual cheating
- Sophisticated attacks cần sophisticated detection (future work)

---

### Câu 60: Tại sao chọn TensorFlow.js chạy client-side thay vì server-side inference?

**Trả lời:**

| Tiêu chí | Client-side (đã chọn) | Server-side |
|----------|----------------------|-------------|
| **Privacy** | ✅ Video không rời device | ❌ Video lên server |
| **Latency** | ✅ <100ms | ~300-500ms (network + inference) |
| **Scalability** | ✅ N clients = N GPUs (WebGL) | ❌ Server GPU bottleneck |
| **Cost** | ✅ Client pays compute | ❌ Need GPU servers |
| **Offline** | ✅ Works without internet | ❌ Requires connection |
| **Model security** | ❌ Model exposed to client | ✅ Model protected |
| **Accuracy** | Slightly lower (WebGL) | Slightly higher (CUDA) |

**Kết luận:** Privacy + Latency + Scalability quan trọng hơn cho use case này.

---

## PHẦN O: CÂU HỎI SÂU VỀ FACE VERIFICATION & AI WORKER

### Câu 61: Face Verification sử dụng ArcFace hoạt động như thế nào?

**Trả lời:**

**ArcFace** (Additive Angular Margin Loss) là state-of-the-art face recognition model.

**Quy trình trong `face_verifier.py`:**
```python
# 1. Initialize InsightFace (buffalo_l model)
self.model = FaceAnalysis(name='buffalo_l')
self.model.prepare(ctx_id=0, det_size=(640, 640))

# 2. Extract 512-dim embedding
faces = self.model.get(image)
embedding = faces[0].embedding  # 512-dim vector
embedding = embedding / np.linalg.norm(embedding)  # Normalize

# 3. Compare embeddings (Cosine Similarity)
similarity = np.dot(embedding1, embedding2)
distance = 1 - similarity

# 4. Threshold decision
ARCFACE_THRESHOLD = 0.4  # distance < 0.4 = same person
verified = distance < threshold
```

**Tại sao ArcFace tốt hơn?**
- 512-dim embedding (vs 128 của dlib)
- Cosine margin loss → better angular separation
- Accuracy: 99.83% trên LFW benchmark

---

### Câu 62: Liveness Detection được implement như thế nào để chống photo/video spoof?

**Trả lời:**

**3 Checks trong `check_liveness()`:**

| Check | Method | Weight | Threshold |
|-------|--------|--------|-----------|
| **Blink Detection** | Eye Aspect Ratio (EAR) | 40% | >= 1 blink |
| **Head Movement** | Pose angle delta | 35% | >= 5° rotation |
| **Texture Analysis** | Laplacian variance | 25% | >= 100 |

**Code Implementation:**
```python
# 1. Blink Detection (EAR)
def _calculate_eye_aspect_ratio(eye_landmarks):
    # EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    v1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    v2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    h = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    ear = (v1 + v2) / (2.0 * h)
    return ear  # < 0.21 = eye closed

# 2. Texture Analysis (detect printed photos)
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
laplacian = cv2.Laplacian(gray, cv2.CV_64F)
variance = laplacian.var()
# Low variance = flat texture = likely photo
```

**Decision:**
```python
is_live = confidence >= 60  # Need 60% to pass
```

---

### Câu 63: Eye Aspect Ratio (EAR) là gì và tại sao dùng để detect blink?

**Trả lời:**

**EAR Formula:**
```
EAR = (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)
```
- p1-p4: Horizontal eye width
- p2-p6, p3-p5: Vertical eye heights

**Visualization:**
```
        p2   p3
         \  /
    p1 -------- p4
         /  \
        p6   p5
```

**Threshold:**
- EAR > 0.25: Eye open
- EAR < 0.21: Eye closed (blink)

**Tại sao EAR tốt cho blink detection?**
- Không phụ thuộc kích thước mắt (ratio)
- Robust với góc nghiêng nhẹ
- Real-time computation

---

### Câu 64: Cosine Similarity vs Euclidean Distance cho Face Comparison?

**Trả lời:**

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Cosine Similarity** | `dot(A, B) / (||A|| × ||B||)` | ArcFace (angular) |
| **Euclidean Distance** | `sqrt(Σ(A-B)²)` | dlib (spatial) |

**Trong code:**
```python
if model_type == "arcface":
    # Cosine similarity [0, 1]
    similarity = np.dot(embedding1, embedding2)
    distance = 1 - similarity
else:  # dlib
    # Euclidean distance [0, inf]
    distance = np.linalg.norm(embedding1 - embedding2)
    similarity = 1 / (1 + distance)
```

**Tại sao ArcFace dùng Cosine?**
- Angle-based margin (ArcFace loss function)
- Embeddings đã normalized (unit vector)
- Cosine phù hợp hơn cho angular relationships

---

### Câu 65: Confidence Score được tính như thế nào từ Face Similarity?

**Trả lời:**

**Confidence Levels:**
```python
HIGH_CONFIDENCE = 0.85
MEDIUM_CONFIDENCE = 0.70
LOW_CONFIDENCE = 0.55
```

**Mapping:**
```python
# ArcFace: similarity [0, 1] → confidence [0, 1]
confidence = max(0.0, min(1.0, similarity))

# Message generation
if verified:
    if confidence >= 0.85:
        message = "Identity verified with high confidence"
    elif confidence >= 0.70:
        message = "Identity verified with medium confidence"
    else:
        message = "Identity verified with low confidence - manual review recommended"
```

**Threshold mặc định:**
```python
ARCFACE_THRESHOLD = 0.4  # distance < 0.4 = verified
# Tương đương similarity > 0.6
```

---

### Câu 66: Laplacian Variance để detect photo có hoạt động như thế nào?

**Trả lời:**

**Nguyên lý:**
- Laplacian = 2nd derivative (edge detection)
- High variance = rich texture = real face
- Low variance = flat texture = printed photo

**Implementation:**
```python
def _analyze_texture(frames):
    variances = []
    for frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        variances.append(variance)
    return np.mean(variances)

# Threshold
TEXTURE_VARIANCE_THRESHOLD = 100
if avg_texture >= 100:
    confidence += 25  # Pass
else:
    # Possible photo attack
```

**Limitations:**
- Có thể fail với high-quality photo giữ gần camera
- Cần kết hợp với blink + movement detection

---

## PHẦN P: CÂU HỎI SÂU VỀ COMPOSITE ATTACK DETECTION

### Câu 67: Composite Violation Detector detect những attack patterns nào?

**Trả lời:**

**7 Patterns trong `compositeViolationDetector.ts`:**

| Pattern | Events Required | Time Window | Severity | Confidence |
|---------|-----------------|-------------|----------|------------|
| `SCREEN_CAPTURE` | Screenshot + (Tab/Paste) | 15s | CRITICAL | 90-98% |
| `LOOKUP_PATTERN` | PreSuspicion + Tab/Blur + Paste | 30s | CRITICAL | 95% |
| `SPLIT_SCREEN_CAPTURE` | Resize + Screenshot | 60s | CRITICAL | 95% |
| `TAB_PASTE` | TabSwitch + Paste | 15s | HIGH | 85-95% |
| `BLUR_PASTE` | Blur + Paste | 10s | HIGH | 80% |
| `SPLIT_SCREEN` | Resize + 3+ Blur/Focus pairs | 60s | HIGH | 80% |
| `MULTI_EVENT_BURST` | 4+ suspicious events | 20s | HIGH/CRITICAL | 50-95% |

**Priority Order:**
```javascript
const patterns = [
    detectScreenCapture,     // Highest priority
    detectSplitScreen,       // Includes SPLIT_SCREEN_CAPTURE
    detectLookupPattern,
    detectTabPaste,
    detectBlurPaste,
    detectMultiEventBurst,   // Lowest priority
];
```

---

### Câu 68: TAB_PASTE Pattern Detection hoạt động chi tiết như thế nào?

**Trả lời:**

**Scenario:** User Alt+Tab to ChatGPT → Copy answer → Alt+Tab back → Paste

**Detection Logic:**
```javascript
private detectTabPaste(): CompositeViolation | null {
    const recent = this.getRecentEvents(15000);  // 15s window

    const tabSwitches = recent.filter(e => e.type === 'TAB_SWITCH');
    const pastes = recent.filter(e => e.type === 'PASTE');

    if (tabSwitches.length > 0 && pastes.length > 0) {
        // Find tabs BEFORE paste (within 5s)
        const relevantTabs = tabSwitches.filter(t =>
            pastes.some(p => p.timestamp > t.timestamp && 
                           p.timestamp - t.timestamp < 5000)
        );

        if (relevantTabs.length > 0) {
            // Confidence based on time proximity
            const baseConfidence = 85;
            const timeBonus = closestPair ? Math.max(0, 10 - (gap / 500)) : 0;
            
            return {
                pattern: 'TAB_PASTE',
                severity: 'HIGH',
                confidence: Math.min(95, baseConfidence + timeBonus)
            };
        }
    }
    return null;
}
```

**Key insight:** Tab THEN Paste (trong 5s) mới suspicious, không phải ngược lại.

---

### Câu 69: LOOKUP_PATTERN là gì và tại sao là CRITICAL?

**Trả lời:**

**LOOKUP_PATTERN = Full Cheating Cycle:**
1. PRE_SUSPICION: Nhìn xuống điện thoại để tra cứu
2. TAB_SWITCH/BLUR: Chuyển qua ChatGPT/Google
3. PASTE: Dán câu trả lời

**Code:**
```javascript
private detectLookupPattern(): CompositeViolation | null {
    const recent = this.getRecentEvents(30000);  // 30s window

    const preSuspicion = recent.filter(e => e.type === 'PRE_SUSPICION');
    const tabOrBlur = recent.filter(e => 
        e.type === 'TAB_SWITCH' || e.type === 'BLUR'
    );
    const pastes = recent.filter(e => e.type === 'PASTE');

    // Full lookup: pre-suspicion + tab/blur + paste
    if (preSuspicion.length > 0 && tabOrBlur.length > 0 && pastes.length > 0) {
        return {
            pattern: 'LOOKUP_PATTERN',
            severity: 'CRITICAL',  // Highest severity
            confidence: 95,
            description: 'Phone check + tab switch + paste - full lookup attack'
        };
    }
}
```

**Tại sao CRITICAL?**
- Kết hợp 3 signals = very low false positive
- Là complete cheating workflow

---

### Câu 70: Screenshot Detection được implement như thế nào?

**Trả lời:**

**Frontend Detection (keyboard listener):**
```javascript
// Trong useOptimizedDetection.ts hoặc component
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // PrintScreen
        if (e.key === 'PrintScreen') {
            compositeDetector.recordEvent('SCREENSHOT_ATTEMPT');
        }
        // Win + Shift + S (Windows Snipping Tool)
        if (e.key === 's' && e.shiftKey && e.metaKey) {
            compositeDetector.recordEvent('SCREENSHOT_ATTEMPT');
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Composite Detection:**
```javascript
private detectScreenCapture(): CompositeViolation | null {
    const screenshots = recent.filter(e => e.type === 'SCREENSHOT_ATTEMPT');
    const tabSwitches = recent.filter(e => e.type === 'TAB_SWITCH');
    const pastes = recent.filter(e => e.type === 'PASTE');

    if (screenshots.length > 0) {
        let confidence = 90;
        let severity = 'HIGH';

        // Screenshot + tab/paste = complete capture attack
        if (tabSwitches.length > 0 || pastes.length > 0) {
            confidence = 98;
            severity = 'CRITICAL';
        }
        // ...
    }
}
```

---

### Câu 71: Split Screen Detection phân biệt như thế nào với normal window activity?

**Trả lời:**

**Tiêu chí Split Screen:**
```javascript
COMPOSITE_THRESHOLDS = {
    SPLIT_SCREEN_WINDOW: 60000,    // 60s observation
    BLUR_FOCUS_MIN_PAIRS: 3,       // >= 3 blur/focus pairs
};
```

**Logic:**
```javascript
private detectSplitScreen(): CompositeViolation | null {
    const windowResizes = recent.filter(e => e.type === 'WINDOW_RESIZE');
    const blurs = recent.filter(e => e.type === 'BLUR');
    const focuses = recent.filter(e => e.type === 'FOCUS');

    const blurFocusPairs = Math.min(blurs.length, focuses.length);

    // KEY: Need BOTH resize AND repeated blur/focus
    if (windowResizes.length > 0 && blurFocusPairs >= 3) {
        return {
            pattern: 'SPLIT_SCREEN',
            severity: 'HIGH',
            confidence: 80
        };
    }
}
```

**Tại sao cần Window Resize?**
- Single blur = có thể click nhầm
- Resize + repeated blur/focus = đang đọc side-by-side

---

### Câu 72: Multi-Event Burst Detection có false positive cao không?

**Trả lời:**

**Thresholds:**
```javascript
BURST_WINDOW: 20000,      // 20s
BURST_MIN_EVENTS: 4,      // >= 4 events required
```

**Severity Scaling:**
```javascript
const suspiciousEvents = recent.filter(e => e.type !== 'FOCUS');

const severity = suspiciousEvents.length >= 6 ? 'CRITICAL' : 'HIGH';
const confidence = Math.min(95, 50 + suspiciousEvents.length * 10);
// 4 events = 90%, 5 events = 100% (capped at 95%)
```

**False Positive Prevention:**
1. FOCUS events excluded (normal behavior)
2. High threshold (4 events in 20s)
3. Cooldown 30s between reports

---

### Câu 73: Pattern Cooldown hoạt động như thế nào?

**Trả lời:**

**Mục đích:** Tránh spam cùng một pattern liên tục

**Implementation:**
```javascript
PATTERN_COOLDOWN: 30000,  // 30 seconds

private lastDetectedPatterns: Map<CompositePatternType, number> = new Map();

private shouldReport(pattern: CompositePatternType): boolean {
    const lastTime = this.lastDetectedPatterns.get(pattern);
    if (!lastTime) return true;  // Never detected before
    return Date.now() - lastTime > COMPOSITE_THRESHOLDS.PATTERN_COOLDOWN;
}

// After detection:
this.lastDetectedPatterns.set(violation.pattern, Date.now());
```

**Ví dụ:**
- TAB_PASTE detected at 10:00:00
- Same pattern at 10:00:15 → Ignored (cooldown)
- Same pattern at 10:00:35 → Reported (30s passed)

---

## PHẦN Q: CÂU HỎI VỀ DATA FLOW VÀ API DESIGN

### Câu 74: Evidence Upload Flow chi tiết?

**Trả lời:**

**Egress-based Flow (preferred):**
```
1. Violation detected (client)
   ↓
2. Request Egress clip: POST /api/livekit/egress
   Body: { roomName, duration: 15s }
   ↓
3. Egress service clips from ongoing recording
   ↓
4. Video file saved to MinIO
   ↓
5. Return object key to client
   ↓
6. Create incident with evidence:
   POST /api/incidents
   Body: { type, severity, objectKey, sessionId }
```

**Presigned URL Flow (direct upload):**
```
1. Request presigned URL:
   GET /api/storage/presigned-url?filename=snapshot.jpg
   ↓
2. Response: { uploadUrl, objectKey }
   ↓
3. Upload directly to MinIO (PUT request to presigned URL)
   ↓
4. Create incident with objectKey
```

---

### Câu 75: Incident API có những endpoints nào?

**Trả lời:**

**REST Endpoints (`IncidentController.java`):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/incidents` | List all incidents |
| GET | `/api/incidents/{id}` | Get incident detail |
| GET | `/api/incidents/session/{sessionId}` | Incidents by session |
| POST | `/api/incidents` | Create incident |
| POST | `/api/incidents/{id}/confirm` | Proctor confirm |
| POST | `/api/incidents/{id}/reject` | Proctor reject |
| GET | `/api/incidents/stream` | SSE real-time stream |

**Incident DTO:**
```java
{
    "id": "uuid",
    "sessionId": "uuid",
    "userId": "uuid",
    "type": "LOOKING_AWAY | TAB_SWITCH | ...",
    "severity": "LOW | MEDIUM | HIGH | CRITICAL",
    "status": "PENDING | CONFIRMED | REJECTED",
    "evidenceUrl": "presigned MinIO URL",
    "timestamp": "2026-01-03T23:00:00Z",
    "reviewedBy": "proctor-id",
    "reviewedAt": "..."
}
```

---

### Câu 76: Session State Management hoạt động như thế nào?

**Trả lời:**

**Session States:**
```java
enum SessionStatus {
    PENDING,    // Created, waiting to start
    ACTIVE,     // Exam in progress
    PAUSED,     // Temporarily paused
    ENDED,      // Completed normally
    TERMINATED  // Force ended (cheating)
}
```

**State Transitions:**
```
PENDING → ACTIVE (start exam)
ACTIVE → PAUSED (connection issue)
PAUSED → ACTIVE (reconnect)
ACTIVE → ENDED (submit)
ACTIVE → TERMINATED (max violations)
```

**React State (useSession hook):**
```typescript
const [sessionState, setSessionState] = useState<{
    id: string;
    status: SessionStatus;
    startedAt: Date;
    violations: number;
    currentQuestion: number;
}>();
```

---

### Câu 77: Data Persistence Architecture?

**Trả lời:**

**4 Separate Databases:**

| Database | Service | Data |
|----------|---------|------|
| `identity_db` | Auth/User Service | users, roles, credentials |
| `session_db` | Session Service | exams, sessions, questions, answers |
| `incident_db` | Incident Service | incidents, reviews, behavior logs |
| `bff_db` | BFF Gateway | sessions, rate limits |

**Why separate?**
- Microservices principle
- Independent scaling
- Fault isolation

**Cross-service data sync:**
```
identity_db.users → Debezium → Kafka → session_db.user_shadow
```

---

### Câu 78: Rate Limiting được implement như thế nào?

**Trả lời:**

**BFF Rate Limits:**
```javascript
// Per-IP limits
const rateLimits = {
    default: { requests: 100, windowMs: 60000 },      // 100/min
    '/api/auth/login': { requests: 20, windowMs: 60000 },  // 20/min
    '/api/auth/otp': { requests: 10, windowMs: 60000 },    // 10/min
    '/api/ingest': { requests: 200, windowMs: 60000 },     // 200/min
};
```

**Implementation (Express middleware):**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);
```

---

### Câu 79: Error Handling Strategy?

**Trả lời:**

**Standardized Error Response:**
```json
{
    "status": "error",
    "service": "session-service",
    "action": "startSession",
    "reason": "Exam not found",
    "correlationId": "abcd-1234-5678"
}
```

**Frontend Error Handling:**
```typescript
try {
    const response = await sessionsApi.startSession(examId);
} catch (error) {
    if (error.response?.status === 401) {
        // Redirect to login
        router.push('/login');
    } else if (error.response?.status === 429) {
        // Rate limited
        showToast('Too many requests, please wait');
    } else {
        // Generic error
        showToast(error.message || 'An error occurred');
    }
}
```

**Retry Logic:**
```typescript
async function uploadWithRetry(file, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await upload(file);
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
        }
    }
}
```

---

### Câu 80: Correlation ID được propagate như thế nào?

**Trả lời:**

**BFF generates Correlation ID:**
```javascript
// middleware/correlationId.js
app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || uuid();
    res.setHeader('x-correlation-id', req.correlationId);
    next();
});
```

**Propagate to Backend:**
```javascript
const response = await fetch(backendUrl, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'X-Correlation-ID': req.correlationId
    }
});
```

**Logging với Correlation ID:**
```java
// Spring Boot
@Slf4j
@RestController
public class SessionController {
    @GetMapping("/api/sessions/{id}")
    public Session getSession(
        @PathVariable UUID id,
        @RequestHeader("X-Correlation-ID") String correlationId
    ) {
        log.info("[{}] Getting session {}", correlationId, id);
        // ...
    }
}
```

**Use case:** Trace request qua BFF → Session Service → Incident Service → AI Worker

---

## PHẦN R: CÂU HỎI VỀ TENSORFLOW.JS VÀ MODEL PARAMETERS

### Câu 81: Các models TensorFlow.js được sử dụng và cấu hình như thế nào?

**Trả lời:**

**3 Models chính:**

| Model | Package | Output | Inference Time |
|-------|---------|--------|----------------|
| **BlazeFace** | `@tensorflow-models/blazeface` | Face bounding boxes, probability | ~20ms |
| **MediaPipe FaceMesh** | `@tensorflow-models/face-landmarks-detection` | 478 landmarks | ~30ms |
| **MediaPipe Iris** | Included in FaceMesh | 10 iris points | Included |

**Load Models:**
```javascript
// BlazeFace
const blazeFaceModel = await blazeface.load();

// FaceMesh với Iris landmarks
const faceLandmarksModel = await faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
        runtime: 'mediapipe',
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        maxFaces: 3,        // Detect tối đa 3 faces
        refineLandmarks: true  // Enable iris detection
    }
);
```

---

### Câu 82: TensorFlow.js Backend Selection hoạt động như thế nào?

**Trả lời:**

**Trong `tfBackend.ts`:**
```javascript
export async function initializeTFBackend(): Promise<string> {
    try {
        // 1. Try WebGL first (GPU-accelerated, fastest)
        await tf.setBackend('webgl');
        await tf.ready();

        // Verify WebGL stability with test operation
        const testTensor = tf.randomNormal([100, 100]);
        await testTensor.data();
        testTensor.dispose();

        console.log('✅ WebGL backend initialized');
        return 'webgl';
    } catch (error) {
        console.warn('⚠️ WebGL failed, falling back to WASM');

        // 2. Fallback to WASM (CPU but optimized)
        setWasmPaths('/tfjs-wasm/');  // Self-hosted WASM files
        await tf.setBackend('wasm');
        await tf.ready();

        console.log('✅ WASM backend initialized');
        return 'wasm';
    }
}
```

**Performance so sánh:**
| Backend | Speed | GPU Required | Compatibility |
|---------|-------|--------------|---------------|
| **WebGL** | Fastest | Yes | Most modern browsers |
| **WASM** | Medium | No | All browsers |
| **CPU** | Slowest | No | Universal fallback |

---

### Câu 83: Model Warm-up là gì và tại sao cần thiết?

**Trả lời:**

**Vấn đề:** First inference rất chậm do:
- JIT compilation
- GPU buffer allocation
- Memory optimization

**Giải pháp - Warm-up trước khi exam:**
```javascript
export async function warmUpModels(models) {
    console.log('🔥 Warming up models...');

    // Create dummy tensor matching expected input (320x240 RGB)
    const dummyInput = tf.randomNormal([240, 320, 3]);

    // Run BlazeFace
    if (models.blazeFace) {
        await models.blazeFace.estimateFaces(dummyInput, false);
    }

    // Run FaceLandmarks
    if (models.faceLandmarks) {
        await models.faceLandmarks.estimateFaces({ input: dummyInput });
    }

    dummyInput.dispose();  // Clean up
    console.log('✅ Models warmed up');
}
```

**Kết quả:**
- First real inference: từ ~300ms → ~30ms
- UI không freeze khi bắt đầu detection

---

### Câu 84: Webcam constraints được cấu hình như thế nào?

**Trả lời:**

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    video: {
        width: { ideal: 640 },   // 640x480 is optimal for performance
        height: { ideal: 480 },
        facingMode: 'user',      // Front camera (selfie mode)
        frameRate: { ideal: 30 } // 30fps capture
    },
    audio: false  // No audio needed
});
```

**Tại sao 640x480?**
- BlazeFace input: 256x256 (downscaled)
- FaceMesh internal: 192x192
- Higher res = unnecessary computation
- Lower res = less accurate landmarks

**Canvas setup:**
```javascript
canvas.width = video.videoWidth || 640;
canvas.height = video.videoHeight || 480;
```

---

### Câu 85: Detection Interval và Throttling hoạt động như thế nào?

**Trả lời:**

**Default Interval:**
```javascript
const { intervalMs = 200 } = options;  // 200ms = 5 FPS

useEffect(() => {
    const interval = setInterval(runDetection, intervalMs);
    return () => clearInterval(interval);
}, [intervalMs, runDetection]);
```

**Tại sao 5 FPS thay vì 30 FPS?**
| FPS | CPU Usage | Detection Latency | Use Case |
|-----|-----------|-------------------|----------|
| 30 | ~80% | <50ms | Gaming, real-time tracking |
| 10 | ~50% | ~100ms | Smooth tracking |
| **5** | **~30%** | **~200ms** | Behavior detection (chosen) |
| 2 | ~15% | ~500ms | Power saving |

**Kết luận:** 5 FPS đủ để detect behavior (~2.5s sustained), không cần real-time.

---

### Câu 86: Tensor Memory Management - Làm sao tránh Memory Leak?

**Trả lời:**

**3 Strategies:**

**1. tf.tidy() - Auto-dispose:**
```javascript
tf.tidy(() => {
    const tensor = tf.tensor([1, 2, 3]);
    const result = tensor.square();
    return result.dataSync();  // Tensors auto-disposed after tidy
});
```

**2. Manual dispose():**
```javascript
const tensor = tf.randomNormal([100, 100]);
const data = await tensor.data();
tensor.dispose();  // Must call manually
```

**3. Memory monitoring:**
```javascript
export function getTFStatus() {
    const memory = tf.memory();
    return {
        backend: tf.getBackend(),
        numTensors: memory.numTensors,   // Should be low
        numBytes: memory.numBytes        // Monitor for growth
    };
}
```

**Red flags:**
- numTensors tăng liên tục = leak
- Recommend page reload mỗi 2 giờ

---

## PHẦN S: CÂU HỎI VỀ INSIGHTFACE VÀ AI WORKER

### Câu 87: InsightFace Models và Thresholds trong AI Worker?

**Trả lời:**

**Model Configuration (`face_verifier.py`):**
```python
class FaceVerifier:
    # Thresholds
    ARCFACE_THRESHOLD = 0.4   # distance < 0.4 = same person
    DLIB_THRESHOLD = 0.6      # Euclidean distance for dlib

    # Confidence levels
    HIGH_CONFIDENCE = 0.85
    MEDIUM_CONFIDENCE = 0.70
    LOW_CONFIDENCE = 0.55

    # Liveness thresholds
    EAR_THRESHOLD = 0.21       # Eye Aspect Ratio
    MIN_BLINKS = 1             # Minimum blinks required
    MIN_HEAD_ROTATION = 5.0    # Minimum head rotation degrees
    TEXTURE_VARIANCE_THRESHOLD = 100  # Laplacian variance

    def _initialize_model(self):
        self.model = FaceAnalysis(name='buffalo_l')  # Best accuracy
        self.model.prepare(
            ctx_id=0 if self.use_gpu else -1,
            det_size=(640, 640)
        )
```

**Model Options:**
| Model | Accuracy | Speed | Use Case |
|-------|----------|-------|----------|
| `buffalo_l` | Highest | Slowest | Production |
| `buffalo_s` | Medium | Medium | Balanced |
| `buffalo_sc` | Lower | Fastest | Real-time |

---

### Câu 88: Face Embedding Dimensions và Storage?

**Trả lời:**

**Embedding Dimensions:**
| Library | Dimensions | Size (float32) |
|---------|------------|----------------|
| **ArcFace/InsightFace** | 512 | 2KB |
| **dlib** | 128 | 0.5KB |

**Storage Format:**
```python
@dataclass
class FaceEmbedding:
    embedding: np.ndarray  # 512-dim vector
    model: str             # "arcface" or "dlib"

    def to_list(self) -> List[float]:
        return self.embedding.tolist()

    @classmethod
    def from_list(cls, data: List[float], model: str = "arcface"):
        return cls(embedding=np.array(data, dtype=np.float32), model=model)
```

**Database storage:**
```sql
CREATE TABLE user_embeddings (
    user_id UUID PRIMARY KEY,
    embedding FLOAT4[512],  -- PostgreSQL array
    model VARCHAR(50),
    created_at TIMESTAMP
);
```

---

### Câu 89: AI Worker - RabbitMQ Message Flow?

**Trả lời:**

**Message Queue Setup:**
```yaml
# docker-compose.yml
ai-worker:
    environment:
        RABBITMQ_HOST: rabbitmq
        RABBITMQ_PORT: 5672
        RABBITMQ_USER: guest
        RABBITMQ_PASS: guest
        FACE_VERIFICATION_THRESHOLD: 0.6
        USE_GPU: "false"
```

**Message Flow:**
```
1. Session Service receives face verification request
   ↓
2. Publish to RabbitMQ: queue="face-verification"
   Payload: { userId, referenceImageUrl, probeImageUrl }
   ↓
3. AI Worker consumes message
   ↓
4. Download images from MinIO
   ↓
5. Run verification: FaceVerifier.verify()
   ↓
6. Publish result to RabbitMQ: queue="verification-results"
   Result: { verified, confidence, similarity }
   ↓
7. Session Service receives result → update session
```

---

## PHẦN T: CÂU HỎI VỀ DOCKER INFRASTRUCTURE

### Câu 90: Docker Compose Services Architecture?

**Trả lời:**

**Tổng cộng 14 services:**

| Category | Services |
|----------|----------|
| **Infrastructure** | postgres, redis, rabbitmq, zookeeper, kafka, debezium, minio |
| **Auth** | authorization-server |
| **Backend** | user-service, admin-service, session-service, incident-service |
| **AI** | ai-worker |
| **Media** | livekit, livekit-egress |
| **Gateway** | bff-gateway, nginx |
| **Frontend** | exam-ui |

**Dependency Order:**
```
postgres
├── redis
├── rabbitmq
├── zookeeper → kafka → debezium
├── minio
├── authorization-server
│   ├── user-service
│   ├── admin-service
│   ├── session-service → incident-service
│   └── bff-gateway → nginx
├── ai-worker
└── livekit → livekit-egress
```

---

### Câu 91: Database Configuration trong Docker?

**Trả lời:**

**4 Databases (1 PostgreSQL instance):**
```yaml
postgres:
    image: postgres:16.3
    command:
        - "postgres"
        - "-c" "wal_level=logical"      # For Debezium CDC
        - "-c" "max_wal_senders=4"
        - "-c" "max_replication_slots=4"
    environment:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
    ports:
        - "55432:5432"
```

**Init Script tạo 4 databases:**
```sql
-- infra/docker/postgres/init/00-init.sql
CREATE DATABASE identity_db;
CREATE DATABASE session_db;
CREATE DATABASE incident_db;
CREATE DATABASE bff_db;
```

**Service Connection:**
```yaml
session-service:
    environment:
        SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/session_db
```

---

### Câu 92: LiveKit Configuration?

**Trả lời:**

**Docker Compose:**
```yaml
livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    ports:
        - "7880:7880"       # WebSocket signaling
        - "7881:7881"       # TCP fallback
        - "7882:7882/udp"   # UDP media
        - "3478:3478/udp"   # TURN
        - "50000-50020:50000-50020/udp"  # RTC range
    volumes:
        - ./livekit-docker.yaml:/etc/livekit.yaml
```

**livekit.yaml:**
```yaml
port: 7880
rtc:
    port_range_start: 50000
    port_range_end: 50020
    use_external_ip: false
    tcp_port: 7881
    udp_port: 7882
keys:
    devkey: secret    # API_KEY: API_SECRET
room:
    max_participants: 100
    empty_timeout: 300
turn:
    enabled: true
    domain: localhost
    udp_port: 3478
```

---

### Câu 93: LiveKit Egress Configuration?

**Trả lời:**

**Egress Service:**
```yaml
livekit-egress:
    image: livekit/egress:latest
    environment:
        EGRESS_CONFIG_FILE: /etc/egress.yaml
    cap_add:
        - SYS_ADMIN  # Required for Chrome headless
```

**egress.yaml:**
```yaml
api_key: devkey
api_secret: secret
ws_url: ws://livekit:7880

# Storage configuration
s3:
    access_key: minioadmin
    secret: minioadmin123
    region: us-east-1
    endpoint: http://minio:9000
    bucket: exam-recordings
    force_path_style: true

# Recording settings
room_composite:
    audio_only: false
    video_only: false
    custom_base_url: ""

# Resource limits
cpu_cost:
    room_composite_cpu_cost: 3.0
```

---

### Câu 94: MinIO Object Storage Configuration?

**Trả lời:**

**Docker Setup:**
```yaml
minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
        MINIO_ROOT_USER: minioadmin
        MINIO_ROOT_PASSWORD: minioadmin123
    ports:
        - "9002:9000"   # API
        - "9001:9001"   # Console
```

**Spring Boot Integration:**
```yaml
# session-service environment
MINIO_ENDPOINT: http://minio:9000           # Internal
MINIO_EXTERNAL_ENDPOINT: http://localhost:9002  # Presigned URLs
MINIO_ACCESS_KEY: minioadmin
MINIO_SECRET_KEY: minioadmin123
```

**Buckets:**
| Bucket | Purpose |
|--------|---------|
| `exam-identity` | ID photos, face embeddings |
| `exam-evidence` | Violation snapshots, clips |
| `exam-recordings` | Egress recordings |

---

### Câu 95: Kafka và Debezium CDC Configuration?

**Trả lời:**

**Kafka Setup:**
```yaml
kafka:
    image: confluentinc/cp-kafka:7.5.0
    environment:
        KAFKA_BROKER_ID: 1
        KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
        KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
        KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
```

**Debezium Connector Registration:**
```json
{
    "name": "identity-users-connector",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "database.hostname": "postgres",
        "database.port": "5432",
        "database.user": "postgres",
        "database.password": "postgres",
        "database.dbname": "identity_db",
        "table.include.list": "public.users",
        "topic.prefix": "identity",
        "slot.name": "identity_slot"
    }
}
```

**Data Flow:**
```
identity_db.users (insert/update)
    ↓ Debezium
Kafka topic: identity.public.users
    ↓ Consumer
session_db.user_shadow (sync)
```

---

## PHẦN U: CÂU HỎI VỀ END-TO-END WORKFLOW

### Câu 96: Complete Exam Session Workflow?

**Trả lời:**

```
┌──────────────────────────────────────────────────────────────────┐
│                        EXAM SESSION WORKFLOW                      │
└──────────────────────────────────────────────────────────────────┘

1. PRE-EXAM SETUP
   ├── Student login → Auth Server → JWT issued
   ├── Load TensorFlow.js models (BlazeFace, FaceMesh)
   ├── Request camera permission → getUserMedia
   ├── Connect to LiveKit room → Token from Session Service
   └── Start Egress recording (server-side)

2. CALIBRATION (30 seconds)
   ├── Collect 60 samples: head pose, iris gaze, face area
   ├── Calculate baseline: median values
   └── Validate: enough samples, good lighting, stable face

3. EXAM IN PROGRESS
   ├── Detection loop @ 5 FPS:
   │   ├── BlazeFace: count faces (0/1/2+)
   │   ├── FaceMesh: 478 landmarks
   │   ├── Calculate: headPose, irisGaze, effectiveGaze
   │   ├── Pre-Suspicion: weighted scoring (threshold 35)
   │   ├── Looking Away: pitch/yaw check (3s sustained)
   │   └── Composite patterns: TAB_PASTE, LOOKUP, etc.
   │
   ├── On violation detected:
   │   ├── State Machine: increment count
   │   ├── Evidence capture: Egress clip or snapshot
   │   ├── Upload to MinIO
   │   ├── Create incident in Incident Service
   │   └── SSE notification to Proctor
   │
   └── Answer submission:
       ├── Record to Temporal Analyzer
       ├── Check hadPreSuspicionDuring flag
       └── Save to Session Service

4. POST-EXAM
   ├── Stop Egress recording
   ├── End session: POST /api/sessions/{id}/end
   ├── Generate violation report
   └── Proctor review pending incidents
```

---

### Câu 97: Face Verification Workflow?

**Trả lời:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    FACE VERIFICATION WORKFLOW                     │
└──────────────────────────────────────────────────────────────────┘

1. REGISTRATION (one-time)
   User uploads ID photo
        ↓
   Session Service → RabbitMQ (extract-embedding queue)
        ↓
   AI Worker:
   ├── Download image from MinIO
   ├── FaceVerifier.detect_face() → bbox, face_image
   ├── FaceVerifier.extract_embedding() → 512-dim vector
   └── Return to Session Service → Store in DB

2. EXAM START (real-time)
   Capture snapshot from webcam
        ↓
   Session Service → RabbitMQ (verify-face queue)
        ↓
   AI Worker:
   ├── Load reference embedding from message
   ├── Extract probe embedding from snapshot
   ├── Compare: cosine_similarity(ref, probe)
   ├── Check liveness (optional):
   │   ├── Blink detection (EAR)
   │   ├── Head movement
   │   └── Texture analysis
   └── Return: { verified, confidence, similarity }
        ↓
   Session Service:
   ├── confidence >= 0.6 → Allow exam
   ├── 0.4 <= confidence < 0.6 → Manual review
   └── confidence < 0.4 → Block + alert proctor
```

---

### Câu 98: Violation Detection → Evidence → Incident Workflow?

**Trả lời:**

```
┌──────────────────────────────────────────────────────────────────┐
│                 VIOLATION → INCIDENT WORKFLOW                     │
└──────────────────────────────────────────────────────────────────┘

1. DETECTION (Client - React)
   ├── ViolationStateMachine.recordEvent(type)
   ├── State: OK → WARN (count >= warningThreshold)
   └── shouldCaptureEvidence() → 'snapshot' | 'clip'

2. EVIDENCE CAPTURE
   ├── Option A: Egress Clip
   │   ├── POST /api/livekit/egress/clip
   │   ├── { roomName, duration: 15 }
   │   ├── Egress clips from ongoing recording
   │   └── Returns: { egressId, objectKey }
   │
   └── Option B: Local Snapshot
       ├── canvas.toBlob()
       ├── GET /api/storage/presigned-url
       ├── PUT directly to MinIO
       └── Returns: { objectKey }

3. INCIDENT CREATION
   POST /api/incidents
   {
       sessionId,
       type: "LOOKING_AWAY",
       severity: "WARN",
       objectKey: "evidence/clip_xxx.mp4",
       metadata: { pitch, yaw, confidence }
   }

4. PROCTOR NOTIFICATION (SSE)
   Incident Service → SSE stream
        ↓
   Proctor Dashboard receives new incident

5. PROCTOR REVIEW
   ├── View evidence: GET /api/evidence/{objectKey}
   ├── Confirm: POST /api/incidents/{id}/confirm
   └── Reject: POST /api/incidents/{id}/reject
```

---

### Câu 99: BFF Authentication Flow chi tiết?

**Trả lời:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    BFF AUTHENTICATION FLOW                        │
└──────────────────────────────────────────────────────────────────┘

1. LOGIN REQUEST
   User clicks "Login" → Redirect to Auth Server
   URL: /oauth2/authorize?
        client_id=exam-bff-client&
        redirect_uri=http://localhost:8080/api/auth/callback&
        response_type=code&
        scope=openid+profile+exam.read+exam.write

2. USER AUTHENTICATES
   Auth Server /login page
   User enters credentials
   Auth Server validates → Issues authorization code

3. CALLBACK
   Redirect to: /api/auth/callback?code=abc123
   BFF exchanges code for tokens:
   POST /oauth2/token
   {
       grant_type: "authorization_code",
       code: "abc123",
       client_id: "exam-bff-client",
       client_secret: "exam-bff-secret",
       redirect_uri: "..."
   }
   Response: { access_token, refresh_token, id_token }

4. SESSION CREATION
   BFF:
   ├── Verify id_token
   ├── Extract user info
   ├── Create session in bff_db
   ├── Set SESSION_ID cookie (httpOnly)
   └── Redirect to dashboard

5. AUTHENTICATED REQUESTS
   Frontend → BFF (with SESSION_ID cookie)
        ↓
   BFF: validateSession()
        ↓
   BFF → Backend (with access_token header)
        ↓
   Backend: validate JWT against JWKS
        ↓
   Response flows back through BFF
```

---

### Câu 100: Complete Data Flow từ Frontend đến Database?

**Trả lời:**

```
┌──────────────────────────────────────────────────────────────────┐
│              COMPLETE DATA FLOW: ANSWER SUBMISSION                │
└──────────────────────────────────────────────────────────────────┘

1. USER ACTION
   Student selects answer → Click "Submit"

2. FRONTEND (React)
   ├── Validate input
   ├── temporalAnalyzer.recordAnswer(questionId, time)
   ├── Check hadPreSuspicionDuring
   └── Call API:
       POST /api/sessions/{sessionId}/answers
       Headers: Cookie: SESSION_ID=xxx
       Body: { questionId, answer, timeToAnswerMs }

3. BFF GATEWAY (Next.js)
   ├── Validate session from cookie
   ├── Lookup access_token from bff_db
   ├── Add headers:
   │   Authorization: Bearer {access_token}
   │   X-Correlation-ID: {uuid}
   └── Proxy to: http://session-service:8081/api/answers

4. SESSION SERVICE (Spring Boot)
   ├── Validate JWT (against Auth Server JWKS)
   ├── Extract userId from token claims
   ├── Business logic:
   │   ├── Validate session status = ACTIVE
   │   ├── Validate question belongs to exam
   │   └── Check not already answered
   ├── Save to database:
   │   INSERT INTO answer_logs (...)
   └── Publish event (optional):
       RabbitMQ: "answer.submitted"

5. DATABASE (PostgreSQL - session_db)
   answer_logs:
   ├── id: uuid
   ├── session_id: uuid
   ├── question_id: uuid
   ├── answer: text
   ├── time_to_answer_ms: int
   ├── had_pre_suspicion: boolean
   └── submitted_at: timestamp

6. RESPONSE FLOW
   PostgreSQL → Session Service → BFF → React
   { success: true, answerId: "xxx" }

7. ASYNC PROCESSING
   ├── Kafka CDC captures INSERT
   ├── Analytics service consumes event
   └── Update real-time dashboard (SSE)
```

---

## PHẦN V: CÂU HỎI VỀ DATABASE DESIGN

### Câu 101: Database Schema được thiết kế theo nguyên tắc gì?

**Trả lời:**

**Nguyên tắc Database-per-Service:**
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   identity_db   │  │   session_db    │  │   incident_db   │  │     bff_db      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ users           │  │ exams           │  │ incidents       │  │ sessions        │
│ roles           │  │ sessions        │  │ reviews         │  │ accounts        │
│ user_roles      │  │ questions       │  │ user_shadow     │  │ verification    │
│ oauth2_*        │  │ answers         │  │ session_shadow  │  │ rate_limits     │
│                 │  │ user_shadow     │  │ behavior_logs   │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
       │                     ▲                    ▲
       │                     │                    │
       └─────── CDC ─────────┴────────────────────┘
              (Debezium → Kafka → Shadow Tables)
```

**Lý do:**
- Independent deployment & scaling
- Fault isolation (one DB down ≠ all services down)
- Technology flexibility (có thể dùng NoSQL cho service khác)

---

### Câu 102: Shadow Tables là gì và tại sao cần?

**Trả lời:**

**Vấn đề:** session-service cần user info, nhưng không nên query identity_db (vi phạm microservices principle).

**Giải pháp: Shadow Tables**
```sql
-- session_db: V1__init_schema.sql
CREATE TABLE IF NOT EXISTS user_shadow (
    user_id VARCHAR(255) PRIMARY KEY,  -- OAuth2 subject ID
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50),
    enabled BOOLEAN DEFAULT true,
    deleted BOOLEAN NOT NULL DEFAULT false,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Sync Mechanism:**
```
identity_db.users (INSERT/UPDATE/DELETE)
      ↓
Debezium Connector
      ↓
Kafka topic: identity.public.users
      ↓
session-service KafkaListener
      ↓
session_db.user_shadow (upsert)
```

**Eventually Consistent:** Có delay ~100ms giữa source và shadow.

---

### Câu 103: identity_db Schema chi tiết?

**Trả lời:**

**Core Tables:**

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'CANDIDATE',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles (RBAC)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(32) UNIQUE NOT NULL
);

-- User-Roles (Many-to-Many)
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Enum
CREATE TYPE user_role AS ENUM ('ADMIN', 'PROCTOR', 'REVIEWER', 'CANDIDATE');
```

**OAuth2 Tables (Spring Authorization Server):**
- `oauth2_registered_client`: Client applications
- `oauth2_authorization`: Active tokens
- `oauth2_authorization_consent`: User consents

---

### Câu 104: session_db Schema chi tiết?

**Trả lời:**

```sql
-- Enums
CREATE TYPE session_status AS ENUM ('ACTIVE', 'ENDED', 'ABORTED');
CREATE TYPE event_type AS ENUM ('TAB_SWITCH', 'PASTE', 'FOCUS', 'BLUR');

-- Exams table
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    retention_days INT NOT NULL DEFAULT 30,
    created_by VARCHAR(255),  -- user_shadow.user_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,  -- user_shadow.user_id
    exam_id UUID NOT NULL REFERENCES exams(id),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    status session_status NOT NULL DEFAULT 'ACTIVE'
);

-- Media snapshots (stored in MinIO)
CREATE TABLE media_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    ts BIGINT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,  -- MinIO path
    file_size BIGINT,
    mime_type VARCHAR(100),
    face_count INT
);

-- Browser events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    ts BIGINT NOT NULL,
    event_type event_type NOT NULL,
    details JSONB,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL
);
```

---

### Câu 105: incident_db Schema chi tiết?

**Trả lời:**

```sql
-- Incidents table (Flyway V1__create_incidents_table.sql)
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- LOOKING_AWAY, TAB_SWITCH, etc.
    severity VARCHAR(20) NOT NULL,  -- LOW, MEDIUM, HIGH, CRITICAL
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    object_key TEXT,  -- Evidence path in MinIO
    metadata JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews table (proctor actions)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id),
    reviewer_id VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- CONFIRM, REJECT
    comment TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shadow tables (sync from other services)
CREATE TABLE user_shadow (...);
CREATE TABLE session_shadow (...);

-- Behavior analysis (temporal patterns)
CREATE TABLE behavior_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    score FLOAT NOT NULL,
    details JSONB,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## PHẦN W: CÂU HỎI VỀ RABBITMQ VÀ MESSAGE QUEUES

### Câu 106: RabbitMQ được cấu hình như thế nào trong hệ thống?

**Trả lời:**

**Architecture (RabbitMQConfig.java):**
```java
// Exchange: Topic exchange
public static final String EXCHANGE_NAME = "exam.events";

// Queues
public static final String QUEUE_NAME = "snapshot.process";
public static final String INCIDENT_QUEUE = "incident.create";
public static final String VIDEO_ANALYSIS_QUEUE = "video.analysis";
public static final String FACE_VERIFICATION_QUEUE = "face.verification";
public static final String FACE_VERIFICATION_RESULT_QUEUE = "face.verification.result";
public static final String PRE_SUSPICION_RESULT_QUEUE = "pre_suspicion_results";

// Routing Keys
public static final String ROUTING_KEY = "snapshot.uploaded";
public static final String INCIDENT_ROUTING_KEY = "incident.detected";
public static final String VIDEO_ANALYSIS_ROUTING_KEY = "video.uploaded";
public static final String FACE_VERIFICATION_ROUTING_KEY = "face.verification.request";
```

**Queue Bindings:**
```
exam.events (Topic Exchange)
├── snapshot.uploaded → snapshot.process (Face Detection Worker)
├── incident.detected → incident.create (Incident Service)
├── video.uploaded → video.analysis (Python AI Worker)
├── face.verification.request → face.verification (Python AI Worker)
└── face.verification.result → face.verification.result (Session Service)
```

---

### Câu 107: Message Flow cho Face Verification?

**Trả lời:**

```
┌───────────────────────────────────────────────────────────────────────┐
│                    FACE VERIFICATION MESSAGE FLOW                      │
└───────────────────────────────────────────────────────────────────────┘

1. REQUEST
   Session Service (Java)
        ↓
   rabbitTemplate.convertAndSend(
       "exam.events",
       "face.verification.request",
       { userId, referenceUrl, probeUrl, correlationId }
   )
        ↓
   RabbitMQ Exchange: exam.events
        ↓ routing: face.verification.request
   Queue: face.verification
        ↓
   AI Worker (Python) consumes

2. PROCESSING
   AI Worker:
   ├── Download images from MinIO
   ├── FaceVerifier.verify()
   └── Publish result:
       pika.basic_publish(
           exchange="exam.events",
           routing_key="face.verification.result",
           body={ correlationId, verified, confidence, similarity }
       )

3. RESPONSE
   RabbitMQ Exchange: exam.events
        ↓ routing: face.verification.result
   Queue: face.verification.result
        ↓
   Session Service (Java) @RabbitListener:
   @RabbitListener(queues = "face.verification.result")
   public void handleResult(FaceVerificationResult result) {
       // Update session status
   }
```

---

### Câu 108: Incident Message Flow chi tiết?

**Trả lời:**

```java
// session-service: RuleService.java
// Khi phát hiện violation
rabbitTemplate.convertAndSend(
    RabbitMQConfig.EXCHANGE_NAME,      // "exam.events"
    RabbitMQConfig.INCIDENT_ROUTING_KEY, // "incident.detected"
    IncidentMessage.builder()
        .sessionId(sessionId)
        .userId(userId)
        .type("LOOKING_AWAY")
        .severity("WARN")
        .objectKey("evidence/snapshot_xxx.jpg")
        .metadata(Map.of("pitch", 35.5, "yaw", 12.3))
        .timestamp(Instant.now())
        .build()
);
```

**Consumer (incident-service):**
```java
// IncidentEventConsumer.java
@RabbitListener(queues = "incident.create")
public void handleIncident(IncidentMessage message) {
    Incident incident = Incident.builder()
        .sessionId(message.getSessionId())
        .userId(message.getUserId())
        .type(message.getType())
        .severity(message.getSeverity())
        .objectKey(message.getObjectKey())
        .metadata(message.getMetadata())
        .status("PENDING")
        .build();
    
    incidentRepository.save(incident);
    
    // Notify proctors via SSE
    sseEmitter.send(incident);
}
```

---

### Câu 109: Video Analysis Queue hoạt động như thế nào?

**Trả lời:**

**Use Case:** Phân tích video clip bằng YOLO để detect objects (phone, headphones, notes)

**Message Schema:**
```java
// Publish from EgressService.java
rabbitTemplate.convertAndSend(
    "exam.events",
    "video.uploaded",
    VideoAnalysisRequest.builder()
        .sessionId(sessionId)
        .clipObjectKey("clips/session_xxx_clip_12345.webm")
        .duration(15)  // seconds
        .triggerType("PRE_SUSPICION")
        .correlationId(UUID.randomUUID().toString())
        .build()
);
```

**Python AI Worker Consumer:**
```python
def callback(ch, method, properties, body):
    request = json.loads(body)
    
    # Download clip from MinIO
    clip_path = download_from_minio(request['clipObjectKey'])
    
    # YOLO object detection
    detections = yolo_detect(clip_path)
    
    # Publish result
    result = {
        'correlationId': request['correlationId'],
        'sessionId': request['sessionId'],
        'detections': detections,  # [{class: 'phone', confidence: 0.92, frame: 45}]
        'isViolation': any(d['class'] in FORBIDDEN_OBJECTS for d in detections)
    }
    
    channel.basic_publish(
        exchange='exam.events',
        routing_key='ai.violations',
        body=json.dumps(result)
    )
```

---

## PHẦN X: CÂU HỎI VỀ SYNC VÀ ASYNC PATTERNS

### Câu 110: Synchronous vs Asynchronous Communication trong hệ thống?

**Trả lời:**

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| **Sync (REST)** | User-facing APIs, CRUD | BFF → Session Service |
| **Async (RabbitMQ)** | AI processing, cross-service events | Session → Incident |
| **Event-Driven (SSE)** | Real-time notifications | Incident → Proctor UI |
| **CDC (Debezium)** | Data sync across databases | identity → session |

**Diagram:**
```
┌──────────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION PATTERNS                             │
└──────────────────────────────────────────────────────────────────────┘

SYNCHRONOUS (REST/HTTP):
   React → BFF → Session Service → PostgreSQL
   Latency: <100ms, Blocking, Consistent

ASYNCHRONOUS (RabbitMQ):
   Session Service → [Queue] → Incident Service
   Session Service → [Queue] → AI Worker
   Latency: ~100-500ms, Non-blocking, Eventually Consistent

EVENT-DRIVEN (SSE):
   Incident Service → [SSE Stream] → Proctor Dashboard
   One-way, Real-time push

CDC (CHANGE DATA CAPTURE):
   identity_db → Debezium → Kafka → session_db
   Automatic sync on DB changes
```

---

### Câu 111: Khi nào dùng Sync vs Async?

**Trả lời:**

| Criteria | Use Sync (REST) | Use Async (Queue) |
|----------|-----------------|-------------------|
| **Latency** | <100ms required | 100ms-5s acceptable |
| **User waiting?** | Yes | No |
| **Processing time** | <1s | >1s (AI, video) |
| **Failure handling** | Immediate error | Retry later |
| **Cross-service** | Same domain | Different domains |
| **Volume** | Low-medium | High (spikes) |

**Ví dụ trong hệ thống:**

**Sync:**
- Get exam details: User đang chờ → REST
- Submit answer: Cần confirm ngay → REST
- Login: Blocking until complete → REST

**Async:**
- Face verification: AI xử lý 1-2s → Queue
- Video analysis: YOLO xử lý 5-10s → Queue
- Create incident: Không cần user wait → Queue
- Send notification: Fire-and-forget → Queue

---

### Câu 112: Debezium CDC hoạt động như thế nào?

**Trả lời:**

**PostgreSQL Configuration:**
```yaml
postgres:
    command:
        - "-c" "wal_level=logical"      # Enable logical replication
        - "-c" "max_wal_senders=4"
        - "-c" "max_replication_slots=4"
```

**Debezium Connector:**
```json
{
    "name": "identity-users-connector",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "database.hostname": "postgres",
        "database.dbname": "identity_db",
        "table.include.list": "public.users",
        "topic.prefix": "identity",
        "slot.name": "identity_slot",
        "publication.name": "dbz_publication"
    }
}
```

**Kafka Topic Format:**
- Topic: `identity.public.users`
- Message: CDC event (before/after state)

**Consumer (Session Service):**
```java
@KafkaListener(topics = "identity.public.users")
public void handleUserChange(ConsumerRecord<String, String> record) {
    UserCdcEvent event = objectMapper.readValue(record.value());
    
    if (event.getOp().equals("c") || event.getOp().equals("u")) {
        // INSERT or UPDATE
        userShadowRepository.upsert(event.getAfter());
    } else if (event.getOp().equals("d")) {
        // DELETE
        userShadowRepository.markDeleted(event.getBefore().getId());
    }
}
```

---

### Câu 113: Message Durability và Reliability?

**Trả lời:**

**RabbitMQ Durability:**
```java
// Durable queue (survives broker restart)
@Bean
public Queue snapshotProcessQueue() {
    return QueueBuilder.durable(QUEUE_NAME).build();
}

// Durable exchange
@Bean
public TopicExchange examEventsExchange() {
    return new TopicExchange(EXCHANGE_NAME, true, false);
    //                                       ^^^^
    //                                      durable
}
```

**Message Acknowledgment:**
```java
@RabbitListener(queues = "incident.create")
public void handleIncident(IncidentMessage message, Channel channel, 
                           @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
    try {
        // Process message
        incidentRepository.save(incident);
        
        // Manual ACK
        channel.basicAck(tag, false);
    } catch (Exception e) {
        // NACK - requeue
        channel.basicNack(tag, false, true);
    }
}
```

**Dead Letter Queue (DLQ):**
```java
@Bean
public Queue incidentQueue() {
    return QueueBuilder.durable("incident.create")
        .withArgument("x-dead-letter-exchange", "dlx")
        .withArgument("x-dead-letter-routing-key", "incident.failed")
        .build();
}
```

---

### Câu 114: Idempotency trong Message Processing?

**Trả lời:**

**Vấn đề:** Message có thể được deliver nhiều lần (network issue, retry)

**Giải pháp 1: Idempotency Key trong Database**
```sql
-- events table
CREATE TABLE events (
    id UUID PRIMARY KEY,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,  -- Unique per message
    ...
);
```

**Giải pháp 2: Check before insert**
```java
@RabbitListener(queues = "incident.create")
public void handleIncident(IncidentMessage message) {
    // Check if already processed
    if (incidentRepository.existsByCorrelationId(message.getCorrelationId())) {
        log.info("Duplicate message, skipping: {}", message.getCorrelationId());
        return;  // Acknowledge but don't process
    }
    
    // Process normally
    incidentRepository.save(incident);
}
```

**Giải pháp 3: Redis deduplication**
```java
public boolean shouldProcess(String messageId) {
    return redisTemplate.opsForValue()
        .setIfAbsent("processed:" + messageId, "1", Duration.ofHours(1));
}
```

---

### Câu 115: SSE (Server-Sent Events) cho Real-time Notifications?

**Trả lời:**

**Use Case:** Push new incidents to Proctor Dashboard

**Backend (Spring Boot):**
```java
@RestController
@RequestMapping("/api/incidents")
public class IncidentStreamController {
    
    private final SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
    
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<IncidentDto>> streamIncidents() {
        return incidentFlux
            .map(incident -> ServerSentEvent.<IncidentDto>builder()
                .id(incident.getId().toString())
                .event("new-incident")
                .data(incident)
                .build());
    }
    
    // Called when new incident is created
    public void notifyProctors(Incident incident) {
        incidentSink.tryEmitNext(IncidentDto.from(incident));
    }
}
```

**Frontend (React):**
```typescript
useEffect(() => {
    const eventSource = new EventSource('/api/incidents/stream', {
        withCredentials: true
    });
    
    eventSource.addEventListener('new-incident', (event) => {
        const incident = JSON.parse(event.data);
        addNotification(incident);
        playAlertSound();
    });
    
    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        // Reconnect logic
    };
    
    return () => eventSource.close();
}, []);
```

**SSE vs WebSocket:**
| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client only | Bidirectional |
| Reconnect | Auto built-in | Manual |
| Complexity | Simple | Complex |
| Use case | Notifications | Chat, gaming |

---

*Tổng số câu hỏi: 115*
*Cập nhật: 04/01/2026*







