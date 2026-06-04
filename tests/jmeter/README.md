# Hướng dẫn Kiểm thử Hiệu năng với JMeter (Exam Platform Load Test)

Kịch bản JMeter này (`exam-load-test.jmx`) được thiết kế để kiểm thử tải hệ thống Exam Cheating Detection với **50 người dùng đồng thời (Threads)** thực hiện trọn vẹn luồng thi cử bảo mật thông qua Gateway BFF và OIDC Authorization Server.

## 1. Yêu cầu hệ thống & Cài đặt
1. **Java Runtime Environment (JRE) hoặc JDK:**
   - Đảm bảo máy đã cài đặt Java 8 trở lên (khuyên dùng Java 17 hoặc 21 để đồng bộ với dự án).
   - Kiểm tra bằng lệnh: `java -version`
2. **Tải Apache JMeter:**
   - Tải bản phân phối mới nhất từ trang chủ: [https://jmeter.apache.org/download_jmeter.cgi](https://jmeter.apache.org/download_jmeter.cgi) (Tải file `.zip` cho Windows).
   - Giải nén file `.zip` vào một thư mục bất kỳ (ví dụ: `C:\apache-jmeter-5.6.3`).

---

## 2. Kịch bản kiểm thử (Test Flow)
Kịch bản tự động thực hiện các bước cho mỗi Thread (User):
1. **Đăng ký tài khoản mới** thông qua BFF (`POST /api/register`). Mỗi user sẽ có username dạng ngẫu nhiên `jm_user_[uuid]`.
2. **Lấy CSRF Token** bằng cách gửi request `GET` đến trang `/login` của Authorization Server.
3. **Đăng nhập hệ thống (POST /login)** truyền kèm username, password và CSRF Token vừa lấy được để thiết lập session cookie.
4. **Yêu cầu Mã Ủy quyền (Auth Code)** qua endpoint `/oauth2/authorize` kèm tham số PKCE (`code_challenge`, `state`). Lấy code phản hồi từ URL redirect.
5. **Đổi Code lấy Access Token (POST /oauth2/token)** qua Basic Authentication với Client Credentials của BFF. Token JWT được tự động trích xuất thông qua JSON Post Processor.
6. **Xác thực phiên (GET /userinfo)** kiểm tra token hoạt động bình thường.
7. **Bắt đầu phòng thi (POST /api/proxy/mock-exam/start)** qua BFF để lấy `sessionId`.
8. **Tải danh sách câu hỏi (GET /api/proxy/mock-exam/{id}/questions)** để lấy ID câu hỏi phục vụ nộp bài.
9. **Nộp bài thi (POST /api/proxy/mock-exam/submit)** gửi kèm câu trả lời trắc nghiệm.
10. **Bắn telemetry cảnh báo gian lận (POST /api/proxy/incident/client-event)** mô phỏng dữ liệu camera AI gửi về.

---

## 3. Hướng dẫn chạy kiểm thử

### Cách 1: Sử dụng giao diện đồ họa (GUI Mode) - Dùng khi phát triển/kiểm tra lỗi
1. Vào thư mục `bin` của thư mục giải nén JMeter (ví dụ: `C:\apache-jmeter-5.6.3\bin`).
2. Nhấp đúp vào file `jmeter.bat` để mở giao diện đồ họa JMeter.
3. Nhấn **File > Open** (hoặc tổ hợp phím `Ctrl + O`) và trỏ tới file [exam-load-test.jmx](file:///d:/Exam-dectection/exam-cheating-detection-v2/tests/jmeter/exam-load-test.jmx).
4. Nhìn vào menu bên trái:
   - Click vào **Test Plan**: Cậu sẽ thấy các tham số cấu hình host/port của BFF và Authorization Server. Chỉnh sửa nếu cấu hình k8s ingress khác mặc định (`localhost:8080` cho BFF, `localhost:9000` cho Auth Server).
   - Click vào **50 Users Thread Group**: Điều chỉnh số lượng Users (Number of Threads), thời gian gia tăng tải (Ramp-up) và số lần lặp (Loop Count) nếu cần.
5. Để chạy test: Nhấn nút **Play** màu xanh trên thanh công cụ.
6. Xem kết quả trực quan tại:
   - **View Results Tree:** Xem chi tiết response HTTP code, headers và json body của từng request xem có bị lỗi logic/401 không.
   - **Aggregate Report:** Xem bảng thống kê tổng hợp (Average Latency, Min/Max, Error %, Throughput).

---

### Cách 2: Chạy dòng lệnh (CLI / Non-GUI Mode) - Khuyên dùng khi đo hiệu năng thực tế
Để đảm bảo JMeter không tốn tài nguyên vẽ giao diện đồ họa làm ảnh hưởng đến độ chính xác của kết quả, hãy chạy test bằng dòng lệnh:

1. Mở PowerShell hoặc Command Prompt tại thư mục chứa file test `tests/jmeter/`.
2. Chạy lệnh sau (Thay đổi đường dẫn tới thư mục cài đặt JMeter của cậu):
   ```bash
   C:\path\to\jmeter\bin\jmeter.bat -n -t exam-load-test.jmx -l results.jtl -e -o reports/
   ```
   *Giải thích các tham số:*
   - `-n`: Chạy ở chế độ không giao diện (Non-GUI).
   - `-t`: Đường dẫn đến file kịch bản `.jmx`.
   - `-l`: File lưu log kết quả chạy dạng bảng raw (`results.jtl`).
   - `-e`: Tự động sinh báo cáo HTML sau khi hoàn thành.
   - `-o`: Thư mục đầu ra của báo cáo HTML (trong ví dụ là thư mục `reports/`).

3. Sau khi chạy xong, hãy mở file `reports/index.html` bằng trình duyệt web để xem biểu đồ thống kê chuyên nghiệp (Response Time, Active Threads, Over Time, Response Codes, Throughput, v.v.).

---

## 4. Tham số hóa & Tùy chỉnh (Tùy chọn)
Nếu muốn cấu hình các tham số động từ dòng lệnh mà không muốn mở file bằng giao diện GUI, cậu có thể truyền trực tiếp qua cờ `-J`:
- Thay đổi Host BFF: `-JBFF_HOST=192.168.1.5`
- Thay đổi Port BFF: `-JBFF_PORT=30080`
- Thay đổi số lượng Threads: Thay đổi trực tiếp trong giao diện hoặc đổi cấu hình ${__P(threads,50)} để truyền từ CLI qua `-Jthreads=100`.
