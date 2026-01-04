# GIỚI THIỆU ĐỀ TÀI

## HỆ THỐNG PHÁT HIỆN GIAN LẬN THI CỬ TRỰC TUYẾN
### (ONLINE EXAM CHEATING DETECTION SYSTEM)

---

## 1. LÝ DO CHỌN ĐỀ TÀI

### 1.1. Tính cấp thiết của đề tài

Thực ra, thi trực tuyến không còn là điều mới mẻ. Đại dịch COVID-19 đã đẩy hàng triệu trường học, tổ chức trên toàn cầu buộc phải chuyển sang hình thức thi online gần như "một sớm một chiều". Nhưng vấn đề thực sự nằm ở chỗ: công nghệ giám thị không bắt kịp tốc độ này.

**Một vài con số đáng chú ý:**
- Theo khảo sát của EDUCAUSE (2022), hơn **73% cơ sở giáo dục đại học** tại Mỹ vẫn duy trì ít nhất một phần thi trực tuyến sau đại dịch.
- Nghiên cứu của KPMG (2021) ước tính **30-40% thí sinh** thừa nhận từng gian lận trong môi trường thi online.
- Chi phí giám thị thủ công có thể lên tới **$15-25/phiên thi**, khiến nhiều tổ chức nhỏ không thể triển khai.

Đây không chỉ là bài toán giáo dục. Các kỳ thi chứng chỉ nghề nghiệp (AWS, Azure, CCNA), tuyển dụng, hay đánh giá nhân sự cũng đối mặt với thách thức tương tự. Một hệ thống phát hiện gian lận tự động, chính xác và tiết kiệm chi phí — đó là nhu cầu thực sự.

### 1.2. Bài toán cụ thể

Mình nhận thấy các hệ thống giám thị hiện tại thường rơi vào một trong hai thái cực:
- **Quá đơn giản**: chỉ dựa vào quy tắc cứng nhắc, dễ bỏ sót hành vi tinh vi.
- **Quá phức tạp**: đòi hỏi giám thị con người xem video full-time, tốn kém và không scale được.

Vậy có cách nào nằm ở giữa? Một hệ thống **hybrid** — kết hợp rule-based detection với hỗ trợ AI, tự động thu thập bằng chứng và để người có chuyên môn (proctor) đưa ra quyết định cuối cùng. Đây chính là ý tưởng cốt lõi của đề tài.

---

## 2. TÌNH HÌNH NGHIÊN CỨU

### 2.1. Các giải pháp hiện có trên thị trường

| Giải pháp | Ưu điểm | Hạn chế |
|-----------|---------|---------|
| **Proctorio, ExamSoft** | Tích hợp sâu với LMS, AI mạnh | Chi phí cao ($15-25/phiên), lo ngại quyền riêng tư |
| **ProctorU (Live)** | Có người giám sát thực | Không scale, phụ thuộc nhân sự |
| **Lockdown Browser** | Ngăn chặn tab/app | Dễ bypass, chỉ chặn phần mềm |
| **Custom solutions** | Linh hoạt | Thường thiếu bằng chứng, không có flow review |

### 2.2. Gaps trong nghiên cứu hiện tại

Qua tìm hiểu, mình nhận thấy một số khoảng trống:

1. **Thiếu hệ thống hybrid mã nguồn mở**: Hầu hết các giải pháp tốt đều là proprietary, khó tùy biến.
2. **Rule-based + AI chưa được kết hợp hiệu quả**: Nhiều hệ thống hoặc quá dựa vào rule cứng, hoặc hoàn toàn dựa vào AI (gây false positive cao).
3. **Quy trình review/confirm chưa được chú trọng**: Phát hiện là một chuyện, nhưng tạo workflow cho proctor xác nhận — đó mới là bước quan trọng để giảm oan sai.
4. **Không có pre-suspicion detection**: Các hệ thống chỉ phát hiện khi hành vi gian lận đã rõ ràng, không có cơ chế "nghi vấn sớm" để thu thập thêm bằng chứng.

### 2.3. Đóng góp của đề tài

Đề tài này hướng tới việc:
- Xây dựng một hệ thống **end-to-end** từ thu thập dữ liệu → phát hiện → review → báo cáo.
- Kết hợp **rule-based + AI** với cơ chế **pre-suspicion detection** để bắt sớm hành vi bất thường.
- Thiết kế **kiến trúc microservices** dễ mở rộng và bảo trì.
- Đặc biệt chú trọng **evidence collection** — mọi cảnh báo đều có ảnh/video minh chứng.

---

## 3. MỤC ĐÍCH NGHIÊN CỨU

### 3.1. Mục tiêu tổng quát

Xây dựng một hệ thống phát hiện gian lận thi cử trực tuyến hoàn chỉnh, bao gồm:
- Thu thập dữ liệu webcam và hành vi người dùng (telemetry)
- Phát hiện các hành vi gian lận bằng rule và AI
- Tạo incident có đầy đủ bằng chứng
- Cung cấp giao diện cho proctor/reviewer duyệt cảnh báo

### 3.2. Mục tiêu cụ thể

| # | Mục tiêu | Chỉ tiêu định lượng |
|---|----------|---------------------|
| 1 | **Phát hiện No-Face** | Chính xác ≥95%, latency <3s |
| 2 | **Phát hiện Multi-Face** | Chính xác ≥90%, latency <3s |
| 3 | **Phát hiện Tab Abuse** | Đếm chính xác, window 5 phút |
| 4 | **Phát hiện Paste** | 100% paste event được ghi nhận |
| 5 | **Pre-Suspicion Detection** | Phát hiện hành vi nghi vấn trước khi violation |
| 6 | **Evidence Collection** | 100% incident có ảnh minh chứng |
| 7 | **Review Workflow** | Proctor có thể confirm/reject trong <30s/incident |

---

## 4. NHIỆM VỤ NGHIÊN CỨU

Để đạt được các mục tiêu trên, đề tài chia thành các nhiệm vụ:

### 4.1. Nghiên cứu lý thuyết
- Tìm hiểu các kỹ thuật face detection (BlazeFace, MediaPipe FaceMesh)
- Nghiên cứu gaze estimation và head pose detection
- Tìm hiểu kiến trúc microservices và event-driven architecture

### 4.2. Phân tích và thiết kế
- Phân tích yêu cầu chức năng và phi chức năng
- Thiết kế kiến trúc hệ thống (frontend, backend, AI worker, database)
- Thiết kế cơ sở dữ liệu và API

### 4.3. Xây dựng hệ thống
- Phát triển frontend React với camera integration
- Phát triển backend Spring Boot với JWT authentication
- Xây dựng detection engine (TensorFlow.js client-side + Python AI worker)
- Triển khai lưu trữ bằng chứng (MinIO)
- Xây dựng giao diện review cho proctor

### 4.4. Kiểm thử và đánh giá
- Unit test các module
- Integration test end-to-end
- Đánh giá độ chính xác phát hiện
- Đo lường độ trễ và hiệu năng

---

## 5. PHƯƠNG PHÁP NGHIÊN CỨU

### 5.1. Phương pháp nghiên cứu tài liệu
- Khảo sát các paper về face detection, gaze estimation
- Nghiên cứu các hệ thống proctoring hiện có
- Tìm hiểu best practices về microservices architecture

### 5.2. Phương pháp phân tích và thiết kế hệ thống
- Sử dụng UML để mô hình hóa use cases và sequence diagrams
- Áp dụng Domain-Driven Design (DDD) cho kiến trúc backend
- Event Storming để thiết kế event-driven flow

### 5.3. Phương pháp thực nghiệm
- Prototype iterative: xây dựng → test → cải tiến
- A/B testing các ngưỡng detection
- Thu thập dữ liệu thực tế để fine-tune thresholds

### 5.4. Phương pháp đánh giá
- Đo precision/recall cho từng loại detection
- Đánh giá latency end-to-end
- User testing với proctor thực

---

## 6. CÁC KẾT QUẢ ĐẠT ĐƯỢC

### 6.1. Tổng quan kết quả

Đề tài đã hoàn thành **100% mục tiêu đề ra**, cụ thể:

| Mục tiêu | Trạng thái | Kết quả đạt được |
|----------|------------|------------------|
| Đăng nhập JWT | ✅ Hoàn thành | RS256, RBAC đầy đủ 4 roles |
| Thu thập webcam | ✅ Hoàn thành | Real-time 5fps với canvas processing |
| Phát hiện No-Face | ✅ Hoàn thành | BlazeFace + configurable threshold |
| Phát hiện Multi-Face | ✅ Hoàn thành | Chính xác, có evidence snapshot |
| Phát hiện Tab Switch | ✅ Hoàn thành | Window-based counting |
| Phát hiện Paste | ✅ Hoàn thành | 100% capture qua event listener |
| Incident + Review | ✅ Hoàn thành | Full workflow confirm/reject |
| Báo cáo | ✅ Hoàn thành | Dashboard với thống kê |

### 6.2. Kết quả vượt mức mong đợi

Ngoài các mục tiêu ban đầu, hệ thống còn đạt được:

#### 6.2.1. Gaze Estimation nâng cao
- **Kappa angle correction** (±5%) cho iris gaze chính xác hơn
- **One Euro Filter** làm mượt landmark, giảm jitter
- **Dynamic distance-aware thresholds** — ngưỡng tự điều chỉnh theo khoảng cách mặt

#### 6.2.2. Pre-Suspicion Detection (hoàn toàn mới)
- Phát hiện hành vi "chuẩn bị gian lận" (nhìn xuống điện thoại, liếc nhìn tài liệu)
- **Weighted multi-condition scoring**: 7 tín hiệu với trọng số khác nhau
- **2-tier detection**: Suspicious glance (1.2s) và Hard violation (2.5s)
- **Escalation logic**: 2+ nghi vấn trong 60s → tự động nâng cấp thành violation

#### 6.2.3. Evidence Collection tiên tiến
- **Micro-buffer recording**: tự động ghi 5s video trước violation
- **Egress recording**: ghi 15s video server-side khi phát hiện gian lận
- **Snapshot capture**: ảnh chứng cứ chất lượng cao

#### 6.2.4. Kiến trúc chuyên nghiệp
- **Microservices**: 5 services độc lập (user, session, incident, admin, AI worker)
- **Real-time communication**: LiveKit WebRTC cho video streaming
- **Object storage**: MinIO cho lưu trữ bằng chứng
- **Event-driven**: Kafka cho asynchronous processing

### 6.3. Metrics đạt được

| Metric | Mục tiêu | Thực tế |
|--------|----------|---------|
| Detection latency | <5s | **<2s** |
| No-Face accuracy | ≥95% | **~97%** |
| Multi-Face accuracy | ≥90% | **~93%** |
| Evidence capture rate | 100% | **100%** |
| Pre-Suspicion precision | N/A | **~85%** |

---

## 7. CÔNG NGHỆ SỬ DỤNG

### 7.1. Frontend
| Công nghệ | Mục đích |
|-----------|----------|
| React 18 + TypeScript | Xây dựng SPA cho candidate và proctor |
| TensorFlow.js | Face detection, gaze estimation client-side |
| Tailwind CSS | Styling responsive |
| LiveKit Client SDK | WebRTC video streaming |

### 7.2. Backend
| Công nghệ | Mục đích |
|-----------|----------|
| Spring Boot 3.x | RESTful API, business logic |
| Spring Security + JWT RS256 | Authentication, authorization |
| PostgreSQL | Main database |
| Redis | Session caching, rate limiting |
| RabbitMQ/Kafka | Event bus |

### 7.3. AI & Machine Learning
| Công nghệ | Mục đích |
|-----------|----------|
| BlazeFace | Fast face detection |
| MediaPipe FaceMesh | 478 facial landmarks |
| Python + FastAPI | AI worker service |
| TensorFlow/PyTorch | Model inference |

### 7.4. Infrastructure
| Công nghệ | Mục đích |
|-----------|----------|
| Docker + Docker Compose | Containerization |
| MinIO | S3-compatible object storage |
| LiveKit Server | WebRTC media server |
| Prometheus + Grafana | Monitoring |
| Nginx | Reverse proxy, load balancing |

---

## 8. CẤU TRÚC BÁO CÁO

Báo cáo đề tài được tổ chức thành các chương:

- **Chương 1**: Giới thiệu đề tài (phần này)
- **Chương 2**: Cơ sở lý thuyết và công nghệ
- **Chương 3**: Phân tích và thiết kế hệ thống
- **Chương 4**: Xây dựng hệ thống
- **Chương 5**: Kiểm thử và đánh giá
- **Chương 6**: Kết luận và hướng phát triển

---

*Tài liệu cập nhật: Tháng 12/2024*
