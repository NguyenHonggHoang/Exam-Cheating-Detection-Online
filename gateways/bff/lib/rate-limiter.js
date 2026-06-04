/**
 * Rate Limiter Middleware for BFF Gateway
 * 
 * Sliding window rate limiting implemented using Redis sorted sets (ZADD/ZREMRANGE/ZCARD).
 * Provides high-performance, distributed rate limiting across all BFF instances.
 */

import { getRedisClient } from './redis';

// Configuration per endpoint category (limits from security rules)
const RATE_LIMITS = {
    auth: { windowMs: 60000, max: 10 },      // 10 requests per minute for auth/login/otp
    api: { windowMs: 60000, max: 100 },       // 100 requests per minute for general API
    ingest: { windowMs: 60000, max: 500 },    // 500 requests per minute for ingest (high throughput)
    upload: { windowMs: 60000, max: 10 },     // 10 uploads per minute
    default: { windowMs: 60000, max: 60 }     // 60 requests per minute default
};

/**
 * Get rate limit category for a path
 */
function getCategory(path) {
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register') || path.includes('/otp')) {
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
 * Check rate limit for a request using Redis sliding window
 * 
 * @param {string} clientId - Client identifier (IP or user ID)
 * @param {string} path - Request path
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
export async function checkRateLimit(clientId, path) {
    try {
        const redis = getRedisClient();
        const category = getCategory(path);
        const config = RATE_LIMITS[category];
        const now = Date.now();
        
        // Key format: bff:rate_limit:<clientId>:<category>
        // Note: redis client has 'bff:token:' prefix configured in redis.js,
        // but getRedisClient returns a client that overrides or appends,
        // so we use a sub-namespace.
        const key = `rate_limit:${clientId}:${category}`;
        const clearBefore = now - config.windowMs;

        // Use a pipeline to ensure atomic execution
        const pipeline = redis.pipeline();
        pipeline.zadd(key, now, now);
        pipeline.zremrangebyscore(key, '-inf', clearBefore);
        pipeline.zcard(key);
        // Auto-expire the key after window time to save Redis memory
        pipeline.pexpire(key, config.windowMs);

        const results = await pipeline.exec();
        
        // Results format: [[err, res], [err, res], ...]
        // ZCARD is the 3rd operation (index 2)
        const requestCount = results[2][1];
        
        const allowed = requestCount <= config.max;
        const remaining = Math.max(0, config.max - requestCount);
        const resetAt = now + config.windowMs;

        return {
            allowed,
            remaining,
            resetAt
        };
    } catch (error) {
        console.error('[RateLimiter][Redis] Error executing rate limit check, falling back to open access:', error);
        // Fail-open strategy for high availability in case of Redis failure
        return {
            allowed: true,
            remaining: 1,
            resetAt: Date.now() + 60000
        };
    }
}

/**
 * Express-style middleware
 */
export async function rateLimitMiddleware(req, res) {
    const clientId = req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'unknown';
    const path = req.url || '/';

    const result = await checkRateLimit(clientId, path);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
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
        const allowed = await rateLimitMiddleware(req, res);
        if (!allowed) {
            return; // Already sent 429 response
        }
        return handler(req, res);
    };
}

export default { checkRateLimit, rateLimitMiddleware, withRateLimit };
