import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface RequestWithStartTime extends Request {
    startTime?: number;
}

// Request logging middleware
export const requestLogger = (req: RequestWithStartTime, res: Response, next: NextFunction): void => {
  // Record start time
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming Request', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    params: req.params,
    query: req.query,
    // Don't log sensitive data in body
    hasBody: Object.keys(req.body || {}).length > 0,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): any {
    const responseTime = req.startTime ? Date.now() - req.startTime : 0;

    // Log response
    logger.logRequest(req, res, responseTime);

    // Log performance metrics
    if (responseTime > 1000) {
      logger.logPerformance('Slow Request', responseTime, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Health check request filter (to reduce noise in logs)
export const skipHealthCheckLogs = (req: Request, res: Response, next: NextFunction): void => {
  if (req.url === '/health' || req.url === '/metrics') {
    // Skip detailed logging for health checks
    return next();
  }
  return requestLogger(req, res, next);
};

export default {
  requestLogger,
  skipHealthCheckLogs,
};
