# run-load-test-k8s.ps1
# Triggers the Full Stack Load Test INSIDE Kubernetes cluster.
#
# Traffic flow: Test Pod → BFF (Next.js :8080) → Backend Services
# Authentication: OIDC Resource Owner Password Credentials via auth-server
#
# USAGE:
#   ./run-load-test-k8s.ps1
#   ./run-load-test-k8s.ps1 -Users 500 -QuestionsDuration 30 -IncidentsPerUser 10
#   ./run-load-test-k8s.ps1 -Users 1000 -SkipRegister   # if users pre-exist
#
# VIEW LOGS (real-time):
#   kubectl logs -f job/load-test-non-policy -n exam-platform

param(
    [int]    $Users             = 1000,
    [string] $ExamId            = "e1000000-0000-0000-0000-000000000001",
    [int]    $QuestionsDuration = 20,
    [int]    $IncidentsPerUser  = 20,
    [string] $BffUrl            = "http://bff-gateway:8080",
    [string] $AuthUrl           = "http://authorization-server:9000",
    [switch] $SkipRegister      = $false
)

$Namespace   = "exam-platform"
$JobName     = "load-test-non-policy"
$ConfigMap   = "load-test-script-config"
$JobManifest = "k8s/apps/load-test-job-non-policy.yaml"
$TotalFlood  = $Users * $IncidentsPerUser

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host "  🚀  FULL STACK LOAD TEST — $Users users via BFF" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Flow: Test Pod → BFF ($BffUrl) → Backend Services" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Phase 1: Register    POST {BFF}/api/register              - $Users users" -ForegroundColor White
Write-Host "  Phase 2: Login       POST {AUTH}/oauth2/token  [ROPC]     - $Users tokens" -ForegroundColor White
Write-Host "  Phase 3: Start Exam  POST {BFF}/api/proxy/mock-exam/start - $Users sessions" -ForegroundColor White
Write-Host "  Phase 4: STRESS      GET  {BFF}/api/proxy/mock-exam/{id}/questions" -ForegroundColor Green
Write-Host "           → $Users users × 10 req/s × $QuestionsDuration s" -ForegroundColor Green
Write-Host "  Phase 5: Submit      POST {BFF}/api/proxy/mock-exam/submit - $Users submits" -ForegroundColor White
Write-Host "  Phase 6: FLOOD       POST {BFF}/api/proxy/incident/client-event" -ForegroundColor Green
Write-Host "           → $Users × $IncidentsPerUser = $TotalFlood concurrent POSTs" -ForegroundColor Green
Write-Host ""

# ── Check manifest ────────────────────────────────────────────────────────────
if (-not (Test-Path $JobManifest)) {
    Write-Error "Manifest not found: $JobManifest"
    exit 1
}

# ── Step 1: Clean up previous run ─────────────────────────────────────────────
Write-Host "1. Cleaning up previous load test job..." -ForegroundColor Cyan
kubectl delete job $JobName -n $Namespace --ignore-not-found=true 2>$null
kubectl delete configmap $ConfigMap -n $Namespace --ignore-not-found=true 2>$null
Start-Sleep -Seconds 2

# ── Step 2: Configure and Apply Manifest ──────────────────────────────────────
Write-Host "2. Configuring and Deploying Job..." -ForegroundColor Cyan

# Set output encoding to UTF-8 for piping to native commands
$OutputEncoding = [System.Text.UTF8Encoding]::new()

# Read original manifest
$yaml = Get-Content $JobManifest -Raw -Encoding UTF8

# Define variables map
$envMap = @{
    "LT_USERS"              = $Users
    "LT_EXAM_ID"            = $ExamId
    "LT_QUESTIONS_DURATION" = $QuestionsDuration
    "LT_INCIDENTS_PER_USER" = $IncidentsPerUser
    "LT_BFF_URL"            = $BffUrl
    "LT_AUTH_URL"           = $AuthUrl
    "LT_SKIP_REGISTER"      = $(if ($SkipRegister) { "true" } else { "false" })
}

# Replace env values in yaml content
foreach ($key in $envMap.Keys) {
    $val = $envMap[$key]
    $pattern = "(-\s+name:\s+$key\s*[\r\n]+\s+value:\s+)" + '"[^"]*"'
    $yaml = $yaml -replace $pattern, ("`${1}`"$val`"")
}

# Write to a temporary file using UTF8 (No BOM) to prevent encoding/control char issues in kubectl pipeline
$tempFile = "k8s/apps/temp-non-policy-job.yaml"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempFile, $yaml, $utf8NoBom)
kubectl apply -n $Namespace -f $tempFile
if (Test-Path $tempFile) { Remove-Item $tempFile -Force }

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  ✅ Load Test Job spawned! Monitor with:" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Stream real-time logs:" -ForegroundColor Cyan
Write-Host "    kubectl logs -f job/$JobName -n $Namespace" -ForegroundColor White
Write-Host ""
Write-Host "  Check pod status:" -ForegroundColor Cyan
Write-Host "    kubectl get pods -n $Namespace -l app=$JobName" -ForegroundColor White
Write-Host ""
Write-Host "  Get final report after completion:" -ForegroundColor Cyan
Write-Host "    kubectl logs job/$JobName -n $Namespace" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
