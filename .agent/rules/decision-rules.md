---
trigger: model_decision
---

3. GLOB RULES (CONTEXT-AWARE – QUY TẮC THEO FILE)
Mục tiêu: Kích hoạt các hướng dẫn cú pháp phù hợp với từng loại file trong Monorepo.

Monorepo bao gồm các vùng code độc lập với vai trò riêng. Mỗi vùng phải tuân thủ coding standards tương ứng.

3.1. Frontend Context

Glob:

**/*.tsx
apps/web/**/*


Role:

Client UI (React 18 + Next.js App Router).

Không sở hữu Access Token.

Chỉ giao tiếp với BFF (/api/*).

Libraries:

next-auth/react (Client hooks)

axios hoặc fetch

tailwindcss

lucide-react (icons)

Coding Standards (Frontend)
1. Luôn dùng useSession() để kiểm tra login state
import { useSession } from "next-auth/react";

const Dashboard = () => {
  const { data: session } = useSession();
  if (!session) return <LoginRequired />;
  return <SecureContent />;
};

2. Component phải là Functional Component (FC) với TypeScript strict mode
"use client";

interface Props {
  title: string;
}

export default function Page({ title }: Props) {
  return <div>{title}</div>;
}

3. Không truy cập session token trực tiếp

UI chỉ được dùng session.user.*
⚠ Không bao giờ truy cập session.accessToken.

4. Chỉ fetch qua BFF
const res = await fetch("/api/users");

5. TailwindCSS bắt buộc cho styling

CSS modules chỉ dùng cho layout đặc biệt.

3.2. BFF API Context

Glob:

apps/bff/app/api/**/*.ts


Role:

API Gateway / Proxy

Nơi duy nhất attach Bearer Token

Thực hiện Token Refresh

Sanitize input

Logging chuẩn

Libraries:

next-auth (server)

axios hoặc fetch cho proxy

Không sử dụng client-side libraries

Coding Standards (BFF)
1. Template bắt buộc cho mọi API Route
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return new Response("Unauthorized", { status: 401 });

  const res = await fetch(`${process.env.BACKEND_URL}/endpoint`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`, // CRITICAL STEP
      "Content-Type": "application/json",
    },
  });

  // Handle status code mapping theo Rule 2.x
  if (res.status === 403) return new Response("Forbidden", { status: 403 });
  if (res.status >= 500) {
    console.error("[BFF][/endpoint] Error:", await res.text());
    return new Response("System busy", { status: 500 });
  }

  const data = await res.json();
  return Response.json(data);
}

2. BFF phải luôn:

Lấy session token → getServerSession()

Xác thực session trước mỗi request

Không chứa business logic

Không gọi database

Không thực hiện AI/ML logic

Không để lộ internal backend URL sang Client

3. Không bao giờ export default cho API Route

Next.js App Router yêu cầu export GET/POST/PUT/DELETE.

3.3. Backend Context (Spring Boot)

Glob:

services/**/*.java


Role:

Resource Server

Authorization Server (nếu module auth)

Business logic

Transaction & domain validation

Libraries:

Spring Boot 3

Spring Security 6 (OAuth2 Resource Server)

Lombok

MapStruct (khuyến nghị)

Coding Standards (Backend)
1. DTO/Entity chuẩn Lombok
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long id;
    private String email;
    private String fullName;
}

2. Không bao giờ trả Entity trực tiếp từ JPA

Always map → DTO.

3. Security Config phải dùng JWT Resource Server
@Bean
SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
      .oauth2ResourceServer(oauth2 -> oauth2
          .jwt(jwt -> jwt.jwkSetUri(jwkSetUri))
      );
    return http.build();
}

4. Business logic bắt buộc nằm trong @Service

Không đưa logic vào Controller.

5. Logging chuẩn
log.error("[Service: UserService] Action: createUser Failed. Reason: {}", ex.getMessage());

3.4. AI Worker Context (Python)

Glob:

ai_pipeline/**/*.py


Role:

Face recognition

Gaze tracking

Lắng nghe RabbitMQ queue

Gửi kết quả về backend qua event/message

Libraries:

pika (RabbitMQ)

opencv-python

boto3 (S3 hoặc MinIO)

numpy

asyncio (recommended)

Coding Standards (AI Worker)
1. Worker phải chạy async (non-blocking)
import pika
import json

def callback(ch, method, properties, body):
    payload = json.loads(body)
    process_frame(payload)

def start_worker():
    connection = pika.BlockingConnection(...)
    channel = connection.channel()
    channel.basic_consume(queue="vision", on_message_callback=callback)
    channel.start_consuming()

2. Sau khi xử lý xong, publish kết quả JSON về Message Broker

Format chuẩn:

result = {
    "student_id": student_id,
    "violation": violation,
    "timestamp": int(time.time()*1000),
    "proof_image_url": image_url
}
channel.basic_publish(exchange="", routing_key="violation_events",
                      body=json.dumps(result))

3. Tuyệt đối không lưu file ảnh local

Sau khi xử lý → upload ảnh/frame lên S3/MinIO.

Chỉ truyền URL trong event.

s3.upload_file(temp_path, "bucket", key)
image_url = f"https://cdn.example.com/{key}"

4. Logging chuẩn
logger.error("[AI Worker][face-detect] Failed: %s | Payload: %s",
             str(e), json.dumps(payload))