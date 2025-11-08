// Repository exports and factory
import { URLRepository } from './URLRepository';
import { UserRepository } from './UserRepository';
import { AnalyticsRepository } from './AnalyticsRepository';
import { PreferencesRepository } from './PreferencesRepository';
import { logger } from '../config/logger';
import { db } from '../config/database';

// Repository instances (singletons)
let urlRepository: URLRepository;
let userRepository: UserRepository;
let analyticsRepository: AnalyticsRepository;
let preferencesRepository: PreferencesRepository;

/**
 * Get URL Repository instance
 */
export function getURLRepository(): URLRepository {
    if (!urlRepository) {
        urlRepository = new URLRepository();
    }
    return urlRepository;
}

/**
 * Get User Repository instance
 */
export function getUserRepository(): UserRepository {
    if (!userRepository) {
        userRepository = new UserRepository();
    }
    return userRepository;
}

/**
 * Get Analytics Repository instance
 */
export function getAnalyticsRepository(): AnalyticsRepository {
    if (!analyticsRepository) {
        analyticsRepository = new AnalyticsRepository();
    }
    return analyticsRepository;
}

/**
 * Get Preferences Repository instance
 */
export function getPreferencesRepository(): PreferencesRepository {
    if (!preferencesRepository) {
        preferencesRepository = new PreferencesRepository();
    }
    return preferencesRepository;
}

/**
 * Repository health check
 */
export async function checkRepositoryHealth(): Promise<{
    healthy: boolean;
    repositories: {
        url: boolean;
        user: boolean;
        analytics: boolean;
    };
    database: {
        connected: boolean;
        poolStats: any;
    };
}> {
    try {
        const [urlHealthy, userHealthy, preferencesHealthy] = await Promise.all([
            getURLRepository().healthCheck(),
            getUserRepository().healthCheck(),
            getPreferencesRepository().healthCheck(),
        ]);

        const dbHealthy = await db.healthCheck();
        const poolStats = db.getPoolStats();

        const allHealthy = urlHealthy && userHealthy && preferencesHealthy && dbHealthy;

        return {
            healthy: allHealthy,
            repositories: {
                url: urlHealthy,
                user: userHealthy,
                analytics: true, // Analytics repository doesn't have health check
            },
            database: {
                connected: dbHealthy,
                poolStats,
            },
        };
    } catch (error) {
        logger.error('Repository health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            healthy: false,
            repositories: {
                url: false,
                user: false,
                analytics: false,
            },
            database: {
                connected: false,
                poolStats: null,
            },
        };
    }
}

/**
 * Initialize all repositories
 */
export async function initializeRepositories(): Promise<void> {
    try {
        logger.info('Initializing repositories...');

        // Initialize repository instances
        getURLRepository();
        getUserRepository();
        getAnalyticsRepository();
        getPreferencesRepository();

        // Perform health checks
        const health = await checkRepositoryHealth();

        if (!health.healthy) {
            throw new Error('Repository initialization failed - health check failed');
        }

        logger.info('Repositories initialized successfully', {
            poolStats: health.database.poolStats,
        });
    } catch (error) {
        logger.error('Failed to initialize repositories', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Cleanup repositories on shutdown
 */
export async function cleanupRepositories(): Promise<void> {
    try {
        logger.info('Cleaning up repositories...');

        // Close database connections
        await db.close();

        logger.info('Repositories cleaned up successfully');
    } catch (error) {
        logger.error('Failed to cleanup repositories', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// Export repository classes for direct use if needed
export { URLRepository } from './URLRepository';
export { UserRepository } from './UserRepository';
export { AnalyticsRepository } from './AnalyticsRepository';
export { PreferencesRepository } from './PreferencesRepository';
export { BaseRepository } from './BaseRepository';

// Export types
export * from '../types/database';