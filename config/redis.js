const Redis = require('ioredis');

let redis = null;

const connectRedis = () => {
  if (redis) return redis;

  if (!process.env.REDIS_URL) {
    console.log('[REDIS] No REDIS_URL configured — running in No-Redis mode (fallback cron active)');
    return null;
  }

  try {
    redis = new Redis(process.env.REDIS_URL, {
      tls: { rejectUnauthorized: false },
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[REDIS] DNS/connection failed after 3 attempts — switching to No-Redis fallback mode. SLA escalation will use in-process cron.');
          redis = null; // Clear so callers get null and use fallback
          return null; // Stop retrying permanently
        }
        return Math.min(times * 500, 2000);
      },
    });

    redis.on('connect', () => console.log('[REDIS] Upstash Redis connected ✅'));
    redis.on('error', (err) => {
      // Only log once per error type — suppress the flood
      if (err.code === 'ENOTFOUND') {
        console.warn(`[REDIS] Host unreachable (${err.hostname}) — No-Redis fallback mode active`);
      } else {
        console.error('[REDIS] Error:', err.message);
      }
    });

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
