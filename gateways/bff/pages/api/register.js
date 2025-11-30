// Public registration endpoint - no authentication required
const userServiceUrl = process.env.UPSTREAM_API_BASE_URL ?? 'http://localhost:8100';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = `${userServiceUrl}/api/register`;
  console.log(`[Register] POST -> ${url}`);

  const headers = new Headers();
  if (req.headers['content-type']) {
    headers.set('Content-Type', req.headers['content-type']);
  }

  const body = await getRawBody(req);

  try {
    const response = await fetch(url, {
      method: 'POST',
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
    console.error('Register proxy error:', error);
    res.status(502).json({ error: 'bad_gateway' });
  }
}
