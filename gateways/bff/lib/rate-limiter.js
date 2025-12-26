/**
 * Rate Limiter Middleware for BFF Gateway
 * 
 * Simple in-memory rate limiting with sliding window
 * For production, use Redis-based rate limiting
 */

const rateLimitStore = new Map();

// Configuration per endpoint category
const RATE_LIMITS = {
    auth: { windowMs: 60000, max: 10 },      // 10 requests per minute for auth
    api: { windowMs: 60000, max: 100 },       // 100 requests per minute for general API
    ingest: { windowMs: 60000, max: 500 },    // 500 requests per minute for ingest (high throughput)
    upload: { windowMs: 60000, max: 10 },     // 10 uploads per minute
    default: { windowMs: 60000, max: 60 }     // 60 requests per minute default
};

/**
 * Get rate limit category for a path
 */
function getCategory(path) {
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
        return 'auth';
    }
    if (path.includes('/ingest') || path.includes('/client-event')) {
        return 'ingest';
    }
    if (path.includes('/storage') || path.includes('/upload') || path.includes('/presigned')) {
        return 'upload';
    }
    if (path.includes('/api/')) {
        return 'api';
    }
    return 'default';
}

/**
 * Clean up expired entries
 */
function cleanup() {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.windowStart > data.windowMs * 2) {
            rateLimitStore.delete(key);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanup, 300000);

/**
 * Check rate limit for a request
 * 
 * @param {string} clientId - Client identifier (IP or user ID)
 * @param {string} path - Request path
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(clientId, path) {
    const category = getCategory(path);
    const config = RATE_LIMITS[category];
    const key = `${clientId}:${category}`;
    const now = Date.now();

    let data = rateLimitStore.get(key);

    if (!data || now - data.windowStart > config.windowMs) {
        // New window
        data = {
            count: 1,
            windowStart: now,
            windowMs: config.windowMs,
            max: config.max
        };
        rateLimitStore.set(key, data);
        return {
            allowed: true,
            remaining: config.max - 1,
            resetAt: now + config.windowMs
        };
    }

    data.count++;

    if (data.count > config.max) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: data.windowStart + config.windowMs
        };
    }

    return {
        allowed: true,
        remaining: config.max - data.count,
        resetAt: data.windowStart + config.windowMs
    };
}

/**
 * Express-style middleware
 */
export function rateLimitMiddleware(req, res) {
    const clientId = req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'unknown';
    const path = req.url || '/';

    const result = checkRateLimit(clientId, path);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
        res.status(429).json({
            error: 'too_many_requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
        });
        return false;
    }

    return true;
}

/**
 * Next.js API route wrapper
 */
export function withRateLimit(handler) {
    return async (req, res) => {
        if (!rateLimitMiddleware(req, res)) {
            return; // Already sent 429 response
        }
        return handler(req, res);
    };
}

export default { checkRateLimit, rateLimitMiddleware, withRateLimit };
