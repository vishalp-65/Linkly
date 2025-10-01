import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/environment';
import { logger } from './config/logger';
import { db } from './config/database';
import { redis } from './config/redis';
import { kafka } from './config/kafka';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { skipHealthCheckLogs } from './middleware/requestLogger';
import { connectionCounterMiddleware, skipMetrics } from './middleware/metricsMiddleware';
import { tracingMiddleware, traceContextMiddleware } from './middleware/tracingMiddleware';
import { ExpiryManagerService } from './services/expiryManagerService';
import { optionalAuth } from './middleware/auth';
import { adaptiveRateLimit } from './middleware/rateLimiter';
import healthRoutes from './routes/health';
import redirectRoutes from './routes/redirect';
import analyticsRoutes from './routes/analytics';
import shortenRoutes from './routes/shorten';
import urlRoutes from './routes/url';

class App {
  public app: express.Application;
  private expiryManager: ExpiryManagerService;

  constructor() {
    this.app = express();
    this.expiryManager = new ExpiryManagerService();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.isDevelopment ? true : process.env.ALLOWED_ORIGINS?.split(',') || false,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Compression middleware
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
    }));

    // Body parsing middleware
    this.app.use(express.json({
      limit: '10mb',
      strict: true,
    }));
    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb',
    }));

    // Request logging middleware (skip for health checks)
    this.app.use(skipHealthCheckLogs);

    // Tracing middleware (adds custom spans and attributes)
    this.app.use(tracingMiddleware);

    // Trace context middleware (adds trace IDs to logs and headers)
    this.app.use(traceContextMiddleware);

    // Metrics collection middleware (skip for metrics endpoint)
    this.app.use(skipMetrics);

    // Connection counter middleware
    this.app.use(connectionCounterMiddleware);

    // Trust proxy (for accurate IP addresses behind load balancers)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check routes (no auth or rate limiting)
    this.app.use('/', healthRoutes);

    // Apply optional authentication to all API routes
    this.app.use('/api', optionalAuth);

    // Apply rate limiting to all API routes
    this.app.use('/api', adaptiveRateLimit);

    // API routes
    this.app.use('/api/v1/shorten', shortenRoutes);
    this.app.use('/api/v1/url', urlRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);

    // Redirect routes (must be after health and API routes but before catch-all)
    // Apply light rate limiting to redirects to prevent abuse
    this.app.use('/', redirectRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'URL Shortener API',
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: {
          shorten: '/api/v1/shorten',
          analytics: '/api/v1/analytics',
          health: '/health',
          docs: '/api/docs'
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize database connection
      logger.info('Initializing database connection...');
      const dbHealthy = await db.healthCheck();
      if (!dbHealthy) {
        throw new Error('Database connection failed');
      }
      logger.info('Database connection established');

      // Initialize Redis connection
      logger.info('Initializing Redis connection...');
      await redis.connect();
      const redisHealthy = await redis.healthCheck();
      if (!redisHealthy) {
        throw new Error('Redis connection failed');
      }
      logger.info('Redis connection established');

      // Initialize Kafka connection (optional - service will work without it)
      logger.info('Initializing Kafka connection...');
      try {
        await kafka.connect();
        const kafkaHealthy = await kafka.healthCheck();
        if (kafkaHealthy) {
          logger.info('Kafka connection established');
        } else {
          logger.warn('Kafka connection failed, analytics will use in-memory buffering');
        }
      } catch (error) {
        logger.warn('Kafka initialization failed, analytics will use in-memory buffering', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Start expiry management background jobs
      logger.info('Starting expiry management service...');
      this.expiryManager.start();
      logger.info('Expiry management service started');

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Application initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');

    try {
      // Stop expiry management service
      logger.info('Stopping expiry management service...');
      this.expiryManager.stop();
      logger.info('Expiry management service stopped');

      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      // Close Redis connections
      await redis.close();
      logger.info('Redis connections closed');

      // Close Kafka connections
      try {
        await kafka.disconnect();
        logger.info('Kafka connections closed');
      } catch (error) {
        logger.warn('Error closing Kafka connections', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.info('Application shutdown completed');
    } catch (error) {
      logger.error('Error during application shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get expiry manager service for external access
   */
  public getExpiryManager(): ExpiryManagerService {
    return this.expiryManager;
  }
}

export default App;
