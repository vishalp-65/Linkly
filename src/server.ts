// Import tracing first to ensure proper instrumentation
import './tracing';

import App from './app';
import { config } from './config/environment';
import { logger } from './config/logger';
import { tracingService } from './services/tracingService';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
    });
    process.exit(1);
});

// Handle SIGTERM gracefully
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await gracefulShutdown();
});

// Handle SIGINT gracefully (Ctrl+C)
process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await gracefulShutdown();
});

let server: any;
let app: App;

async function gracefulShutdown(): Promise<void> {
    try {
        if (server) {
            // Stop accepting new connections
            server.close(() => {
                logger.info('HTTP server closed');
            });
        }

        // Close application resources
        if (app) {
            await app.shutdown();
        }

        // Shutdown tracing
        await tracingService.shutdown();

        // Exit process
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

async function startServer(): Promise<void> {
    try {
        // Create and initialize application
        app = new App();
        await app.initialize();

        // Start HTTP server
        server = app.app.listen(config.port, config.host, () => {
            logger.info('Server started successfully', {
                port: config.port,
                host: config.host,
                environment: config.nodeEnv,
                pid: process.pid,
                nodeVersion: process.version,
            });
        });

        // Handle server errors
        server.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use`);
            } else {
                logger.error('Server error', {
                    error: error.message,
                    code: error.code,
                });
            }
            process.exit(1);
        });

        // Log server metrics periodically
        setInterval(() => {
            const memUsage = process.memoryUsage();
            logger.info('Server metrics', {
                uptime: process.uptime(),
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024),
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memUsage.external / 1024 / 1024),
                },
                cpu: process.cpuUsage(),
            });
        }, 60000); // Log every minute

    } catch (error) {
        logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}

// Start the server
startServer().catch((error) => {
    logger.error('Server startup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
});
