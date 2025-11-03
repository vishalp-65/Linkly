import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../config/database';
import { logger } from '../config/logger';

interface Migration {
    id: number;
    filename: string;
    sql: string;
}

interface MigrationRecord {
    id: number;
    filename: string;
    executed_at: Date;
    checksum: string;
}

class MigrationRunner {
    private migrationsPath: string;

    constructor() {
        this.migrationsPath = join(__dirname, 'migrations');
    }

    /**
     * Initialize the migrations table if it doesn't exist
     */
    private async initializeMigrationsTable(): Promise<void> {
        const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        execution_time_ms INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
      ON schema_migrations(executed_at);
    `;

        await db.query(createTableSQL);
        logger.info('Migrations table initialized');
    }

    /**
     * Get all migration files from the migrations directory
     */
    private getMigrationFiles(): Migration[] {
        try {
            const files = readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.sql'))
                .sort();

            return files.map(filename => {
                const match = filename.match(/^(\d+)_/);
                if (!match) {
                    throw new Error(`Invalid migration filename format: ${filename}. Expected format: 001_description.sql`);
                }

                const id = parseInt(match[1], 10);
                const filePath = join(this.migrationsPath, filename);
                const sql = readFileSync(filePath, 'utf8');

                return { id, filename, sql };
            });
        } catch (error) {
            logger.error('Failed to read migration files', {
                error: error instanceof Error ? error.message : 'Unknown error',
                migrationsPath: this.migrationsPath,
            });
            throw error;
        }
    }

    /**
     * Get executed migrations from the database
     */
    private async getExecutedMigrations(): Promise<MigrationRecord[]> {
        const result = await db.query(`
      SELECT id, filename, executed_at, checksum
      FROM schema_migrations
      ORDER BY id
    `);

        return result.rows;
    }

    /**
     * Calculate checksum for migration content
     */
    private calculateChecksum(content: string): string {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Execute a single migration
     */
    private async executeMigration(migration: Migration): Promise<void> {
        const startTime = Date.now();
        const checksum = this.calculateChecksum(migration.sql);

        logger.info('Executing migration', {
            id: migration.id,
            filename: migration.filename,
            checksum,
        });

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Execute the migration SQL
            await client.query(migration.sql);

            // Record the migration as executed
            await client.query(`
        INSERT INTO schema_migrations (id, filename, executed_at, checksum, execution_time_ms)
        VALUES ($1, $2, NOW(), $3, $4)
      `, [
                migration.id,
                migration.filename,
                checksum,
                Date.now() - startTime,
            ]);

            await client.query('COMMIT');

            logger.info('Migration executed successfully', {
                id: migration.id,
                filename: migration.filename,
                executionTimeMs: Date.now() - startTime,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Migration failed', {
                id: migration.id,
                filename: migration.filename,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTimeMs: Date.now() - startTime,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validate that executed migrations haven't been modified
     */
    private validateMigrationIntegrity(
        migration: Migration,
        executedMigration: MigrationRecord
    ): void {
        const currentChecksum = this.calculateChecksum(migration.sql);

        if (currentChecksum !== executedMigration.checksum) {
            throw new Error(
                `Migration ${migration.filename} has been modified after execution. ` +
                `Expected checksum: ${executedMigration.checksum}, ` +
                `Current checksum: ${currentChecksum}`
            );
        }
    }

    /**
     * Run all pending migrations
     */
    async runMigrations(): Promise<void> {
        try {
            logger.info('Starting database migrations');

            // Initialize migrations table
            await this.initializeMigrationsTable();

            // Get all migrations and executed migrations
            const allMigrations = this.getMigrationFiles();
            const executedMigrations = await this.getExecutedMigrations();

            // Create a map of executed migrations for quick lookup
            const executedMap = new Map<number, MigrationRecord>();
            executedMigrations.forEach(migration => {
                executedMap.set(migration.id, migration);
            });

            // Validate integrity of executed migrations
            for (const migration of allMigrations) {
                const executed = executedMap.get(migration.id);
                if (executed) {
                    this.validateMigrationIntegrity(migration, executed);
                }
            }

            // Find pending migrations
            const pendingMigrations = allMigrations.filter(
                migration => !executedMap.has(migration.id)
            );

            if (pendingMigrations.length === 0) {
                logger.info('No pending migrations found');
                return;
            }

            logger.info('Found pending migrations', {
                count: pendingMigrations.length,
                migrations: pendingMigrations.map(m => m.filename),
            });

            // Execute pending migrations in order
            for (const migration of pendingMigrations) {
                await this.executeMigration(migration);
            }

            logger.info('All migrations completed successfully', {
                totalMigrations: allMigrations.length,
                executedMigrations: pendingMigrations.length,
            });
        } catch (error) {
            logger.error('Migration process failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Get migration status
     */
    async getMigrationStatus(): Promise<{
        total: number;
        executed: number;
        pending: number;
        migrations: Array<{
            id: number;
            filename: string;
            status: 'executed' | 'pending';
            executedAt?: Date;
        }>;
    }> {
        await this.initializeMigrationsTable();

        const allMigrations = this.getMigrationFiles();
        const executedMigrations = await this.getExecutedMigrations();

        const executedMap = new Map<number, MigrationRecord>();
        executedMigrations.forEach(migration => {
            executedMap.set(migration.id, migration);
        });

        const migrations = allMigrations.map(migration => {
            const executed = executedMap.get(migration.id);
            return {
                id: migration.id,
                filename: migration.filename,
                status: executed ? 'executed' as const : 'pending' as const,
                executedAt: executed?.executed_at,
            };
        });

        return {
            total: allMigrations.length,
            executed: executedMigrations.length,
            pending: allMigrations.length - executedMigrations.length,
            migrations,
        };
    }

    /**
     * Create a new migration file template
     */
    createMigration(description: string): string {
        const allMigrations = this.getMigrationFiles();
        const nextId = allMigrations.length > 0
            ? Math.max(...allMigrations.map(m => m.id)) + 1
            : 1;

        const paddedId = nextId.toString().padStart(3, '0');
        const sanitizedDescription = description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        const filename = `${paddedId}_${sanitizedDescription}.sql`;
        const filePath = join(this.migrationsPath, filename);

        const template = `-- Migration ${paddedId}: ${description}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL
-- );

-- Remember to add appropriate indexes and constraints

-- Migration completed
SELECT 'Migration ${paddedId} completed' as status;
`;

        require('fs').writeFileSync(filePath, template);

        logger.info('Migration file created', {
            filename,
            path: filePath,
        });

        return filePath;
    }
}

export const migrationRunner = new MigrationRunner();