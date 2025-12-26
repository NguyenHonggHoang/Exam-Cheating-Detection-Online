# Local Development Setup for LiveKit + Egress

## Architecture
When developing locally, you have two options:

### Option 1: All in Docker (Recommended for full testing)
```bash
docker compose up redis minio livekit livekit-egress
```
This uses `livekit.yaml` and `egress.yaml` with Docker networking.

### Option 2: LiveKit Local + Egress Docker (For debugging LiveKit)
Run LiveKit on your machine, Egress in Docker.

## Setup for Option 2

### Prerequisites
- Redis must be running and accessible on localhost:6379
- MinIO must be running and accessible on localhost:9002
- LiveKit server binary (livekit-server.exe for Windows)

### Step 1: Start Infrastructure
```bash
# Start Redis and MinIO
docker compose up redis minio -d

# Verify Redis is accessible
redis-cli ping  # Should return PONG
```

### Step 2: Start LiveKit Server Locally
```bash
# Windows
livekit-server.exe --config livekit-local.yaml

# Linux/Mac
./livekit-server --config livekit-local.yaml
```

### Step 3: Start Egress Container
The Egress container needs to connect to:
- LiveKit on host: `ws://host.docker.internal:7880`
- Redis on host: `host.docker.internal:6379`
- MinIO (Docker): `minio:9000` or `host.docker.internal:9002`

```bash
# PowerShell (Windows)
docker run --rm `
  -e EGRESS_CONFIG_FILE=/etc/egress.yaml `
  -v ${PWD}/egress-local.yaml:/etc/egress.yaml:ro `
  --add-host=host.docker.internal:host-gateway `
  --network exam-cheating-detection-v2_default `
  --cap-add SYS_ADMIN `
  livekit/egress:latest

# Bash (Linux/Mac)
docker run --rm \
  -e EGRESS_CONFIG_FILE=/etc/egress.yaml \
  -v $(pwd)/egress-local.yaml:/etc/egress.yaml:ro \
  --add-host=host.docker.internal:host-gateway \
  --network exam-cheating-detection-v2_default \
  --cap-add SYS_ADMIN \
  livekit/egress:latest
```

### Step 4: Start Session Service
Update your environment or `application.yml`:
```
LIVEKIT_HOST=ws://localhost:7880
MINIO_ENDPOINT=http://localhost:9000
MINIO_EXTERNAL_ENDPOINT=http://localhost:9002
```

Then run the Spring Boot application.

### Step 5: Start Frontend
```bash
cd frontends/exam-ui
npm run dev
```

## Troubleshooting

### Egress 500 Error
1. **Check Redis connectivity**: Egress and LiveKit must use the same Redis instance
   - Local LiveKit uses `localhost:6379` 
   - Docker Egress must use `host.docker.internal:6379`
   
2. **Check Docker network**: Egress needs to be on the same network as MinIO
   ```bash
   docker network ls | grep exam
   ```

3. **Check logs**:
   ```bash
   # Egress logs
   docker logs -f exam-livekit-egress
   
   # Session service logs
   # Look for "Failed to start recording" errors
   ```

### Video Clips Have Frozen Frames
This was a bug in CircularVideoBuffer where WebM chunks without keyframes were concatenated.
**Fixed in commit**: Use segment rotation approach - each 5s segment is self-contained.

### Room Does Not Exist Error
The Egress API returns null if:
- Room doesn't exist
- No participants have joined
- Track ID is invalid

Ensure the candidate has joined the room before triggering recording.

## Configuration Files

| File | Purpose | Redis | LiveKit URL |
|------|---------|-------|-------------|
| `livekit.yaml` | Docker LiveKit | `redis:6379` | N/A (is server) |
| `livekit-local.yaml` | Local LiveKit | `localhost:6379` | N/A (is server) |
| `egress.yaml` | Docker Egress (Docker LiveKit) | `redis:6379` | `ws://livekit:7880` |
| `egress-local.yaml` | Docker Egress (Local LiveKit) | `host.docker.internal:6379` | `ws://host.docker.internal:7880` |
