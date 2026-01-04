# Hướng Dẫn Cài Đặt và Kiểm Thử

## Mục Lục

1. [Môi Trường Phát Triển](#1-môi-trường-phát-triển)
2. [Tổ Chức Mã Nguồn](#2-tổ-chức-mã-nguồn)
3. [Cài Đặt Các Thành Phần Cốt Lõi](#3-cài-đặt-các-thành-phần-cốt-lõi)
4. [Kiểm Thử Hệ Thống](#4-kiểm-thử-hệ-thống)

---

## 1. Môi Trường Phát Triển

### 1.1. Yêu Cầu Phần Cứng

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
|------------|-------------------|-------------|
| **CPU** | 4 cores | 8 cores |
| **RAM** | 8 GB | 16 GB |
| **Disk** | 20 GB SSD | 50 GB SSD |
| **GPU** | Không bắt buộc | NVIDIA (TensorFlow.js WebGL acceleration) |

### 1.2. Yêu Cầu Phần Mềm

| Công cụ | Phiên bản | Mục đích | Link tải |
|---------|-----------|----------|----------|
| **Node.js** | 18.x LTS trở lên | Frontend & BFF runtime | [nodejs.org](https://nodejs.org/) |
| **Java JDK** | 21 LTS | Spring Boot services | [Oracle](https://www.oracle.com/java/technologies/downloads/) / [Adoptium](https://adoptium.net/) |
| **Maven** | 3.9.x | Build Java projects | [maven.apache.org](https://maven.apache.org/) |
| **Docker Desktop** | 4.x trở lên | Container runtime | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2.x | Version control | [git-scm.com](https://git-scm.com/) |
| **Python** | 3.11.x | AI Worker | [python.org](https://www.python.org/) |

### 1.3. IDE Khuyến Nghị

| IDE | Sử dụng cho | Extensions cần thiết |
|-----|-------------|---------------------|
| **VS Code** | Frontend, BFF | ESLint, Prettier, TypeScript, Tailwind CSS IntelliSense |
| **IntelliJ IDEA** | Spring Boot services | Spring Boot, Lombok, Maven Helper |
| **PyCharm** | AI Worker | Python, Requirements |

### 1.4. Cài Đặt Công Cụ Phát Triển

#### Windows (PowerShell as Administrator)

```powershell
# Cài đặt Chocolatey package manager
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Cài đặt các công cụ
choco install nodejs-lts -y
choco install openjdk21 -y
choco install maven -y
choco install docker-desktop -y
choco install git -y
choco install python311 -y

# Khởi động lại terminal và kiểm tra
node --version    # v18.x hoặc cao hơn
java --version    # openjdk 21.x
mvn --version     # Apache Maven 3.9.x
docker --version  # Docker version 24.x
python --version  # Python 3.11.x
```

#### macOS (Homebrew)

```bash
# Cài đặt Homebrew nếu chưa có
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Cài đặt các công cụ
brew install node@18
brew install openjdk@21
brew install maven
brew install --cask docker
brew install python@3.11

# Khởi động Docker Desktop từ Applications
```

#### Linux (Ubuntu/Debian)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Java 21
sudo apt-get install -y openjdk-21-jdk

# Maven
sudo apt-get install -y maven

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Python
sudo apt-get install -y python3.11 python3.11-venv
```

---

## 2. Tổ Chức Mã Nguồn

### 2.1. Cấu Trúc Thư Mục

```
exam-cheating-detection-v2/
│
├── 📁 frontends/                    # Giao diện người dùng
│   └── exam-ui/                     # React + TypeScript + TailwindCSS
│       ├── src/
│       │   ├── api/                 # API clients
│       │   ├── components/          # React components
│       │   ├── pages/               # Route pages
│       │   ├── lib/                 # Core logic
│       │   │   ├── hooks/           # Custom hooks (detection, stream)
│       │   │   └── utils/           # Utilities (face analysis, etc.)
│       │   └── ui/                  # UI primitives
│       ├── package.json
│       └── vite.config.ts
│
├── 📁 gateways/                     # API Gateway layer
│   └── bff/                         # Backend-for-Frontend (Node.js)
│       ├── src/
│       │   ├── routes/              # Express routes
│       │   └── middleware/          # Auth, rate limiting
│       ├── prisma/                  # Database schema
│       └── package.json
│
├── 📁 services/                     # Microservices (Spring Boot)
│   ├── auth-server/                 # OAuth2 Authorization Server
│   ├── session-service/             # Exam session management
│   ├── incident-service/            # Violation handling
│   ├── user-service/                # User management
│   └── admin-service/               # Admin functions
│
├── 📁 ai-worker/                    # Python AI workers
│   ├── face_verifier.py             # Face comparison (ArcFace)
│   ├── comprehensive_analyzer.py    # Session analysis
│   ├── screen_glow_detector.py      # Phone glow detection
│   └── requirements.txt
│
├── 📁 infra/                        # Infrastructure configs
│   ├── docker/                      # Docker configs
│   │   └── postgres/init/           # DB init scripts
│   ├── debezium/                    # CDC connectors
│   └── nginx/                       # Reverse proxy
│
├── 📁 docs/                         # Documentation
│
├── docker-compose.yml               # Container orchestration
├── livekit.yaml                     # LiveKit SFU config
└── cleanup_data.ps1                 # Test data reset script
```

### 2.2. Technology Stack

| Layer | Công nghệ | Phiên bản |
|-------|-----------|-----------|
| **Frontend** | React + TypeScript + Vite | 18.x |
| **UI Framework** | TailwindCSS + shadcn/ui | 3.x |
| **AI Detection** | TensorFlow.js (BlazeFace, MediaPipe) | 4.x |
| **BFF Gateway** | Node.js + Express + Prisma | 18.x |
| **Backend** | Spring Boot + Java | 3.2.x / 21 |
| **Database** | PostgreSQL | 15.x |
| **Cache** | Redis | 7.x |
| **Object Storage** | MinIO | Latest |
| **Message Queue** | RabbitMQ | 3.x |
| **CDC** | Debezium + Kafka | 2.x |
| **WebRTC** | LiveKit | 1.x |

---

## 3. Cài Đặt Các Thành Phần Cốt Lõi

### 3.1. Clone Repository

```bash
# Clone project
git clone https://github.com/NguyenHonggHoang/exam-cheating-detection-v2.git
cd exam-cheating-detection-v2
```

### 3.2. Khởi Động Infrastructure

```bash
# Khởi động tất cả infrastructure services
docker-compose up -d postgres redis minio rabbitmq zookeeper kafka

# Chờ 30-60 giây để services khởi động
# Kiểm tra trạng thái
docker-compose ps
```

**Các services và ports:**

| Service | Container | Port | URL |
|---------|-----------|------|-----|
| PostgreSQL | postgres | 5432 | `localhost:5432` |
| Redis | redis | 6379 | `localhost:6379` |
| MinIO API | minio | 9000 | `http://localhost:9000` |
| MinIO Console | minio | 9001 | `http://localhost:9001` |
| RabbitMQ | rabbitmq | 5672, 15672 | `http://localhost:15672` |
| Kafka | kafka | 9092 | `localhost:9092` |

### 3.3. Cài Đặt Backend Services

#### 3.3.1. Auth Server

```bash
cd services/auth-server

# Build project
./mvnw clean package -DskipTests

# Chạy service
./mvnw spring-boot:run

# Service chạy tại port 8080
```

#### 3.3.2. Session Service

```bash
cd services/session-service

./mvnw clean package -DskipTests
./mvnw spring-boot:run

# Service chạy tại port 8081
```

#### 3.3.3. Incident Service

```bash
cd services/incident-service

./mvnw clean package -DskipTests
./mvnw spring-boot:run

# Service chạy tại port 8082
```

#### 3.3.4. User Service

```bash
cd services/user-service

./mvnw clean package -DskipTests
./mvnw spring-boot:run

# Service chạy tại port 8083
```

### 3.4. Cài Đặt BFF Gateway

```bash
cd gateways/bff

# Cài đặt dependencies
npm install

# Chạy database migration
npx prisma migrate deploy
npx prisma generate

# Chạy development server
npm run dev

# Gateway chạy tại port 3001
```

### 3.5. Cài Đặt Frontend

```bash
cd frontends/exam-ui

# Cài đặt dependencies
npm install

# Tạo file environment (nếu chưa có)
cp .env.example .env.local

# Chạy development server
npm run dev

# Frontend chạy tại port 5173
```

**Nội dung `.env.local`:**
```env
VITE_API_URL=http://localhost:3001
VITE_LIVEKIT_URL=ws://localhost:7880
```

### 3.6. Cài Đặt LiveKit Server

#### Windows

```powershell
# Download LiveKit (nếu chưa có)
Invoke-WebRequest -Uri "https://github.com/livekit/livekit/releases/download/v1.5.3/livekit_1.5.3_windows_amd64.zip" -OutFile livekit.zip
Expand-Archive livekit.zip -DestinationPath .

# Chạy LiveKit server
.\livekit-server.exe --config livekit.yaml
```

#### Linux/macOS

```bash
# Download và install
curl -sSL https://get.livekit.io | bash

# Chạy server
livekit-server --config livekit.yaml
```

**LiveKit ports:**
| Port | Protocol | Mục đích |
|------|----------|----------|
| 7880 | WebSocket | Client connections |
| 7881 | HTTP | REST API |
| 7882 | TCP | TURN relay |

### 3.7. Cài Đặt AI Worker (Optional)

```bash
cd ai-worker

# Tạo virtual environment
python -m venv venv

# Kích hoạt environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# Chạy worker
python worker.py
```

---

## 4. Kiểm Thử Hệ Thống

### 4.1. Kiểm Tra Health Check

```bash
# Auth Server
curl http://localhost:8080/actuator/health

# Session Service
curl http://localhost:8081/actuator/health

# Incident Service
curl http://localhost:8082/actuator/health

# BFF Gateway
curl http://localhost:3001/health

# MinIO
curl http://localhost:9000/minio/health/live
```

**Kết quả mong đợi:** `{"status":"UP"}`

### 4.2. Kiểm Tra Database

```bash
# Kết nối PostgreSQL
docker exec -it postgres psql -U postgres

# Liệt kê databases
\l

# Kiểm tra tables trong identity_db
\c identity_db
\dt

# Kiểm tra dữ liệu users
SELECT id, email, role FROM users;
```

### 4.3. Kiểm Tra Frontend

1. Mở trình duyệt tại: `http://localhost:5173`
2. Đăng nhập với tài khoản test:
   - **Email:** `admin@example.com`
   - **Password:** `admin123`
3. Kiểm tra camera access (cho phép khi được hỏi)
4. Thử tạo phiên thi và bắt đầu

### 4.4. Kiểm Tra LiveKit

```bash
# Test LiveKit connection
node test-livekit.js
```

### 4.5. Xóa Dữ Liệu Test

```powershell
# Windows
.\cleanup_data.ps1

# Linux/macOS
./cleanup_data.sh
```

**Script này sẽ:**
- Flush Redis cache
- Truncate sessions, events tables
- Truncate incidents tables
- Clear MinIO evidence bucket
- Giữ lại users và exams

---

## 5. Troubleshooting

### 5.1. Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `ECONNREFUSED localhost:5432` | PostgreSQL chưa chạy | `docker-compose up -d postgres` |
| `Port 8080 already in use` | Service đang chạy | Kill process hoặc đổi port |
| `Camera not found` | Browser chặn camera | Cho phép camera trong browser settings |
| `CORS error` | BFF không chạy | Khởi động BFF gateway |
| `JWT expired` | Token hết hạn | Đăng nhập lại |

### 5.2. Logs

```bash
# Docker logs
docker-compose logs -f postgres
docker-compose logs -f minio

# Spring Boot logs
# Xem trong terminal chạy service

# Frontend logs
# Mở DevTools (F12) → Console tab
```

### 5.3. Reset Hoàn Toàn

```bash
# Dừng tất cả services
docker-compose down -v

# Xóa node_modules
rm -rf frontends/exam-ui/node_modules
rm -rf gateways/bff/node_modules

# Cài đặt lại từ đầu
docker-compose up -d
# ... tiếp tục các bước cài đặt
```

---

## 6. Liên Hệ Hỗ Trợ

- **GitHub Issues:** [Repository Issues](https://github.com/NguyenHonggHoang/exam-cheating-detection-v2/issues)
- **Email:** support@example.com

---

*Tài liệu cập nhật: 27/12/2024*
