-- ============================================================================
-- Migration: Add PASSWORD (ROPC) grant to exam-bff-client
-- Purpose  : Allow load test scripts to authenticate programmatically
--            without browser OAuth2 flow (Resource Owner Password Credentials)
-- When     : Run once after deploying updated auth-server with ROPC grant
-- How      : Delete the old client record → auth-server seeder will re-create
--            it with the new grant type on next startup
-- ============================================================================

-- Step 1: Remove stale authorizations referencing the old client
-- (safe: old tokens will be invalidated, users must re-login once)
DELETE FROM oauth2_authorization
WHERE registered_client_id IN (
    SELECT id FROM oauth2_registered_client
    WHERE client_id = 'exam-bff-client'
);

-- Step 2: Remove consent records for old client
DELETE FROM oauth2_authorization_consent
WHERE registered_client_id IN (
    SELECT id FROM oauth2_registered_client
    WHERE client_id = 'exam-bff-client'
);

-- Step 3: Delete the old registered client record
-- The auth-server seeder will re-create it with PASSWORD grant on next startup
DELETE FROM oauth2_registered_client
WHERE client_id = 'exam-bff-client';

-- ============================================================================
-- After running this script:
-- 1. Restart auth-server pod: kubectl rollout restart deployment/auth-server -n exam-platform
-- 2. The seeder will re-seed exam-bff-client with:
--    - authorization_code  ✅ (existing)
--    - refresh_token        ✅ (existing)
--    - password             ✅ (NEW - for load test ROPC login)
-- ============================================================================
