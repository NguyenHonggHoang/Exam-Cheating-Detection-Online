# Register Debezium Postgres Connectors for CDC
# This script sends the connector configurations to Kafka Connect REST API
# Uses connector config files from infra/debezium/

$ErrorActionPreference = "Stop"

$KAFKA_CONNECT_URL = "http://localhost:8083"
$CONNECTOR_DIR = "./infra/debezium"
$MAX_RETRIES = 60
$RETRY_DELAY = 2

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Debezium Connector Registration Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

function Register-Connector {
    param([string]$ConnectorFile)

    $connectorContent = Get-Content $ConnectorFile -Raw | ConvertFrom-Json
    $connectorName = $connectorContent.name

    Write-Host ""
    Write-Host "Registering: $connectorName" -ForegroundColor Yellow
    Write-Host "   File: $ConnectorFile"

    # Check if connector already exists
    try {
        $null = Invoke-RestMethod -Uri "$KAFKA_CONNECT_URL/connectors/$connectorName" -Method Get -ErrorAction SilentlyContinue
        Write-Host "   Connector already exists, deleting..." -ForegroundColor Yellow
        Invoke-RestMethod -Uri "$KAFKA_CONNECT_URL/connectors/$connectorName" -Method Delete | Out-Null
        Start-Sleep -Seconds 2
    } catch {
        # Connector doesn't exist, which is fine
    }

    # Register connector
    try {
        $body = Get-Content $ConnectorFile -Raw
        Invoke-RestMethod -Uri "$KAFKA_CONNECT_URL/connectors" -Method Post -Body $body -ContentType "application/json" | Out-Null
        Write-Host "   Registered successfully" -ForegroundColor Green
    } catch {
        Write-Host "   Failed to register connector: $_" -ForegroundColor Red
        throw
    }
}

# Wait for Kafka Connect to be ready
Write-Host ""
Write-Host "Waiting for Kafka Connect to be ready..." -ForegroundColor Yellow

$ready = $false
for ($i = 1; $i -le $MAX_RETRIES; $i++) {
    try {
        $null = Invoke-RestMethod -Uri "$KAFKA_CONNECT_URL/" -Method Get -ErrorAction Stop
        Write-Host "Kafka Connect is ready!" -ForegroundColor Green
        $ready = $true
        break
    } catch {
        Write-Host "   Attempt $i/$MAX_RETRIES - retrying in ${RETRY_DELAY}s..."
        Start-Sleep -Seconds $RETRY_DELAY
    }
}

if (-not $ready) {
    Write-Host "Kafka Connect failed to start after $MAX_RETRIES attempts" -ForegroundColor Red
    exit 1
}

# Wait additional time for Kafka Connect to stabilize
Write-Host "Waiting for Kafka Connect to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Register each connector
Write-Host ""
Write-Host "Registering Debezium connectors..." -ForegroundColor Cyan

$connectors = @(
    "$CONNECTOR_DIR/identity-connector.json",
    "$CONNECTOR_DIR/session-connector.json",
    "$CONNECTOR_DIR/incident-connector.json"
)

foreach ($connector in $connectors) {
    if (Test-Path $connector) {
        Register-Connector -ConnectorFile $connector
    } else {
        Write-Host "Connector file not found: $connector" -ForegroundColor Yellow
    }
}

# List all registered connectors
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Current connectors status:" -ForegroundColor Cyan
try {
    $connectorList = Invoke-RestMethod -Uri "$KAFKA_CONNECT_URL/connectors" -Method Get
    $connectorList | ConvertTo-Json | Write-Host
} catch {
    Write-Host "Could not fetch connector list: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Connector registration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Topic naming convention:" -ForegroundColor Yellow
Write-Host "   - exam-identity.public.users"
Write-Host "   - exam-session.public.sessions"
Write-Host "   - exam-incident.public.incidents"
Write-Host ""
Write-Host "To check connector status:" -ForegroundColor Yellow
Write-Host "   curl http://localhost:8083/connectors/<name>/status"
