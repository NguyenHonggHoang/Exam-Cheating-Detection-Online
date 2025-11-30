import { getToken } from 'next-auth/jwt';
import { proxyRequest } from '../../../lib/proxy-utils';

const userServiceUrl = process.env.UPSTREAM_API_BASE_URL ?? 'http://localhost:8100';
const sessionServiceUrl = process.env.SESSION_SERVICE_URL ?? 'http://localhost:8081';

export const config = {
  api: {
    bodyParser: false, 
    externalResolver: true,
  },
};


export default async function handler(req, res) {
  const cookieName = process.env.BFF_SESSION_COOKIE || `next-auth.session-token`;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: cookieName });

  if (!token) {
    console.warn('[Proxy] No token found in cookie. Redirecting to login.');
    return res.status(401).json({ error: 'unauthorized', message: 'No session found' });
  }
  
  if (!token.accessToken) {
    console.warn('[Proxy] Session exists but AccessToken is missing.');
    return res.status(401).json({ error: 'unauthorized', message: 'No access token' });
  }

  const accessToken = token.accessToken;

  const pathParts = req.query.path || [];
  const targetPath = pathParts.join('/');
  const firstSegment = pathParts[0];

  let upstreamUrl = userServiceUrl;

  if (['sessions', 'ingest', 'incidents', 'mock-exam'].includes(firstSegment)) {
    upstreamUrl = sessionServiceUrl;
  } else if (firstSegment === 'api' && ['exams', 'sessions', 'mock-exam', 'incidents', 'ingest'].includes(pathParts[1])) {
    upstreamUrl = sessionServiceUrl;
  } else if (firstSegment === 'admin') {
     if (['exams', 'stats'].includes(pathParts[1])) {
         upstreamUrl = sessionServiceUrl;
     }
  }

  const searchParams = { ...req.query };
  delete searchParams.path;
  const qs = new URLSearchParams(searchParams).toString();
  const url = `${upstreamUrl}/${targetPath}${qs ? `?${qs}` : ''}`;

  console.log(`[Proxy] ${req.method} ${targetPath} -> ${url}`);

  await proxyRequest(req, res, url, accessToken);
}