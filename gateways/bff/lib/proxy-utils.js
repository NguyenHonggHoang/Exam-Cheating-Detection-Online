import { Readable } from 'stream';
import { Agent, setGlobalDispatcher } from 'undici';

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const proxyDispatcherKey = Symbol.for('exam.bff.proxyDispatcherConfigured');

if (!globalThis[proxyDispatcherKey]) {
    setGlobalDispatcher(new Agent({
        connectTimeout: parsePositiveInt(process.env.BFF_PROXY_CONNECT_TIMEOUT_MS, 60000),
        headersTimeout: parsePositiveInt(process.env.BFF_PROXY_HEADERS_TIMEOUT_MS, 120000),
        bodyTimeout: parsePositiveInt(process.env.BFF_PROXY_BODY_TIMEOUT_MS, 120000),
        connections: parsePositiveInt(process.env.BFF_PROXY_CONNECTIONS, 256),
        pipelining: 1,
    }));
    globalThis[proxyDispatcherKey] = true;
}

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
    } else if (req.headers['authorization']) {
        headers.set('Authorization', req.headers['authorization']);
    }

    // Forward distributed tracing and correlation headers to downstream services
    const traceHeaders = [
        'traceparent', 'tracestate',
        'x-request-id', 'x-correlation-id',
        'x-b3-traceid', 'x-b3-spanid', 'x-b3-sampled', 'x-b3-parentspanid', 'x-b3-flags',
        'x-ot-span-context'
    ];
    traceHeaders.forEach(h => {
        if (req.headers[h]) {
            headers.set(h, req.headers[h]);
        }
    });

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
            if (isSSE) {
                const reader = response.body.getReader();
                // For SSE, we need to flush after each chunk
                const flushIfNeeded = () => {
                    if (typeof res.flush === 'function') {
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
            } else {
                Readable.fromWeb(response.body).pipe(res);
            }
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
