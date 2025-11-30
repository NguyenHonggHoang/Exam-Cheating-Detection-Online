# Backend quickstart (Spring Boot)

Mục tiêu: chạy Postgres trong Docker, build và chạy Spring Boot app, gọi API start/end session.

1) Khởi động Postgres bằng Docker Compose (Windows CMD):

```bat
cd "e:\HK1 Nam 4\TotNghiep\exam-cheating-detection-v2"
docker compose up -d
```

2) Kiểm tra container đang chạy:

```bat
docker ps
```

3) Build và chạy backend (sử dụng Maven):

```bat
cd backend
mvnw.cmd -v   # kiểm tra mvn wrapper hoặc dùng mvn nếu đã cài
mvnw.cmd spring-boot:run
```

Ghi chú: lệnh trên đã tự kích hoạt profile `dev` và timezone `UTC` qua cấu hình `spring-boot-maven-plugin` trong `pom.xml`.

Nếu dùng IDE (IntelliJ/Eclipse/VS Code) thì import project Maven (`backend/pom.xml`) và run `ExamApplication`.

4) Test API (Windows CMD):

# Start session
curl -X POST http://localhost:8080/api/sessions/start -H "Content-Type: application/json" -d "{\"examId\":\"11111111-1111-1111-1111-111111111111\",\"userId\":\"22222222-2222-2222-2222-222222222222\"}"

# End session (thay id bằng id trả về)
curl -X POST http://localhost:8080/api/sessions/{id}/end

5) Logs & debugging
- Docker logs: `docker logs exam-postgres`
- App logs: console from mvn spring-boot:run or IDE run window.

6) API Docs (OpenAPI/Swagger)
- Swagger UI: http://localhost:8080/swagger-ui/index.html
- OpenAPI JSON: http://localhost:8080/v3/api-docs

7) Bật JWT (RS256) – bắt đầu từng bước
- Mặc định (profile `dev`) chưa bắt buộc auth để bạn phát triển nhanh: `security.require-auth=false` trong `application-dev.yml`.
- Để bật yêu cầu JWT cho `/api/**`, đổi thành:

```yaml
# application-dev.yml
security:
	require-auth: true

spring:
	security:
		oauth2:
			resourceserver:
				jwt:
					public-key-location: classpath:keys/dev-public.pem
```

- Sau khi bật, gửi kèm header:

```http
Authorization: Bearer <JWT_đã_ký_RS256>
```

- File `docs/api/requests.http` đã có biến `@authBearer` để bạn dán token nhanh.
- Lưu ý: phần key dev chỉ phục vụ local; khi tích hợp IdP thực (Keycloak, Auth0, Azure AD…), thay `public-key-location` bằng `jwk-set-uri` (VD: `https://<domain>/.well-known/jwks.json`).

Next: add authentication (JWT RS256), entity mapping cho các bảng khác, seed data runner, và mở rộng test coverage.
Ghi chú:
- Postgres container đang publish cổng host 55432 → JDBC URL mặc định trong `application.yml` đã trỏ `jdbc:postgresql://127.0.0.1:55432/examdb`.
- Nếu bạn đang có Postgres cài native trên Windows chiếm 5432, giữ nguyên cổng 55432 để tránh xung đột.
- Có sẵn file `docs/api/requests.http` để test nhanh bằng VS Code REST Client.

## Troubleshooting: TimeZone 'Asia/Saigon'

- Nếu khi chạy test hoặc khởi động app bạn gặp lỗi tương tự:

	`FATAL: invalid value for parameter "TimeZone": "Asia/Saigon"`

	Nguyên nhân: JDBC driver gửi TimeZone mặc định của JVM (lấy từ OS). Postgres không chấp nhận alias cũ `Asia/Saigon`.

	Đã khắc phục sẵn trong project theo 2 lớp:
	- Test JVM luôn chạy với `-Duser.timezone=UTC` (cấu hình `maven-surefire-plugin`).
	- Kết nối Hikari ép session Postgres dùng `TimeZone=UTC` và Hibernate dùng `hibernate.jdbc.time_zone=UTC` (trong `application.yml`).

	Vì vậy bạn không cần đổi timezone của Windows. Nếu vẫn thấy lỗi, hãy đảm bảo:
	- Đã rebuild dự án: `mvn -q -DskipTests package`
	- Container Postgres đã up: `docker ps` thấy service đang chạy cổng 55432.
	- Không override cấu hình bằng biến môi trường lạ liên quan timezone.
