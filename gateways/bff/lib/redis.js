import Redis from 'ioredis';

let redisClient = null;

export const getRedisClient = () => {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD || undefined;

    redisClient = new Redis({
      host,
      port,
      password,
      keyPrefix: 'bff:token:',
      maxRetriesPerRequest: 3,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.slice(0, targetError.length) === targetError) {
          return true;
        }
        return false;
      }
    });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected successfully to Redis server at ${host}:${port}`);
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Unexpected error on Redis client', err);
    });
  }
  return redisClient;
};
