Write-Host "Cleaning up Exam Detection System Data..."

# Check if Docker is running
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running or not accessible. Please start Docker Desktop."
    exit 1
}

# 1. Flush Redis
Write-Host "Flushing Redis..."
docker exec exam-redis redis-cli FLUSHALL

# 2. Clear Session DB
Write-Host "Clearing Session DB (Sessions, Events, Snapshots)..."
# Note: We keep 'exams' and 'user_shadow' to allow immediate testing without re-seeding
docker exec -i exam-postgres psql -U postgres -d session_db -c "TRUNCATE TABLE events, media_snapshots, sessions CASCADE;"

# 3. Clear Incident DB
Write-Host "Clearing Incident DB (Incidents, Reviews)..."
docker exec -i exam-postgres psql -U postgres -d incident_db -c "TRUNCATE TABLE reviews, incidents, session_shadow CASCADE;"

# 4. Clear MinIO Evidence
Write-Host "Clearing MinIO Evidence Bucket..."
# Remove contents of exam-evidence bucket
docker exec exam-minio sh -c "rm -rf /data/exam-evidence/*"

Write-Host "---------------------------------------------------"
Write-Host "Cleanup Complete! You can now start a fresh exam session."
Write-Host "Note: Users and Exams definitions were PRESERVED."
