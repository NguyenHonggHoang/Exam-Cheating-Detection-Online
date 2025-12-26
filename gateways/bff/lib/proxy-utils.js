import { Readable } from 'stream';

export function getBodyInit(req) {
    if (['GET', 'HEAD'].includes(req.method)) {
        return undefined;
    }

    return req;
}

export async function proxyRequest(req, res, targetUrl, accessToken = null) {
    const headers = new Headers();

    if (req.headers['content-type']) {
        headers.set('Content-Type', req.headers['content-type']);
    }

    // Forward Accept header for SSE detection
    if (req.headers['accept']) {
        headers.set('Accept', req.headers['accept']);
    }

    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const skipHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];

    headers.set('X-Forwarded-For', req.socket.remoteAddress || '');

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: headers,
            body: getBodyInit(req),
            duplex: 'half',
        });

        // Check if this is an SSE response
        const contentType = response.headers.get('content-type') || '';
        const isSSE = contentType.includes('text/event-stream');

        res.status(response.status);

        response.headers.forEach((value, key) => {
            if (!skipHeaders.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // SSE-specific headers to prevent buffering
        if (isSSE) {
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
            console.log('[Proxy] SSE connection detected, streaming enabled');
        }

        if (response.body) {
            const reader = response.body.getReader();

            // For SSE, we need to flush after each chunk
            const flushIfNeeded = () => {
                if (isSSE && typeof res.flush === 'function') {
                    res.flush();
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
                flushIfNeeded();
            }
            res.end();
        }
        else {
            res.end();
        }
    }
    catch (error) {
        console.error(`[Proxy Error] ${req.method} ${targetUrl} -`, error);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway', message: error.message });
        }
    }

}
