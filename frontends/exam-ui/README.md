# Frontend (React + Vite) MVP

## Cài đặt

```cmd
cd frontend
npm install
npm run dev
```

Mở: http://localhost:5173

Proxy `/api` đã trỏ tới backend `http://localhost:8080` trong `vite.config.ts`.

## Các trang
- Start Session: tạo / kết thúc session (dùng seed exam/user ID).
- Ingest Demo: gửi events, snapshots metadata, upload base64 ảnh.
- Incidents: xem danh sách incidents theo session.
- Review: tạo và xem review cho incident.

## Lưu ý
- Cần backend đang chạy (Docker Compose hoặc `mvn spring-boot:run`).
- Nếu gặp lỗi CORS hoặc 401, kiểm tra biến `SECURITY_REQUIRE_AUTH` trong docker-compose để tắt auth dev.
