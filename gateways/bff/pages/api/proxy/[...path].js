import { getToken } from 'next-auth/jwt';
import { proxyRequest } from '../../../lib/proxy-utils';

// Service URLs
const userServiceUrl = process.env.UPSTREAM_API_BASE_URL ?? 'http://localhost:8100';
const sessionServiceUrl = process.env.SESSION_SERVICE_URL ?? 'http://localhost:8081';
const incidentServiceUrl = process.env.INCIDENT_SERVICE_URL ?? 'http://localhost:8082';
const adminServiceUrl = process.env.ADMIN_SERVICE_URL ?? 'http://localhost:8200';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

// Public routes that don't require authentication
const publicRoutes = [
  // NOTE: proctor-token REMOVED - it requires authentication to identify the proctor
  /^sessions\/exam\//, // Get sessions by exam
  /^sessions\/by-exam\//, // Alternative path for sessions by exam
  /^sessions\/[a-f0-9-]+\/join$/, // Join session (student gets LiveKit token)
  /^mock-exam/, // Mock exam endpoints for testing
  /^api\/mock-exam/, // Nested mock exam endpoints (from /api/proxy/api/mock-exam)
  /^incident\/client-event/, // Incident event endpoint for load testing
  /^api\/incident\/client-event/, // Nested incident event endpoint
  /^api\/exams\/[a-f0-9-]+\/seb-config$/, // SEB config download (SEB is a fresh browser without cookies)
];

function isPublicRoute(path) {
  return publicRoutes.some(pattern => pattern.test(path));
}

export default async function handler(req, res) {
  const pathParts = req.query.path || [];
  const targetPath = pathParts.join('/');
  const firstSegment = pathParts[0];
  const secondSegment = pathParts[1];

  // Check if this is a public route (no auth required)
  const isPublic = isPublicRoute(targetPath);

  let accessToken = null;

  if (!isPublic) {
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

    if (token.error) {
      console.warn('[Proxy] Token has error (e.g. failed refresh):', token.error);
      return res.status(401).json({ error: 'unauthorized', message: token.error });
    }

    accessToken = token.accessToken;
  } else {
    console.log(`[Proxy] Public route: ${targetPath}`);
  }

  // Determine upstream service based on path
  let upstreamUrl = userServiceUrl;
  let apiPrefix = ''; // Add /api prefix for services that need it

  // Session Service routes
  if (['sessions', 'ingest', 'mock-exam', 'storage', 'users', 'identity', 'exams', 'egress', 'secure-exam'].includes(firstSegment)) {
    upstreamUrl = sessionServiceUrl;
    apiPrefix = '/api'; // session-service uses /api prefix
  }
  // Incident Service routes (FIXED: was going to session-service)
  else if (['incidents', 'incident'].includes(firstSegment)) {
    upstreamUrl = incidentServiceUrl;
    apiPrefix = '/api'; // incident-service uses /api prefix
  }
  // Nested API routes (already have /api prefix from client)
  else if (firstSegment === 'api') {
    if (['sessions', 'mock-exam', 'ingest', 'storage', 'identity'].includes(secondSegment)) {
      upstreamUrl = sessionServiceUrl;
    } else if (['users'].includes(secondSegment)) {
      upstreamUrl = userServiceUrl;
    } else if (['incidents', 'incident', 'behavior'].includes(secondSegment)) {
      upstreamUrl = incidentServiceUrl;
    } else if (['exams', 'questions'].includes(secondSegment)) {
      upstreamUrl = sessionServiceUrl;
    } else if (['admin'].includes(secondSegment)) {
      // Nested api/admin/* routing
      const thirdSegment = pathParts[2];
      if (['metrics', 'system'].includes(thirdSegment)) {
        upstreamUrl = sessionServiceUrl;
      } else if (['users'].includes(thirdSegment)) {
        upstreamUrl = adminServiceUrl;
      } else {
        // Default admin routes to adminService? or session?
        // Most original admin routes were session. 
        upstreamUrl = sessionServiceUrl;
      }
    }
  }
  // Admin routes
  else if (firstSegment === 'admin') {
    if (['sessions'].includes(secondSegment)) {
      upstreamUrl = sessionServiceUrl;
      apiPrefix = '/api';
    } else if (['exams', 'stats'].includes(secondSegment)) {
      upstreamUrl = incidentServiceUrl; // Or session? Admin stats usually session. Let's redirect to session for now if stats controller is there.
      // Actually AdminStatsController is in session-service (checked earlier, empty file but exists).
      // But SystemMetricsController is in session-service /api/admin/metrics.
      upstreamUrl = sessionServiceUrl;
      apiPrefix = '/api';
    } else if (['users'].includes(secondSegment)) {
      upstreamUrl = userServiceUrl;
      apiPrefix = '/api';
    } else if (['system', 'metrics', 'health'].includes(secondSegment)) {
      upstreamUrl = sessionServiceUrl;
      apiPrefix = '/api';
    }
  }

  const searchParams = { ...req.query };
  delete searchParams.path;
  const qs = new URLSearchParams(searchParams).toString();
  const url = `${upstreamUrl}${apiPrefix}/${targetPath}${qs ? `?${qs}` : ''}`;

  console.log(`[Proxy] ${req.method} ${targetPath} -> ${url}`);

  await proxyRequest(req, res, url, accessToken);
}
