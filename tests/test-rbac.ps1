# Script to test the incident-service RBAC

# Get PROCTOR token via Client Credentials for incident-service
$proctorTokenResponse = curl.exe -s -X POST http://localhost:9000/oauth2/token `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -u "incident-service:incident-secret" `
  -d "grant_type=client_credentials"

$proctorToken = ($proctorTokenResponse | ConvertFrom-Json).access_token

Write-Host "PROCTOR TOKEN:" -ForegroundColor Green
Write-Host $proctorToken

# Call incident-service with PROCTOR token (Should return 200)
Write-Host "Testing PROCTOR access to /api/incidents..." -ForegroundColor Cyan
$proctorResp = curl.exe -s -i -w "\nHTTP_STATUS:%{http_code}\n" -X GET http://localhost:8082/api/incidents `
  -H "Authorization: Bearer $proctorToken"

Write-Host $proctorResp

# Get STUDENT token 
# Wait, do we have a default user? We can use user1 / password
$studentTokenResponse = curl.exe -s -X POST http://localhost:9000/oauth2/token `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -u "bff-client:bff-secret" `
  -d "grant_type=password&username=user1&password=password"

$studentToken = ($studentTokenResponse | ConvertFrom-Json).access_token

if ($studentToken) {
    Write-Host "STUDENT TOKEN:" -ForegroundColor Green
    Write-Host $studentToken

    # Call incident-service with STUDENT token without sessionId (Should return 200 but only their incidents, or empty if none)
    Write-Host "Testing STUDENT access to /api/incidents (no sessionId)..." -ForegroundColor Cyan
    $studentResp = curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET http://localhost:8082/api/incidents `
      -H "Authorization: Bearer $studentToken"

    Write-Host $studentResp

    # Call incident-service with STUDENT token for an arbitrary sessionId (Should return 403 Forbidden)
    $fakeSessionId = "00000000-0000-0000-0000-000000000000"
    Write-Host "Testing STUDENT access to /api/incidents?sessionId=$fakeSessionId..." -ForegroundColor Cyan
    $studentFakeResp = curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:8082/api/incidents?sessionId=$fakeSessionId" `
      -H "Authorization: Bearer $studentToken"

    Write-Host $studentFakeResp
} else {
    Write-Host "Failed to get STUDENT token (maybe user doesn't exist?)" -ForegroundColor Red
}

