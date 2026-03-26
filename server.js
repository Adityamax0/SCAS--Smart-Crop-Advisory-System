require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { configureCloudinary } = require('./config/cloudinary');
const { runAutoEscalation } = require('./services/escalationService');
const { initEscalationQueue, startEscalationWorker } = require('./services/escalationQueueService');
const { rateLimit } = require('express-rate-limit');
const logger = require('./config/logger');
const { initSocket } = require('./config/socket');

// ──────────────────────────────────
// Rate Limiting (Security Layer)
// ──────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 mins.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'AI limit reached (30/hr). Please wait.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000, // Developer mode: bumped from 10 to 1000 to prevent lockout
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' }
});



// Route imports
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const syncRoutes = require('./routes/syncRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const audioRoutes = require('./routes/audioRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const userRoutes = require('./routes/userRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const advisoryRoutes = require('./routes/advisoryRoutes');

const app = express();

// ──────────────────────────────────
// CORS Configuration
// ──────────────────────────────────
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN?.split(',') || []
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ──────────────────────────────────
// Body Parsing
// ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ──────────────────────────────────
// Health Check
// ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SCAS API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────
// API Routes
// ──────────────────────────────────
app.use('/api', generalLimiter); // Base protection for all

/**
 * 📡 API Route Registration
 */
app.use('/api/auth', authLimiter, authRoutes); // Re-added authLimiter
app.use('/api/users', userRoutes); // New route
app.use('/api/tickets', ticketRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/audio', aiLimiter, audioRoutes);
app.use('/api/advisory', aiLimiter, advisoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/feedback', feedbackRoutes); // Existing route
app.use('/api/simulation', simulationRoutes); // New route

// ──────────────────────────────────
// 404 Handler
// ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ──────────────────────────────────
// Global Error Handler
// ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ──────────────────────────────────
// Bootstrap
// ──────────────────────────────────
const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  try {
    // Connect to MongoDB Atlas
    await connectDB();

    // Initialize Redis
    connectRedis();

    // Configure Cloudinary
    configureCloudinary();

    // ─── SLA Escalation: BullMQ (Persisted in Redis, survives restarts) ───────
    // Unlike a cron job, BullMQ tasks stay in Upstash Redis when the server crashes.
    // The task runs immediately when the server comes back online. No "SLA Ghost" leakage.
    try {
      await initEscalationQueue();
      startEscalationWorker();
    } catch (queueErr) {
      logger.warn(`[QUEUE] BullMQ init failed — falling back to in-process check: ${queueErr.message}`);
      // Graceful fallback: run escalation inline if Redis is unavailable
      setInterval(async () => {
        try { await runAutoEscalation(); } catch (e) { logger.error('[FALLBACK CRON] Error:', e.message); }
      }, 30 * 60 * 1000);
    }


    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`\n🌾 SCAS API Server (WebSocket Enabled) running on port ${PORT}`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`   Health: http://localhost:${PORT}/api/health\n`);
    });

    // 🛡️ GLOBAL EXCEPTION CATCHER (Zero-Crash Policy)
    process.on('unhandledRejection', (err) => {
      logger.error(`[UNHANDLED REJECTION] Shutting down gracefully... Error: ${err.message}`);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error(`[UNCAUGHT EXCEPTION] Shutting down gracefully... Error: ${err.message}`);
      server.close(() => process.exit(1));
    });

    // Graceful Shutdown for PM2/Cloud
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Closing server gracefully...');
      server.close(() => {
        logger.info('Process terminated.');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('[FATAL] Failed to start server: %s', error.message);
    process.exit(1);
  }
};

bootstrap();

module.exports = app;

