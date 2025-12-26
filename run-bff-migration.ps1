# Script to run BFF session timeout migration
# This adds last_activity_at and session_expires_at columns to refresh_tokens table

Write-Host "Running BFF session timeout migration..." -ForegroundColor Cyan

# Check if Docker container is running
$containerRunning = docker ps --filter "name=exam-postgres" --format "{{.Names}}" | Select-String "exam-postgres"
if (-not $containerRunning) {
    Write-Error "PostgreSQL container 'exam-postgres' is not running. Please start it first."
    exit 1
}

# Run migration
Write-Host "Applying migration to bff_db..." -ForegroundColor Yellow
Get-Content infra/docker/postgres/migrations/run-bff-session-timeout-migration.sql | docker exec -i exam-postgres psql -U postgres -d bff_db

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host "Verifying schema..." -ForegroundColor Yellow
    docker exec -i exam-postgres psql -U postgres -d bff_db -c "\d refresh_tokens"
} else {
    Write-Error "Migration failed with exit code $LASTEXITCODE"
    exit 1
}

