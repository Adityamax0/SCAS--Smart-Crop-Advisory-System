const Redis = require('ioredis');

let redis = null;

const connectRedis = () => {
  if (redis) return redis;

  if (!process.env.REDIS_URL) {
    console.log('[REDIS] No REDIS_URL configured — skipping Redis (using direct calls)');
    return null;
  }

  try {
    redis = new Redis(process.env.REDIS_URL, {
      tls: { rejectUnauthorized: false },
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // Stop retrying after 5 attempts
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redis.on('connect', () => console.log('[REDIS] Upstash Redis connected'));
    redis.on('error', (err) => console.error('[REDIS] Connection error:', err.message));

    return redis;
  } catch (error) {
    console.error('[REDIS] Failed to initialize:', error.message);
    return null;
  }
};

/**
 * Cache helper with TTL
 * @param {string} key
 * @param {Function} fetchFn - async function to fetch fresh data
 * @param {number} ttl - time-to-live in seconds (default 300 = 5 min)
 */
const cacheGet = async (key, fetchFn, ttl = 300) => {
  const client = connectRedis();
  if (!client) return fetchFn();

  try {
    const cached = await client.get(key);
    if (cached) {
      console.log(`[REDIS] Cache HIT: ${key}`);
      return JSON.parse(cached);
    }

    console.log(`[REDIS] Cache MISS: ${key}`);
    const freshData = await fetchFn();
    await client.setex(key, ttl, JSON.stringify(freshData));
    return freshData;
  } catch (error) {
    console.error(`[REDIS] Cache error for key ${key}:`, error.message);
    return fetchFn();
  }
};

module.exports = { connectRedis, cacheGet };
