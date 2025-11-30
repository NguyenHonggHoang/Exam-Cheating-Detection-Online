import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth-options';
import { TokenRepository } from '../../../lib/token-repository';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let sessionData = null;
    let userId = null;
    let idToken = null;

    const sessionCookie = req.cookies['bff_session'];
    if (sessionCookie) {
      try {
        sessionData = JSON.parse(decodeURIComponent(sessionCookie));
        userId = sessionData.user?.id;
        idToken = sessionData.idToken;
      } catch (e) {
        console.error('[Logout] Failed to parse bff_session cookie:', e);
      }
    }

    if (!sessionData) {
      const session = await getServerSession(req, res, authOptions);
      if (session) {
        userId = session.user?.id;
        idToken = session.idToken;
      }
    }

    console.log('[Logout] User ID:', userId, 'Has ID Token:', !!idToken);

    if (userId) {
      try {
        console.log(`[Logout] Revoking tokens for user ${userId}`);
        await TokenRepository.deleteRefreshToken(userId);
      } catch (dbError) {
        console.warn('[Logout] Failed to delete refresh token from DB:', dbError);
      }
    }

    const cookiesToClear = [
      'bff_session',
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.session-token',
    ];

    const expiredCookies = cookiesToClear.map(name =>
      `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
    );

    res.setHeader('Set-Cookie', expiredCookies);

    const reactClientUrl = process.env.REACT_CLIENT_URL || 'http://localhost:5173';
    const authServerUrl = process.env.AUTH_SERVER_ISSUER || 'http://localhost:9000';
    const postLogoutRedirectUri = `${reactClientUrl}/login`;

    const params = new URLSearchParams();
    params.append('post_logout_redirect_uri', postLogoutRedirectUri);

    if (idToken) {
      params.append('id_token_hint', idToken);
    }

    const authServerLogoutUrl = `${authServerUrl}/connect/logout?${params.toString()}`;

    console.log(`[Logout] Redirecting to: ${authServerLogoutUrl}`);

    return res.status(200).json({
      success: true,
      redirectUrl: authServerLogoutUrl
    });

  } catch (error) {
    console.error('[Logout] Error during logout:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
}