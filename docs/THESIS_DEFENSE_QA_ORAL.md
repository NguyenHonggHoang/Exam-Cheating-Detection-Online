# CÂU HỎI VÀ TRẢ LỜI BẢO VỆ KHÓA LUẬN TỐT NGHIỆP
## (Phiên bản trả lời bằng miệng - Văn bản thuần túy)

## Đề tài: HỆ THỐNG PHÁT HIỆN GIAN LẬN THI CỬ TRỰC TUYẾN

---

## PHẦN A: CÂU HỎI TỔNG QUAN

### Câu 1: Vì sao bạn chọn đề tài này? Tính cấp thiết của đề tài như thế nào?

**Trả lời:**

Em chọn đề tài này vì ba lý do chính. Thứ nhất, sau đại dịch COVID-19, hình thức thi trực tuyến đã trở nên phổ biến và được duy trì tại hơn 73% các trường đại học tại Mỹ theo thống kê của EDUCAUSE năm 2022. Tuy nhiên, theo nghiên cứu của KPMG năm 2021, có tới 30 đến 40% thí sinh thừa nhận đã từng gian lận trong môi trường thi online.

Thứ hai, chi phí giám thị thủ công hiện tại rất cao, dao động từ 15 đến 25 đô la cho mỗi phiên thi, khiến nhiều tổ chức giáo dục nhỏ không thể triển khai được hệ thống giám sát hiệu quả.

Thứ ba, các giải pháp hiện có trên thị trường hoặc quá đơn giản với các rule cứng nhắc gây nhiều false positive, hoặc quá phức tạp đòi hỏi giám thị phải xem video liên tục. Điều này tạo ra khoảng trống cho một giải pháp hybrid kết hợp rule-based với AI hỗ trợ mà em muốn giải quyết trong đồ án này.

---

### Câu 2: Mục tiêu chính của đồ án là gì?

**Trả lời:**

Đồ án có bảy mục tiêu cụ thể với các chỉ tiêu định lượng rõ ràng.

Mục tiêu thứ nhất là phát hiện trường hợp không có khuôn mặt trong khung hình, yêu cầu độ chính xác trên 95% và độ trễ dưới 3 giây, kết quả đạt được khoảng 97%.

Mục tiêu thứ hai là phát hiện nhiều khuôn mặt trong khung hình, với độ chính xác yêu cầu trên 90%, kết quả thực tế đạt khoảng 93%.

Mục tiêu thứ ba và thứ tư là ghi nhận 100% các hành vi chuyển tab và paste nội dung vào ô trả lời, hệ thống đã đạt được mục tiêu này.

Mục tiêu thứ năm là Pre-Suspicion Detection, tức phát hiện sớm các hành vi chuẩn bị gian lận như nhìn xuống điện thoại hay xoay đầu sang bên, với độ precision đạt khoảng 85%.

Mục tiêu thứ sáu là đảm bảo 100% incident đều có bằng chứng ảnh hoặc video kèm theo.

Cuối cùng, mục tiêu thứ bảy là workflow cho phép proctor có thể review và xác nhận một incident trong vòng 30 giây.

---

### Câu 3: Đề tài có gì mới so với các hệ thống hiện có như Proctorio hay ProctorU?

**Trả lời:**

So với Proctorio và ProctorU, đồ án của em có nhiều điểm khác biệt quan trọng.

Đầu tiên, về mã nguồn, các hệ thống thương mại là proprietary và đóng, trong khi đề tài này là mã nguồn mở, cho phép các tổ chức tùy biến theo nhu cầu riêng.

Thứ hai, về phương pháp detection, Proctorio dựa hoàn toàn vào AI dẫn đến tỷ lệ false positive cao, còn hệ thống của em sử dụng cách tiếp cận hybrid kết hợp rule-based với AI, giảm đáng kể các cảnh báo sai.

Thứ ba, đồ án có tính năng Pre-Suspicion Detection mà các hệ thống hiện tại không có, cho phép phát hiện sớm các hành vi chuẩn bị gian lận trước khi vi phạm thực sự xảy ra.

Thứ tư, về evidence collection, Proctorio chỉ chụp screenshot còn hệ thống của em hỗ trợ cả snapshot và video clip thông qua LiveKit Egress.

Cuối cùng, về kiến trúc, hệ thống sử dụng microservices cho phép scale từng thành phần riêng biệt, và vì là self-hosted nên không tốn phí theo từng phiên thi như các giải pháp thương mại.

---

## PHẦN B: CÂU HỎI VỀ KIẾN TRÚC HỆ THỐNG

### Câu 4: Mô tả kiến trúc tổng thể của hệ thống?

**Trả lời:**

Hệ thống được xây dựng theo kiến trúc microservices với sáu service chính.

Ở tầng frontend, em sử dụng React kết hợp với TensorFlow.js để chạy các model AI trực tiếp trên trình duyệt, và LiveKit SDK để xử lý video streaming.

Tầng gateway sử dụng BFF pattern, được implement bằng Next.js, đóng vai trò là điểm vào duy nhất cho tất cả các request từ frontend. BFF xử lý authentication, rate limiting, và điều hướng request đến các backend service phù hợp.

Tầng backend bao gồm bốn Spring Boot service: auth-server xử lý đăng nhập và OAuth2, user-service quản lý thông tin người dùng, session-service quản lý phiên thi và nhận detection events, và incident-service lưu trữ các vi phạm và hỗ trợ proctor review.

Ngoài ra còn có một AI Worker viết bằng Python để chạy các tác vụ nặng như face verification sử dụng InsightFace.

Về infrastructure, hệ thống sử dụng PostgreSQL làm database chính, RabbitMQ cho message queue, MinIO cho object storage lưu ảnh và video, và LiveKit cho WebRTC media server.

---

### Câu 5: Tại sao chọn kiến trúc microservices thay vì monolithic?

**Trả lời:**

Em chọn microservices thay vì monolithic vì ba lý do chính.

Thứ nhất là yêu cầu đa ngôn ngữ. AI Worker cần chạy InsightFace và PyTorch mà những thư viện này chỉ có trong Python, không thể chạy trực tiếp trong Spring Boot. Với microservices, em có thể viết AI Worker bằng Python trong khi các service khác dùng Java.

Thứ hai là khả năng scale độc lập. Khi có nhiều vi phạm xảy ra đồng thời, chỉ cần scale Incident Service mà không cần scale toàn bộ hệ thống, tiết kiệm tài nguyên.

Thứ ba là fault isolation. Nếu AI Worker bị crash do xử lý một video lỗi, các service khác vẫn hoạt động bình thường, phiên thi không bị gián đoạn.

Tuy nhiên, em cũng nhận thức được nhược điểm của microservices là tăng độ phức tạp trong deployment và cần xử lý vấn đề eventual consistency giữa các service.

---

### Câu 6: BFF Gateway là gì và tại sao cần nó?

**Trả lời:**

BFF là viết tắt của Backend-for-Frontend, là một layer trung gian giữa frontend và các backend service.

Lý do cần BFF là vì bốn chức năng chính. Thứ nhất, BFF thực hiện API Aggregation, gộp nhiều request nhỏ thành một request lớn để giảm latency cho frontend. Thứ hai, BFF xử lý authentication tập trung, validate JWT token và refresh token khi cần. Thứ ba, BFF làm rate limiting để chống spam và tấn công DDoS. Thứ tư, BFF làm request routing, điều hướng các request đến đúng backend service.

Nếu không có BFF, frontend sẽ phải gọi trực tiếp đến nhiều backend service, dẫn đến vấn đề CORS phức tạp, expose địa chỉ nội bộ của các service, và khó quản lý token trong môi trường browser.

---

### Câu 7: Hệ thống giao tiếp giữa các service như thế nào?

**Trả lời:**

Hệ thống sử dụng ba pattern giao tiếp chính tùy theo use case.

Pattern đầu tiên là Synchronous REST API, được sử dụng khi cần response ngay lập tức, ví dụ như lấy thông tin bài thi, submit câu trả lời, hay đăng nhập. Luồng đi từ Frontend qua BFF đến Backend Service rồi trả về.

Pattern thứ hai là Asynchronous Message Queue sử dụng RabbitMQ, được dùng cho các tác vụ nặng không cần response ngay như face verification hay video analysis. Session Service publish message vào queue, AI Worker consume và xử lý, sau đó publish kết quả vào queue khác cho Incident Service consume.

Pattern thứ ba là Event-Driven dùng SSE (Server-Sent Events) để push real-time notification đến Proctor Dashboard khi có incident mới, giúp proctor biết ngay mà không cần polling liên tục.

---

## PHẦN C: CÂU HỎI VỀ CÔNG NGHỆ AI VÀ DETECTION

### Câu 8: Hệ thống sử dụng những model AI nào?

**Trả lời:**

Hệ thống sử dụng ba model AI chính chạy trên hai môi trường khác nhau.

Ở phía client trong trình duyệt, em sử dụng TensorFlow.js với hai model. Model đầu tiên là BlazeFace dùng để detect và đếm số khuôn mặt trong khung hình một cách nhanh chóng, thời gian inference khoảng 20ms. Model thứ hai là MediaPipe FaceMesh trả về 478 facial landmarks bao gồm cả iris position, thời gian inference khoảng 30ms.

Ở phía server trong Python AI Worker, em sử dụng InsightFace với model ArcFace cho face verification. Model này trích xuất face embedding 512 chiều và so sánh bằng cosine similarity để xác nhận danh tính thí sinh.

Lý do chạy BlazeFace và FaceMesh trên client là để đảm bảo privacy (video không cần gửi lên server), giảm latency (detection xảy ra ngay trên máy thí sinh), và giảm tải cho server.

---

### Câu 9: Looking Away Detection hoạt động như thế nào?

**Trả lời:**

Looking Away Detection phát hiện khi thí sinh nhìn ra khỏi màn hình trong thời gian dài, có thể là nhìn sang bên để xem tài liệu hoặc nhìn xuống để tra điện thoại.

Cách hoạt động như sau: Từ 478 landmarks của FaceMesh, em tính toán head pose gồm pitch (nghiêng lên xuống) và yaw (xoay trái phải). Nếu pitch vượt quá 30 độ xuống hoặc yaw vượt quá 30 độ sang bên, và trạng thái này kéo dài liên tục 3 giây, hệ thống sẽ ghi nhận một vi phạm Looking Away.

Lý do cần sustained time 3 giây là để tránh false positive khi thí sinh chỉ liếc nhìn thoáng qua hoặc hắt hơi, những hành động bình thường không phải gian lận.

---

### Câu 10: Pre-Suspicion Detection là gì và hoạt động như thế nào?

**Trả lời:**

Pre-Suspicion Detection là tính năng phát hiện sớm các hành vi chuẩn bị gian lận trước khi vi phạm thực sự xảy ra. Ví dụ, khi thí sinh cúi xuống kiểm tra điện thoại nằm trên bàn, đó chưa phải là gian lận nhưng là dấu hiệu đáng nghi.

Hệ thống sử dụng Weighted Confidence Scoring kết hợp 7 tín hiệu. Tín hiệu quan trọng nhất là head pitch deviation quá 25 độ với trọng số 25%, tiếp theo là yaw deviation quá 20 độ với trọng số 20%, iris gaze offset với trọng số 20%, và bốn tín hiệu khác gồm face area change, blink rate change, position drift, và motion jitter.

Khi tổng điểm vượt ngưỡng 35, hệ thống kích hoạt Pre-Suspicion. Nếu Pre-Suspicion xảy ra liên tục trong 2.5 giây hoặc xuất hiện 3 lần trong 5 phút, hệ thống sẽ escalate thành vi phạm chính thức và thu thập bằng chứng video.

---

### Câu 11: Face Verification hoạt động như thế nào?

**Trả lời:**

Face Verification được sử dụng để xác nhận người ngồi thi chính là người đã đăng ký. Quy trình gồm hai giai đoạn.

Giai đoạn đăng ký: Lúc đăng ký thi, thí sinh upload ảnh CMND hoặc thẻ sinh viên. AI Worker download ảnh từ MinIO, dùng InsightFace detect khuôn mặt và trích xuất face embedding 512 chiều, rồi lưu vào database.

Giai đoạn verification: Khi bắt đầu thi, hệ thống chụp snapshot từ webcam, gửi qua RabbitMQ đến AI Worker. AI Worker trích xuất embedding từ snapshot, so sánh với embedding đã lưu bằng cosine similarity. Nếu similarity vượt ngưỡng 0.6, thí sinh được xác nhận. Nếu nằm trong khoảng 0.4 đến 0.6, cần proctor review thủ công. Dưới 0.4 thì từ chối.

---

### Câu 12: Liveness Detection chống photo spoofing như thế nào?

**Trả lời:**

Liveness Detection đảm bảo người trước camera là người thật chứ không phải ảnh in hoặc video phát lại. Hệ thống sử dụng ba phương pháp kết hợp.

Phương pháp thứ nhất là Blink Detection sử dụng Eye Aspect Ratio. Khi mắt nhắm, tỷ lệ chiều cao trên chiều rộng của mắt giảm xuống dưới 0.21. Yêu cầu thí sinh chớp mắt ít nhất một lần trong quá trình verification.

Phương pháp thứ hai là Head Movement Detection. Yêu cầu thí sinh xoay đầu ít nhất 5 độ. Ảnh tĩnh không thể thay đổi góc.

Phương pháp thứ ba là Texture Analysis sử dụng Laplacian variance. Khuôn mặt thật có texture phong phú với variance cao, trong khi ảnh in có texture phẳng với variance thấp dưới 100.

Kết hợp ba phương pháp với trọng số 40%, 35%, và 25%, nếu tổng confidence đạt 60% thì coi là người thật.

---

## PHẦN D: CÂU HỎI VỀ DATABASE VÀ DATA FLOW

### Câu 13: Hệ thống sử dụng bao nhiêu database và tại sao?

**Trả lời:**

Hệ thống sử dụng bốn database riêng biệt theo nguyên tắc database-per-service trong microservices.

Database thứ nhất là identity_db cho auth-server và user-service, chứa thông tin users, roles, và OAuth2 tokens.

Database thứ hai là session_db cho session-service, chứa thông tin bài thi, phiên thi, câu hỏi, và câu trả lời.

Database thứ ba là incident_db cho incident-service, chứa các vi phạm và lịch sử review của proctor.

Database thứ tư là bff_db cho BFF gateway, chứa session cookies và rate limiting counters.

Lý do tách riêng database là để mỗi service có thể deploy và scale độc lập. Nếu incident_db bị chậm vì có quá nhiều vi phạm cần lưu, nó không ảnh hưởng đến session_db nơi thí sinh đang làm bài. Ngoài ra, việc tách riêng cũng giúp dễ dàng backup và restore từng database riêng.

---

### Câu 14: Shadow Table là gì và tại sao cần?

**Trả lời:**

Shadow Table là bản sao của dữ liệu từ một service khác, được sync tự động qua CDC (Change Data Capture).

Ví dụ trong hệ thống, session-service cần biết thông tin user để hiển thị tên thí sinh, nhưng theo nguyên tắc microservices, session-service không nên query trực tiếp vào identity_db. Giải pháp là tạo một user_shadow table trong session_db chứa các trường cần thiết như user_id, username, email, role.

Khi có thay đổi trong identity_db.users, Debezium connector đọc WAL (Write-Ahead Log) của PostgreSQL, publish event lên Kafka topic, session-service consume event và cập nhật user_shadow.

Nhược điểm của cách này là eventually consistent, có độ trễ khoảng 100ms. Nhưng với use case của hệ thống, độ trễ này chấp nhận được vì thông tin user thay đổi không thường xuyên.

---

### Câu 15: Evidence được lưu trữ như thế nào?

**Trả lời:**

Evidence bao gồm snapshot và video clip được lưu trong MinIO, một object storage tương thích với S3.

Khi phát hiện vi phạm, có hai cách thu thập evidence. Cách thứ nhất là Client Snapshot: Frontend chụp ảnh từ canvas video, request presigned URL từ backend, rồi upload trực tiếp lên MinIO không qua server để giảm tải.

Cách thứ hai là Server-side Video Clip dùng LiveKit Egress. Toàn bộ phiên thi được record liên tục bởi Egress service. Khi có vi phạm, backend gửi request clip một đoạn 15 giây trước thời điểm vi phạm, Egress cắt và lưu vào MinIO, trả về object key.

Khi proctor review, backend generate presigned URL có thời hạn 15 phút để proctor có thể xem trực tiếp từ MinIO mà không cần proxy qua server.

---

## PHẦN E: CÂU HỎI VỀ MESSAGE QUEUE VÀ ASYNC PROCESSING

### Câu 16: Hệ thống dùng RabbitMQ như thế nào?

**Trả lời:**

RabbitMQ được sử dụng cho các tác vụ async không cần response ngay lập tức.

Hệ thống định nghĩa một Topic Exchange tên exam.events với nhiều queue khác nhau. Queue snapshot.process nhận snapshot để face detection. Queue face.verification nhận request xác thực danh tính gửi đến Python AI Worker. Queue face.verification.result nhận kết quả verification trả về cho Java. Queue incident.create nhận event tạo incident từ session-service gửi đến incident-service. Queue video.analysis nhận video clip để phân tích bằng YOLO.

Mỗi queue được bind với exchange thông qua routing key, cho phép một message publish đến exchange với routing key phù hợp sẽ được route đến đúng queue.

Tất cả queue đều được cấu hình durable, nghĩa là message không bị mất khi RabbitMQ restart.

---

### Câu 17: Khi nào dùng sync REST API, khi nào dùng async Message Queue?

**Trả lời:**

Em sử dụng sync REST khi user đang chờ response và cần kết quả ngay, thời gian xử lý dưới 1 giây. Ví dụ như lấy danh sách bài thi, submit câu trả lời, đăng nhập. User expect response trong vài trăm millisecond.

Ngược lại, em dùng async Message Queue khi xử lý mất thời gian hơn 1 giây, user không cần chờ kết quả ngay. Ví dụ face verification với InsightFace mất 1 đến 2 giây, video analysis với YOLO mất 5 đến 10 giây. Nếu dùng sync, user sẽ phải chờ rất lâu. Với queue, request được gửi vào hàng đợi, worker xử lý trong background, kết quả được push qua SSE hoặc polling.

Ngoài ra, queue còn giúp load leveling. Khi có spike 1000 request cùng lúc, queue buffer lại và worker xử lý dần, không bị overwhelm như sync API.

---

### Câu 18: Làm sao đảm bảo message không bị mất?

**Trả lời:**

Em áp dụng ba cơ chế để đảm bảo message reliability.

Cơ chế thứ nhất là Durable Queue và Durable Exchange. Queue được tạo với flag durable, message được persist xuống disk thay vì chỉ lưu RAM. Khi RabbitMQ restart, message vẫn còn.

Cơ chế thứ hai là Manual Acknowledgment. Consumer không auto-ack ngay khi nhận message. Chỉ sau khi xử lý thành công và lưu vào database, consumer mới gửi ACK. Nếu consumer crash giữa chừng, message sẽ được requeue cho consumer khác xử lý.

Cơ chế thứ ba là Dead Letter Queue. Nếu một message fail sau nhiều lần retry, nó được chuyển sang DLQ thay vì mất. Admin có thể kiểm tra DLQ để debug hoặc replay message.

---

### Câu 19: Idempotency trong message processing là gì và áp dụng như thế nào?

**Trả lời:**

Idempotency đảm bảo việc xử lý một message nhiều lần cho kết quả giống như xử lý một lần. Điều này quan trọng vì message có thể được deliver nhiều lần do network issue hoặc consumer restart.

Trong hệ thống, em áp dụng idempotency key. Mỗi message có một correlation_id unique. Trước khi xử lý, consumer kiểm tra trong database xem correlation_id này đã được xử lý chưa. Nếu đã có, skip message và ACK ngay. Nếu chưa, xử lý bình thường và lưu record với correlation_id.

Ví dụ cụ thể: Message tạo incident có correlation_id là uuid. Consumer kiểm tra trong bảng incidents có record với correlation_id này chưa. Nếu có thì return sớm, nếu chưa thì insert mới.

---

## PHẦN F: CÂU HỎI VỀ SECURITY

### Câu 20: Hệ thống authentication và authorization như thế nào?

**Trả lời:**

Hệ thống sử dụng OAuth2 với Authorization Code Flow và PKCE cho frontend SPA.

Về authentication, user nhập username và password, BFF redirect đến auth-server, người dùng đăng nhập, auth-server trả về authorization code, BFF đổi code lấy access token và refresh token, BFF lưu session vào database và set httpOnly cookie.

Về authorization, mỗi JWT token chứa claims bao gồm subject (user id), roles, và scopes. Backend service validate token bằng cách kiểm tra signature với JWKS endpoint của auth-server. Role-based access control được áp dụng: CANDIDATE chỉ được làm bài thi của mình, PROCTOR được xem và review vi phạm, ADMIN được quản lý users và exams.

Access token có thời hạn 5 phút để giảm thiểu rủi ro nếu bị lộ. Refresh token có thời hạn 24 giờ và được lưu ở server-side.

---

### Câu 21: Evidence integrity được đảm bảo như thế nào?

**Trả lời:**

Evidence integrity đảm bảo bằng chứng không bị giả mạo hoặc thay đổi sau khi thu thập.

Thứ nhất, em sử dụng Server-side Recording với LiveKit Egress. Video được record trực tiếp bởi server, không qua client, nên thí sinh không thể can thiệp vào quá trình ghi.

Thứ hai, Presigned URL cho upload có thời hạn ngắn chỉ 5 phút và chỉ cho phép upload vào đường dẫn cố định, không thể overwrite file khác.

Thứ ba, MinIO bucket được cấu hình immutable, file upload rồi không thể bị xóa hoặc sửa trong retention period là 30 ngày.

Thứ tư, mỗi incident record trong database lưu object key, timestamp, và metadata tại thời điểm tạo. Audit trail ghi lại mọi thao tác của proctor khi review.

---

## PHẦN G: CÂU HỎI VỀ PERFORMANCE VÀ SCALABILITY

### Câu 22: Làm sao để detection không làm lag UI của thí sinh?

**Trả lời:**

Em áp dụng bốn biện pháp để đảm bảo detection không ảnh hưởng đến trải nghiệm làm bài của thí sinh.

Biện pháp thứ nhất là giới hạn FPS detection ở mức 5 frames per second thay vì 30. Với việc phát hiện hành vi kéo dài 2.5 đến 3 giây, 5 FPS là đủ chính xác mà chỉ tốn 30% CPU so với 80% khi chạy ở 30 FPS.

Biện pháp thứ hai là sử dụng WebGL backend cho TensorFlow.js để tận dụng GPU, tăng tốc inference đáng kể.

Biện pháp thứ ba là downscale canvas xuống 640x480 trước khi chạy model, vì BlazeFace và FaceMesh đều resize input về kích thước nhỏ hơn nữa, nên resolution cao không mang lại lợi ích.

Biện pháp thứ tư là debounce warning hiển thị, không hiện warning liên tục mỗi frame mà chỉ hiện khi violation mới bắt đầu hoặc khi đã sustained đủ thời gian.

---

### Câu 23: Hệ thống scale như thế nào khi có nhiều thí sinh?

**Trả lời:**

Với kiến trúc microservices, hệ thống có thể scale từng thành phần độc lập.

Đầu tiên, AI detection chạy trên client nên số lượng thí sinh không ảnh hưởng đến server load của phần detection.

Với database, các service dùng database riêng nên có thể optimize từng database. Ví dụ session_db có nhiều read có thể thêm read replica.

Với message queue, AI Worker có thể scale horizontal. Khi có quá nhiều request face verification, chỉ cần tăng số instance của AI Worker, RabbitMQ tự distribute message cho các worker.

Với Incident Service, khi có nhiều violation cần lưu, có thể scale số instance và dùng load balancer phía trước.

Với LiveKit, đây là media server đã được design cho scale, hỗ trợ geographically distributed nodes.

---

### Câu 24: Calibration hoạt động như thế nào và tại sao cần?

**Trả lời:**

Calibration là quá trình thu thập baseline của thí sinh trước khi bắt đầu làm bài, kéo dài 30 giây.

Trong 30 giây này, thí sinh được yêu cầu nhìn thẳng vào màn hình. Hệ thống thu thập 60 samples của head pose, iris gaze position, và face area. Sau đó tính median của các giá trị này làm baseline.

Tại sao cần calibration? Vì mỗi người có tư thế ngồi khác nhau. Có người hay nghiêng đầu sang phải một chút, có người webcam đặt cao nên hay nhìn xuống. Nếu dùng ngưỡng cố định, những người này sẽ liên tục bị báo vi phạm dù họ đang nhìn màn hình bình thường.

Với calibration, ngưỡng detection trở thành tương đối so với baseline cá nhân. Ví dụ không phải "nhìn xuống 30 độ là vi phạm" mà là "nhìn xuống hơn baseline 25 độ là vi phạm".

---

## PHẦN H: CÂU HỎI VỀ COMPOSITE DETECTION

### Câu 25: Composite Violation Detection là gì?

**Trả lời:**

Composite Violation Detection phát hiện các pattern gian lận phức tạp bằng cách kết hợp nhiều sự kiện đơn lẻ trong một khoảng thời gian.

Ví dụ, chỉ một event tab switch có thể là vô tình, một event paste có thể là paste từ clipboard hệ thống. Nhưng nếu tab switch xảy ra, sau đó 5 giây có paste, thì khả năng cao thí sinh đã copy câu trả lời từ nơi khác.

Hệ thống detect 7 pattern composite. Pattern TAB_PASTE khi tab switch theo sau bởi paste trong 15 giây. Pattern BLUR_PASTE tương tự nhưng với window blur. Pattern LOOKUP_PATTERN là pattern nghiêm trọng nhất, kết hợp Pre-Suspicion (nhìn xuống điện thoại), tab switch, và paste, cho thấy thí sinh tra cứu trên điện thoại rồi copy vào bài. Pattern SCREEN_CAPTURE phát hiện khi thí sinh nhấn PrintScreen hoặc Win+Shift+S. Pattern SPLIT_SCREEN phát hiện khi thí sinh resize cửa sổ và có nhiều blur/focus liên tục, dấu hiệu của việc đọc tài liệu bên cạnh.

---

### Câu 26: Temporal Pattern Analysis là gì?

**Trả lời:**

Temporal Pattern Analysis phân tích hành vi của thí sinh theo thời gian để phát hiện các pattern bất thường.

Hệ thống track 7 pattern chính. Pattern repeated_head_down phát hiện khi thí sinh cúi xuống nhiều lần đều đặn, có thể đang nhìn tài liệu dưới bàn. Pattern regular_micro_pauses phát hiện các khoảng dừng ngắn đều đặn, có thể đang đọc thứ gì đó. Pattern answer_latency_spikes phát hiện khi một số câu trả lời quá nhanh so với trung bình, có thể đã biết trước đáp án. Pattern pre_suspicion_correlation phát hiện khi Pre-Suspicion xảy ra ngay trước khi submit đáp án, dấu hiệu tra cứu trước khi trả lời. Pattern impossible_typing_speed phát hiện tốc độ gõ không thể với con người, thường là paste. Pattern answer_burst phát hiện nhiều câu trả lời trong thời gian ngắn. Pattern frequent_blur phát hiện blur quá thường xuyên.

Mỗi pattern được ghi nhận với score và details để proctor review.

---

## PHẦN I: CÂU HỎI VỀ WORKFLOW VÀ USER EXPERIENCE

### Câu 27: Workflow của một phiên thi từ đầu đến cuối?

**Trả lời:**

Workflow phiên thi gồm bốn giai đoạn chính.

Giai đoạn một là Pre-Exam Setup. Thí sinh đăng nhập, hệ thống load các model TensorFlow.js, yêu cầu quyền camera, kết nối đến LiveKit room và bắt đầu record video.

Giai đoạn hai là Calibration trong 30 giây. Thí sinh nhìn thẳng vào màn hình, hệ thống thu thập baseline cho head pose và gaze.

Giai đoạn ba là Exam In Progress. Detection loop chạy ở 5 FPS, liên tục kiểm tra số mặt, head pose, gaze, và các hành vi nghi vấn. Khi phát hiện vi phạm, State Machine tăng violation count, quyết định có cần collect evidence hay không, upload evidence lên MinIO, tạo incident trong database, và push notification đến Proctor qua SSE.

Giai đoạn bốn là Post-Exam. Dừng Egress recording, gửi request end session, generate report tổng hợp các vi phạm, Proctor review các incident còn pending.

---

### Câu 28: Proctor review workflow như thế nào?

**Trả lời:**

Khi có incident mới, Proctor Dashboard nhận real-time notification qua SSE với âm thanh alert.

Proctor click vào incident trong danh sách, xem chi tiết bao gồm loại vi phạm, thời điểm xảy ra, metadata như góc pitch và yaw, và đặc biệt là evidence gồm ảnh hoặc video clip.

Proctor có ba lựa chọn. Nếu đánh giá đây là vi phạm thực sự, proctor click Confirm và có thể thêm ghi chú. Nếu đánh giá là false positive, proctor click Reject với lý do. Nếu cần thêm thông tin, proctor có thể xem video recording đầy đủ của phiên thi.

Hệ thống track thời gian review trung bình và tỷ lệ confirm/reject để đánh giá chất lượng detection và tinh chỉnh ngưỡng nếu cần.

---

### Câu 29: State Machine cho violation detection hoạt động thế nào?

**Trả lời:**

Violation State Machine quản lý trạng thái và mức độ nghiêm trọng của vi phạm theo thời gian.

Có bốn trạng thái chính. Trạng thái OK là bình thường, không có vấn đề. Trạng thái WARN khi đã có một số vi phạm nhẹ. Trạng thái SUSPICIOUS khi vi phạm tích lũy nhiều hơn. Trạng thái ESCALATED khi vi phạm nghiêm trọng cần xử lý ngay.

Chuyển đổi giữa các trạng thái dựa trên violation count. Mỗi lần violation mới được record, count tăng lên. Từ 1 đến 2 vi phạm là WARN, từ 3 đến 4 là SUSPICIOUS, từ 5 trở lên là ESCALATED.

Quyết định collect evidence cũng dựa trên state. Ở trạng thái WARN chỉ chụp snapshot, ở SUSPICIOUS bắt đầu clip video, ở ESCALATED gửi alert ngay cho proctor.

Cooldown mechanism ngăn việc spam cùng một loại vi phạm, phải chờ 30 giây trước khi record lại cùng loại.

---

### Câu 30: Hệ thống handle network disconnection như thế nào?

**Trả lời:**

Network disconnection được handle ở nhiều layer.

Ở LiveKit layer, khi mất kết nối WebRTC, LiveKit SDK tự động reconnect với exponential backoff. Trong thời gian đó, local detection vẫn chạy vì TensorFlow.js chạy offline.

Ở BFF layer, nếu backend không response, BFF retry 3 lần với timeout 5 giây mỗi lần trước khi trả về error cho frontend.

Ở Message Queue layer, nếu consumer mất kết nối, message vẫn nằm trong queue chờ consumer khác hoặc chờ consumer reconnect.

Ở Session layer, session có trạng thái PAUSED. Nếu thí sinh mất kết nối quá 60 giây, session được đánh dấu PAUSED. Khi reconnect, thí sinh tiếp tục làm bài. Nếu disconnect quá 5 phút, session bị ABORTED và cần admin can thiệp.

Detection data (violations) được buffer ở client và batch upload khi network recovery.

---

## PHẦN J: CÂU HỎI KỸ THUẬT CHI TIẾT

### Câu 31: Giải thích Eye Aspect Ratio và cách tính?

**Trả lời:**

Eye Aspect Ratio hay EAR là tỷ lệ giữa chiều cao và chiều rộng của mắt, dùng để detect blink.

Công thức EAR bằng tổng của khoảng cách từ điểm trên đến điểm dưới mắt (đo tại hai vị trí khác nhau) chia cho hai lần khoảng cách từ điểm trái đến điểm phải mắt.

Khi mắt mở, EAR có giá trị khoảng 0.25 đến 0.30. Khi mắt nhắm, các điểm trên và dưới gần nhau hơn, EAR giảm xuống dưới 0.21.

Ưu điểm của EAR là không phụ thuộc kích thước mắt vì là tỷ lệ, và tính toán rất nhanh chỉ với phép trừ và chia. EAR được sử dụng trong Liveness Detection để yêu cầu thí sinh chớp mắt, điều mà ảnh tĩnh không thể làm được.

---

### Câu 32: Kappa Angle Correction là gì?

**Trả lời:**

Kappa Angle là góc lệch khoảng 5 độ giữa trục thị giác thực sự của mắt và trục quang học của eyeball. Khi một người nhìn thẳng vào camera, iris có vẻ hơi lệch sang mũi thay vì nằm chính giữa sclera.

Nếu không hiệu chỉnh, gaze estimation sẽ bị sai lệch có hệ thống. Thí sinh đang nhìn màn hình sẽ bị đánh giá là đang nhìn chéo.

Trong hệ thống, sau khi tính iris position relative to eye corners, em áp dụng một offset khoảng 0.05 đơn vị về phía mũi để bù trừ Kappa Angle. Giá trị này được tune dựa trên calibration data.

Đây là một cải tiến so với các hệ thống gaze estimation thông thường và giúp giảm false positive đáng kể cho Looking Away Detection.

---

### Câu 33: One Euro Filter là gì và dùng làm gì?

**Trả lời:**

One Euro Filter là một adaptive low-pass filter dùng để làm mượt tín hiệu real-time mà vẫn giữ được response nhanh khi có chuyển động đột ngột.

Vấn đề là landmark detection từ camera có nhiễu. Dù thí sinh ngồi yên, các điểm landmark vẫn nhảy nhẹ mỗi frame, gây nhiễu cho head pose calculation.

Giải pháp đơn giản là low-pass filter, nhưng filter mạnh sẽ làm chậm phản hồi khi thí sinh thực sự xoay đầu. One Euro Filter giải quyết bằng cách tự động điều chỉnh cutoff frequency: khi tín hiệu đứng yên thì filter mạnh để giảm nhiễu, khi tín hiệu thay đổi nhanh thì filter nhẹ để bám theo.

Hệ thống sử dụng One Euro Filter cho cả iris position và head pose, với cấu hình khác nhau. Iris filter có min_cutoff thấp hơn vì mắt di chuyển nhanh và nhỏ, cần response nhanh.

---

### Câu 34: Backend sử dụng Flyway Migration như thế nào?

**Trả lời:**

Flyway là database migration tool giúp version control schema changes.

Mỗi thay đổi schema được viết thành một file SQL với tên theo pattern V{version}__description.sql, ví dụ V1__init_schema.sql, V2__add_calibration_table.sql. Version phải tăng tuần tự và không được sửa file đã chạy.

Khi service start, Flyway kiểm tra bảng flyway_schema_history trong database, so sánh với các file migration trong codebase, và chạy các file chưa được apply.

Lợi ích là mọi developer và môi trường dev, staging, production đều có schema giống nhau. Khi deploy version mới, schema tự động được update. Có thể rollback bằng cách viết undo migration.

Trong project, session-service có 14 migration files, incident-service có 10 files, mỗi file document một thay đổi cụ thể.

---

### Câu 35: Spring Security OAuth2 Resource Server hoạt động thế nào?

**Trả lời:**

Mỗi backend service được cấu hình là OAuth2 Resource Server, nghĩa là nó bảo vệ resources và validate JWT token.

Khi request đến với header Authorization Bearer token, Spring Security interceptor lấy token, decode header để biết algorithm (RS256), lấy public key từ JWKS endpoint của auth-server bằng kid trong header, verify signature, parse claims để lấy user info và roles.

Nếu valid, request được cho phép đi tiếp với SecurityContext chứa authentication information. Nếu invalid như token expired, signature wrong, hay missing scopes, trả về 401 Unauthorized.

Cấu hình trong application.yml chỉ cần một dòng spring.security.oauth2.resourceserver.jwt.jwk-set-uri trỏ đến endpoint JWKS của auth-server.

---

## PHẦN K: CÂU HỎI PHẢN BIỆN

### Câu 36: False positive rate của hệ thống là bao nhiêu và làm sao giảm?

**Trả lời:**

Dựa trên testing, false positive rate cho Looking Away khoảng 5% đến 8%, cho Pre-Suspicion khoảng 10% đến 15%.

Để giảm false positive, em áp dụng năm biện pháp. Thứ nhất là Calibration để cá nhân hóa baseline cho từng thí sinh. Thứ hai là Sustained Duration yêu cầu hành vi kéo dài 2.5 đến 3 giây mới tính vi phạm, loại bỏ các hành động thoáng qua. Thứ ba là Weighted Scoring kết hợp nhiều tín hiệu thay vì dựa vào một tín hiệu duy nhất. Thứ tư là Cooldown ngăn spam cùng một loại vi phạm. Thứ năm là Human Review, tất cả vi phạm cần proctor xác nhận trước khi tính chính thức.

So với Proctorio với false positive rate 20% đến 30% theo nhiều nghiên cứu, hệ thống của em có kết quả tốt hơn nhờ cách tiếp cận hybrid.

---

### Câu 37: Thí sinh có thể bypass hệ thống bằng cách nào?

**Trả lời:**

Em đã phân tích các attack vectors và có biện pháp phòng ngừa tương ứng.

Attack thứ nhất là dùng ảnh thay mặt thật. Biện pháp là Liveness Detection yêu cầu chớp mắt và xoay đầu, ảnh tĩnh không làm được.

Attack thứ hai là dùng virtual camera. Biện pháp là detect virtual camera drivers và block.

Attack thứ ba là có người khác trong phòng. Biện pháp là Multi-Face Detection, nếu xuất hiện mặt thứ hai sẽ báo vi phạm.

Attack thứ tư là điện thoại nằm ngoài góc nhìn camera. Biện pháp là Pre-Suspicion Detection phát hiện hành vi cúi nhìn, và Composite Detection phát hiện pattern tra cứu trước khi trả lời.

Attack thứ năm là second monitor. Khó detect hoàn toàn, nhưng Tab Switch và Window Blur detection capture phần lớn.

Không hệ thống nào hoàn hảo, mục tiêu là tăng barrier đủ cao để đa số thí sinh chọn cách học thay vì gian lận.

---

### Câu 38: Hệ thống có vi phạm privacy không?

**Trả lời:**

Em thiết kế hệ thống theo nguyên tắc Privacy by Design.

Thứ nhất, AI detection chạy trên client, video không được stream lên server liên tục. Server chỉ nhận metadata và evidence khi có vi phạm.

Thứ hai, Video recording bởi Egress chỉ lưu trong retention period, mặc định 30 ngày, sau đó tự động xóa.

Thứ ba, Face embedding không phải là ảnh mặt, không thể reconstruct lại khuôn mặt từ embedding vector.

Thứ tư, Presigned URL cho evidence có thời hạn ngắn, chỉ proctor authorized mới access được.

Thứ năm, không lưu video toàn bộ phiên thi trên device của thí sinh, chỉ lưu trên server với access control.

Hệ thống comply với GDPR principles về data minimization và purpose limitation.

---

### Câu 39: So sánh TensorFlow.js client-side với server-side AI processing?

**Trả lời:**

Em chọn client-side cho face detection và chuyển sang server-side cho face verification.

Client-side TensorFlow.js có bốn ưu điểm. Privacy cao vì video không rời device. Latency thấp vì inference ngay trên máy. Scalable vì thêm thí sinh không tăng server load. Offline capable vì hoạt động khi mất mạng tạm thời.

Nhược điểm là performance phụ thuộc device của thí sinh, model bị expose trong browser.

Server-side Python AI có ưu điểm là accuracy cao hơn với CUDA, model được bảo vệ.

Nhược điểm là cần network, latency cao hơn, cost per inference.

Em kết hợp cả hai: client-side cho detection real-time cần latency thấp, server-side cho verification một lần cần accuracy cao.

---

### Câu 40: Nếu được làm lại, bạn sẽ thay đổi gì?

**Trả lời:**

Nếu làm lại với kinh nghiệm hiện tại, em sẽ thay đổi ba điểm.

Thứ nhất, về infrastructure, em sẽ dùng Kubernetes thay vì Docker Compose thuần để tận dụng auto-scaling và self-healing.

Thứ hai, về detection algorithm, em sẽ explore thêm các phương pháp gaze estimation advanced hơn như sử dụng separate eye crop model thay vì dựa vào MediaPipe Iris.

Thứ ba, về testing, em sẽ build một test dataset lớn hơn với nhiều scenarios khác nhau như lighting conditions khác nhau, người đeo kính, người có tóc che mặt, để train và evaluate model tốt hơn.

Tuy nhiên, với scope và timeline của khóa luận, các quyết định đã đưa ra là hợp lý và hệ thống đã đạt được các mục tiêu đề ra.

---

## PHẦN L: CÂU HỎI VỀ INFRASTRUCTURE VÀ DEPLOYMENT

### Câu 41: Docker Compose được cấu hình như thế nào?

**Trả lời:**

Hệ thống sử dụng Docker Compose để orchestrate 14 container services trong môi trường development và testing.

Nhóm đầu tiên là database và messaging gồm PostgreSQL với 4 logical databases, RabbitMQ cho message queue, Redis cho caching, và MinIO cho object storage.

Nhóm thứ hai là Kafka ecosystem gồm Zookeeper, Kafka broker, và Debezium Connect cho Change Data Capture.

Nhóm thứ ba là backend services gồm auth-server, user-service, session-service, incident-service, và admin-service, tất cả đều là Spring Boot applications.

Nhóm thứ tư là frontend và gateway gồm BFF gateway dùng Next.js và exam-ui dùng React với Vite.

Nhóm thứ năm là media gồm LiveKit server cho WebRTC và LiveKit Egress cho video recording.

Các services được kết nối qua Docker network nội bộ, với depends_on đảm bảo thứ tự startup đúng, ví dụ backend services chờ database ready trước khi start.

---

### Câu 42: LiveKit được sử dụng như thế nào trong hệ thống?

**Trả lời:**

LiveKit là open-source WebRTC media server được sử dụng cho hai mục đích chính.

Mục đích thứ nhất là video streaming. Khi thí sinh bắt đầu thi, client kết nối đến LiveKit room, publish video track từ webcam. Điều này cho phép proctor xem live video của thí sinh nếu cần, và cũng là nguồn cho server-side recording.

Mục đích thứ hai là video recording thông qua Egress service. LiveKit Egress có thể record toàn bộ room video và lưu trực tiếp vào MinIO. Khi có vi phạm, backend request Egress clip một segment video và upload lên bucket evidence.

Lý do chọn LiveKit thay vì các giải pháp khác như Twilio hay Vonage là vì LiveKit là open-source, có thể self-host không tốn phí per-minute, và có built-in Egress feature rất phù hợp cho use case thu thập evidence.

---

### Câu 43: MinIO được cấu hình như thế nào?

**Trả lời:**

MinIO là object storage server tương thích với AWS S3 API, được sử dụng để lưu trữ tất cả binary files trong hệ thống.

Hệ thống tạo ba bucket. Bucket thứ nhất là snapshots chứa các ảnh chụp từ webcam khi phát hiện vi phạm. Bucket thứ hai là evidence chứa video clips được cắt bởi Egress. Bucket thứ ba là profiles chứa ảnh CMND và thẻ sinh viên upload khi đăng ký.

Mỗi bucket được cấu hình với object locking để đảm bảo files không bị xóa hay sửa trong retention period 30 ngày. Access được kiểm soát qua presigned URLs có thời hạn ngắn, không expose credentials ra frontend.

MinIO chạy ở chế độ standalone cho development, nhưng trong production có thể chuyển sang distributed mode với nhiều nodes để tăng durability và availability.

---

### Câu 44: Làm sao debug khi một service không hoạt động?

**Trả lời:**

Em có quy trình debug theo từng layer.

Đầu tiên kiểm tra service có running không bằng docker compose ps. Nếu status không phải running thì xem logs bằng docker compose logs service-name.

Tiếp theo kiểm tra network connectivity. Từ một container có thể ping hoặc curl đến container khác bằng docker exec. Nếu không kết nối được thì kiểm tra network configuration.

Với database issues, em kết nối trực tiếp bằng psql hoặc pgAdmin để kiểm tra schema và data. Với message queue issues, em truy cập RabbitMQ management UI để xem queue depth, consumer count, và dead letters.

Với API issues, em dùng Postman hoặc curl để gửi request trực tiếp đến từng service, bypass BFF, để isolate vấn đề nằm ở layer nào.

Cuối cùng với detection issues ở frontend, em mở Chrome DevTools xem console logs, network requests, và performance profiling cho TensorFlow.js inference.

---

### Câu 45: Correlation ID là gì và được sử dụng như thế nào?

**Trả lời:**

Correlation ID là một unique identifier được gán cho mỗi request từ đầu đến cuối, giúp trace request flow qua nhiều services.

Khi BFF nhận request từ frontend, nó generate một UUID làm correlation ID, gắn vào header X-Correlation-ID, và forward đến backend services. Mỗi service log lại correlation ID cùng với mọi action. Khi publish message vào queue, correlation ID được include trong message body.

Khi cần debug một issue, admin có thể lấy correlation ID từ frontend logs hoặc error response, sau đó grep trong logs của tất cả services để thấy complete journey của request đó.

Ví dụ: khi face verification fail, correlation ID giúp trace từ lúc request đến BFF, forward đến session-service, publish message đến queue, AI Worker process, và result publish back. Dễ dàng tìm ra step nào fail.

---

## PHẦN M: CÂU HỎI VỀ AI CHI TIẾT

### Câu 46: InsightFace hoạt động chi tiết như thế nào?

**Trả lời:**

InsightFace là một open-source face analysis toolkit viết bằng Python, hệ thống sử dụng model buffalo_l cho face verification.

Khi nhận ảnh, InsightFace thực hiện ba bước. Bước một là Face Detection sử dụng RetinaFace để locate khuôn mặt trong ảnh và crop ra face region. Bước hai là Face Alignment để xoay và resize face về chuẩn 112x112 pixels. Bước ba là Feature Extraction sử dụng ArcFace model để trích xuất face embedding vector 512 chiều.

ArcFace được train với Additive Angular Margin Loss, giúp embedding của cùng một người cluster gần nhau trong không gian 512 chiều, trong khi embedding của người khác nằm xa nhau. Nhờ đó khi so sánh hai embedding bằng cosine similarity, same person cho score cao, different person cho score thấp.

Ngưỡng 0.6 được chọn dựa trên trade-off giữa False Acceptance Rate và False Rejection Rate, đạt được Equal Error Rate tối ưu.

---

### Câu 47: Cosine Similarity là gì và tại sao dùng nó?

**Trả lời:**

Cosine Similarity đo độ tương đồng giữa hai vector bằng cách tính cosine của góc giữa chúng, có giá trị từ -1 đến 1, trong đó 1 nghĩa là hoàn toàn giống, 0 là không liên quan, -1 là hoàn toàn ngược.

Công thức là tích vô hướng của hai vector chia cho tích của độ dài hai vector.

Lý do dùng Cosine Similarity thay vì Euclidean Distance cho face embedding là vì Cosine Similarity không phụ thuộc vào magnitude của vector, chỉ quan tâm direction. Điều này quan trọng vì face embedding từ ảnh khác lighting conditions có thể có magnitude khác nhau, nhưng direction vẫn tương tự nếu là cùng một người.

Ngoài ra Cosine Similarity có range cố định 0 đến 1 cho normalized vectors, dễ đặt ngưỡng hơn so với Euclidean Distance có range unbounded.

---

### Câu 48: Head Pose được tính như thế nào từ landmarks?

**Trả lời:**

Head Pose gồm ba góc pitch, yaw, và roll được tính từ vị trí các facial landmarks sử dụng phương pháp geometric ratios thay vì PnP algorithm truyền thống.

Với Yaw tức góc quay trái phải, em tính bằng cách so sánh khoảng cách từ mũi đến hai mắt. Công thức là asymmetry bằng khoảng cách mũi đến mắt trái trừ khoảng cách mũi đến mắt phải, chia cho khoảng cách giữa hai mắt, sau đó nhân với 120 độ để scale.

Với Pitch tức góc cúi lên xuống, em sử dụng tỷ lệ vị trí mũi trong khuôn mặt. Tính pitchRatio bằng noseToForeheadRatio trừ noseToChinRatio, rồi nhân với 180 độ.

Với Roll tức góc nghiêng đầu, em dùng Math.atan2 của độ chênh lệch y chia cho delta x giữa hai mắt, rồi convert từ radian sang độ.

Cuối cùng apply calibration offset để trừ đi baseline pose đã thu thập lúc calibration. Pitch dương nghĩa là cúi xuống, âm là ngẩng lên. Yaw dương là quay sang trái, âm là quay sang phải.

---

### Câu 49: Tại sao cần warmup model trước khi sử dụng?

**Trả lời:**

Model warmup là quá trình chạy một vài inference với dummy input trước khi bắt đầu detection thực sự.

Lý do cần warmup là vì lần inference đầu tiên của TensorFlow.js luôn chậm hơn đáng kể so với các lần sau. Điều này do TensorFlow.js cần compile shader programs cho WebGL backend, allocate GPU memory, và optimize execution graph ở lần chạy đầu.

Nếu không warmup, lần detection đầu tiên khi thí sinh vừa bắt đầu thi có thể mất 500ms thay vì 30ms bình thường, gây lag cho UI và có thể khiến detection miss một vài frame quan trọng.

Trong hệ thống, warmup được thực hiện ở bước Pre-Exam Setup, trước khi Calibration bắt đầu. Em chạy BlazeFace và FaceMesh với một frame thử, đảm bảo các lần detect sau đó đều có latency ổn định.

---

### Câu 50: Model fallback strategy là gì?

**Trả lời:**

Model fallback strategy là cơ chế tự động chuyển sang backend execution khác khi backend ưu tiên không available.

TensorFlow.js hỗ trợ nhiều backends: WebGL chạy trên GPU nhanh nhất, WASM chạy trên CPU cũng khá nhanh, và CPU backend chậm nhất làm backup cuối cùng.

Trong hệ thống, em ưu tiên WebGL cho performance tốt nhất. Tuy nhiên một số devices không có GPU đủ mạnh hoặc driver có vấn đề. Khi đó TensorFlow.js tự động fallback sang WASM.

Em implement thêm manual detection: khi thấy inference time quá cao liên tục, ví dụ trên 200ms trong 5 frames liên tiếp, em có thể force switch sang backend khác và thông báo cho user.

Nếu cả WebGL và WASM đều fail, hệ thống disable client-side detection, log warning, và notify proctor rằng thí sinh đang thi mà không có AI monitoring. Proctor có thể decide cho tiếp tục hay yêu cầu thí sinh đổi device.

---

## PHẦN N: CÂU HỎI VỀ TESTING VÀ QUALITY

### Câu 51: Hệ thống được test như thế nào?

**Trả lời:**

Em áp dụng nhiều loại testing ở các layer khác nhau.

Unit tests cho các hàm logic riêng lẻ như calculateHeadPose, calculateEAR, isViolation. Em dùng Jest cho TypeScript frontend và JUnit cho Java backend. Mỗi function có test cases cover các edge cases.

Integration tests cho API endpoints. Em dùng MockMvc trong Spring Boot test để gửi request đến controller, verify response và database state. Có tests cho happy path và error cases.

End-to-end tests cho critical user flows. Em dùng Playwright để simulate browser actions từ login, start exam, trigger violations, đến submit và review.

Manual testing cho detection accuracy. Em record nhiều video scenarios như nhìn sang phải, cúi xuống, nhiều người trong frame, rồi chạy qua detection pipeline để tính precision và recall.

Performance testing để đảm bảo detection không exceed CPU budget và UI vẫn responsive.

---

### Câu 52: Làm sao đo accuracy của detection?

**Trả lời:**

Em sử dụng các metrics standard trong machine learning: Precision, Recall, và F1 Score.

Đầu tiên em tạo một labeled dataset gồm các video clips với ground truth annotations. Ví dụ clip 1 có looking away từ giây 3 đến giây 6, clip 2 có pre-suspicion từ giây 2 đến giây 4.

Sau đó chạy detection algorithm trên dataset, thu thập predictions.

Compare predictions với ground truth để tính: True Positives là số lần detect đúng, False Positives là số lần báo nhầm, False Negatives là số lần miss. Từ đó tính Precision bằng TP chia cho TP cộng FP, Recall bằng TP chia cho TP cộng FN, F1 là harmonic mean của Precision và Recall.

Kết quả đạt được: Looking Away có Precision 92% Recall 88%, Pre-Suspicion có Precision 85% Recall 80%. Pre-Suspicion thấp hơn vì là feature phức tạp hơn với nhiều edge cases.

---

### Câu 53: Error handling strategy của hệ thống?

**Trả lời:**

Em thiết kế error handling theo nguyên tắc fail gracefully và provide meaningful feedback.

Ở frontend, khi gọi API fail, em phân loại lỗi. Lỗi 4xx như validation error được hiển thị cho user với message cụ thể. Lỗi 5xx được hiển thị thông báo chung và log details để debug. Network errors trigger retry với exponential backoff.

Ở BFF, request đến backend được wrap trong try-catch. Timeout được set 10 giây để tránh hanging. Error response được normalize thành format chuẩn với status, message, correlation id.

Ở backend Spring Boot, em dùng ControllerAdvice để handle exceptions globally. Custom exceptions như ExamNotFoundException extend từ base exception class. All exceptions được log với correlation id và stack trace.

Ở message processing, nếu consumer throw exception, message được requeue. Sau 3 lần retry fail, message chuyển sang Dead Letter Queue để investigate sau.

---

### Câu 54: Logging và Monitoring được thực hiện như thế nào?

**Trả lời:**

Logging được structured để dễ search và analyze.

Mỗi log entry có format JSON với timestamp, level, service name, correlation id, message, và context data. Em dùng SLF4J với Logback trong Spring Boot, và console.log với structured format trong frontend.

Log levels được sử dụng consistently: DEBUG cho detailed tracing khi develop, INFO cho normal operations như request received và completed, WARN cho recoverable issues như retry attempts, ERROR cho failures cần attention.

Trong production, logs được aggregate vào một central system. Có thể dùng ELK stack (Elasticsearch, Logstash, Kibana) hoặc Loki. Query bằng correlation id để trace request across services.

Metrics như request latency, error rate, queue depth, detection inference time được expose qua Prometheus endpoints và visualize trong Grafana dashboards. Alerts được set up khi metrics exceed thresholds.

---

### Câu 55: Code quality được đảm bảo như thế nào?

**Trả lời:**

Em áp dụng nhiều practices để maintain code quality.

Thứ nhất là ESLint và Prettier cho TypeScript frontend, enforce consistent code style và catch common errors. Thứ hai là Checkstyle và SpotBugs cho Java backend với similar purposes.

Thứ ba là TypeScript strict mode để catch type errors at compile time thay vì runtime. Thứ tư là Pre-commit hooks chạy linting và formatting tự động trước mỗi commit.

Thứ năm là Code review cho mọi Pull Request, đảm bảo logic đúng, readable, và maintainable. Thứ sáu là Documentation cho public APIs và complex algorithms.

Thứ bảy là Dependency management với npm audit và dependabot để keep dependencies updated và patch security vulnerabilities.

Thứ tám là Architecture decision records document các design decisions quan trọng và rationale, giúp team members mới hiểu why things are done certain way.

---

## PHẦN O: CÂU HỎI NÂNG CAO

### Câu 56: WebRTC hoạt động như thế nào ở high level?

**Trả lời:**

WebRTC là protocol cho real-time communication peer-to-peer trong browsers, được sử dụng để stream video từ thí sinh lên LiveKit server.

Quy trình kết nối gồm ba phase. Phase thứ nhất là Signaling: client và server trao đổi SDP (Session Description Protocol) messages mô tả media capabilities như codecs và resolution. Phase thứ hai là ICE (Interactive Connectivity Establishment): tìm cách kết nối tối ưu, có thể direct nếu cùng network hoặc qua TURN server nếu behind NAT. Phase thứ ba là DTLS-SRTP: encrypt media stream để đảm bảo privacy.

Trong hệ thống, LiveKit SDK abstract hầu hết complexity này. Frontend chỉ cần connect to room với token, publish local video track, và LiveKit handle phần còn lại.

Video được encode với VP8 hoặc H264 codec, bitrate adaptive dựa trên network conditions để đảm bảo quality tốt nhất có thể mà không buffer.

---

### Câu 57: CORS là gì và hệ thống handle như thế nào?

**Trả lời:**

CORS là Cross-Origin Resource Sharing, một security mechanism của browser ngăn frontend ở domain A gọi API ở domain B trừ khi domain B explicitly cho phép.

Trong development, frontend chạy ở localhost:5173, BFF ở localhost:8080, các backend services ở các ports khác. Đây là different origins nên browser block requests.

Em handle CORS ở BFF level. BFF được configure cho phép origin localhost:5173, allow credentials, và allow specific headers như Authorization và X-Correlation-ID. Response headers Access-Control-Allow-Origin, Access-Control-Allow-Credentials được set.

Frontend chỉ gọi đến BFF, không gọi trực tiếp backend services. BFF gọi backend services là server-to-server, không bị CORS restriction.

Trong production với proper domain setup, CORS policy được tighten để chỉ allow production frontend domain.

---

### Câu 58: Rate Limiting hoạt động như thế nào?

**Trả lời:**

Rate Limiting ngăn abuse bằng cách giới hạn số requests trong một khoảng thời gian.

Em implement ở BFF level sử dụng sliding window algorithm. Mỗi IP address được track số requests trong 60 giây gần nhất. Nếu vượt quá 100 requests, trả về 429 Too Many Requests.

Các endpoints sensitive hơn có limits thấp hơn. Login endpoint limit 5 requests per minute để chống brute force. File upload limit 10 per minute.

Rate limit state được lưu trong Redis để scale horizontal. Nhiều BFF instances share cùng rate limit counters.

Response khi bị rate limited include header Retry-After cho biết bao lâu nữa có thể thử lại.

Authenticated users có limits cao hơn unauthenticated vì đã verified identity. Per-user limits cũng được track để ngăn một user abuse nhiều hơn quota.

---

### Câu 59: Cách handle concurrent database access?

**Trả lời:**

Concurrent access được handle thông qua nhiều mechanisms.

Đầu tiên là database transactions với proper isolation levels. Em dùng READ_COMMITTED cho hầu hết operations, SERIALIZABLE cho critical sections như answer submission.

Thứ hai là Optimistic Locking với version field. Mỗi entity có version column, tăng lên mỗi lần update. Nếu hai requests cùng read version 1 và cùng update, request thứ hai sẽ fail vì version đã là 2, throw OptimisticLockException, frontend retry.

Thứ ba là Unique constraints prevent duplicate entries. Ví dụ idempotency_key trong events table đảm bảo cùng một event không được insert hai lần.

Thứ tư là Row-level locking cho operations cần atomicity, sử dụng SELECT FOR UPDATE.

Thứ năm là application-level locks với Redis SETNX cho distributed scenarios như prevent multiple AI Workers process same verification request.

---

### Câu 60: Backward compatibility khi update hệ thống?

**Trả lời:**

Em maintain backward compatibility qua nhiều practices.

Với API changes, em follow versioning strategy. Breaking changes require new API version như /api/v2/. Old versions được support trong deprecation period, cho clients time to migrate.

Với database schema changes, Flyway migrations chỉ add columns hoặc tables, không drop hay rename existing columns. Nếu cần rename, em add new column, copy data, update code to use new column, sau đó trong migration sau mới drop old column.

Với message formats trong RabbitMQ, em add new fields là optional với default values. Consumer code check field existence trước khi use, handle cả old và new format.

Với frontend deployments, em ensure old cached JavaScript bundles vẫn work với current backend APIs trong thời gian ngắn.

Rolling deployments với health checks ensure new instances healthy trước khi route traffic, old instances chỉ terminate sau khi no longer receiving requests.

---

## PHẦN P: CÂU HỎI VỀ SPECIFIC FEATURES

### Câu 61: Safe Exam Browser integration hoạt động như thế nào?

**Trả lời:**

Safe Exam Browser hay SEB là một browser lockdown application ngăn thí sinh truy cập các ứng dụng khác trong khi thi.

Khi admin tạo exam, họ có thể enable SEB requirement và configure các settings như allowed URLs, disable right-click, disable print screen. Session-service generate một SEB configuration file dạng XML chứa các settings này cùng với exam URL.

Khi thí sinh start exam, nếu SEB required, hệ thống kiểm tra User-Agent header. SEB browser gửi một signature đặc biệt trong header. Nếu không match, request bị reject với message yêu cầu download và cài SEB.

SEB configuration file được sign với secret key để prevent tampering. Khi SEB launch, nó verify signature trước khi apply configuration.

Ưu điểm của SEB là chống được nhiều attack vectors như second monitor, virtual machine, screen sharing. Nhược điểm là yêu cầu thí sinh install thêm software.

---

### Câu 62: Role-Based Access Control được implement như thế nào?

**Trả lời:**

Hệ thống có bốn roles chính với permissions khác nhau.

Role CANDIDATE là thí sinh, được phép xem danh sách exams mình được assign, làm bài thi, xem kết quả của mình, và upload ảnh profile.

Role PROCTOR là giám thị, được phép xem tất cả sessions đang active, xem incidents của tất cả thí sinh, confirm hoặc reject incidents, và xem video recordings.

Role REVIEWER là người review sau khi thi kết thúc, có quyền tương tự PROCTOR nhưng không được xem live sessions, chỉ xem historical data.

Role ADMIN có full access, được quản lý users, tạo exams, configure SEB settings, view audit logs, và manage system settings.

Mỗi JWT token chứa claims roles và scopes. Backend service extract roles từ token và check permission trước khi execute operation. Nếu không có permission, trả về 403 Forbidden.

---

### Câu 63: SSE (Server-Sent Events) hoạt động chi tiết như thế nào?

**Trả lời:**

SSE là một-way communication channel từ server đến client, được sử dụng để push real-time notifications.

Client mở một persistent HTTP connection đến SSE endpoint bằng EventSource API. Server giữ connection open và gửi events khi có data mới. Mỗi event có format text/event-stream với fields là event type, data, và optional id.

Trong hệ thống, Proctor Dashboard connect đến incident-service SSE endpoint. Khi có incident mới được tạo, incident-service publish event lên internal event bus, SSE controller consume và push đến all connected clients.

SSE có built-in reconnection. Nếu connection drop, browser tự động reconnect và gửi Last-Event-ID header để resume từ event cuối đã nhận. Server có thể gửi lại events missed.

So với WebSocket, SSE đơn giản hơn, auto-reconnect, nhưng chỉ one-way. Cho use case notifications, SSE là đủ và phù hợp hơn.

---

### Câu 64: Debezium CDC hoạt động chi tiết như thế nào?

**Trả lời:**

Debezium là Change Data Capture platform đọc database transaction logs và publish changes đến Kafka.

PostgreSQL được configure với wal_level là logical để generate detailed transaction logs. Debezium Postgres Connector connect đến database, tạo replication slot, và subscribe đến changes.

Khi có INSERT, UPDATE, hoặc DELETE trong bảng users ở identity_db, Debezium đọc WAL entry, serialize thành Avro hoặc JSON message với before và after state, publish lên Kafka topic identity.public.users.

Session-service và incident-service consume topic này bằng Kafka Consumer. Khi nhận message, parse operation type: nếu là c (create) hoặc u (update) thì upsert vào shadow table, nếu là d (delete) thì mark record as deleted.

Ưu điểm của CDC so với API sync là không cần change source code, capture all changes including direct SQL, và near real-time với latency dưới 100ms.

---

### Câu 65: Kafka được cấu hình như thế nào trong hệ thống?

**Trả lời:**

Kafka được sử dụng chủ yếu cho CDC với Debezium, chạy với Zookeeper cho cluster coordination.

Kafka broker được configure với một số settings quan trọng. auto.create.topics.enable là true trong development để tự tạo topics khi producer publish. log.retention.hours là 168 tức 7 ngày để giữ messages đủ lâu cho replay nếu cần.

Topics được tạo bởi Debezium connector theo pattern prefix.schema.table, ví dụ identity.public.users. Mỗi topic có một partition trong development, có thể tăng trong production để parallel processing.

Consumers sử dụng consumer groups để load balance và ensure at-least-once delivery. Offset được commit sau khi message processed thành công.

Trong development với Docker, Kafka và Zookeeper chạy single instance. Production sẽ cần cluster với multiple brokers cho high availability.

---

### Câu 66: Tensor memory management trong TensorFlow.js?

**Trả lời:**

TensorFlow.js sử dụng WebGL textures để lưu tensors, không tự động garbage collect như JavaScript objects. Nếu không dispose đúng cách, memory sẽ leak.

Để prevent memory leak, em sử dụng tf.tidy() wrapper cho tất cả tensor operations. Code trong tf.tidy block được execute, sau đó tất cả intermediate tensors được dispose automatically. Chỉ tensor returned từ tidy được giữ lại.

Ngoài ra em monitor tensor count bằng tf.memory().numTensors. Trong detection loop, tensor count phải stable, không tăng theo thời gian. Nếu thấy tăng, đó là dấu hiệu memory leak.

Cho FaceMesh predictions, sau khi extract landmarks cần thiết vào JavaScript arrays, em dispose prediction tensors ngay. Không giữ reference đến tensors lâu hơn cần thiết.

Định kỳ log memory usage trong development để verify không có leak, đặc biệt quan trọng khi detection loop chạy liên tục trong nhiều giờ.

---

### Câu 67: Browser events được capture như thế nào?

**Trả lời:**

Em capture các browser events liên quan đến potential cheating behaviors.

Tab visibility change được detect bằng document.visibilitychange event. Khi visible thành hidden, record TAB_SWITCH event với timestamp.

Window blur được detect bằng window.blur event. Khi window mất focus, record BLUR event. Điều này catch cases như Alt+Tab, click ra ngoài window.

Paste event được detect bằng document.paste event trên các textarea và input fields. Record PASTE event với text length nhưng không record actual content để privacy.

Keyboard shortcuts như PrintScreen, Ctrl+Shift+S được detect bằng keydown event. Các shortcuts nguy hiểm được block bằng preventDefault() và record SCREEN_CAPTURE event.

Window resize được detect bằng window.resize event, xảy ra liên tục có thể indicate split screen usage.

Tất cả events được buffer locally và batch upload đến backend mỗi 5 giây để reduce network requests.

---

### Câu 68: Iris Gaze Estimation hoạt động như thế nào?

**Trả lời:**

Iris Gaze Estimation xác định hướng nhìn dựa trên vị trí iris trong eyeball.

MediaPipe FaceMesh trả về 478 landmarks trong đó có các điểm cho iris: điểm trung tâm iris, và các điểm ở rìa iris. Ngoài ra có các điểm ở corners của mắt (inner corner và outer corner).

Em tính iris position relative to eye bằng cách lấy khoảng cách từ iris center đến inner corner chia cho khoảng cách từ inner corner đến outer corner. Giá trị này nằm trong khoảng 0 đến 1, với 0.5 là nhìn thẳng về phía trước.

Nếu giá trị nhỏ hơn 0.5 đáng kể, tức iris gần inner corner hơn, người đó đang nhìn sang phía inner corner (về phía mũi). Nếu lớn hơn 0.5 đáng kể, đang nhìn sang phía outer corner.

Kết hợp với Kappa Angle Correction và Calibration baseline, em xác định được khi nào thí sinh đang nhìn ra khỏi màn hình.

---

### Câu 69: Face Distance Estimation hoạt động như thế nào?

**Trả lời:**

Face Distance Estimation ước tính khoảng cách từ thí sinh đến camera dựa trên kích thước khuôn mặt trong khung hình.

Nguyên lý là khuôn mặt người trưởng thành có kích thước tương đối cố định. Khi người ngồi xa hơn, khuôn mặt chiếm ít pixels hơn trong frame. Khi ngồi gần hơn, khuôn mặt to hơn.

Em tính face area bằng bounding box từ BlazeFace detection: width nhân height. So sánh với baseline face area thu thập trong Calibration để tính tỷ lệ.

Nếu tỷ lệ tăng đáng kể, tức face area lớn hơn baseline, thí sinh đang tiến gần camera hơn, có thể đang cúi xuống nhìn điện thoại trên bàn.

Distance estimation cũng được dùng để điều chỉnh thresholds cho các detection khác. Khi thí sinh ngồi xa, head pose angle estimation có thể bị noise nhiều hơn, nên threshold được relax một chút.

---

### Câu 70: Answer Logging hoạt động như thế nào?

**Trả lời:**

Answer Logging ghi lại lịch sử thay đổi câu trả lời để phát hiện patterns bất thường.

Mỗi khi thí sinh thay đổi câu trả lời, frontend gửi event đến backend với answer text, question id, và timestamp. Backend lưu vào bảng answer_logs với tracking của mọi version.

Từ answer logs, em có thể phân tích: thời gian thí sinh dành cho mỗi câu, tốc độ typing, số lần edit, và đặc biệt correlation với các events khác.

Ví dụ nếu thấy pattern: Pre-Suspicion event xảy ra, sau đó 5 giây có paste event, sau đó answer được update với text length tăng đáng kể, đây là strong indicator của cheating.

Answer logs cũng hữu ích cho post-exam analysis, giúp proctor hiểu behavior của thí sinh ngay cả khi không có real-time detection alerts.

---

### Câu 71: Session Management hoạt động như thế nào?

**Trả lời:**

Session trong hệ thống có hai nghĩa: HTTP session cho authentication và Exam session cho phiên thi.

HTTP session được quản lý bởi BFF. Khi user login thành công, BFF tạo session record trong bff_db với session id, access token, refresh token, và expiry. Session id được set vào httpOnly cookie gửi về browser.

Requests tiếp theo, browser gửi cookie, BFF lookup session, validate access token, và attach user info vào request headers khi forward đến backend services.

Exam session được quản lý bởi session-service. Khi thí sinh start exam, tạo record trong sessions table với status ACTIVE. Mọi events, snapshots, answers đều reference session id này.

Khi exam kết thúc hoặc timeout, session status chuyển sang ENDED. Nếu disconnect prolonged hoặc technical issue, status là ABORTED. Session statistics được calculate và stored.

---

### Câu 72: Refresh Token Flow hoạt động như thế nào?

**Trả lời:**

Refresh Token Flow đảm bảo user không bị logout đột ngột khi access token expire.

Access token có thời hạn ngắn 5 phút để giảm risk nếu bị leak. Khi access token expire và request fail với 401, BFF tự động thử refresh.

BFF gửi refresh token đến auth-server /oauth2/token endpoint với grant_type là refresh_token. Auth-server validate refresh token, nếu valid thì issue new access token và optionally new refresh token.

BFF update session trong database với new tokens và retry original request với new access token.

Nếu refresh token cũng expired hoặc invalid (đã bị revoke), auth-server trả về error, BFF clear session và redirect user đến login page.

Frontend không biết về refresh flow này, mọi thứ handled transparently bởi BFF.

Refresh token có thời hạn 24 giờ và được rotate mỗi lần use để enhance security.

---

### Câu 73: Session Timeout handling như thế nào?

**Trả lời:**

Session timeout có hai loại: idle timeout và absolute timeout.

Idle timeout là thời gian không có activity. Trong BFF, mỗi lần nhận request, em update last_activity timestamp trong session record. Background job chạy mỗi phút, query sessions với last_activity quá 30 phút, và mark chúng expired.

Absolute timeout là tổng thời gian session tồn tại, bất kể activity. Session không thể dài hơn 8 giờ. Đây là safety measure nếu user quên logout.

Khi session expire, BFF trả về 401, frontend redirect đến login với message thông báo session expired.

Với exam sessions, có thêm exam duration timeout. Khi thí sinh start exam, backend calculate end time dựa trên exam duration. Khi end time đến, exam được auto-submit dù thí sinh chưa click submit.

Frontend hiển thị countdown timer và warning khi còn 5 phút.

---

### Câu 74: Real-time Dashboard hoạt động như thế nào?

**Trả lời:**

Proctor Dashboard cần hiển thị real-time data về sessions đang active và incidents mới.

Kiến trúc sử dụng combination của REST polling và SSE. Khi dashboard load, fetch initial data bằng REST API: danh sách active sessions và recent incidents.

Sau đó subscribe vào SSE endpoint để nhận updates. Mỗi khi có incident mới, SSE push event chứa incident data. Dashboard update UI ngay lập tức, hiển thị notification toast và play sound.

Mỗi 30 giây dashboard cũng poll REST API để sync state, handle cases khi SSE miss events do network issues.

Session list được update bằng polling mỗi 10 giây vì session status changes không frequent như incidents.

Dashboard sử dụng React state management để maintain consistent view, với optimistic updates khi proctor take action và rollback nếu API fail.

---

### Câu 75: Data Retention Policy như thế nào?

**Trả lời:**

Data Retention Policy quy định dữ liệu được lưu bao lâu trước khi xóa.

Exam data như questions, answers được giữ vĩnh viễn hoặc theo policy của institution, thường là 5 năm.

Session data và events được giữ theo retention_days setting của exam, default là 30 ngày. Sau đó background job clean up.

Evidence trong MinIO (snapshots và video clips) được giữ theo bucket retention policy. MinIO object locking đảm bảo evidence không bị xóa trước retention period kết thúc.

Incidents và reviews được giữ lâu hơn, thường 1 năm, vì có thể cần cho appeals hoặc audit.

User data tuân theo GDPR right to erasure. Khi user request deletion, personal data được anonymize hoặc delete, nhưng exam records có thể được retain với anonymized identifiers.

Logs được rotate hàng ngày và archive sau 7 ngày, delete sau 90 ngày.

---

## PHẦN Q: CÂU HỎI VỀ ADMIN FEATURES

### Câu 76: Exam Creation Flow như thế nào?

**Trả lời:**

Admin tạo exam qua Admin Dashboard với multi-step wizard.

Step đầu tiên là Basic Info: nhập tên exam, description, start time, end time, và duration. Các validation đảm bảo end time sau start time, duration hợp lý.

Step thứ hai là Questions: upload file CSV hoặc nhập manual từng câu hỏi với options và correct answer. Support multiple choice, true/false, và essay questions.

Step thứ ba là Participants: import danh sách thí sinh từ CSV hoặc select từ existing users. Assign thí sinh vào exam.

Step thứ tư là Proctoring Settings: enable hoặc disable các detection features như face detection, tab switch, Pre-Suspicion. Configure thresholds nếu muốn custom.

Step thứ năm là SEB Settings: enable SEB requirement, configure allowed URLs, security settings.

Step cuối là Review và Publish. Khi publish, exam trở thành visible cho assigned thí sinh trong thời gian cho phép.

---

### Câu 77: User Management hoạt động như thế nào?

**Trả lời:**

Admin có thể manage users qua Admin Dashboard.

Create User: nhập username, email, password, và assign roles. Password được hash với bcrypt trước khi store. Email verification optional.

Import Users: upload CSV với columns username, email, role. System validate và batch create, report errors nếu có duplicate hoặc invalid data.

Edit User: update email, roles, enabled status. Password reset gửi email với temporary link.

Disable User: soft delete, user không thể login nhưng data vẫn giữ. Hard delete chỉ available cho admin với proper audit trail.

Role assignment: một user có thể có multiple roles. Ví dụ một người vừa là PROCTOR vừa là REVIEWER.

Audit log ghi lại mọi changes đến user accounts với who, when, và what changed.

---

### Câu 78: Report Generation hoạt động như thế nào?

**Trả lời:**

System generate nhiều loại reports cho different stakeholders.

Session Report: summary của một phiên thi, bao gồm số violations, types, timestamps, và proctor actions. Export PDF hoặc Excel.

Exam Report: aggregate statistics của một exam across all sessions: average score, violation rate, time spent distribution, và question difficulty analysis.

User Report: history của một thí sinh, tất cả exams taken, scores, và incident history.

System Report: overall platform metrics như total exams, total sessions, detection accuracy based on proctor confirmations, và system performance metrics.

Reports được generate on-demand hoặc scheduled. Large reports được queue lên RabbitMQ, background worker generate và email link khi ready.

Charts và visualizations sử dụng Chart.js trong frontend, data aggregation ở backend với SQL queries.

---

### Câu 79: Audit Trail được implement như thế nào?

**Trả lời:**

Audit Trail ghi lại tất cả significant actions trong hệ thống cho compliance và security.

Mỗi audit entry có: timestamp, user id, action type, resource type, resource id, old value, new value, và IP address.

Actions được log bao gồm: user login và logout, exam create update delete, session start end, incident review, user role change, và settings modification.

Audit logs được store trong separate database table với append-only design, không cho phép update hoặc delete. Đây là immutable record.

Retention của audit logs dài hơn operational data, thường 7 năm để comply với regulations.

Admin có thể search và filter audit logs theo user, action type, time range. Export available cho external audit tools.

Audit logging được implement ở application level sử dụng Spring AOP, intercept annotated methods và automatically log.

---

### Câu 80: System Configuration hoạt động như thế nào?

**Trả lời:**

System Configuration cho phép admin customize behavior mà không deploy code mới.

Global settings được store trong database table settings với key-value pairs. Ví dụ: default_detection_threshold, max_exam_duration, retention_days_default.

Khi service start, nó load settings vào memory cache. Settings có version number, khi admin update, version tăng. Services periodically check version và reload nếu changed.

Feature flags cho phép enable hoặc disable features. Ví dụ: enable_pre_suspicion_detection, enable_seb_requirement. Flags evaluated at runtime.

Environment-specific settings như database URLs, API keys được manage qua environment variables trong Docker Compose hoặc Kubernetes ConfigMaps.

Sensitive settings như secrets và passwords được manage separately, có thể dùng secrets management tools trong production.

---

## PHẦN R: CÂU HỎI VỀ EDGE CASES VÀ ERROR HANDLING

### Câu 81: Handling Multiple Faces như thế nào?

**Trả lời:**

Khi BlazeFace detect nhiều hơn một khuôn mặt, hệ thống xử lý như sau.

Đầu tiên, nếu phát hiện hai hoặc nhiều faces, hệ thống record MULTI_FACE violation ngay lập tức. Đây là indicator rõ ràng của potential cheating, có thể có người khác trong phòng đang giúp.

Để chọn face chính cho detection tiếp tục, em lấy face có bounding box lớn nhất, giả định đó là thí sinh ngồi gần camera nhất.

Tuy nhiên nếu hai faces có size tương đương, khó xác định ai là thí sinh. Trong trường hợp này, detection tạm pause và alert proctor để intervene.

Edge case: người đi ngang qua phía sau thí sinh thoáng qua. Để tránh false positive, MULTI_FACE violation cũng có sustained duration 2 giây. Một người đi qua nhanh không trigger violation.

Evidence snapshot được capture showing both faces để proctor có thể review và decide.

---

### Câu 82: Handling No Face như thế nào?

**Trả lời:**

Khi BlazeFace detect zero faces, có thể do nhiều nguyên nhân.

Nguyên nhân legitimate: thí sinh tạm thời nghiêng đầu, che mặt lúc gãi mũi, đứng dậy lấy nước. Nguyên nhân suspicious: thí sinh rời khỏi máy tính, có người khác ngồi thay.

Để distinguish, em sử dụng sustained duration. No face phải kéo dài quá 3 giây mới trigger violation. Actions ngắn như hắt hơi chỉ mất 1 đến 2 giây.

Nếu no face kéo dài quá 60 giây liên tục, đây là serious issue, hệ thống escalate ngay và có thể auto-pause exam.

Khi face reappear sau một khoảng no face dài, hệ thống có thể trigger Face Verification lại để confirm vẫn là cùng một người.

Lighting conditions cũng affect detection. Nếu webcam quá tối, BlazeFace có thể fail. Em log warning khi detection confidence thấp để proctor aware.

---

### Câu 83: Handling Calibration Failure như thế nào?

**Trả lời:**

Calibration fail khi không thu thập đủ valid samples trong 30 giây.

Fail reasons: thí sinh không nhìn thẳng vào camera, webcam quality quá kém, lighting không đủ, face không stable detected.

Khi fail, hệ thống cho phép retry. Hiển thị guidance cho thí sinh: đảm bảo khuôn mặt nằm trong khung hướng dẫn, ngồi yên, nhìn vào camera, đảm bảo đủ ánh sáng.

Nếu fail sau 3 attempts, hệ thống allow thí sinh tiếp tục với fallback thresholds. Fallback thresholds là fixed values không personalized, có thể gây higher false positive nhưng ít nhất cho phép exam proceed.

Calibration quality score được attach vào session record. Proctor có thể filter sessions với low calibration quality để prioritize review.

Post-exam analysis có thể correlate calibration quality với violation rates để improve algorithm.

---

### Câu 84: Handling WebGL Crash như thế nào?

**Trả lời:**

WebGL crash xảy ra khi GPU driver có issues hoặc browser tab exceed memory limits.

Symptom: TensorFlow.js inference throw error hoặc return garbage results. Canvas không render đúng.

Detection: em wrap inference calls trong try-catch và monitor inference time. Nếu throw error hoặc time exceed 1 second nhiều lần liên tiếp, đây là dấu hiệu crash.

Recovery: đầu tiên try restart WebGL context bằng cách recreate canvas. Nếu không work, switch backend sang WASM nếu available.

Nếu cả WebGL và WASM fail, detection bị disabled. Frontend notify user với message và log alert. Proctor nhận notification rằng một thí sinh đang thi mà không có AI monitoring.

User có option refresh page để attempt recovery. Session state được preserve trong localStorage để resume.

Prevention: model warmup, proper tensor disposal, và memory monitoring help prevent crashes.

---

### Câu 85: Handling Server Downtime như thế nào?

**Trả lời:**

Server downtime có thể xảy ra do crash, deploy, hoặc maintenance.

Client-side detection chạy independent của server, vẫn tiếp tục hoạt động khi server down. Violations được buffer locally.

Khi try submit answer hoặc sync events fail, frontend implement retry với exponential backoff. Sau max retries, show error message và save data locally.

LocalStorage được sử dụng để persist unsent data. Khi server recover và connection restored, frontend batch upload buffered data với timestamps.

Backend có health check endpoints. Load balancer (trong production) route traffic đến healthy instances. Unhealthy instances bị remove khỏi rotation.

Database downtime được handle bằng connection pool với retry. Message queue (RabbitMQ) có persistence, messages không lost khi consumers down.

Planned maintenance được communicate trước, thí sinh được advise không start new exams trong maintenance window.

---

### Câu 86: Handling Timezone Issues như thế nào?

**Trả lời:**

Timezone issues phức tạp vì thí sinh có thể ở nhiều timezones khác nhau.

Rule: tất cả timestamps stored trong database là UTC. Conversion sang local timezone chỉ xảy ra ở presentation layer.

Exam start time và end time được admin nhập ở local timezone, frontend convert sang UTC trước khi send đến backend. Backend validate và store UTC.

Khi display cho thí sinh, frontend get exam times từ backend (UTC), convert sang browser timezone, và display. Thí sinh ở Việt Nam thấy giờ Việt Nam, thí sinh ở US thấy giờ US.

Event timestamps cũng là UTC. Answer logs, incidents đều có UTC timestamp.

Potential issue: nếu thí sinh change device timezone mid-exam, displays có thể confusing. Em include UTC timestamp in logs để admin có single source of truth.

Backend validation đảm bảo exam actions chỉ allowed trong valid time window based on UTC comparison.

---

## PHẦN S: CÂU HỎI VỀ REACT VÀ FRONTEND

### Câu 87: Custom Hooks trong project được design như thế nào?

**Trả lời:**

Em tổ chức logic phức tạp thành custom hooks để reuse và separate concerns.

Hook useOptimizedDetection là main detection hook, orchestrate BlazeFace, FaceMesh, và various analysis functions. Return detection state, violations, và control functions như pause hoặc resume.

Hook usePreSuspicionDetection handle Pre-Suspicion detection riêng, có own state machine và thresholds. Integrate với main detection hook qua shared data.

Hook useLiveKit handle LiveKit room connection, local track publishing, và egress control.

Hook useExamSession manage exam session lifecycle, API calls to backend, và answer submission.

Hook useBrowserEvents setup browser event listeners và batch upload events.

Các hooks được compose trong page component. Page chỉ focus on rendering, không chứa business logic.

Hooks utilize React's useEffect cho side effects, useRef cho stable references, và useCallback để prevent unnecessary rerenders.

---

### Câu 88: State Management trong frontend như thế nào?

**Trả lời:**

Em sử dụng React's built-in state management với hooks, không dùng external library như Redux.

Local component state dùng useState cho simple values như form inputs, modal open/close.

Cross-component state dùng Context API. AuthContext hold user session info accessible mọi nơi. ExamContext hold current exam state.

Caching server data dùng React Query (TanStack Query). Queries được cached với stale time, automatic refetch on focus, và optimistic updates. Mutations update cache và invalidate related queries.

Complex client state như detection results dùng useReducer với defined actions để predictable state transitions.

Derived state computed inline hoặc với useMemo để avoid recalculation.

Global singleton state như TensorFlow models store trong module-level variables outside React, loaded once và shared.

Pattern này balance simplicity với scalability, avoid over-engineering cho medium-sized app.

---

### Câu 89: Performance Optimization trong frontend như thế nào?

**Trả lời:**

Performance optimization focus vào detection loop và rendering.

Detection loop optimization: limit FPS ở 5, downscale canvas, warmup models, proper tensor disposal như đã discuss.

Rendering optimization: React.memo wrap components không cần rerender frequently. useMemo cho expensive calculations. useCallback cho functions passed to children.

Lazy loading: routes được code-split với React.lazy. TensorFlow models loaded only when exam starts, không khi app loads.

Image optimization: evidence images resized client-side trước upload để reduce bandwidth. Use native image decode.

Avoid blocking main thread: heavy operations như model inference scheduled với requestIdleCallback khi possible.

Virtual scrolling: incident lists có thể dài, dùng react-window để only render visible items.

Bundle optimization: tree shaking enabled, unused code eliminated. Split chunks per route.

Measure với Chrome DevTools Performance tab và React DevTools Profiler để identify bottlenecks.

---

### Câu 90: Component Structure như thế nào?

**Trả lời:**

Components được organized theo feature-based structure.

Folder structure: src/components chứa shared reusable components như Button, Modal, Card. src/features chứa feature-specific components grouped by feature như exam, incident, user.

Mỗi feature folder có: components subfolder cho presentational components, hooks subfolder cho custom hooks, api.ts cho API calls, types.ts cho TypeScript interfaces.

Naming convention: PascalCase cho components, camelCase cho hooks và utilities. Files named after default export.

Props typing: mỗi component có interface defining props. Required props không có default, optional có default values.

Composition over inheritance: sử dụng children prop và render props pattern thay vì class inheritance.

Storybook được sử dụng để document và visually test isolated components.

Component tests với React Testing Library focus on user behavior không internal implementation.

---

## PHẦN T: CÂU HỎI VỀ SPRING BOOT VÀ BACKEND

### Câu 91: JPA và Hibernate được sử dụng như thế nào?

**Trả lời:**

JPA với Hibernate implementation được sử dụng cho object-relational mapping.

Entities được annotated với @Entity và map đến database tables. Relationships được define với @OneToMany, @ManyToOne, @ManyToMany.

Repositories extend JpaRepository interface, provide standard CRUD operations và query methods. Custom queries được write với @Query annotation sử dụng JPQL hoặc native SQL.

Lazy loading được configure cho collections để avoid N+1 problems. Em sử dụng @EntityGraph hoặc JOIN FETCH trong queries khi cần eager load.

Transactions được manage với @Transactional annotation. Default là REQUIRED, tức join existing transaction hoặc create new.

Auditing enabled với @CreatedDate và @LastModifiedDate columns được auto-populated.

Hibernate second-level cache không enabled trong project này, queries được optimized thay vì rely on cache.

Schema generation được disable, Flyway migrations handle schema changes.

---

### Câu 92: Exception Handling trong Spring Boot như thế nào?

**Trả lời:**

Exception handling được centralize với @ControllerAdvice.

Custom exceptions được create cho different error cases: ResourceNotFoundException, ValidationException, AuthenticationException. Mỗi exception có HTTP status code associated.

GlobalExceptionHandler class annotated với @ControllerAdvice, có methods annotated @ExceptionHandler cho mỗi exception type.

Handler method convert exception thành standardized ErrorResponse DTO với status, message, timestamp, và correlationId. Log exception với appropriate level, trả về ResponseEntity với HTTP status.

Validation errors từ @Valid được handle separately, collect all field errors thành readable message.

Unexpected exceptions (500) được catch-all handle, log full stack trace nhưng chỉ return generic message cho security.

Development mode có thể include stack trace trong response để debug. Production mode never expose internal details.

---

### Câu 93: API Design Principles như thế nào?

**Trả lời:**

API design follow REST principles và best practices.

Resource-based URLs: /api/exams, /api/sessions, /api/incidents. Nouns không verbs.

HTTP methods semantic: GET cho read, POST cho create, PUT cho full update, PATCH cho partial update, DELETE cho remove.

Status codes meaningful: 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error.

Pagination cho list endpoints: query params page và size, response include totalElements và totalPages.

Filtering và sorting: query params filter[field]=value và sort=field,asc.

Response format consistency: data wrapped trong data field, errors trong error field.

Versioning: /api/v1 prefix, version bump cho breaking changes.

Documentation: SpringDoc OpenAPI generate Swagger UI automatically từ annotations.

---

### Câu 94: Service Layer Design như thế nào?

**Trả lời:**

Service layer chứa business logic, sit between controller và repository.

Controllers thin: chỉ handle request/response mapping, delegate đến services.

Services encapsulate business rules: validation beyond simple constraints, orchestration của multiple repositories, integration với external systems.

Interfaces được define cho services, implementations annotated @Service. Dependency injection qua constructor.

Services có thể call other services khi cần cross-domain logic. Circular dependencies avoided bằng careful design.

Domain-driven approach: services organized by business domain như ExamService, SessionService, IncidentService.

Utility operations extract thành separate helper classes hoặc static utility methods.

Testing: services tested với mocked dependencies, focus on business logic correctness.

---

### Câu 95: DTO và Entity Mapping như thế nào?

**Trả lời:**

DTOs (Data Transfer Objects) separate API contracts từ internal domain models.

Entities represent database tables, chứa JPA annotations, relationships. Không expose directly qua API.

Request DTOs define API input format, chỉ chứa fields client cần gửi. Response DTOs define output format, có thể include computed fields, exclude sensitive fields.

Mapping giữa Entity và DTO dùng MapStruct library. Define interface với @Mapper annotation, MapStruct generate implementation at compile time.

Mapping methods: entityToDto, dtoToEntity, và collection variants. Nested relationships mapped recursively.

Ưu điểm separation: API có thể evolve independent của database schema. Sensitive fields như password hash không accidentally leak. Clear contracts cho frontend developers.

Validation annotations như @NotNull, @Size trên DTO fields, validated tại controller level với @Valid.

---

## PHẦN U: CÂU HỎI VỀ FUTURE DEVELOPMENT

### Câu 96: Những hạn chế hiện tại của hệ thống?

**Trả lời:**

Hệ thống có một số hạn chế em nhận thức được.

Hạn chế về detection accuracy: Pre-Suspicion có precision 85% nghĩa là 15% false positive. Người đeo kính đậm hoặc điều kiện ánh sáng yếu có thể giảm accuracy.

Hạn chế về scalability: hiện tại Docker Compose single-node, chưa có Kubernetes orchestration. Production scale cần refactor.

Hạn chế về attack vectors: second monitor detection vẫn là challenge. Sophisticated attacks như screen sharing over secondary device khó detect.

Hạn chế về UX: Calibration 30 giây có thể annoying. Thí sinh với disabilities như visual impairment chưa có accommodations riêng.

Hạn chế về mobile: hệ thống designed cho desktop browser, mobile support limited.

Hạn chế về integration: chưa có out-of-box LMS integration như Canvas hay Moodle.

Đây là areas cho future improvement.

---

### Câu 97: Roadmap phát triển tiếp theo?

**Trả lời:**

Em có roadmap cho phases tiếp theo.

Phase 1 - Short term: improve detection accuracy bằng cách train custom models với larger dataset, add glasses detection và auto-adjust thresholds.

Phase 2 - Medium term: Kubernetes deployment với auto-scaling, implement object detection cho phone hoặc notes visible in frame sử dụng YOLO on server.

Phase 3 - Long term: LMS integrations với Canvas, Moodle, Blackboard. Mobile app native cho proctoring on tablets. AI-generated question variations để prevent sharing.

Phase 4 - Advanced: fully automated proctoring mode với human review only cho escalated cases. Machine learning để learn từ proctor decisions và improve algorithms.

Mỗi phase có clear deliverables và success metrics. Prioritization based on user feedback và business value.

---

### Câu 98: Làm sao improve detection accuracy?

**Trả lời:**

Em có nhiều approaches để improve accuracy.

First, larger và more diverse training/testing dataset. Collect videos từ nhiều người, nhiều lighting conditions, nhiều webcam types. Use this để tune thresholds.

Second, custom model training. Hiện tại dùng pre-trained BlazeFace và FaceMesh. Có thể fine-tune trên domain-specific data để better detect exam cheating poses.

Third, multi-modal detection. Kết hợp video với audio analysis. Detect whispering hoặc speaking có thể indicate receiving help.

Fourth, temporal modeling. Sử dụng LSTM hoặc Transformer để model sequences của events, phát hiện patterns across time thay vì frame-by-frame.

Fifth, active learning. Proctor feedback (confirm/reject) được collect, use để retrain models periodically, continuously improving.

Sixth, ensemble methods. Combine multiple detection algorithms, aggregate decisions để reduce individual algorithm biases.

---

### Câu 99: Performance optimization tiếp theo?

**Trả lời:**

Performance có thể optimize further ở nhiều areas.

Client-side: explore WebGPU backend mới của TensorFlow.js, potentially faster than WebGL. Implement model quantization để reduce model size và inference time.

Server-side: database query optimization với proper indexing, analyze slow queries. Consider read replicas cho heavy read workloads.

Caching: implement Redis caching cho frequently accessed data như exam details. Consider CDN cho static assets.

Message queue: RabbitMQ clustering cho high availability. Consider Kafka cho higher throughput scenarios.

Network: compress API payloads với gzip. Implement HTTP/2 cho multiplexing. Consider GraphQL để reduce over-fetching.

Infrastructure: move từ Docker Compose sang Kubernetes với horizontal pod autoscaling. Implement proper load balancing.

Monitoring: detailed performance metrics với Prometheus và Grafana. Identify bottlenecks proactively.

---

### Câu 100: Security enhancements tiếp theo?

**Trả lời:**

Security có thể enhance ở nhiều areas.

Authentication: add Multi-Factor Authentication option cho high-stakes exams. Implement device fingerprinting để detect unauthorized devices.

Authorization: implement Attribute-Based Access Control ngoài RBAC cho fine-grained permissions. Policy-as-code với Open Policy Agent.

Network security: add Web Application Firewall rules. Implement IP blocklisting cho repeated attack attempts.

Data security: encrypt sensitive data at rest trong database. Implement proper key management.

API security: add request signing để prevent tampering. Implement stricter rate limiting per user.

Monitoring: real-time security event monitoring với SIEM. Automated alerts cho suspicious activities.

Compliance: SOC 2 certification preparation. Regular penetration testing. Bug bounty program.

Third-party: regular dependency updates. Software composition analysis cho vulnerabilities.

---

## PHẦN V: CÂU HỎI TỔNG KẾT

### Câu 101: Đóng góp chính của đồ án là gì?

**Trả lời:**

Đồ án có ba đóng góp chính.

Đóng góp thứ nhất về mặt kỹ thuật là kết hợp hybrid rule-based và AI detection cho online exam proctoring. Cách tiếp cận này balance giữa accuracy và interpretability, giảm false positive so với pure AI approaches.

Đóng góp thứ hai là tính năng Pre-Suspicion Detection phát hiện sớm hành vi chuẩn bị gian lận. Đây là feature mới chưa thấy trong các hệ thống thương mại phổ biến, giúp proactive intervention.

Đóng góp thứ ba về mặt kiến trúc là thiết kế microservices với client-side AI processing, kết hợp privacy-preserving edge computing với server-side verification, scalable với cost-effective.

Ngoài ra đồ án cũng cung cấp open-source implementation và documentation, giúp các tổ chức có thể deploy và customize theo nhu cầu riêng.

---

### Câu 102: Lessons learned trong quá trình làm đồ án?

**Trả lời:**

Em học được nhiều lessons quan trọng.

Lesson về technical trade-offs: không có perfect solution, mọi decision đều có trade-off. Ví dụ client-side AI tốt cho privacy nhưng limited model complexity.

Lesson về iterative development: detection thresholds không thể determine upfront, phải tune dựa trên real testing. Agile approach với frequent testing essential.

Lesson về system design: microservices brings flexibility nhưng cũng complexity. Cần careful consideration trước khi split services.

Lesson về AI in production: model accuracy in lab không translate directly thành production performance. Edge cases, diverse inputs, và environmental factors significant.

Lesson về user experience: technical excellence không đủ, UX phải smooth. Thí sinh stressed khi thi, additional friction từ proctoring system phải minimize.

Lesson về documentation: good documentation saves time long-term. Code comments, API docs, architecture diagrams essential cho collaboration và maintenance.

---

### Câu 103: Kết quả đạt được so với mục tiêu đề ra?

**Trả lời:**

So sánh với bảy mục tiêu đề ra ban đầu.

Mục tiêu No-Face Detection với yêu cầu 95% accuracy và latency dưới 3 giây, kết quả đạt 97% accuracy và latency khoảng 2 giây, đạt yêu cầu.

Mục tiêu Multi-Face Detection với yêu cầu 90% accuracy, kết quả đạt 93%, đạt yêu cầu.

Mục tiêu Tab Switch Detection với yêu cầu 100% capture, kết quả đạt 100% cho supported browsers, đạt yêu cầu.

Mục tiêu Paste Detection với yêu cầu 100% ghi nhận, kết quả đạt 100%, đạt yêu cầu.

Mục tiêu Pre-Suspicion Detection với mục tiêu phát hiện sớm hành vi nghi vấn, kết quả đạt 85% precision, đạt yêu cầu với room for improvement.

Mục tiêu Evidence Collection với yêu cầu 100% incident có evidence, kết quả đạt 100%, đạt yêu cầu.

Mục tiêu Review Workflow với yêu cầu proctor review dưới 30 giây, kết quả UI responsive và evidence accessible ngay, đạt yêu cầu.

Tổng kết: 7/7 mục tiêu đạt được.

---

### Câu 104: Ứng dụng thực tế của đồ án?

**Trả lời:**

Đồ án có nhiều ứng dụng thực tế.

Ứng dụng trong giáo dục: các trường đại học, cao đẳng, trung tâm đào tạo có thể deploy để giám sát thi online, đặc biệt hữu ích cho distance learning programs.

Ứng dụng trong tuyển dụng: các công ty có thể sử dụng cho online assessment trong quá trình tuyển dụng, đảm bảo ứng viên không gian lận.

Ứng dụng trong chứng chỉ: các tổ chức cấp chứng chỉ chuyên nghiệp như IT certifications có thể sử dụng để proctoring từ xa.

Ưu điểm of self-hosted solution: các tổ chức có data sovereignty requirements có thể deploy on-premise. Cost savings so với per-session commercial solutions.

Customization: mã nguồn mở cho phép customize theo specific needs, integrate với existing systems.

---

### Câu 105: Đạo đức và công bằng trong sử dụng AI proctoring?

**Trả lời:**

Đây là vấn đề quan trọng mà em cân nhắc trong thiết kế.

Về privacy, em design client-side AI để minimize data sent đến server. Video không continuously recorded, chỉ evidence khi có violation.

Về bias, AI models có thể có bias với certain demographics. Em mitigate bằng calibration cá nhân hóa, và human review cho mọi violations. Automated decisions không final.

Về transparency, thí sinh được inform upfront về monitoring methods. Post-exam có thể review incidents reported về mình.

Về accommodation, thí sinh với disabilities cần special consideration. Settings có thể adjust per user. Proctor discretion cho edge cases.

Về false accusation, em prioritize precision over recall. Prefer miss some violations than falsely accuse innocent students.

Về stress, proctoring inherently stressful. Em minimize intrusiveness, clear instructions, và supportive error messages.

Balance between exam integrity và student experience là ongoing consideration.

---

### Câu 106: Benchmark với các hệ thống khác như thế nào?

**Trả lời:**

Em so sánh với Proctorio và ProctorU, hai hệ thống phổ biến nhất.

Về detection accuracy, Proctorio có reported false positive rate 20 đến 30% theo một số nghiên cứu. Em đạt dưới 10% cho most detection types nhờ hybrid approach.

Về features, cả ba hệ thống đều có face detection, tab switch detection. Em thêm Pre-Suspicion Detection là feature unique.

Về privacy, Proctorio scan entire machine, ProctorU có live human proctors. Em chỉ analyze camera feed và browser events, no system scan.

Về cost, commercial solutions charge 15 đến 25 đô la per session. Em là self-hosted, no per-session fee sau initial deployment.

Về transparency, commercial solutions là black box. Em là open source, algorithm explainable.

Limitation: em chưa có scale of commercial solutions, chưa proven with millions of users.

Benchmark data based on published research và own testing, đều có limitations.

---

### Câu 107: Challenges lớn nhất trong quá trình development?

**Trả lời:**

Challenge thứ nhất là TensorFlow.js performance optimization. Ban đầu detection lag gây poor UX. Phải iterate nhiều lần để tìm optimal FPS, canvas resolution, và memory management.

Challenge thứ hai là threshold tuning. Các thresholds như head pose angle, sustained duration, confidence score phải tune dựa trên real testing. Không có formula, phải empirical testing với nhiều subjects.

Challenge thứ ba là async communication giữa services. Debug distributed systems phức tạp hơn monolith nhiều. Correlation ID và proper logging essential.

Challenge thứ tư là WebRTC và LiveKit integration. WebRTC có nhiều edge cases với NAT, firewalls. LiveKit documentation không cover hết, phải read source code.

Challenge thứ năm là balance features với timeline. Muốn làm nhiều hơn nhưng phải prioritize. Scope management critical cho thesis timeline.

---

### Câu 108: Recommendations cho người muốn develop similar systems?

**Trả lời:**

Recommendations based on experience.

Start với clear requirements và metrics. Define trước success criteria cho detection accuracy, latency, false positive acceptable rate.

Invest in testing infrastructure sớm. Build dataset cho testing, automated testing pipeline. This pays off tremendously.

Design for privacy từ đầu, không bolt-on sau. Privacy by design dễ hơn retrofitting.

Prototype client-side AI viability sớm. Test với multiple devices, browsers, conditions. If not feasible, switch to server-side early.

Use established libraries và frameworks. Đừng reinvent authentication, video encoding. Focus domain-specific value.

Plan for human-in-the-loop. AI không perfect, human review essential. Design workflow support this.

Document extensively. Future self và teammates sẽ thank you.

Get real user feedback sớm. Build MVP, test với actual users, iterate.

---

### Câu 109: Công nghệ nào em thấy exciting cho future proctoring?

**Trả lời:**

Một số công nghệ em thấy promising.

First, large language models cho essay grading và plagiarism detection. LLMs có thể analyze writing style, detect AI-generated content.

Second, edge AI hardware. Devices với NPU (Neural Processing Unit) sẽ enable more complex models client-side mà không drain battery.

Third, blockchain cho credential verification. Tamper-proof records của exam completions và certifications.

Fourth, VR và AR proctoring. As online education moves to immersive environments, proctoring cần adapt.

Fifth, behavioral biometrics. Typing patterns, mouse movements unique per person, có thể verify identity continuously.

Sixth, federated learning. Train models on distributed data without centralized collection, enhance privacy.

Seventh, explainable AI. Better tools để explain why AI flagged certain behavior, important for fairness.

---

### Câu 110: Advice cho students doing similar thesis?

**Trả lời:**

Advice từ experience.

First, chọn topic bạn genuinely interested. Thesis kéo dài, motivation quan trọng.

Second, start early, especially nếu có hardware hoặc infrastructure setup. Unexpected issues always arise.

Third, communicate regularly với advisor. Don't disappear for months rồi surprise với problems.

Fourth, scope realistically. Better to do fewer features well than many features poorly. Can always note future work.

Fifth, document as you go. Writing thesis paper cuối sẽ much easier nếu có notes throughout.

Sixth, test với real users. Friends, classmates có thể volunteer. Their feedback invaluable.

Seventh, prepare cho defense. Practice explaining technical concepts simply. Anticipate questions.

Eighth, take care of yourself. Sleep, exercise, breaks. Sustainable pace beats burnout.

Ninth, đừng sợ ask for help. Classmates, online communities, Stack Overflow. Everyone struggles sometimes.

---

### Câu 111: Technical debt trong project và cách handle?

**Trả lời:**

Technical debt accumulate trong fast development. Em quản lý như sau.

Identify debt: em track known issues và shortcuts trong TODO comments và GitHub issues. Không hide debt.

Prioritize: not all debt equal. Debt affecting correctness fixed first. Debt affecting maintainability scheduled for later.

Refactor incrementally: big rewrites risky. Small refactors in each PR keep codebase improving.

Debt trong project: một số detection thresholds hardcoded, nên externalize thành configuration. Một số API endpoints không consistent, cần refactor. Test coverage cho edge cases incomplete.

Prevention: code review catch potential debt. Clear coding standards. Resist pressure to just ship it.

Balance: some debt acceptable nếu enables faster delivery. Key là conscious decision, not accidental.

Documentation: document workarounds và known limitations để future maintainers aware.

---

### Câu 112: Teamwork và collaboration như thế nào trong project?

**Trả lời:**

Dù là individual thesis, em vẫn áp dụng collaboration practices.

Version control với Git: clear commit messages, feature branches, pull request workflow dù self-review.

Documentation: README files cho mỗi major module, API documentation, architecture diagrams. Nếu ai khác cần contribute, có thể onboard.

Code organization: consistent structure across services, shared conventions. Makes navigation easy.

External collaboration: community packages và libraries sử dụng có contribution từ thousands developers. Em contribute back bug reports và sometimes fixes.

Advisor collaboration: regular meetings, demo progress, incorporate feedback.

Peer review: có friends review code và test system. Fresh eyes catch issues.

Future collaboration: codebase designed để handoff-able. If project continues, others can contribute.

---

### Câu 113: Demo hệ thống trong bảo vệ như thế nào?

**Trả lời:**

Em chuẩn bị demo workflow như sau.

Setup: Docker Compose start tất cả services trước buổi defend. Verify healthy. Have backup plan nếu demo fails.

Demo flow: First show admin creating exam với proctoring enabled. Then switch role, simulate thí sinh login, go through Calibration, start exam.

Trigger violations: intentionally look away, have second face appear (picture), switch tabs. Show violations being recorded.

Evidence viewing: login as proctor, view incidents, see snapshots and video clips. Demonstrate confirm và reject workflow.

Technical deep-dive: show code for key components như preSuspicionDetector.ts, RabbitMQConfig.java nếu asked.

Keep demo concise: 5 đến 7 minutes max. Leave time for Q&A.

Backup: pre-recorded video nếu live demo fails. Screenshots của key screens.

---

### Câu 114: Câu hỏi dự đoán từ hội đồng và câu trả lời chi tiết?

**Trả lời:**

Dựa trên experience và common patterns, có thể expect các câu hỏi sau. Em sẽ trình bày từng loại với câu trả lời chuẩn bị sẵn.

**Loại 1: Câu hỏi về lý do chọn công nghệ**

Nếu hỏi tại sao TensorFlow.js mà không PyTorch: TensorFlow.js là thư viện duy nhất mature cho browser AI. PyTorch không có browser version native. Em cần chạy AI trực tiếp trong browser để privacy, không gửi video lên server. TensorFlow.js có BlazeFace và FaceMesh models pre-trained, optimized cho web.

Nếu hỏi tại sao RabbitMQ mà không Redis Pub/Sub: RabbitMQ có persistent message queues, đảm bảo không mất message khi service restart. Redis Pub/Sub là fire-and-forget, nếu consumer offline thì message mất. Với incident recording, reliability quan trọng hơn speed.

Nếu hỏi tại sao Spring Boot mà không Node.js cho backend: Spring Boot có ecosystem mature cho enterprise, type safety với Java, và team đã familiar. Node.js phù hợp cho realtime nhưng Spring Boot đủ tốt với WebSocket support. Đồ án cần reliability hơn raw performance.

Nếu hỏi tại sao PostgreSQL mà không MongoDB: Data có schema rõ ràng như users, exams, sessions, incidents với relationships. PostgreSQL ACID compliance quan trọng cho audit trail. MongoDB tốt cho flexible schema nhưng không cần thiết ở đây.

**Loại 2: Câu hỏi về accuracy và testing**

Nếu hỏi accuracy đo như thế nào: Em test với dataset tự thu thập từ volunteers, khoảng 30 người với các scenarios look-away, multiple faces, normal behavior. Tính true positive rate và false positive rate. Detection rate cho look-away đạt khoảng 85% với false positive dưới 10% sau tuning.

Nếu hỏi dataset từ đâu: Dataset là self-collected không phải public benchmark vì không có public dataset cho exam proctoring cụ thể. Em record volunteers với các scenarios predefined. Limitation là dataset size nhỏ, bias về demographics của volunteers.

Nếu hỏi false positive rate chấp nhận được không: Trong exam proctoring, false positive gây frustration cho thí sinh nhưng là minor inconvenience nếu có human review. Em target dưới 10% false positive cho LOOKING_AWAY, chấp nhận được vì proctor sẽ verify. Quan trọng hơn là không miss true violations.

**Loại 3: Câu hỏi về security và privacy**

Nếu hỏi handle attack vectors thế nào: Spoofing photo được handle bằng liveness detection qua blink và head movement. Virtual camera bypass có thể detect qua device enumeration và noise analysis, nhưng chưa implement fully. Multiple devices bypass không handle được vì scope limitation.

Nếu hỏi về privacy: Video không upload lên server, AI chạy hoàn toàn trong browser. Chỉ evidence snapshots và short clips được upload khi có violation. Dùng presigned URLs để bypass backend cho file transfer. Data retention policy clear, tự động delete sau period.

Nếu hỏi về GDPR: Hệ thống design theo privacy-by-design principle. Collect minimum necessary data. User consent được collect trước khi bắt đầu. Data portability và right to erasure có thể implement qua admin APIs.

**Loại 4: Câu hỏi về scalability**

Nếu hỏi handle bao nhiêu concurrent users: Với current architecture, estimate handle khoảng 500 đến 1000 concurrent exam sessions. Bottleneck chính là WebSocket connections cho SSE và database write throughput cho incidents.

Nếu hỏi bottlenecks ở đâu: Thứ nhất là PostgreSQL writes khi nhiều incidents cùng lúc, giải quyết bằng batch inserts và read replicas. Thứ hai là MinIO bandwidth cho video clips, giải quyết bằng CDN hoặc distributed storage. Thứ ba là AI Worker processing queue, giải quyết bằng horizontal scaling workers.

Nếu hỏi cách scale: Microservices architecture cho phép scale từng service độc lập. Session service có thể scale horizontally với load balancer. Database có thể shard theo exam_id. Message queues có thể cluster. Kubernetes deployment ready với Docker Compose.

**Loại 5: Câu hỏi về comparison với commercial solutions**

Nếu hỏi so với Proctorio, Examity: Commercial solutions có advantages là mature, well-tested, support team. Đồ án này có advantages là privacy tốt hơn với client-side AI, customizable, no vendor lock-in, lower cost. Disadvantages là accuracy có thể thấp hơn, fewer features, no 24/7 support.

Nếu hỏi tại sao không dùng commercial: Mục đích đồ án là học và demonstrate technical skills, không phải build production system. Ngoài ra, commercial solutions thường có privacy concerns với video upload lên cloud của họ.

**Loại 6: Câu hỏi về limitations**

Nếu hỏi hệ thống fail ở cases nào: Thứ nhất là lighting conditions extreme như backlight strong, face không visible. Thứ hai là eyeglasses có glare che mắt, iris tracking fail. Thứ ba là camera quality thấp, landmarks noisy. Thứ tư là multiple monitors setup, candidate có thể nhìn sang monitor khác mà không detect được. Thứ năm là sophisticated cheating như earpiece, không có audio analysis.

Nếu hỏi blind spots: Không detect được cheating không liên quan đến visual như listening to audio, someone dictating from behind camera, screen sharing to another device.

**Loại 7: Câu hỏi về future work**

Nếu hỏi tiếp theo develop gì: Priority một là object detection để detect phone và notes. Priority hai là audio analysis cho voice detection. Priority ba là mobile support cho exam trên tablet. Priority bốn là LMS integration với Moodle và Canvas.

Nếu hỏi về commercialize: Có potential nhưng cần nhiều work. Cần improve accuracy, add more features, security audit, compliance certifications. Có thể open source core và offer enterprise support.

**Loại 8: Câu hỏi về contribution**

Nếu hỏi novel contribution là gì: Thứ nhất là Pre-Suspicion Detection concept, detect preparatory behavior trước khi violation xảy ra. Thứ hai là hybrid architecture kết hợp client-side AI với server-side verification. Thứ ba là Kappa angle correction implementation cho iris gaze.

Nếu hỏi về publication potential: Pre-Suspicion Detection concept có thể viết thành paper về early detection of cheating behavior. Hybrid AI architecture có thể contribute to privacy-preserving AI systems literature.


---

### Câu 115: Kết luận và lời cảm ơn?

**Trả lời:**

Kết luận: Đồ án đã xây dựng thành công Hệ thống Phát hiện Gian lận Thi cử Trực tuyến với các tính năng phát hiện không có mặt, nhiều mặt, chuyển tab, paste, và đặc biệt là Pre-Suspicion Detection. Kiến trúc microservices với client-side AI đảm bảo privacy và scalability. Kết quả đạt được tất cả bảy mục tiêu đề ra với detection accuracy phù hợp yêu cầu.

Hạn chế và hướng phát triển đã được đề cập, bao gồm cải thiện accuracy, mobile support, và LMS integration.

Lời cảm ơn: Em xin cảm ơn thầy cô hướng dẫn đã tận tình chỉ bảo trong suốt quá trình làm đồ án. Cảm ơn gia đình và bạn bè đã hỗ trợ, thử nghiệm hệ thống, và cho feedback quý giá. Cảm ơn cộng đồng open source đã xây dựng các thư viện và công cụ mà em sử dụng.

Em xin kết thúc phần trình bày và sẵn sàng nhận câu hỏi từ hội đồng.

---

## PHẦN W: CÂU HỎI VỀ CÔNG THỨC TOÁN HỌC VÀ TÍNH TOÁN

### Câu 116: Giải thích chi tiết công thức tính Head Pose (Pitch, Yaw, Roll)?

**Trả lời:**

Head Pose estimation trong đồ án sử dụng phương pháp hình học từ các facial landmarks thay vì PnP algorithm truyền thống vì đây là client-side processing.

Với Yaw tức góc quay trái phải, em tính bằng cách so sánh khoảng cách từ mũi đến hai mắt. Khi đầu quay sang trái, mũi gần mắt phải hơn mắt trái. Công thức là: asymmetry bằng khoảng cách mũi đến mắt trái trừ khoảng cách mũi đến mắt phải, chia cho khoảng cách giữa hai mắt. Sau đó nhân với 120 độ để scale về phạm vi góc thực tế. Hệ số 120 thay vì 90 là để tăng độ nhạy detection.

Với Pitch tức góc cúi lên xuống, em sử dụng tỷ lệ vị trí mũi trong khuôn mặt. Tính noseToForeheadRatio là khoảng cách từ trán đến mũi chia cho chiều cao mặt, và noseToChinRatio là khoảng cách từ mũi đến cằm chia cho chiều cao mặt. Pitch bằng noseToForeheadRatio trừ noseToChinRatio, nhân với 180 độ. Khi cúi xuống, mũi gần trán hơn nên ratio tăng, pitch dương.

Với Roll tức góc nghiêng đầu, em dùng arc tangent của độ chênh lệch y chia cho độ chênh lệnh x giữa hai mắt, rồi convert từ radian sang độ.

---

### Câu 117: Tại sao không sử dụng solvePnP của OpenCV cho Head Pose?

**Trả lời:**

PnP hay Perspective-n-Point là thuật toán kinh điển để estimate 3D pose từ 2D points. OpenCV cung cấp solvePnP function rất chính xác. Tuy nhiên em không dùng vì một số lý do thực tế.

Thứ nhất, OpenCV.js (phiên bản JavaScript) có bundle size lớn khoảng 8MB, làm tăng load time đáng kể cho client.

Thứ hai, solvePnP cần camera matrix chứa focal length và principal point. Webcam consumer không cung cấp thông tin này, phải estimate hoặc dùng giá trị mặc định, làm giảm accuracy.

Thứ ba, phương pháp hình học em dùng tuy đơn giản hơn nhưng đủ chính xác cho use case phát hiện look-away. Em không cần 3D pose chính xác tuyệt đối, chỉ cần phân biệt được khi nào thí sinh quay đầu quá ngưỡng.

Thứ tư, phương pháp này nhanh hơn, chỉ vài phép tính số học, không cần iterative optimization như solvePnP.

Trade-off là accuracy có thể kém hơn 5 đến 10 độ so với PnP, nhưng với calibration cá nhân hóa, vẫn đạt được detection reliable.

---

### Câu 118: Giải thích công thức solvePnP nếu được hỏi sâu về lý thuyết?

**Trả lời:**

Lưu ý quan trọng: đồ án em KHÔNG sử dụng solvePnP trong code thực tế vì các lý do đã nêu ở Câu 117. Tuy nhiên nếu được hỏi về lý thuyết PnP, có thể trả lời như sau.

Về mặt toán học, PnP giải bài toán: cho n điểm 3D trên model và n điểm 2D tương ứng trên ảnh, tìm rotation matrix R và translation vector t sao cho khi project 3D points xuống 2D khớp với detected points.

Công thức projection là: s nhân với điểm 2D homogeneous bằng camera matrix K nhân với ma trận rotation R ghép nối với translation t, nhân với điểm 3D homogeneous.

Trong đó s là scale factor, K là camera intrinsic matrix 3x3 chứa focal length fx fy và principal point cx cy. R là rotation matrix 3x3, có thể biểu diễn bằng Rodrigues vector 3x1. t là translation vector 3x1.

Thuật toán iterative SOLVEPNP_ITERATIVE minimize reprojection error bằng Levenberg-Marquardt optimization.

Sau khi có rotation matrix R, có thể extract Euler angles. Roll bằng atan2 của R21 chia R11. Pitch bằng arcsin của âm R31. Yaw bằng atan2 của R32 chia R33.

Đây là convention XYZ hay intrinsic rotations. Nhắc lại: đồ án dùng geometric ratios (Câu 116) chứ không phải PnP, vì đơn giản và đủ accurate cho use case này.


---

### Câu 119: Công thức tính Iris Gaze Position chi tiết?

**Trả lời:**

Iris Gaze estimation xác định hướng nhìn dựa trên vị trí iris relative to eye bounds.

Bước đầu tiên là lấy landmarks. MediaPipe FaceMesh trả về iris center tại index 468 cho mắt trái và 473 cho mắt phải. Eye corners tại indices 33 (left outer), 133 (left inner), 362 (right inner), 263 (right outer).

Bước thứ hai là tính relative position. leftIrisRelX bằng iris center x trừ eye left corner x, chia cho eye width. Giá trị này nằm trong khoảng 0 đến 1, với 0.5 là nhìn thẳng.

Bước thứ ba là convert sang range -1 đến 1. leftRawHorizontal bằng leftIrisRelX trừ 0.5, nhân 2. Khi iris ở outer corner thì giá trị gần 1, inner corner thì gần -1, center thì 0.

Tương tự cho vertical gaze dựa trên y coordinate relative to eye top và bottom.

Bước cuối là average hai mắt. horizontalGaze bằng leftHorizontal cộng rightHorizontal chia 2. Điều này smooth out noise từ từng mắt.

---

### Câu 120: Kappa Angle Correction là gì và tại sao quan trọng?

**Trả lời:**

Kappa Angle là góc giữa visual axis (trục thị giác, hướng ta thực sự nhìn) và optical axis (trục quang học, hướng pupil physical).

Vấn đề sinh học là fovea (vùng võng mạc có acuity cao nhất) không nằm chính xác trên optical axis mà lệch khoảng 5 độ về phía temporal (bên thái dương). Điều này có nghĩa khi bạn nhìn thẳng vào camera, iris không nằm chính giữa mắt mà lệch về phía mũi.

Nếu không có Kappa Correction, khi thí sinh nhìn thẳng vào màn hình, hệ thống sẽ detect là đang nhìn sang trái khoảng 5 độ. Điều này gây false positive.

Em apply correction bằng cách cộng offset vào raw gaze. Với mắt trái, horizontal offset là 0.05 tức iris thực tế lệch 5% về phía mũi. Với mắt phải, offset là âm 0.05 vì hướng ngược lại. Vertical offset là 0.02 cho cả hai mắt vì visual axis hướng lên nhẹ so với optical axis.

Sau correction, nhìn thẳng cho kết quả gần 0, phù hợp với expectation.

---

### Câu 121: Effective Gaze được tính như thế nào?

**Trả lời:**

Effective Gaze kết hợp Head Pose và Iris Gaze để có hướng nhìn thực sự. Ý tưởng là ta có thể nhìn sang trái bằng cách quay đầu hoặc liếc mắt hoặc cả hai.

Công thức là effectivePitch bằng headPose.pitch cộng irisContribution.pitch. Tương tự cho effectiveYaw.

Iris contribution được scale từ range -1 đến 1 sang độ. Em dùng hệ số 30 độ, nghĩa là khi iris ở cực đại (nhìn hết cỡ sang một bên), nó đóng góp 30 độ vào effective gaze.

Hệ số này được điều chỉnh theo face distance. Khi thí sinh ngồi gần camera hơn, iris tracking chính xác hơn nên iris contribution reliable hơn. Khi xa, iris landmarks có noise nhiều hơn nên giảm contribution weight.

Ví dụ cụ thể: Nếu headPose.yaw là 10 độ (quay đầu nhẹ sang trái), irisGaze.horizontal là 0.3 (liếc mắt sang trái), thì irisContribution.yaw bằng 0.3 nhân 30 bằng 9 độ. effectiveYaw bằng 10 cộng 9 bằng 19 độ. Khi so với threshold 25 độ, ta thấy chưa vượt ngưỡng.

---

### Câu 122: Face Distance Estimation dựa trên công thức nào?

**Trả lời:**

Face Distance estimation sử dụng nguyên lý camera projection. Khi object gần camera hơn, nó chiếm nhiều pixels hơn trên ảnh.

Em sử dụng Interocular Distance tức khoảng cách giữa hai mắt làm proxy. Khoảng cách này ở người trưởng thành tương đối ổn định, khoảng 60 đến 70 mm.

Công thức là interocularPx bằng căn bậc hai của bình phương delta x cộng bình phương delta y giữa outer corners của hai mắt. relativeDistance bằng interocularPx chia cho baseline.

Baseline được thu thập trong calibration phase. Khi thí sinh ngồi ở vị trí comfortable lúc đầu, em record interocular distance làm baseline, giá trị 1.0.

Khi đang thi, nếu relativeDistance lớn hơn 1.0, nghĩa là mặt gần camera hơn baseline, có thể đang cúi xuống. Nếu nhỏ hơn 1.0, mặt xa hơn.

Ngoài ra em cũng tính face area từ bounding box (width nhân height) để cross-validate và dùng cho Pre-Suspicion detection leaning forward signal.

---

### Câu 123: Eye Aspect Ratio (EAR) được tính như thế nào?

**Trả lời:**

EAR là metric để detect blink và eye closure. Công thức từ paper của Tereza Soukupová và Jan Čech.

EAR bằng tổng của hai khoảng cách vertical chia cho 2 lần khoảng cách horizontal. Cụ thể: EAR bằng distance(P2, P6) cộng distance(P3, P5), chia cho 2 nhân distance(P1, P4).

Trong đó P1 và P4 là two corners của mắt (horizontal), còn P2 P6 là cặp eyelid trên dưới thứ nhất, P3 P5 là cặp thứ hai.

Khi mắt mở, EAR khoảng 0.3 đến 0.4. Khi chớp mắt hoặc nhắm, EAR giảm xuống gần 0. Threshold 0.25 được dùng để phân biệt mắt mở hay đóng.

Trong đồ án, EAR được dùng cho hai mục đích. Thứ nhất là blink detection cho liveness check. Thứ hai là blink rate monitoring cho Pre-Suspicion, vì khi tập trung nhìn điện thoại, blink rate thường giảm.

distance function là Euclidean distance 3D: căn bậc hai của bình phương dx cộng bình phương dy cộng bình phương dz. Dz từ z-coordinate của landmarks cho depth information.

---

### Câu 124: One Euro Filter hoạt động dựa trên công thức gì?

**Trả lời:**

One Euro Filter là adaptive low-pass filter để smooth noisy signals mà minimize latency. Paper gốc của Géry Casiez năm 2012.

Ý tưởng chính là cutoff frequency thay đổi theo velocity của signal. Khi movement chậm (như jitter), filter more aggressively. Khi movement nhanh (như quick glance), filter less để không bị lag.

Công thức có ba bước. Bước một là tính derivative dx bằng x hiện tại trừ x trước chia cho time delta.

Bước hai là smooth derivative bằng low-pass filter với fixed cutoff. Công thức low-pass filter là y_new bằng alpha nhân x cộng (1 trừ alpha) nhân y_old. Alpha là smoothing factor bằng 2 pi nhân cutoff nhân Te, chia cho 2 pi nhân cutoff nhân Te cộng 1.

Bước ba là tính adaptive cutoff. cutoff bằng minCutoff cộng beta nhân absolute của smoothedDerivative. Khi derivative lớn (nhanh), cutoff cao, filter ít. Khi derivative nhỏ (chậm), cutoff thấp, filter nhiều.

Parameters: minCutoff quyết định smoothing cho slow movements. beta quyết định responsiveness. Trong đồ án, iris filter dùng minCutoff 0.8 và beta 0.5 để vừa smooth jitter vừa responsive cho quick eye movements.

---

### Câu 125: Tại sao cần chuyển đổi từ 2D sang 3D trong face analysis?

**Trả lời:**

2D coordinates từ camera chỉ cho biết vị trí pixel trên ảnh, không cho biết depth hay actual 3D orientation. Điều này gây vấn đề cho head pose estimation.

Ví dụ cụ thể: khi thí sinh quay đầu 30 độ sang trái, 2D projection của facial landmarks thay đổi. Nhưng khi thí sinh move gần camera hơn mà không quay đầu, 2D projection cũng thay đổi tương tự. Nếu chỉ dùng 2D, không phân biệt được hai trường hợp này.

Giải pháp là estimate Z-depth. MediaPipe FaceMesh cung cấp z-coordinate cho mỗi landmark, được estimate từ 3D face model regression. Giá trị z negative nghĩa là điểm đó gần camera hơn origin.

Với z-coordinate, em có thể tính Euclidean distance 3D thay vì 2D, cho measurement chính xác hơn không bị ảnh hưởng bởi perspective distortion.

Ngoài ra, z-depth giúp estimate face distance. Khi face gần camera, z-range (max z trừ min z) của landmarks lớn hơn. Khi xa, z-range flat hơn.

Tuy nhiên z-estimation từ single camera có noise, nên em combine với interocular distance và face area để robust hơn.

---

### Câu 126: Dynamic Threshold Adjustment sử dụng công thức gì?

**Trả lời:**

Thresholds cho look-away detection được điều chỉnh dựa trên face distance vì viewing geometry thay đổi.

Em sử dụng công thức arctan-based. threshold bằng arctan của CONSTANT chia D, cộng OFFSET. Trong đó D là khoảng cách ước tính, CONSTANT là 200, OFFSET là 5 độ.

Ví dụ: tại D bằng 500mm (khoảng cách comfortable), threshold bằng arctan(200/500) cộng 5 bằng khoảng 21.8 cộng 5 bằng 26.8 độ. Tại D bằng 800mm (xa hơn), threshold bằng arctan(200/800) cộng 5 bằng khoảng 14 cộng 5 bằng 19 độ. Tại D bằng 300mm (gần hơn), threshold bằng arctan(200/300) cộng 5 bằng khoảng 33.7 cộng 5 bằng 38.7 độ.

Logic là: khi gần camera, head movement nhỏ cũng dễ detect, nên threshold strict hơn. Khi xa, head movement phải lớn hơn mới visible, nên threshold loose hơn.

Em cũng có fallback logic đơn giản: nếu faceDistance lớn hơn 1.2 (rất gần), nhân base threshold với 0.8. Nếu nhỏ hơn 0.8 (xa), nhân với 1.3.

---

### Câu 127: Pre-Suspicion Weighted Confidence Score tính như thế nào?

**Trả lời:**

Pre-Suspicion detection dùng weighted scoring để combine nhiều signals thành một confidence score.

Em define 7 signals với weights. PITCH_DOWN có weight 25, trigger khi head pitch lớn hơn 25 độ. GAZE_DOWN weight 20, trigger khi iris vertical gaze lớn hơn 0.25. YAW_SIDE weight 25, trigger khi absolute yaw lớn hơn 20 độ. GAZE_SIDE weight 20, trigger khi iris horizontal gaze lớn hơn 0.20. DISTANCE_CHANGE weight 15, trigger khi face area ratio lớn hơn 1.08 tức tăng 8 phần trăm. BLINK_SUPPRESSED weight 10, trigger khi blink rate giảm dưới 0.8 lần baseline. FACE_STABLE weight 5, trigger khi face drift nhỏ hơn 20 pixels.

Confidence score bằng tổng weights của các signals đang active. Tổng tối đa có thể là 120. Nếu confidence vượt threshold 35, và sustained trên 2.5 giây, thì trigger Pre-Suspicion event.

Ví dụ: thí sinh cúi đầu (PITCH_DOWN: 25) và mắt nhìn xuống (GAZE_DOWN: 20), tổng là 45, vượt 35, trigger. Nhưng nếu chỉ cúi nhẹ đọc câu hỏi (PITCH_DOWN: 25) và mặt stable (FACE_STABLE: 5), tổng là 30, không trigger.

---

### Câu 128: Iris Depth Estimation từ Iris Diameter?

**Trả lời:**

Em estimate relative depth từ apparent iris size dựa trên nguyên lý camera projection.

Iris có kích thước thực tế tương đối cố định ở người lớn, khoảng 11.7mm đường kính trung bình. Khi người gần camera hơn, iris chiếm nhiều pixels hơn trên ảnh.

Công thức: estimatedDepthRatio bằng avgIrisDiameter chia BASELINE_IRIS_RATIO. Trong đó avgIrisDiameter là average của left và right iris diameter (trong normalized coordinates 0-1), BASELINE_IRIS_RATIO là 0.07 (typical iris takes 7% of frame width at comfortable distance).

Ví dụ: Nếu iris diameter hiện tại là 0.084 (lớn hơn baseline), estimatedDepthRatio bằng 0.084/0.07 bằng 1.2. Nghĩa là người đang gần camera hơn baseline khoảng 20%.

Method này complement interocular distance estimation, cho thêm một signal về face distance. Em sử dụng cả hai và average hoặc cross-validate để robust hơn.

Limitation là khi eyes không fully visible (squinting, glasses glare), iris diameter estimate bị ảnh hưởng.

---

### Câu 129: Coefficient of Variation (CV) trong Temporal Pattern Analysis?

**Trả lời:**

CV là metric đo mức độ đều đặn của một chuỗi intervals. Công thức: CV bằng standard deviation chia cho mean.

Trong temporal pattern analysis, em dùng CV để detect repeated head down behavior. Nếu thí sinh nhìn xuống điện thoại lặp đi lặp lại với interval đều đặn, CV sẽ thấp.

Ví dụ cụ thể: Nếu intervals là 30s, 32s, 28s, 31s thì mean là 30.25s, stdDev khoảng 1.7s, CV bằng 1.7/30.25 bằng 0.056. CV thấp (dưới 0.3) cho thấy pattern regular, đáng ngờ.

Ngược lại, nếu intervals là 10s, 45s, 5s, 60s thì CV cao (khoảng 0.8), cho thấy random behavior, không phải cheating pattern.

Pattern REPEATED_HEAD_DOWN trigger khi có ít nhất 3 occurrences trong 5 phút và CV nhỏ hơn 0.3.

Logic là: người đọc từ điện thoại có tendency nhìn xuống định kỳ (đọc, nhìn lên gõ, đọc tiếp). Pattern này regular hơn so với random glancing.

---

### Câu 130: Smoothing Factor trong Low-Pass Filter?

**Trả lời:**

Smoothing factor alpha quyết định mức độ filter signal. Công thức: alpha bằng 2 pi nhân cutoff nhân Te, chia cho 2 pi nhân cutoff nhân Te cộng 1.

Trong đó cutoff là cutoff frequency in Hz, Te là time delta in seconds giữa hai samples.

Khi alpha gần 1, output gần với input hiện tại (ít filter). Khi alpha gần 0, output gần với output trước đó (filter nhiều).

Ví dụ: với cutoff 1 Hz và Te 0.2s (5 FPS), alpha bằng 2 pi nhân 1 nhân 0.2 chia (2 pi nhân 1 nhân 0.2 cộng 1) bằng khoảng 0.56.

Low-pass filter update: y_new bằng alpha nhân x cộng (1 trừ alpha) nhân y_old. Với alpha 0.56, new value contribute 56% và old value contribute 44%.

Higher cutoff cho phép higher frequencies pass through (less smoothing). Lower cutoff block more frequencies (more smoothing).

Trong One Euro Filter, cutoff là adaptive based on velocity, nên smoothing tự động điều chỉnh theo movement speed.

---

### Câu 131: Tại sao dùng atan2 thay vì atan cho Roll calculation?

**Trả lời:**

Roll là góc nghiêng đầu, tính từ sự chênh lệch y giữa hai mắt. Công thức: roll bằng atan2(eyeDeltaY, eyeDeltaX) nhân 180 chia pi.

atan2(y, x) khác với atan(y/x) ở chỗ nó handle đúng tất cả bốn quadrants và không bị division by zero.

Cụ thể: atan(y/x) chỉ return giá trị từ âm pi/2 đến pi/2, không phân biệt được khi x âm. Ví dụ atan(1/1) và atan(-1/-1) đều cho 45 độ, nhưng thực tế một cái là 45 độ và một cái là 225 độ.

atan2(y, x) return giá trị từ âm pi đến pi, handle đúng cả bốn góc phần tư. Nó cũng return giá trị hợp lệ khi x bằng 0, trong khi atan(y/0) là undefined.

Trong bài toán roll, eyeDeltaX có thể gần 0 khi hai mắt overlapping vertically (hiếm nhưng possible với extreme angles). atan2 handle case này safely.

Ngoài ra atan2 standard trong hầu hết ngôn ngữ lập trình, including JavaScript Math.atan2.

---

### Câu 132: Giải thích Threshold Calibration Margin là gì?

**Trả lời:**

Calibration margin là hệ số nhân để tạo vùng buffer quanh calibrated boundaries.

Trong calibration phase, em thu thập gaze range khi thí sinh nhìn vào 4 góc và center của màn hình. Từ đó xác định boundaries: minPitch, maxPitch, minYaw, maxYaw.

Tuy nhiên, nếu dùng exact boundaries làm thresholds, bất kỳ slight deviation nào cũng trigger violation, gây quá nhiều false positives.

Em apply CALIBRATION_MARGIN bằng 1.3, nghĩa là thresholds lớn hơn 30% so với calibrated range. Công thức: maxYaw threshold bằng calibrated maxYaw nhân 1.3.

Ví dụ: nếu calibration xác định thí sinh nhìn sang phải tối đa là 20 độ, thì threshold là 20 nhân 1.3 bằng 26 độ. Chỉ khi yaw vượt 26 độ mới trigger violation.

Margin này account for natural variation (thí sinh không hoàn toàn consistent), measurement noise, và cho phép comfortable exam-taking behavior mà không bị flagged.

---

### Câu 133: Camera Matrix và Principal Point trong PnP là gì?

**Trả lời:**

Camera Matrix hay Camera Intrinsic Matrix K là ma trận 3x3 encode internal characteristics của camera.

K có dạng: hàng 1 là fx, 0, cx. Hàng 2 là 0, fy, cy. Hàng 3 là 0, 0, 1.

Trong đó fx và fy là focal length in pixels. cx và cy là principal point, tức điểm mà optical axis intersect image plane.

Focal length xác định how much camera zooms. Larger focal length nghĩa là larger image of same object. Công thức estimate: f bằng image_width chia 2 chia tan(fov/2). Với webcam typical có field of view khoảng 60 độ và width 640px, f khoảng 530 đến 550 pixels.

Principal point lý tưởng nằm ở center của image, tức cx bằng width/2, cy bằng height/2. Tuy nhiên webcam consumer thường có slight offset.

Problem là webcam không expose focal length và principal point. Em phải estimate using reasonable defaults. Điều này là một trong những lý do em dùng geometric method thay vì strict PnP trong client-side code.

---

### Câu 134: Reprojection Error trong PnP là gì?

**Trả lời:**

Reprojection error đo mức độ fit giữa estimated pose và observed data.

Trong PnP, sau khi estimate rotation R và translation t, em project 3D model points xuống 2D using estimated pose và camera matrix. Các projected 2D points này được so sánh với actual detected 2D landmarks.

Reprojection error là average Euclidean distance giữa projected points và detected points. Công thức: error bằng 1/n nhân tổng từ i equals 1 đến n của norm của projected_point_i trừ detected_point_i.

Low reprojection error (dưới 5 pixels) nghĩa là estimated pose phù hợp tốt với observation. High error nghĩa là estimation có vấn đề, có thể do occlusion, incorrect 3D model, bad detection.

Em có thể dùng reprojection error để assess quality của head pose estimation. Nếu error cao, giảm confidence của detection hoặc skip frame.

Trong đồ án, em không explicitly compute reprojection error vì không dùng solvePnP, nhưng concept này explains tại sao accurate 3D model và accurate detection quan trọng.

---

### Câu 135: Geometric method vs Learning-based method cho Head Pose?

**Trả lời:**

Geometric methods như PnP hoặc phương pháp ratio em dùng rely on explicit mathematical model. Ưu điểm là interpretable, không cần training data, và deterministic.

Learning-based methods train neural network để regress pose angles trực tiếp từ face image hoặc landmarks. Ưu điểm là potentially more accurate, handle occlusion và variation tốt hơn.

Em chọn geometric vì một số lý do.

Thứ nhất, MediaPipe FaceMesh đã là learning-based model cho landmark detection. Stacking another neural network cho pose estimation thêm complexity và latency.

Thứ hai, geometric method cho phép calibration dễ dàng. Em collect baseline pose lúc đầu và subtract, không thể làm điều này intuitive với learned regressor.

Thứ ba, geometric method explainable. Khi debug false positive, em biết exactly tại sao angle được tính là X vì từng step transparent. Neural network là black box.

Thứ tư, browser environment limit model size. Thêm pose regression model tăng bundle size.

Trade-off là geometric method có accuracy ceiling, đặc biệt với extreme poses hoặc occlusion. Nhưng cho use case exam proctoring, extreme poses chính là violations, không cần precise measurement.

---

## PHẦN X: SO SÁNH BÁO CÁO VÀ CODE THỰC TẾ

### Câu 136: Báo cáo ghi Head Pose dùng atan2 với face normal, nhưng code dùng geometric ratios - giải thích?

**Trả lời:**

Đây là sự khác biệt quan trọng cần giải thích rõ. Báo cáo mô tả phương pháp lý thuyết face normal vector với công thức Yaw bằng atan2(Normal.x, Normal.z) và Pitch bằng atan2(âm Normal.y, Normal.z). Tuy nhiên code thực tế dùng phương pháp đơn giản hơn.

Trong code, Yaw được tính bằng asymmetry nhân 120 độ, với asymmetry là tỷ lệ chênh lệch khoảng cách mũi đến hai mắt. Pitch được tính bằng pitchRatio nhân 180 độ, với pitchRatio là chênh lệch tỷ lệ mũi-trán và mũi-cằm. Chỉ Roll là dùng atan2.

Lý do thay đổi là khi implement, em nhận thấy phương pháp ratio đơn giản hơn, nhanh hơn, và cho kết quả tương đương với use case phát hiện look-away. Việc tính face normal vector 3D từ 2D landmarks đòi hỏi estimate z-coordinate chính xác, mà z từ FaceMesh có noise khá cao.

Nếu được hỏi, em sẽ trả lời: báo cáo mô tả nguyên lý lý thuyết, còn code implementation đã được đơn giản hóa để optimize performance mà vẫn đạt accuracy cần thiết.

---

### Câu 137: Công thức Iris Gaze trong báo cáo có khớp với code không?

**Trả lời:**

Công thức Iris Gaze trong báo cáo và code là tương đương về mặt toán học, chỉ khác cách diễn đạt.

Báo cáo viết: Gaze_horizontal bằng IrisCenter.x trừ C_x chia cho W_eye chia 2, với C_x là tâm mắt.

Code viết: leftIrisRelX bằng irisCenter.x trừ eyeLeft.x chia cho eyeWidth, sau đó convert sang range âm 1 đến 1 bằng (leftIrisRelX trừ 0.5) nhân 2.

Khi khai triển toán học, hai công thức cho kết quả identical. Báo cáo dùng tâm mắt làm reference, code dùng góc mắt trái làm reference rồi shift về tâm. Cả hai đều normalize theo chiều rộng mắt và output trong khoảng âm 1 đến 1.

Điểm khác biệt là code bổ sung thêm Kappa Angle Correction cộng 0.05 cho mắt trái, âm 0.05 cho mắt phải để hiệu chỉnh sai lệch sinh học. Phần này chưa được đề cập chi tiết trong báo cáo.

---

### Câu 138: Ngưỡng trong code khác với ngưỡng trong báo cáo - giải thích?

**Trả lời:**

Đúng, các ngưỡng đã được fine-tune nhiều lần sau khi viết báo cáo. Đây là bảng so sánh:

Yaw threshold báo cáo ghi 20 độ, code hiện tại là 25 độ (MAX_YAW). Pitch down báo cáo ghi 15 độ, code là 30 độ (MAX_PITCH_DOWN). Iris gaze báo cáo ghi 0.5, code là 0.35 (MAX_IRIS_HORIZONTAL). Time window báo cáo ghi 3 giây, code là 2.5 giây (HARD_VIOLATION.DURATION_MS).

Lý do thay đổi là sau nhiều vòng testing với thí sinh thực, em nhận thấy ngưỡng ban đầu quá strict gây nhiều false positive khi thí sinh đọc câu hỏi dài hoặc suy nghĩ. Yaw và Pitch được nới lỏng để reduce false positive. Ngược lại, iris gaze được siết chặt hơn vì iris tracking accurate hơn head pose. Time window giảm để detect nhanh hơn sau khi đã nới lỏng các ngưỡng khác.

Đây là quy trình phát triển thực tế: báo cáo thể hiện design ban đầu, code thể hiện final tuned parameters.

---

### Câu 139: IOD Distance baseline trong code khác với báo cáo?

**Trả lời:**

Báo cáo mô tả baseline là 15 phần trăm chiều rộng khung hình, tương ứng khoảng cách ngồi 50cm. Code hiện tại dùng baseline mặc định là 65 pixels cho video 640x480.

Hai giá trị này thực ra tương đương: 15 phần trăm của 640 pixels là 96 pixels. Tuy nhiên trong thực tế, khoảng cách mắt trung bình khi ngồi comfortable thường cho kết quả khoảng 60 đến 70 pixels, nên em đã điều chỉnh xuống 65 pixels.

Quan trọng hơn, code cho phép calibration: khi thí sinh ngồi vào vị trí ban đầu, hệ thống ghi lại IOD thực tế làm baseline. Giá trị 65 pixels chỉ là fallback khi không có calibration data.

Công thức relative distance là IOD_current chia IOD_baseline vẫn khớp với báo cáo. Ngưỡng xa là relative nhỏ hơn 0.8, ngưỡng gần là relative lớn hơn 1.2, đúng như báo cáo.

---

### Câu 140: Nếu hội đồng hỏi tại sao báo cáo khác code, trả lời như thế nào?

**Trả lời:**

Em sẽ trả lời rằng đây là quy trình phát triển phần mềm thực tế. Báo cáo được viết ở giai đoạn design, mô tả nguyên lý và thuật toán dự kiến. Code là implementation cuối cùng sau nhiều vòng iteration.

Trong quá trình implement, em đã thực hiện một số tối ưu hóa. Thứ nhất là đơn giản hóa Head Pose calculation để tăng performance mà không giảm accuracy cho use case cụ thể. Thứ hai là fine-tune các ngưỡng dựa trên testing thực tế để cân bằng giữa sensitivity và specificity. Thứ ba là bổ sung các tính năng như Kappa Correction mà chưa được document đầy đủ trong báo cáo.

Điều này thể hiện khả năng iterate và optimize dựa trên feedback thực tế, không chỉ implement đúng theo design ban đầu.

Em sẵn sàng giải thích chi tiết bất kỳ sự khác biệt nào nếu hội đồng yêu cầu, và có thể demo trực tiếp để chứng minh code hoạt động đúng như expected.

---

## PHẦN Y: CÂU HỎI VỀ NỀN TẢNG LÝ THUYẾT TRONG BÁO CÁO

### Câu 141: MediaPipe Face Mesh cung cấp tọa độ 3D như thế nào?

**Trả lời:**

MediaPipe Face Mesh từ Google AI Edge cung cấp 468 điểm mốc trên khuôn mặt với tọa độ 3 chiều x, y, z đã được chuẩn hóa.

x và y là tọa độ ngang dọc trên mặt phẳng ảnh, được chuẩn hóa vào khoảng 0 đến 1. x bằng 0 là cạnh trái khung hình, x bằng 1 là cạnh phải. Điều này giúp dễ so sánh giữa các camera có độ phân giải khác nhau.

z là giá trị độ sâu tương đối, lấy mốc từ trung tâm đầu là vùng giữa hai mắt. z nhỏ hơn nghĩa là điểm đó gần camera hơn. Ví dụ mũi nhô ra sẽ có z nhỏ hơn cằm. Em hay nói với người mới là hãy tưởng tượng z như cấp độ nhô của điểm đó.

Việc có sẵn z ngay từ output cho phép hệ thống tính toán góc quay đầu bằng công thức hình học đơn giản mà không cần thuật toán phức tạp như PnP. Điều này đặc biệt quan trọng khi chạy trong browser vì giảm CPU usage đáng kể.

---

### Câu 142: Tọa độ z được MediaPipe estimate như thế nào?

**Trả lời:**

MediaPipe Face Mesh sử dụng neural network để regress trực tiếp tọa độ 3D từ single 2D image, không cần depth sensor.

Về mặt kỹ thuật, model được train trên synthetic data với 3D face scans. Input là 2D face image, output là 468 landmarks với full x y z coordinates. Network học được mapping từ 2D appearance sang 3D structure dựa trên shape priors của khuôn mặt người.

z coordinate là relative depth, không phải absolute. Giá trị được normalize theo khoảng cách giữa hai mắt, nên z không cho biết khoảng cách thực tế đến camera mà chỉ cho biết một điểm gần hay xa hơn so với điểm khác.

Limitation là z estimate có noise nhiều hơn x y vì đây là ill-posed problem, từ 2D suy ngược ra 3D có nhiều solutions possible. Vì vậy trong code, em chủ yếu dùng z cho roll calculation và không hoàn toàn phụ thuộc vào nó cho critical decisions.

---

### Câu 143: Phương pháp Geometric Vector Analysis là gì?

**Trả lời:**

Geometric Vector Analysis là cách tiếp cận tính toán hình học trực tiếp thay vì dùng 3D model matching phức tạp.

Nguyên lý là lấy các điểm giải phẫu ổn định trên mặt như sống mũi, đỉnh mũi, hai mắt và cằm, sau đó xây dựng feature vectors là những vector toán học đại diện cho hướng và khoảng cách giữa các điểm.

Ví dụ dễ hiểu là hãy nghĩ như vẽ mũi tên giữa các điểm trên mặt. Vector từ mũi đến cằm cho biết chiều dọc đầu, vector từ mắt trái đến mắt phải cho biết chiều ngang. Nếu mũi tên lệch so với baseline, hệ thống biết đầu đang quay.

Ưu điểm của phương pháp này là complexity O(1), tức computational cost không đổi bất kể số landmarks. Không cần iterative optimization như PnP. Phù hợp để chạy real-time trên browser mà không gây lag.

---

### Câu 144: Góc Euler được tính như thế nào từ vectors?

**Trả lời:**

Trong code, góc Euler được tính từ geometric ratios thay vì formal Rodrigues rotation matrix decomposition.

Với Yaw tức góc quay trái phải, em so sánh khoảng cách từ mũi đến hai mắt. Công thức là asymmetry bằng leftEyeToNose trừ rightEyeToNose chia cho eyeDistance. Khi đầu quay sang trái, mũi gần mắt phải hơn nên asymmetry dương. Nhân với 120 để scale về độ.

Với Pitch tức góc cúi lên xuống, em dùng tỷ lệ vị trí mũi. Công thức là pitchRatio bằng noseToForeheadRatio trừ noseToChinRatio. Khi cúi xuống, mũi gần trán hơn nên pitchRatio dương. Nhân với 180 để scale.

Với Roll tức góc nghiêng đầu, em dùng hàm atan2 với delta x và delta y giữa hai mắt. Đây là chỗ duy nhất dùng arctan2 vì roll thực sự cần góc giữa hai điểm.

---

### Câu 145: Tại sao dùng arctan2 thay vì arctan thông thường?

**Trả lời:**

arctan2 có hai arguments y và x, trong khi arctan chỉ có một argument là y chia x.

Ưu điểm của arctan2 là handle đúng cả bốn góc phần tư của đường tròn đơn vị. arctan thông thường chỉ return giá trị từ âm 90 đến 90 độ, không phân biệt được góc phần tư thứ hai và thứ ba. Ví dụ arctan(1/1) và arctan(âm 1/âm 1) đều cho 45 độ nhưng thực tế một cái là 45 độ và một cái là 225 độ.

Thêm nữa, arctan(y/x) bị undefined khi x bằng 0 do chia cho 0. arctan2(y, x) handle case này gracefully, return 90 hoặc âm 90 độ tùy dấu của y.

Trong bài toán roll của đồ án, eyeDeltaX có thể gần 0 khi hai mắt gần như overlapping theo chiều ngang với extreme head tilt. arctan2 đảm bảo không bị crash trong trường hợp này.

---

### Câu 146: Relative Iris Positioning hoạt động như thế nào?

**Trả lời:**

Relative Iris Positioning là phương pháp định vị tâm mống mắt tương đối thay vì đo absolute position, giúp loại bỏ biến thiên về kích thước mắt giữa các người dùng.

Nguyên lý là so sánh vị trí iris center với eye center thay vì chỉ khóe mắt. Công thức là gazeHorizontal bằng irisCenter.x trừ eyeCenter.x chia cho eyeWidth chia 2. Kết quả nằm trong khoảng âm 1 đến 1.

Giá trị âm 1 nghĩa là liếc hết cỡ sang phải theo hướng người dùng. Giá trị 0 là nhìn thẳng. Giá trị 1 là liếc hết cỡ sang trái.

Ưu điểm của phương pháp này là normalization tự động. Người có mắt to hay nhỏ đều cho ra scale giống nhau. Em không cần calibrate riêng cho từng anatomy, chỉ cần calibrate cho screen position.

Trong code, em implement hơi khác nhưng tương đương toán học. Calculate leftIrisRelX bằng irisCenter.x trừ eyeLeft.x chia eyeWidth, rồi convert sang âm 1 đến 1 bằng (leftIrisRelX trừ 0.5) nhân 2.

---

### Câu 147: InsightFace và ArcFace được dùng như thế nào trong dự án?

**Trả lời:**

InsightFace là thư viện mã nguồn mở cho face analysis dựa trên PyTorch và MXNet. ArcFace là một trong các models trong InsightFace, sử dụng Additive Angular Margin Loss để tạo face embeddings discriminative.

Trong dự án, InsightFace được dùng cho Face Verification phía server trong AI Worker, không phải trong browser. Flow là thí sinh upload ID photo, AI Worker extract face embedding thành vector 512 chiều. Khi thi, AI Worker capture snapshot, extract embedding, và compare bằng cosine similarity.

Công thức cosine similarity là dot product của hai vectors chia cho tích của norms. Similarity cao hơn threshold 0.6 nghĩa là cùng một người.

Em chọn ArcFace vì accuracy cao trong face verification benchmarks như LFW và CFP. Model buffalo_l được optimized cho production với balance tốt giữa speed và accuracy. Fallback sang dlib-based face_recognition nếu InsightFace không install được.

---

### Câu 148: Face Embedding 512 chiều nghĩa là gì?

**Trả lời:**

Face embedding là vector số thực đại diện cho đặc trưng khuôn mặt trong một không gian học được.

512 chiều nghĩa là mỗi khuôn mặt được biểu diễn bởi một array 512 số float. Mỗi dimension encode một aspect nào đó của facial features mà network đã học, như shape of nose, distance between eyes, jawline curve.

Không gian này được train sao cho khuôn mặt cùng một người có embeddings gần nhau, khuôn mặt khác người có embeddings xa nhau. Cosine similarity đo góc giữa hai vectors trong không gian này.

Ưu điểm của approach này là comparison cực kỳ nhanh. Sau khi có embeddings, comparison chỉ là dot product của hai vectors 512 chiều, O(512) operations. Không cần feature extraction lại từ ảnh.

Storage cũng compact, 512 floats chiếm khoảng 2KB. Em có thể store embedding cùng user profile thay vì store full face image.

---

### Câu 149: Liveness Detection trong InsightFace hoạt động như thế nào?

**Trả lời:**

Liveness Detection kiểm tra xem khuôn mặt có phải từ người thật hay từ ảnh/video spoofing.

Em implement ba checks trong AI Worker. Thứ nhất là Blink Detection dùng Eye Aspect Ratio. EAR bằng sum của vertical distances chia 2 lần horizontal distance. EAR thấp hơn 0.21 nghĩa là mắt đang nhắm. Detect ít nhất 1 blink trong sequence là signal người thật.

Thứ hai là Head Pose Change Detection. Compare pose giữa các frames trong sequence. Rotation lớn hơn 5 độ nghĩa là có movement tự nhiên. Ảnh tĩnh không có movement.

Thứ ba là Texture Analysis dùng Laplacian variance. Ảnh từ màn hình thường có texture smoother do pixel grid. Variance thấp hơn 100 là suspicious.

Final decision cần confidence từ 60 phần trăm trở lên. Mỗi check contribute một phần vào total score: blink 40 điểm, head movement 35 điểm, texture 25 điểm.

---

### Câu 150: Tại sao dùng client-side AI cho detection và server-side AI cho verification?

**Trả lời:**

Đây là design decision quan trọng dựa trên privacy và performance trade-offs.

Detection như look-away và pre-suspicion cần chạy liên tục 10 đến 30 FPS. Nếu gửi video lên server, bandwidth consumption sẽ rất lớn và latency không acceptable cho real-time feedback. Chạy client-side với TensorFlow.js giải quyết cả hai vấn đề và đảm bảo video không rời khỏi device của thí sinh.

Verification như face matching chỉ cần chạy một vài lần, lúc bắt đầu thi và sampling trong quá trình thi. Accuracy quan trọng hơn latency ở đây. InsightFace với ArcFace cho accuracy cao hơn nhiều so với browser-based alternatives. Và vì chỉ là snapshots không phải continuous stream, bandwidth và privacy concerns minimal.

Tóm lại: high-frequency low-stakes analysis ở client, low-frequency high-stakes analysis ở server.

---

### Câu 151: So sánh MediaPipe FaceMesh với InsightFace về use case?

**Trả lời:**

Hai công cụ này phục vụ mục đích khác nhau trong đồ án.

MediaPipe FaceMesh trong TensorFlow.js chạy ở browser, output 468 landmarks với 3D coordinates. Dùng cho behavioral analysis như head pose estimation, gaze tracking, blink detection. Không output face embeddings.

InsightFace với ArcFace chạy ở Python server, output face embeddings 512 chiều. Dùng cho identity verification, so sánh ID photo với exam snapshot. Cũng detect faces và landmarks nhưng ít points hơn, chủ yếu 5-point landmarks.

FaceMesh lightweight hơn, optimized cho real-time browser execution. InsightFace accuracy cao hơn cho face recognition, nhưng cần GPU cho speed reasonable.

Em dùng cả hai vì không có single tool nào làm tốt cả hai việc. FaceMesh không có face embedding capability tốt. InsightFace không chạy được trong browser.

---

### Câu 152: Giải thích tại sao z-coordinate giúp tránh dùng PnP?

**Trả lời:**

PnP algorithm cần solve một optimization problem để tìm camera pose từ 2D-3D correspondences. Đây là iterative process, tốn CPU và có thể fail với noisy data.

Khi MediaPipe đã cung cấp z-coordinate estimated, em có thể tính geometric relationships trực tiếp mà không cần PnP.

Ví dụ với Roll, em cần biết góc nghiêng của đường nối hai mắt. Với z available, em tính Euclidean distance 3D bằng sqrt của dx squared cộng dy squared cộng dz squared. Nhưng thực tế Roll chủ yếu visible trong x-y plane nên em dùng atan2(dy, dx).

Với Pitch và Yaw, thay vì project 3D model xuống 2D rồi compare, em directly compute ratios từ landmark positions đã có z. Nose nhô ra có z nhỏ hơn, cho thông tin về head orientation.

Trade-off là accuracy có thể thấp hơn formal PnP một chút, nhưng speed tốt hơn nhiều và đủ cho detection use case.

---

### Câu 153: One Euro Filter được áp dụng ở đâu và tại sao?

**Trả lời:**

One Euro Filter được áp dụng cho iris positions trước khi tính gaze direction.

Vấn đề là FaceMesh landmarks có jitter khoảng 1 đến 3 pixels mỗi frame do noise trong image và model uncertainty. Với iris tracking, jitter này translate thành fluctuating gaze values, gây false detections hoặc noisy signals.

One Euro Filter là adaptive low-pass filter. Khi iris di chuyển chậm như đang focus, filter smooth aggressively. Khi iris di chuyển nhanh như glancing, filter less để preserve responsiveness.

Em create separate filter instances cho left và right iris với parameters minCutoff 0.8 và beta 0.5, optimized cho eye movements. Filter tự động adapt based on velocity của signal.

Kết quả là iris gaze values stable hơn nhiều, Pre-Suspicion detection reliable hơn vì không bị trigger bởi random jitter.

---

### Câu 154: Cosine Similarity vs Euclidean Distance trong Face Verification?

**Trả lời:**

Cả hai metrics đều có thể dùng để compare face embeddings, nhưng behavior khác nhau.

Euclidean Distance là straight-line distance trong không gian n chiều. Formula là sqrt của sum của squared differences. Sensitive với magnitude của vectors.

Cosine Similarity đo angle giữa hai vectors, normalize cho magnitude. Formula là dot product chia cho product của norms. Range từ âm 1 đến 1, với 1 là identical direction.

ArcFace embeddings được train với angular margin loss, optimize cho cosine similarity. Vectors đã normalized về unit length nên magnitude không matter. Vì vậy cosine similarity phù hợp hơn.

Trong code, em dùng cosine similarity với threshold 0.6 cho ArcFace. Similarity cao hơn 0.6 nghĩa là match. Với dlib-based fallback, dùng Euclidean distance với threshold 0.6 vì đó là convention của library đó.

---

### Câu 155: Kappa Angle Correction được implement như thế nào?

**Trả lời:**

Kappa Angle là góc giữa visual axis và optical axis của mắt, khoảng 5 độ ở người bình thường.

Vấn đề là khi nhìn thẳng vào camera, iris không nằm chính giữa mắt mà lệch về phía mũi do fovea không nằm trên optical axis. Nếu không correct, hệ thống sẽ detect nhìn thẳng là đang liếc sang trái.

Em implement correction bằng constants. Left eye horizontal offset là 0.05 tức 5 phần trăm shift nasal. Right eye horizontal offset là âm 0.05 vì direction ngược lại. Vertical offset là 0.02 cho cả hai mắt.

Apply correction bằng cách cộng offset vào raw gaze value. leftCorrectedHorizontal bằng leftRawHorizontal cộng 0.05. Sau đó average left và right để get final gaze.

Kết quả là nhìn thẳng cho gaze value gần 0, đúng với expectation. Calibration phase có thể personalize offset nếu population average không phù hợp với cá nhân cụ thể.

---

## PHẦN Z: CÂU HỎI VỀ MINIO, LIVEKIT VÀ YÊU CẦU PHI CHỨC NĂNG

### Câu 156: Tại sao chọn MinIO cho Object Storage?

**Trả lời:**

MinIO là self-hosted S3-compatible object storage, em chọn vì một số lý do chính.

Thứ nhất là S3 API compatibility. MinIO implement đầy đủ Amazon S3 API nên có thể dùng AWS SDK hoặc bất kỳ S3 client nào. Code không bị lock-in, có thể migrate sang AWS S3 thật hoặc DigitalOcean Spaces dễ dàng bằng cách đổi endpoint.

Thứ hai là self-hosted và privacy. Evidence files như snapshots và video clips chứa thông tin nhạy cảm của thí sinh. Self-hosting đảm bảo data không rời khỏi infrastructure của tổ chức, tuân thủ quy định về data sovereignty.

Thứ ba là performance. MinIO được tối ưu cho high-throughput với erasure coding và distributed mode. Trong setup đơn giản với Docker, vẫn đạt performance tốt cho use case vừa phải.

Thứ tư là chi phí. Cloud S3 tính phí per request và egress bandwidth. Self-hosted MinIO chỉ tốn infrastructure cost, tiết kiệm khi có nhiều uploads và downloads.

---

### Câu 157: MinIO có những bất lợi gì?

**Trả lời:**

Có một số bất lợi cần cân nhắc.

Thứ nhất là operational overhead. Self-hosted nghĩa là team phải quản lý backup, monitoring, scaling, và maintenance. Cloud S3 managed hoàn toàn bởi provider.

Thứ hai là durability guarantee. AWS S3 có 11 nines durability, MinIO single-node không đạt được level đó. Cần configure erasure coding và multiple nodes cho production-grade durability.

Thứ ba là global distribution. S3 có edge locations và CloudFront integration. MinIO single-node chỉ ở một location. Cho use case exam proctoring với users cùng region, điều này acceptable.

Thứ tư là ecosystem integration. AWS S3 integrate tốt với các AWS services khác như Lambda, CloudWatch. MinIO cần configure thêm tools cho monitoring và alerting.

Trong đồ án, bất lợi này acceptable vì scope là prototype. Production deployment sẽ cần address các issues này.

---

### Câu 158: Có những alternatives nào thay cho MinIO?

**Trả lời:**

Có nhiều alternatives cho object storage tùy use case.

Amazon S3 là cloud option phổ biến nhất. Advantages là managed, highly durable, global. Disadvantages là cost và data không on-premise.

Google Cloud Storage và Azure Blob Storage tương tự S3 với different pricing models.

Ceph là distributed storage system có S3-compatible gateway. Advantages là enterprise-grade, highly configurable. Disadvantages là complex setup, cần dedicated team.

SeaweedFS là lightweight alternative với S3 API support. Faster cho small files nhưng less mature.

Local filesystem với NFS share là option đơn giản nhất. Không cần additional service. Disadvantages là không có presigned URLs, không S3 compatible, scaling limited.

Em chọn MinIO vì balance tốt giữa features, simplicity, và S3 compatibility cho prototype stage.

---

### Câu 159: Presigned URLs trong MinIO hoạt động như thế nào?

**Trả lời:**

Presigned URLs là URLs đã được sign với credentials, cho phép access limitedtime mà không expose credentials.

Flow trong đồ án là client request upload, backend generate presigned PUT URL với expiry 15 phút, client upload trực tiếp đến MinIO bypass backend. Video không đi qua Spring Boot, giảm bandwidth và latency.

Công thức signature dùng HMAC-SHA256 với secret key, bao gồm HTTP method, bucket, object key, expiry time, và conditions. MinIO verify signature khi receive request.

Ưu điểm là backend không phải handle file transfer, chỉ authorize và generate URL. Client upload trực tiếp nên latency thấp hơn. Secure vì URL expires và chỉ valid cho specific object.

Trong code, StorageService generate presigned URL bằng minioClient.getPresignedObjectUrl với method PUT và expiry duration. Return URL cho frontend để upload.

---

### Câu 160: Tại sao chọn LiveKit cho Media Server?

**Trả lời:**

LiveKit là open-source WebRTC SFU server, em chọn vì nhiều lý do.

Thứ nhất là WebRTC native support. LiveKit handle SDP negotiation, ICE, STUN/TURN automatically. Client SDK cho React giúp integrate nhanh không cần hiểu sâu WebRTC internals.

Thứ hai là Egress API. LiveKit cung cấp server-side recording trực tiếp to S3-compatible storage như MinIO. Khi có violation, Spring Boot trigger track egress để record evidence video mà không cần client cooperation.

Thứ ba là low latency. LiveKit advertises sub-500ms latency, phù hợp cho realtime proctoring monitoring.

Thứ tư là scalability. LiveKit có horizontal scaling với multiple nodes. Mỗi room có thể scale đến hàng trăm participants.

Thứ năm là self-hosted. Tương tự MinIO, LiveKit có thể deploy on-premise cho data privacy.

---

### Câu 161: LiveKit có những bất lợi gì?

**Trả lời:**

Có một số bất lợi cần lưu ý.

Thứ nhất là infrastructure requirements. LiveKit cần resources đáng kể, đặc biệt cho video transcoding trong egress. Cần server với CPU mạnh hoặc GPU acceleration.

Thứ hai là learning curve. WebRTC architecture phức tạp. Debugging ICE failures, network traversal issues cần kiến thức chuyên sâu.

Thứ ba là cost của LiveKit Cloud. Nếu dùng managed LiveKit Cloud thay vì self-hosted, pricing có thể cao cho nhiều concurrent streams.

Thứ tư là egress limitations. Track egress chỉ record từng track riêng lẻ, không composite. Room composite egress cần layout configuration.

Trong đồ án, em handle bất lợi bằng cách self-host LiveKit trong Docker với resources moderate, đủ cho prototype scale.

---

### Câu 162: Có những alternatives nào thay cho LiveKit?

**Trả lời:**

Có nhiều alternatives cho WebRTC media server.

Jitsi Meet là open-source video conferencing platform. Advantages là mature, có UI sẵn. Disadvantages là thiên về conferencing hơn custom use case, egress API limited.

Janus Gateway là lightweight WebRTC server. Advantages là modular plugins. Disadvantages là lower-level, cần implement nhiều logic.

mediasoup là SFU library cho Node.js. Advantages là performant, lowlevel control. Disadvantages là library not server, cần build server around it.

Twilio Video là cloud option. Advantages là managed, reliable. Disadvantages là vendor lock-in, recurring cost.

Agora là another cloud option với recording features. Similar tradeoffs như Twilio.

Em chọn LiveKit vì combination của open-source, self-hosted, egress API tốt, và modern SDK cho React.

---

### Câu 163: LiveKit Egress được dùng như thế nào trong project?

**Trả lời:**

LiveKit Egress được dùng để record video evidence khi có violation.

Flow là khi Pre-Suspicion detection trigger, frontend gửi incident lên server qua RabbitMQ. Session-service xử lý và call EgressService để start track egress. LiveKit server receive request, bắt đầu record video track của candidate, output trực tiếp to MinIO bucket.

Có hai loại egress em dùng. Track Egress record single participant video track, dùng cho evidence của thí sinh cụ thể. Room Composite Egress record entire room với layout, dùng cho proctor view recording.

Egress output format là MP4 với H.264 codec, upload to MinIO với object key pattern evidence/sessionId/incidentId.mp4.

Khi egress complete, LiveKit send webhook to Spring Boot. EgressService update incident status và object key trong database để frontend có thể retrieve evidence.

---

### Câu 164: Yêu cầu Bảo Mật Token không lưu LocalStorage được đáp ứng như thế nào?

**Trả lời:**

Đây là yêu cầu quan trọng để chống XSS attacks.

Trong architecture, frontend React không directly handle access tokens. Thay vào đó, tokens được manage hoàn toàn bởi BFF layer trong NextJS.

Flow authentication là user login qua NextJS page gọi API đến Auth Server. Auth Server return tokens. NextJS store tokens trong httpOnly cookies, không accessible bởi JavaScript. Subsequent requests đến backend services, NextJS BFF attach token từ cookie vào Authorization header.

Frontend React components chỉ nhận session data từ NextJS không phải raw tokens. Khi cần call API, React gọi NextJS BFF endpoint, BFF extract token từ cookie và forward request với token.

Nếu attacker inject XSS script vào page, script không thể access cookies với httpOnly flag. Tokens protected even in XSS scenario.

---

### Câu 165: BFF Layer hoạt động như lá chắn trung gian như thế nào?

**Trả lời:**

BFF tức Backend For Frontend layer trong NextJS serve nhiều purposes security.

Thứ nhất là token isolation. Như đã nói, access tokens không expose to frontend JavaScript. BFF keep tokens server-side.

Thứ hai là request validation. BFF validate và sanitize requests trước khi forward đến microservices. Prevent malformed requests reaching critical services.

Thứ ba là rate limiting. BFF implement rate limits per IP và per user session. Protect backend services from abuse.

Thứ tư là response filtering. BFF có thể filter sensitive data từ backend responses trước khi send to frontend. Hide internal error details, sanitize PII.

Thứ năm là audit logging. All requests qua BFF được log với correlation ID. Centralized point for security monitoring.

Trong project, NextJS middleware và API routes implement các functions này. Every sensitive API call từ React đi qua NextJS không direct to Spring Boot.

---

### Câu 166: Mã hóa dữ liệu truyền tải được implement như thế nào?

**Trả lời:**

Encryption in transit được implement ở multiple layers.

HTTPS cho all HTTP traffic. TLS 1.2 hoặc 1.3 encrypt data giữa browser và servers. Certificates managed bởi ingress controller hoặc load balancer trong production.

WebSocket Secure WSS cho realtime communication. LiveKit connections và SSE streams đều encrypted.

DTLS và SRTP cho WebRTC media. LiveKit sử dụng DTLS handshake để establish encrypted channel cho video/audio RTP packets. Mandatory trong WebRTC spec.

Internal service communication trong Docker network hiện chưa encrypted. Production deployment sẽ cần mTLS giữa containers hoặc service mesh như Istio.

Database connections sử dụng TLS nếu PostgreSQL configured với SSL. MinIO có thể configure với TLS cho S3 API.

---

### Câu 167: Yêu cầu Detection Latency dưới 2 giây được đáp ứng như thế nào?

**Trả lời:**

Detection latency là thời gian từ lúc behavior xảy ra đến lúc system report violation.

Client-side AI với TensorFlow.js là key enabler. Face detection và analysis chạy entirely trong browser, không network latency for AI inference. Typical inference time là 30ms per frame với WebGL backend.

Sustained detection với time window đã tuned. HARD_VIOLATION trigger sau 2.5 giây continuous violation. Từ góc nhìn user experience, violation được capture trong window này.

Pre-Suspicion detection ngắn hơn với 1.8 đến 2.5 giây window. Catch early signals nhanh hơn formal violation.

Network latency chỉ affect incident reporting, không affect detection. Even if upload to server slow, detection và local warning đã trigger.

Measured end-to-end latency trong testing khoảng 1.5 đến 2 giây từ actual behavior đến UI update, within requirement.

---

### Câu 168: Yêu cầu Streaming Latency dưới 500ms được đáp ứng như thế nào?

**Trả lời:**

Streaming latency là glass-to-glass delay từ thí sinh camera đến proctor screen.

LiveKit SFU architecture giữ latency minimal. Video frames forward directly qua server không transcoding for viewing. SFU chỉ route packets không process.

WebRTC optimizations bao gồm simulcast với multiple resolution layers. Proctor subscribe low-resolution stream giảm bandwidth. Adaptive bitrate dựa trên network conditions.

LiveKit advertises sub-400ms latency cho typical networks. Trong internal testing với local Docker setup, measured latency khoảng 200ms đến 400ms.

Fallback mechanisms nếu network degraded bao gồm automatically switch to lower quality, audio priority over video.

Với mạng chậm, latency có thể tăng nhưng connection vẫn maintain. Proctor vẫn thấy stream, chỉ delayed.

---

### Câu 169: Yêu cầu Availability với modules độc lập được đáp ứng như thế nào?

**Trả lời:**

Availability requirement là nếu AI Worker fail, core exam functions vẫn work.

Microservices architecture enable independence. Session-service, incident-service, và AI Worker là separate containers. Failure của một không crash others.

RabbitMQ message queuing provide buffering. Nếu AI Worker down, messages queue up. Khi worker restart, process backlog. No data loss.

Face verification là async optional operation. Exam start không block on verification completion. Student có thể bắt đầu thi, verification result update later.

Incident recording không block exam submission. Evidence upload qua presigned URL direct to MinIO, không qua AI Worker.

Liveness check là optional feature. Nếu fail, log warning nhưng không prevent exam access.

Health checks trong Docker Compose detect failures và có thể trigger restart. Kubernetes deployment có thêm self-healing.

---

### Câu 170: Nếu AI Worker crash, incident upload có bị ảnh hưởng không?

**Trả lời:**

Incident upload path không đi qua AI Worker nên không bị ảnh hưởng khi AI Worker crash.

Flow là frontend detect violation, gọi session-service API để report incident, upload evidence snapshot direct to MinIO via presigned URL, session-service publish message to RabbitMQ.

AI Worker subscribe RabbitMQ messages but messages persist nếu worker offline. Queue durable, messages không mất.

Incident record được create trong database bởi session-service, không phải AI Worker. Evidence files trong MinIO available immediately.

AI Worker responsibilities chỉ là face verification và optional processing. Core incident flow hoàn toàn independent.

Khi AI Worker restart, nó consume backlogged messages và process face verification retroactively. Incidents đã recorded, just verification status update later.

---

### Câu 171: So sánh AWS S3 với MinIO cho project này?

**Trả lời:**

AWS S3 và MinIO có trade-offs khác nhau cho project này.

Về durability, S3 có 99.999999999 phần trăm durability với data replicated across zones. MinIO single-node không đạt level này, cần multi-node setup.

Về latency, MinIO on-premise có lower latency đến local services. S3 có network round-trip to AWS region.

Về cost, S3 charge per request, storage, và egress bandwidth. MinIO chỉ tốn infrastructure. For high-volume use, MinIO cheaper. For low-volume, S3 simpler.

Về maintenance, S3 fully managed, zero ops. MinIO cần backup strategy, monitoring, upgrades.

Về compliance, S3 có nhiều certifications như HIPAA, SOC2. MinIO self-hosted đặt compliance burden lên organization.

Cho prototype stage, MinIO phù hợp hơn vì cost control và data privacy. Production có thể consider S3 nếu organization đã có AWS account và compliance requirements.

---

### Câu 172: So sánh Jitsi với LiveKit cho project này?

**Trả lời:**

Jitsi và LiveKit đều là open-source WebRTC solutions nhưng khác focus.

Jitsi là complete video conferencing solution với UI, chat, và features như recording, virtual backgrounds. LiveKit là lower-level SFU với APIs cho custom applications.

Về customization, LiveKit cho nhiều control hơn. Jitsi UI harder to customize significantly. Cho exam proctoring với specific UX requirements, LiveKit phù hợp hơn.

Về recording, Jitsi có Jibri component cho recording nhưng heavy. LiveKit Egress modern hơn, direct output to S3.

Về SDKs, LiveKit có TypeScript SDK tốt cho React. Jitsi embed via IFrame hoặc lib-jitsi-meet lower level.

Về resources, Jitsi Videobridge nhẹ hơn cho large rooms với many participants. LiveKit mới hơn, less battle-tested but actively developed.

Về documentation, cả hai decent nhưng LiveKit documentation modern hơn.

Em chọn LiveKit vì Egress API tốt cho evidence recording và SDK phù hợp cho React custom integration.

---

### Câu 173: Rate Limiting trong BFF được implement như thế nào?

**Trả lời:**

Rate limiting protect backend services từ abuse và DDoS.

Trong NextJS BFF, rate limiting có thể implement bằng middleware checking request counts per IP hoặc per user session.

Implementation options bao gồm in-memory rate limiter với sliding window algorithm. Cho single BFF instance đủ đơn giản.

Redis-based rate limiting cho distributed setup với multiple BFF instances sharing counters.

Configurable limits như 100 requests per minute cho general API, 20 requests per minute cho auth endpoints, 10 requests per minute cho sensitive operations.

Response khi exceeded là HTTP 429 Too Many Requests với Retry-After header.

Trong project hiện tại, rate limiting chưa fully implemented. Production deployment sẽ need edge rate limiting qua Cloudflare hoặc similar, plus application-level limiting trong BFF.

---

### Câu 174: Làm sao đảm bảo privacy khi video stream qua LiveKit?

**Trả lời:**

Privacy cho video stream được address ở multiple levels.

LiveKit self-hosted đảm bảo video frames không gửi đến third-party cloud. All traffic within organization infrastructure.

SRTP encryption cho media packets. Even nếu network traffic captured, content encrypted.

Access control qua JWT tokens. Only authenticated users với valid token có thể join room. Tokens có expiry và room-level permissions.

Participant permissions configurable. Student có thể publish video nhưng không subscribe others. Proctor có thể subscribe nhưng typically không publish.

Recording control. Egress chỉ trigger khi có violation và authorized request. Random recording không xảy ra.

Data retention policy. Evidence videos deleted sau retention period. Không indefinite storage.

Audit trail. All room joins và egress operations logged với timestamps và user IDs.

---

### Câu 175: Trade-off giữa self-hosted và cloud services trong project này?

**Trả lời:**

Self-hosted với MinIO và LiveKit có specific trade-offs.

Advantages của self-hosted là data sovereignty, video và files không rời khỏi premises. Cost predictability, không phụ thuộc vào usage spikes. Customization, full control over configuration. No vendor lock-in, có thể switch hoặc modify.

Disadvantages của self-hosted là operational burden, cần team manage infrastructure, backups, updates. Durability và availability responsibility, tự ensure uptime. Scaling complexity, cần plan capacity và scale manually.

Advantages của cloud như AWS S3 và Twilio là managed services, zero ops. Enterprise SLAs với guaranteed uptime. Global distribution, edge locations worldwide. Compliance certifications sẵn có.

Disadvantages của cloud là recurring cost, có thể expensive at scale. Data leaves premises, privacy concerns. Vendor dependency, API changes affect application.

Cho đồ án prototype, self-hosted làm sense. Production deployment decision phụ thuộc organization resources và requirements cụ thể.

---

*Tổng số câu hỏi: 175 câu cho bảo vệ bằng miệng*
*Cập nhật: 04/01/2026*

