# Exam Cheating Detection System v2

A microservices-based exam proctoring system with real-time cheating detection.

## Architecture

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
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│              PostgreSQL (4 databases)                │
│  identity_db │ session_db │ incident_db │ bff_db     │
└──────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
             ┌───────────┐  ┌───────────┐
             │  Kafka    │  │ Debezium  │
             │ (CDC Bus) │◀─│ (Connect) │
             └───────────┘  └───────────┘
```

## Services

| Service | Port | Database | Description |
|---------|------|----------|-------------|
| auth-server | 9000 | identity_db | OAuth2 Authorization Server |
| session-service | 8081 | session_db | Exam session management |
| incident-service | 8082 | incident_db | Cheating incident tracking |
| user-service | 8100 | identity_db | User management |
| admin-service | 8200 | - | Admin dashboard API |
| bff-gateway | 3001 | bff_db | Backend-for-Frontend |
| exam-ui | 5173 | - | React frontend |

## Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d postgres redis kafka zookeeper kafka-connect minio rabbitmq
```

### 2. Wait for Services

```bash
# Wait for Kafka Connect to be ready (check http://localhost:8083)
```

### 3. Register CDC Connectors

**On Windows (PowerShell):**
```powershell
./register-connectors.ps1
```

**On Linux/macOS:**
```bash
./register-connectors.sh
```

### 4. Start All Services

```bash
docker-compose up -d
```

### 5. Access UI

- Frontend: http://localhost:5173
- Auth Server: http://localhost:9000
- Session Service: http://localhost:8081
- Incident Service: http://localhost:8082

## CDC (Change Data Capture) Setup

This system uses Debezium to sync data between microservices via Kafka.

### CDC Flow

```
identity_db.users ──▶ Debezium ──▶ Kafka ──▶ session-service.user_shadow
                                         └──▶ incident-service.user_shadow

session_db.sessions ──▶ Debezium ──▶ Kafka ──▶ incident-service.session_shadow
```

### Debezium Connectors

| Connector | Source DB | Tables | Kafka Topic Prefix |
|-----------|-----------|--------|-------------------|
| identity-db-connector | identity_db | users, roles | exam-identity.public.* |
| session-db-connector | session_db | sessions, exams, events | exam-session.public.* |
| incident-db-connector | incident_db | incidents, reviews | exam-incident.public.* |

### Shadow Tables

Shadow tables are local caches of data from other services:

- `session-service.user_shadow` - Cache of users from identity_db
- `incident-service.session_shadow` - Cache of sessions from session_db
- `incident-service.user_shadow` - Cache of users from identity_db

### Monitoring CDC

```bash
# List connectors
curl http://localhost:8083/connectors

# Check connector status
curl http://localhost:8083/connectors/identity-db-connector/status

# View Kafka topics
docker exec exam-kafka kafka-topics --list --bootstrap-server localhost:29092
```

## Development

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Java 17+
- Maven 3.8+

### Running Frontend Locally

```bash
cd frontends/exam-ui
npm install
npm run dev
```

### Building Services

```bash
# Session Service (Maven)
cd services/session-service
./mvnw clean package -DskipTests

# Auth Server (Gradle)
cd services/auth-server
./gradlew build -x test
```

## Environment Variables

### Session Service

| Variable | Default | Description |
|----------|---------|-------------|
| SPRING_KAFKA_BOOTSTRAP_SERVERS | localhost:9092 | Kafka broker |
| SPRING_DATASOURCE_URL | jdbc:postgresql://localhost:5432/session_db | Database URL |
| LIVEKIT_HOST | ws://localhost:7880 | LiveKit server |

### Incident Service

| Variable | Default | Description |
|----------|---------|-------------|
| SPRING_KAFKA_BOOTSTRAP_SERVERS | localhost:9092 | Kafka broker |
| SPRING_DATASOURCE_URL | jdbc:postgresql://localhost:5432/incident_db | Database URL |

## Troubleshooting

### Kafka Connect not starting

```bash
# Check Kafka Connect logs
docker logs exam-kafka-connect

# Verify Kafka is running
docker exec exam-kafka kafka-broker-api-versions --bootstrap-server localhost:29092
```

### CDC not syncing

1. Check connector status:
```bash
curl http://localhost:8083/connectors/identity-db-connector/status | jq .
```

2. Check Kafka topic has messages:
```bash
docker exec exam-kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic exam-identity.public.users \
  --from-beginning \
  --max-messages 5
```

3. Check service logs:
```bash
docker logs exam-session-service 2>&1 | grep -i "cdc\|kafka"
docker logs exam-incident-service 2>&1 | grep -i "cdc\|kafka"
```

## License

MIT
