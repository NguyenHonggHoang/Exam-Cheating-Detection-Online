import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth-options';

const userServiceUrl = process.env.UPSTREAM_API_BASE_URL ?? 'http://localhost:8100';
const sessionServiceUrl = process.env.SESSION_SERVICE_URL ?? 'http://localhost:8081';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  let accessToken = null;

  const session = await getServerSession(req, res, authOptions);

  if (session?.error === "RefreshAccessTokenError" || session?.error === "SessionInvalidated") {
    console.warn('[Proxy] Session expired or refresh failed. Logging out.');
    res.setHeader('Set-Cookie', [
      'next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'next-auth.csrf-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'bff_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ]);
    return res.status(401).json({ error: 'session_expired' });
  }

  if (session?.accessToken) {
    accessToken = session.accessToken;
  } else {
    const sessionCookie = req.cookies['bff_session'];
    if (sessionCookie) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionCookie));
        if (sessionData?.accessToken) {
          accessToken = sessionData.accessToken;
        }
      } catch (e) {
        console.error('[Proxy] Failed to parse custom session cookie:', e);
      }
    }
  }

  if (!accessToken) {
    console.warn('[Proxy] No access token found in session');
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const pathParts = req.query.path || [];
  const targetPath = pathParts.join('/');

  let upstreamUrl = userServiceUrl;
  const firstSegment = pathParts[0];

  if (['sessions', 'ingest', 'incidents', 'mock-exam'].includes(firstSegment)) {
    upstreamUrl = sessionServiceUrl;
  } else if (firstSegment === 'api' && ['exams', 'sessions', 'mock-exam', 'incidents', 'ingest'].includes(pathParts[1])) {
    upstreamUrl = sessionServiceUrl;
  } else if (firstSegment === 'admin' && ['exams', 'stats'].includes(pathParts[1])) {
    upstreamUrl = sessionServiceUrl;
  }

  console.log(`[Proxy] ${req.method} ${targetPath} -> ${upstreamUrl}/${targetPath}`);

  const searchParams = { ...req.query };
  delete searchParams.path;
  const qs = new URLSearchParams(searchParams).toString();
  const url = `${upstreamUrl}/${targetPath}${qs ? `?${qs}` : ''}`;

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (req.headers['content-type']) {
    headers.set('Content-Type', req.headers['content-type']);
  }

  let body = undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await getRawBody(req);
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body
    });

    const buffer = await response.arrayBuffer();
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-length') return;
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'bad_gateway' });
  }
}

