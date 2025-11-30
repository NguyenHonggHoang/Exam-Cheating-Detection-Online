import crypto from 'crypto';

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate random state for CSRF protection
 */
function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fromClient = req.query && req.query.callbackUrl;
  const headerOrigin = req.headers && (req.headers.origin || req.headers.referer);
  const reactClientUrl = fromClient || headerOrigin || process.env.REACT_CLIENT_URL || 'http://localhost:5173';

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  const pkceData = JSON.stringify({
    codeVerifier,
    state,
    callbackUrl: reactClientUrl
  });
  res.setHeader('Set-Cookie', `pkce_data=${encodeURIComponent(pkceData)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);

  const authServerExternalUrl = process.env.AUTH_SERVER_EXTERNAL_URL || 'http://localhost:9000';
  const clientId = process.env.BFF_CLIENT_ID || 'exam-bff-client';
  const bffCallbackUri = `${process.env.NEXTAUTH_URL || 'http://localhost:8080'}/api/auth/callback/exam-oidc`;
  const scope = 'openid profile exam.read exam.write';

  const authUrl = `${authServerExternalUrl}/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(bffCallbackUri)}&` +
    `state=${state}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;

  console.log('[Login] Redirecting directly to Authorization Server:', authUrl);

  res.redirect(302, authUrl);
}
