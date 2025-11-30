import { TokenRepository } from '../../../../lib/token-repository';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, state, error } = req.query;

    if (error) {
        console.error('[OAuth2 Callback] Authorization error:', error);
        return res.redirect(`http://localhost:5173/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        console.error('[OAuth2 Callback] Missing code or state');
        return res.redirect('http://localhost:5173/login?error=missing_parameters');
    }

    const pkceDataCookie = req.cookies['pkce_data'];
    if (!pkceDataCookie) {
        console.error('[OAuth2 Callback] Missing PKCE data cookie');
        return res.redirect('http://localhost:5173/login?error=session_expired');
    }

    let pkceData;
    try {
        pkceData = JSON.parse(decodeURIComponent(pkceDataCookie));
    } catch (e) {
        console.error('[OAuth2 Callback] Invalid PKCE data:', e);
        return res.redirect('http://localhost:5173/login?error=invalid_session');
    }

    if (state !== pkceData.state) {
        console.error('[OAuth2 Callback] State mismatch - possible CSRF attack');
        return res.redirect('http://localhost:5173/login?error=state_mismatch');
    }

    try {
        const authServerUrl = process.env.AUTH_SERVER_URL || 'http://authorization-server:9000';
        const clientId = process.env.BFF_CLIENT_ID || 'exam-bff-client';
        const clientSecret = process.env.BFF_CLIENT_SECRET || 'exam-bff-secret';
        const bffCallbackUri = `${process.env.NEXTAUTH_URL || 'http://localhost:8080'}/api/auth/callback/exam-oidc`;

        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        console.log('[OAuth2 Callback] Exchanging code for tokens...');
        const tokenResponse = await fetch(`${authServerUrl}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: bffCallbackUri,
                code_verifier: pkceData.codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('[OAuth2 Callback] Token exchange failed:', tokenResponse.status, errorText);
            return res.redirect('http://localhost:5173/login?error=token_exchange_failed');
        }

        const tokens = await tokenResponse.json();
        console.log('[OAuth2 Callback] Token exchange successful');

        const userinfoResponse = await fetch(`${authServerUrl}/userinfo`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
            },
        });

        if (!userinfoResponse.ok) {
            console.error('[OAuth2 Callback] Userinfo fetch failed:', userinfoResponse.status);
            return res.redirect('http://localhost:5173/login?error=userinfo_failed');
        }

        const userProfile = await userinfoResponse.json();
        console.log('[OAuth2 Callback] User info retrieved:', userProfile.sub);

        if (tokens.refresh_token) {
            await TokenRepository.saveRefreshToken(userProfile.sub, tokens.refresh_token);
            console.log('[OAuth2 Callback] Refresh token stored for user:', userProfile.sub);
        }

        const sessionData = {
            user: {
                id: userProfile.sub,
                name: userProfile.preferred_username || userProfile.name,
                email: userProfile.email,
            },
            accessToken: tokens.access_token,
            accessTokenExpires: Date.now() + (tokens.expires_in * 1000),
            idToken: tokens.id_token,
        };

        const sessionJson = JSON.stringify(sessionData);
        const maxAge = tokens.expires_in || 3600;

        res.setHeader('Set-Cookie', [
            `bff_session=${encodeURIComponent(sessionJson)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
            `pkce_data=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        ]);

        console.log('[OAuth2 Callback] Session cookie set successfully');


        const callbackUrl = pkceData.callbackUrl || process.env.REACT_CLIENT_URL || 'http://localhost:5173';
        console.log('[OAuth2 Callback] Redirecting to:', callbackUrl);
        res.redirect(302, callbackUrl);

    } catch (error) {
        console.error('[OAuth2 Callback] Error during token exchange:', error);
        return res.redirect('http://localhost:5173/login?error=server_error');
    }
}
