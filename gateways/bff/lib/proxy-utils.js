import { Readable } from 'stream';

export function getBodyInit(req) {
    if (['GET', 'HEAD'].includes(req.method)) {
        return undefined;
    }

    return req;
}

export async function proxyRequest(req, res, targetUrl, accessToken = null) {
    const headers = new Headers();

    if(req.headers['content-type']){
        headers.set('Content-Type', req.headers['content-type']);
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

        res.status(response.status);

        response.headers.forEach((value, key) => {
            if (!skipHeaders.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        if(response.body) {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
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