import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth-options";

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authServerUrl = process.env.AUTH_SERVER_URL || 'http://authorization-server:9000';
  let accessToken = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  } else {
    const session = await getServerSession(req, res, authOptions);
    if (session && session.accessToken) {
      accessToken = session.accessToken;
    } else {
      const sessionCookie = req.cookies['bff_session'];
      if (sessionCookie) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(sessionCookie));
          if (sessionData && sessionData.accessToken) {
            accessToken = sessionData.accessToken;
            console.log('BFF /api/auth/userinfo: using token from custom session cookie');
          }
        } catch (e) {
          console.error('BFF /api/auth/userinfo: failed to parse custom session cookie:', e);
        }
      }
    }
  }

  if (!accessToken) {
    console.warn('BFF /api/auth/userinfo: no token found in header or session');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const masked = accessToken && accessToken.length > 14
      ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 6)}`
      : accessToken;
    console.log(`BFF /api/auth/userinfo: using token=${masked}`);

    let jwtAuthorities = null;
    try {
      const parts = accessToken.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        console.log('BFF /api/auth/userinfo: access token is JWT, claims=', {
          sub: payload.sub,
          aud: payload.aud,
          iss: payload.iss,
          exp: payload.exp,
          iat: payload.iat,
          scope: payload.scope,
          authorities: payload.authorities,
        });
        if (payload.authorities && Array.isArray(payload.authorities)) {
          jwtAuthorities = payload.authorities;
        }
      } else {
        console.log('BFF /api/auth/userinfo: access token is opaque (not JWT) length=', accessToken.length);
      }
    } catch (e) {
      console.warn('BFF /api/auth/userinfo: failed to parse token payload for diagnostics', e);
    }

    const response = await fetch(`${authServerUrl}/userinfo`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let text;
      try {
        text = await response.text();
      } catch (e) {
        text = `<unable to read body: ${e}>`;
      }
      console.error(`BFF /api/auth/userinfo: upstream returned ${response.status}: ${text}`);

      if (response.status === 401) {
        try {
          const introspectUrl = process.env.AUTH_SERVER_INTROSPECT_URL || `${authServerUrl}/oauth2/introspect`;
          const clientId = process.env.BFF_CLIENT_ID || process.env.OAUTH2_CLIENT_ID || 'react-test-client';
          const clientSecret = process.env.BFF_CLIENT_SECRET || process.env.OAUTH2_CLIENT_SECRET;

          if (clientSecret) {
            const params = new URLSearchParams();
            params.append('token', accessToken);
            const resp2 = await fetch(introspectUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
              },
              body: params.toString(),
            });

            const introspectText = await resp2.text().catch(() => '<no-body>');
            console.error(`BFF /api/auth/userinfo: introspection ${resp2.status}: ${introspectText}`);
          } else {
            console.warn('BFF /api/auth/userinfo: BFF client secret not configured, skipping introspection');
          }
        } catch (ie) {
          console.error('BFF /api/auth/userinfo: introspection failed', ie);
        }
      }
      try {
        const parsed = JSON.parse(text);
        return res.status(response.status).json(parsed);
      } catch (e) {
        return res.status(response.status).json({ error: text });
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('BFF /api/auth/userinfo: failed to parse upstream JSON:', e);
      return res.status(502).json({ error: 'Invalid JSON from auth server' });
    }

    if (jwtAuthorities && (!data.authorities || data.authorities.length === 0)) {
      data.authorities = jwtAuthorities;
      console.log('BFF /api/auth/userinfo: merged authorities from JWT into profile:', jwtAuthorities);
    }

    console.log('BFF /api/auth/userinfo: upstream returned OK, profile=', data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('BFF /api/auth/userinfo: unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
