# Chương 4: Kết Luận và Hướng Phát Triển

## 4.1. Tổng Kết Kết Quả Thực Hiện

### 4.1.1. Các Mục Tiêu Đã Hoàn Thành

#### ✅ Hệ Thống Phát Hiện Gian Lận Real-time

| Chức năng | Trạng thái | Mô tả |
|-----------|------------|-------|
| **Phát hiện No Face** | ✅ Hoàn thành | Cảnh báo khi không phát hiện khuôn mặt trong khung hình |
| **Phát hiện Multiple Faces** | ✅ Hoàn thành | Phát hiện có nhiều người trong khung hình |
| **Phát hiện Looking Away** | ✅ Hoàn thành | Phát hiện nhìn ra ngoài màn hình với ngưỡng sustained 2.5s |
| **Pre-Suspicion Detection** | ✅ Hoàn thành | Phát hiện hành vi chuẩn bị gian lận (cúi đầu, quay ngang) |
| **Tab Switch Detection** | ✅ Hoàn thành | Phát hiện chuyển tab trong khi làm bài |
| **Copy/Paste Detection** | ✅ Hoàn thành | Chặn và ghi nhận hành vi copy/paste |
| **Screenshot Detection** | ✅ Hoàn thành | Phát hiện và chặn chụp màn hình |

#### ✅ Kiến Trúc Microservices

| Thành phần | Trạng thái | Công nghệ |
|------------|------------|-----------|
| **Auth Server** | ✅ Hoàn thành | Spring Authorization Server + OAuth 2.0 + PKCE |
| **Session Service** | ✅ Hoàn thành | Spring Boot + PostgreSQL + Flyway |
| **Incident Service** | ✅ Hoàn thành | Spring Boot + SSE + RabbitMQ |
| **User Service** | ✅ Hoàn thành | Spring Boot + PostgreSQL |
| **BFF Gateway** | ✅ Hoàn thành | Node.js + Express + Prisma |
| **AI Worker** | ✅ Hoàn thành | Python + InsightFace + OpenCV |

#### ✅ Tích Hợp AI/ML

| Tính năng | Công nghệ | Hiệu suất |
|-----------|-----------|-----------|
| **Face Detection** | BlazeFace (TensorFlow.js) | ~20ms/frame |
| **Face Landmarks** | MediaPipe FaceMesh | ~30ms/frame, 468 landmarks |
| **Iris Tracking** | MediaPipe Iris | 10 iris landmarks |
| **Head Pose Estimation** | PnP Algorithm | pitch, yaw, roll ± 2° |
| **Gaze Estimation** | Kappa-corrected Iris Gaze | Kết hợp head + eye direction |
| **Face Verification** | ArcFace/InsightFace | Cosine similarity > 0.6 |

#### ✅ Hạ Tầng Streaming & Storage

| Thành phần | Trạng thái | Đặc điểm |
|------------|------------|----------|
| **LiveKit WebRTC** | ✅ Hoàn thành | SFU, Simulcast, < 100ms latency |
| **LiveKit Egress** | ✅ Hoàn thành | Server-side video recording |
| **MinIO Object Storage** | ✅ Hoàn thành | S3-compatible, presigned URLs |
| **SSE Real-time Push** | ✅ Hoàn thành | Incident notifications |
| **CDC Sync (Debezium)** | ✅ Hoàn thành | Cross-service data sync |

#### ✅ Giao Diện Người Dùng

| Trang | Trạng thái | Chức năng |
|-------|------------|-----------|
| **Trang Đăng nhập** | ✅ Hoàn thành | OAuth 2.0 + PKCE flow |
| **Trang Làm bài thi** | ✅ Hoàn thành | Real-time detection, warnings |
| **Dashboard Giám thị** | ✅ Hoàn thành | Multi-view, incident list, SSE |
| **Dashboard Admin** | ✅ Hoàn thành | Exam management, reports |
| **Trang Xác thực danh tính** | ✅ Hoàn thành | Face verification trước thi |

---

### 4.1.2. Số Liệu Kỹ Thuật

| Metric | Giá trị | Ghi chú |
|--------|---------|---------|
| **Tổng số dòng code** | ~50,000+ lines | Không tính dependencies |
| **Số lượng services** | 6 microservices | + 1 AI worker |
| **Số lượng API endpoints** | 80+ endpoints | REST + WebSocket |
| **Detection FPS** | 5 FPS | 200ms interval |
| **End-to-end latency** | < 500ms | Detection → Warning display |
| **Video streaming latency** | < 100ms | WebRTC glass-to-glass |
| **Database tables** | 20+ tables | Across 4 databases |

---

## 4.2. Khiếm Khuyết và Hạn Chế

### 4.2.1. Hạn Chế Về Kỹ Thuật

| Vấn đề | Mô tả | Mức độ ảnh hưởng |
|--------|-------|------------------|
| **False Positives** | Pre-suspicion có thể trigger sai khi người dùng cúi đầu đọc câu hỏi dài | Trung bình |
| **Lighting Dependency** | Độ chính xác giảm trong điều kiện ánh sáng yếu hoặc backlight | Trung bình |
| **Single Camera** | Chỉ hỗ trợ 1 camera, không detect phone bằng camera phụ | Thấp |
| **Browser Dependency** | Phụ thuộc WebRTC/WebGL support của browser | Thấp |
| **Mobile Support** | Chưa tối ưu cho mobile devices | Trung bình |

### 4.2.2. Hạn Chế Về Chức Năng

| Chức năng | Trạng thái | Lý do |
|-----------|------------|-------|
| **Audio Monitoring** | ❌ Chưa triển khai | Privacy concerns, complexity |
| **Screen Recording** | ❌ Chưa triển khai | Bandwidth, storage constraints |
| **Multi-language Support** | ⚠️ Một phần | UI tiếng Việt, docs tiếng Anh |
| **Offline Mode** | ❌ Không hỗ trợ | Yêu cầu kết nối real-time |
| **Export Reports (PDF)** | ⚠️ Một phần | Chỉ có CSV export |

### 4.2.3. Hạn Chế Về Hiệu Suất

| Vấn đề | Chi tiết | Workaround hiện tại |
|--------|----------|---------------------|
| **CPU Usage cao** | TensorFlow.js tiêu tốn ~30-50% CPU | WebGL backend, 5 FPS throttle |
| **Memory Leak** | Long sessions có thể leak memory | Page reload mỗi 2 giờ |
| **Concurrent Users** | Chưa test > 100 concurrent | Horizontal scaling ready |
| **Video Storage** | Egress videos ~2MB/15s | Retention policy 30 days |

### 4.2.4. Vấn Đề Đã Biết (Known Issues)

1. **Stale Closure Bug**: ✅ Đã fix - `enabled` state bị stale trong callbacks
2. **Pre-suspicion quá nhạy**: ✅ Đã fix - Tăng ngưỡng pitch từ 12° lên 25°
3. **Egress không trigger**: ✅ Đã fix - Sử dụng refs thay vì captured values
4. **Gaze Direction sai**: ⚠️ Đang theo dõi - irisGaze âm khi pitch dương

---

## 4.3. Hướng Phát Triển Trong Tương Lai

### 4.3.1. Cải Thiện Ngắn Hạn (3-6 tháng)

| Ưu tiên | Cải thiện | Mô tả |
|---------|-----------|-------|
| **P0** | Adaptive Thresholds | Tự động điều chỉnh ngưỡng dựa trên calibration |
| **P0** | False Positive Reduction | ML model để phân biệt đọc bài vs nhìn phone |
| **P1** | Mobile Responsive | Tối ưu UI cho tablet và mobile |
| **P1** | Liveness Detection | Chống spoofing bằng ảnh/video |
| **P2** | Multi-language UI | Hỗ trợ English, Vietnamese, Chinese |
| **P2** | PDF Report Export | Xuất báo cáo chi tiết dạng PDF |

### 4.3.2. Phát Triển Trung Hạn (6-12 tháng)

| Tính năng | Mô tả | Công nghệ đề xuất |
|-----------|-------|-------------------|
| **Audio Analysis** | Phát hiện giọng nói/tiếng ồn bất thường | Web Audio API + Speech Recognition |
| **Object Detection** | Phát hiện điện thoại, tài liệu trong khung hình | YOLO/MobileNet |
| **Behavioral Biometrics** | Typing patterns, mouse movements | Custom ML model |
| **Plagiarism Detection** | So sánh câu trả lời giữa các thí sinh | NLP + Similarity algorithms |
| **Proctoring AI Assistant** | Chatbot hỗ trợ giám thị | LLM integration |

### 4.3.3. Tầm Nhìn Dài Hạn (12-24 tháng)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROADMAP 2025-2026                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Q1 2025: Foundation Improvements                                   │
│  ├── Adaptive thresholds với ML                                    │
│  ├── Mobile-first redesign                                         │
│  └── Kubernetes deployment                                          │
│                                                                     │
│  Q2 2025: Advanced Detection                                        │
│  ├── Multi-modal analysis (video + audio)                          │
│  ├── Object detection (phone, notes)                               │
│  └── Cross-exam cheating detection                                  │
│                                                                     │
│  Q3 2025: AI Enhancement                                            │
│  ├── Self-learning threshold optimization                          │
│  ├── Anomaly detection with autoencoders                           │
│  └── Explainable AI for proctors                                    │
│                                                                     │
│  Q4 2025: Enterprise Features                                       │
│  ├── Multi-tenant SaaS architecture                                │
│  ├── SSO integration (SAML, OIDC)                                  │
│  └── Compliance certifications (SOC2, GDPR)                        │
│                                                                     │
│  2026: Next Generation                                              │
│  ├── AR/VR exam environments                                       │
│  ├── Blockchain-based certificate verification                     │
│  └── Global distributed infrastructure                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3.4. Các Cải Tiến Kiến Trúc

| Hiện tại | Đề xuất | Lợi ích |
|----------|---------|---------|
| Docker Compose | Kubernetes | Auto-scaling, self-healing |
| PostgreSQL single | PostgreSQL cluster + read replicas | High availability |
| MinIO single | MinIO distributed | Data redundancy |
| Monolithic frontend | Micro-frontends | Independent deployments |
| REST polling (một số chỗ) | Full WebSocket/gRPC | Lower latency |

---

## 4.4. Kết Luận

### 4.4.1. Đánh Giá Tổng Quan

Đề tài **"Hệ thống phát hiện gian lận thi trực tuyến"** đã được xây dựng thành công với các mục tiêu chính:

1. **✅ Phát hiện gian lận real-time**: Hệ thống có thể phát hiện các hành vi gian lận phổ biến (nhìn ra ngoài, không có mặt, nhiều người) với độ trễ < 500ms.

2. **✅ Kiến trúc hiện đại**: Áp dụng microservices, event-driven architecture, và các best practices trong phát triển phần mềm.

3. **✅ Client-side AI**: TensorFlow.js cho phép chạy AI inference trên browser, giảm tải server và đảm bảo privacy.

4. **✅ Real-time streaming**: LiveKit WebRTC cung cấp video streaming chất lượng cao với latency thấp.

5. **✅ Bằng chứng số**: MinIO lưu trữ snapshot/video clip làm bằng chứng cho mỗi vi phạm.

### 4.4.2. Đóng Góp Khoa Học

1. **Multi-signal Fusion Strategy**: Kết hợp head pose, iris gaze, face distance với weighted scoring để phát hiện pre-suspicion patterns.

2. **Kappa Angle Correction**: Áp dụng hiệu chỉnh góc Kappa (~5°) để cải thiện độ chính xác gaze estimation.

3. **Temporal Pattern Analysis**: Phân tích behavioral patterns theo thời gian để phát hiện gian lận tinh vi.

4. **Hybrid Evidence Collection**: Kết hợp client-side snapshots và server-side video recording để tối ưu bandwidth.

### 4.4.3. Bài Học Kinh Nghiệm

| Khía cạnh | Bài học |
|-----------|---------|
| **Architecture** | Microservices cần được thiết kế cẩn thận với clear boundaries |
| **Real-time** | WebRTC/SSE phù hợp hơn polling cho real-time features |
| **AI on Client** | TensorFlow.js powerful nhưng cần optimize để không drain resources |
| **Testing** | Integration tests quan trọng hơn unit tests cho distributed systems |
| **DevOps** | Docker Compose đủ cho development, Kubernetes cần cho production |

### 4.4.4. Lời Kết

Hệ thống đã đạt được mục tiêu ban đầu là xây dựng một giải pháp phát hiện gian lận thi trực tuyến hoàn chỉnh, từ detection đến notification đến evidence storage. Mặc dù còn một số hạn chế cần cải thiện, nền tảng kiến trúc vững chắc cho phép mở rộng và phát triển thêm các tính năng advanced trong tương lai.

Với sự phát triển của AI và computer vision, các phiên bản tiếp theo có thể tích hợp thêm nhiều phương pháp phát hiện thông minh hơn, hướng tới mục tiêu tạo ra một môi trường thi trực tuyến công bằng và tin cậy cho tất cả các bên liên quan.

---

*Hoàn thành: 27/12/2024*
