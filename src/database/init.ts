#!/usr/bin/env node

/**
 * Database initialization script
 * Runs migrations and sets up the database schema
 */

import { migrationRunner } from './migrationRunner';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/environment';

async function initializeDatabase(): Promise<void> {
    try {
        logger.info('Starting database initialization...');

        // Check database connection
        logger.info('Checking database connection...');
        const isHealthy = await db.healthCheck();
        if (!isHealthy) {
            throw new Error('Database connection failed');
        }
        logger.info('Database connection established');

        // Run migrations
        logger.info('Running database migrations...');
        await migrationRunner.runMigrations();
        logger.info('Database migrations completed');

        // Get migration status
        const status = await migrationRunner.getMigrationStatus();
        logger.info('Migration status', {
            total: status.total,
            executed: status.executed,
            pending: status.pending,
        });

        // Verify core tables exist
        logger.info('Verifying core tables...');
        await verifyCoreTablesExist();
        logger.info('Core tables verified');

        logger.info('Database initialization completed successfully');
    } catch (error) {
        logger.error('Database initialization failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

async function verifyCoreTablesExist(): Promise<void> {
    const requiredTables = [
        'users',
        'url_mappings',
        'id_counter',
        'analytics_events',
        'analytics_aggregates',
        'schema_migrations',
    ];

    for (const table of requiredTables) {
        const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [table]);

        if (!result.rows[0].exists) {
            throw new Error(`Required table '${table}' does not exist`);
        }
    }

    logger.info('All required tables exist', { tables: requiredTables });
}

async function createMigration(description: string): Promise<void> {
    try {
        if (!description) {
            throw new Error('Migration description is required');
        }

        const filePath = migrationRunner.createMigration(description);
        logger.info('Migration file created', { filePath });
    } catch (error) {
        logger.error('Failed to create migration', {
            description,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

async function getMigrationStatus(): Promise<void> {
    try {
        const status = await migrationRunner.getMigrationStatus();

        console.log('\n=== Migration Status ===');
        console.log(`Total migrations: ${status.total}`);
        console.log(`Executed: ${status.executed}`);
        console.log(`Pending: ${status.pending}`);

        if (status.migrations.length > 0) {
            console.log('\n=== Migration Details ===');
            status.migrations.forEach(migration => {
                const statusIcon = migration.status === 'executed' ? '✓' : '○';
                const executedAt = migration.executedAt
                    ? ` (${migration.executedAt.toISOString()})`
                    : '';
                console.log(`${statusIcon} ${migration.filename}${executedAt}`);
            });
        }

        console.log('');
    } catch (error) {
        logger.error('Failed to get migration status', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// CLI interface
async function main(): Promise<void> {
    const command = process.argv[2];
    const arg = process.argv[3];

    try {
        switch (command) {
            case 'init':
                await initializeDatabase();
                break;

            case 'migrate':
                await migrationRunner.runMigrations();
                break;

            case 'status':
                await getMigrationStatus();
                break;

            case 'create':
                if (!arg) {
                    console.error('Usage: npm run db:create <description>');
                    process.exit(1);
                }
                await createMigration(arg);
                break;

            default:
                console.log('Usage:');
                console.log('  npm run db:init     - Initialize database and run migrations');
                console.log('  npm run db:migrate  - Run pending migrations');
                console.log('  npm run db:status   - Show migration status');
                console.log('  npm run db:create <description> - Create new migration file');
                process.exit(1);
        }
    } catch (error) {
        logger.error('Database command failed', {
            command,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    } finally {
        // Close database connection
        try {
            await db.close();
        } catch (error) {
            // Ignore close errors
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export {
    initializeDatabase,
    createMigration,
    getMigrationStatus,
    verifyCoreTablesExist,
};