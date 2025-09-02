import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config/environment';
import { logger } from './config/logger';
import { db } from './config/database';
import { redis } from './config/redis';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { skipHealthCheckLogs } from './middleware/requestLogger';
import healthRoutes from './routes/health';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
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

    // Trust proxy (for accurate IP addresses behind load balancers)
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Health check routes
    this.app.use('/', healthRoutes);

    // API routes will be added here in future tasks
    // this.app.use('/api/v1', apiRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'URL Shortener API',
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
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
      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      // Close Redis connections
      await redis.close();
      logger.info('Redis connections closed');

      logger.info('Application shutdown completed');
    } catch (error) {
      logger.error('Error during application shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export default App;
