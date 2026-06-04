# run-load-test-policy-k8s.ps1
# Triggers the Policy-Enabled Full Stack Load Test INSIDE Kubernetes cluster.
# Run this with ALL security policies ACTIVE (Istio mTLS, Cilium, JWT).
#
# Prerequisites:
#   1. exam-bff-client must support authorization_code and the registered
#      redirect URI used by the PKCE login flow.
#   2. Do NOT run disable-security-rules.ps1 — policies must be ACTIVE
#
# USAGE:
#   ./run-load-test-policy-k8s.ps1
#   ./run-load-test-policy-k8s.ps1 -Users 200 -QuestionsDuration 30
#
# VIEW LOGS:
#   kubectl logs -f job/load-test-policy -n exam-platform

param(
    [int]    $Users             = 200,
    [string] $ExamId            = "e1000000-0000-0000-0000-000000000001",
    [int]    $QuestionsDuration = 20,
    [int]    $IncidentsPerUser  = 20,
    [string] $BffUrl            = "http://istio-ingressgateway.istio-system.svc.cluster.local",
    [string] $AuthUrl           = "http://authorization-server:9000",
    [switch] $SkipRegister      = $false,
    [switch] $SkipPolicyChecks  = $false
)

$Namespace   = "exam-platform"
$JobName     = "load-test-policy"
$ConfigMap   = "load-test-policy-script-config"
$JobManifest = "k8s/apps/load-test-job-policy.yaml"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Magenta
Write-Host "  🔐  POLICY-ENABLED FULL STACK LOAD TEST — $Users users" -ForegroundColor Magenta
Write-Host "======================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  ⚠️  Security policies MUST be ACTIVE for this test" -ForegroundColor Yellow
Write-Host "  ⚠️  Do NOT run disable-security-rules.ps1 before this test" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Flow: Test Pod → BFF ($BffUrl) → Backend Services" -ForegroundColor Cyan
Write-Host "        JWT validated at BFF + each microservice (Istio mTLS)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Phase 1: Register      POST {BFF}/api/register" -ForegroundColor White
Write-Host "  Phase 2: Login         OIDC Authorization Code + PKCE" -ForegroundColor White
Write-Host "  Phase 3: Verify Token  GET  {AUTH}/userinfo" -ForegroundColor White
Write-Host "  Phase 4: Start Exam    POST {BFF}/api/proxy/mock-exam/start [JWT]" -ForegroundColor White
Write-Host "  Phase 5: STRESS        GET  {BFF}/api/proxy/mock-exam/{id}/questions [JWT]" -ForegroundColor Green
Write-Host "           → $Users users × 10 req/s × ${QuestionsDuration}s" -ForegroundColor Green
Write-Host "  Phase 6: Submit        POST {BFF}/api/proxy/mock-exam/submit [JWT]" -ForegroundColor White
Write-Host "  Phase 7: FLOOD         POST {BFF}/api/proxy/incident/client-event [JWT]" -ForegroundColor Green
Write-Host "           → $Users × $IncidentsPerUser = $($Users * $IncidentsPerUser) concurrent POSTs" -ForegroundColor Green
Write-Host ""
Write-Host "  + Security Policy Checks: 401/403/429 probes" -ForegroundColor Cyan
Write-Host ""

# ── Prerequisite check ────────────────────────────────────────────────────────
Write-Host "Checking if exam-bff-client has PKCE authorization_code config in DB..." -ForegroundColor Cyan
$postgresPod = kubectl get pod -l app=postgres -n $Namespace -o jsonpath='{.items[0].metadata.name}' 2>$null
if ($postgresPod) {
    $grantCheck = kubectl exec $postgresPod -n $Namespace -- env PGPASSWORD=postgres `
        psql -h localhost -U postgres identity_db -t -c "SELECT authorization_grant_types || '|' || redirect_uris FROM oauth2_registered_client WHERE client_id='exam-bff-client'" 2>$null
    if (($grantCheck -match "authorization_code") -and ($grantCheck -match "http://localhost:8080/login/oauth2/code/exam-oidc")) {
        Write-Host "  ✅ PKCE authorization_code config confirmed for exam-bff-client" -ForegroundColor Green
    } else {
        Write-Host "  ❌ PKCE authorization_code config not found or redirect URI mismatch!" -ForegroundColor Red
        Write-Host "     Required redirect URI: http://localhost:8080/login/oauth2/code/exam-oidc" -ForegroundColor Yellow
        Write-Host "     Fix oauth2_registered_client, restart deployment/authorization-server, then retry." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  ⚠️  Could not find postgres pod to check grant" -ForegroundColor Yellow
}

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
    "LT_SKIP_POLICY_CHECKS" = $(if ($SkipPolicyChecks) { "true" } else { "false" })
}

# Replace env values in yaml content
foreach ($key in $envMap.Keys) {
    $val = $envMap[$key]
    $pattern = "(-\s+name:\s+$key\s*[\r\n]+\s+value:\s+)" + '"[^"]*"'
    $yaml = $yaml -replace $pattern, ("`${1}`"$val`"")
}

# Write to a temporary file using UTF8 (No BOM) to prevent encoding/control char issues in kubectl pipeline
$tempFile = "k8s/apps/temp-policy-job.yaml"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempFile, $yaml, $utf8NoBom)
kubectl apply -n $Namespace -f $tempFile
if (Test-Path $tempFile) { Remove-Item $tempFile -Force }

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  ✅ Policy Load Test Job spawned!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Stream real-time logs:" -ForegroundColor Cyan
Write-Host "    kubectl logs -f job/$JobName -n $Namespace" -ForegroundColor White
Write-Host ""
Write-Host "  Compare results with non-policy test to measure security overhead:" -ForegroundColor Cyan
Write-Host "    kubectl logs job/load-test-non-policy -n $Namespace  (non-policy)" -ForegroundColor Gray
Write-Host "    kubectl logs job/$JobName -n $Namespace              (with policy)" -ForegroundColor White
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
