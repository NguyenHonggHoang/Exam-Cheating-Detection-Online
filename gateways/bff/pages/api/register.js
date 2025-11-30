import { proxyRequest } from '../../lib/proxy-utils';

const userServiceUrl = process.env.UPSTREAM_API_BASE_URL ?? 'http://localhost:8100';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = `${userServiceUrl}/api/register`;
  console.log(`[Register] POST -> ${url}`);

  await proxyRequest(req, res, url, null);
}