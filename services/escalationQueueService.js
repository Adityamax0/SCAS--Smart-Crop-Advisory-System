/**
 * SLA Escalation Task Queue
 * 
 * Uses BullMQ + Upstash Redis to persist escalation tasks.
 * Unlike a basic cron job, BullMQ tasks SURVIVE server crashes and restarts.
 * If Render/Railway goes into sleep mode, these tasks are still queued in Redis
 * and will run immediately when the server wakes up.
 * 
 * This solves the "SLA Ghost" loophole where a cron job skips during a server restart.
 */

const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const { runAutoEscalation } = require('./escalationService');
const logger = require('../config/logger');

// ─── Redis Connection for BullMQ ─────────────────────────────────────────────
// BullMQ requires ioredis. We parse the REDIS_URL from Upstash.
let connection;

const getRedisConnection = () => {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('[QUEUE] REDIS_URL not set. BullMQ queue will be skipped.');
      return null;
    }
    
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      tls: redisUrl.startsWith('rediss://') ? {
        rejectUnauthorized: false
      } : undefined
    });
  }
  return connection;
};

// ─── Queue Definition ─────────────────────────────────────────────────────────
const QUEUE_NAME = 'sla-escalation';
let escalationQueue = null;

/**
 * Initialize and return the SLA Escalation Queue.
 * Adds a repeating job every 30 minutes that persists in Redis.
 */
const initEscalationQueue = async () => {
  const conn = getRedisConnection();
  if (!conn) return null;

  try {
    escalationQueue = new Queue(QUEUE_NAME, { connection: conn });

    // Remove any existing repeating jobs (prevents duplicate schedulers on restart)
    const repeatableJobs = await escalationQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await escalationQueue.removeRepeatableByKey(job.key);
    }

    // Add the persistent repeating job — every 30 minutes
    await escalationQueue.add(
      'check-sla-breaches',
      {},
      {
        repeat: { every: 30 * 60 * 1000 }, // 30 minutes in ms
        jobId: 'sla-check-recurring', // stable ID prevents duplicates
      }
    );

    logger.info('[QUEUE] ✅ SLA Escalation Queue initialized (persisted in Upstash Redis)');
    return escalationQueue;
  } catch (err) {
    logger.error(`[QUEUE] Failed to initialize queue: ${err.message}`);
    return null;
  }
};

/**
 * Start the BullMQ Worker that processes escalation jobs.
 * This is what actually runs runAutoEscalation() when the job fires.
 */
const startEscalationWorker = () => {
  const conn = getRedisConnection();
  if (!conn) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`[QUEUE] 🚀 Processing SLA escalation job #${job.id}`);
      try {
        await runAutoEscalation();
        logger.info(`[QUEUE] ✅ SLA escalation job #${job.id} completed`);
      } catch (err) {
        logger.error(`[QUEUE] ❌ SLA escalation job #${job.id} failed: ${err.message}`);
        throw err; // BullMQ will auto-retry failed jobs
      }
    },
    {
      connection: conn,
      concurrency: 1, // Only one escalation check runs at a time (prevents overlaps)
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`[QUEUE] Job failed after all retries: ${err.message}`);
  });

  logger.info('[QUEUE] ✅ SLA Escalation Worker started');
  return worker;
};

module.exports = { initEscalationQueue, startEscalationWorker };
