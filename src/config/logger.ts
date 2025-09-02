import winston from 'winston';
import path from 'path';

// Define enhanced logger interface
interface EnhancedLogger extends winston.Logger {
    logRequest: (req: any, res: any, responseTime?: number) => void;
    logDbOperation: (operation: string, table: string, duration: number, rowCount?: number) => void;
    logCacheOperation: (operation: string, key: string, hit: boolean, duration?: number) => void;
    logBusinessEvent: (event: string, data: Record<string, any>) => void;
    logSecurityEvent: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', data: Record<string, any>) => void;
    logPerformance: (operation: string, duration: number, metadata: Record<string, any>) => void;
    logError: (error: Error, context: Record<string, any>) => void;

}

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : process.env.LOG_LEVEL || 'info';
};

// Define format for logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;

        // Create structured log entry
        const logEntry = {
            timestamp,
            level,
            message,
            service: 'url-shortener-api',
            environment: process.env.NODE_ENV || 'development',
            ...meta,
        };

        return JSON.stringify(logEntry);
    }),
);

// Define console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    }),
);

// Define transports
const transports = [];

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
        }),
    );
}

// File transport for all environments
const logDir = 'logs';
const logFile = process.env.LOG_FILE_PATH || path.join(logDir, 'app.log');

transports.push(
    new winston.transports.File({
        filename: logFile,
        format,
        maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '000000') || '10000000'), // Default 10MB
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
        tailable: true,
    }),
);

// Error log file
transports.push(
    new winston.transports.File({
        filename: path.join(path.dirname(logFile), 'error.log'),
        level: 'error',
        format,
        maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '000000') || '10000000'),
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
        tailable: true,
    }),
);

// Create the base logger
const baseLogger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
    exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
const stream = {
    write: (message: string) => {
        baseLogger.http(message.trim());
    },
};

// Helper functions for structured logging
const createLogMeta = (meta: Record<string, any> = {}) => {
    return {
        ...meta,
        pid: process.pid,
        hostname: require('os').hostname(),
    };
};

// Create enhanced logger with custom methods
const logger = baseLogger as any as EnhancedLogger;

logger.logRequest = (req: any, res: any, responseTime?: number) => {
    baseLogger.http('HTTP Request', createLogMeta({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        contentLength: res.get('Content-Length'),
    }));
};

logger.logDbOperation = (operation: string, table: string, duration: number, rowCount?: number) => {
    baseLogger.debug('Database Operation', createLogMeta({
        operation,
        table,
        duration,
        rowCount,
    }));
};

logger.logCacheOperation = (operation: string, key: string, hit: boolean, duration?: number) => {
    baseLogger.debug('Cache Operation', createLogMeta({
        operation,
        key,
        hit,
        duration,
    }));
};

logger.logBusinessEvent = (event: string, data: Record<string, any> = {}) => {
    baseLogger.info('Business Event', createLogMeta({
        event,
        ...data,
    }));
};

logger.logSecurityEvent = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', data: Record<string, any> = {}) => {
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    baseLogger[logLevel]('Security Event', createLogMeta({
        event,
        severity,
        ...data,
    }));
};

logger.logPerformance = (operation: string, duration: number, metadata: Record<string, any> = {}) => {
    baseLogger.info('Performance Metric', createLogMeta({
        operation,
        duration,
        ...metadata,
    }));
};

logger.logError = (error: Error, context: Record<string, any> = {}) => {
    baseLogger.error('Application Error', createLogMeta({
        error: error.message,
        stack: error.stack,
        name: error.name,
        ...context,
    }));
};

(logger as any).stream = stream;

export { logger };
export default logger;
