import { createClient, createCluster, RedisClientType, RedisClusterType } from 'redis';
import { logger } from './logger';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetries: number;
  retryDelay: number;
  clusterNodes?: string[];
}

const config: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  clusterNodes: process.env.REDIS_CLUSTER_NODES?.split(',') || undefined,
};

class RedisConnection {
  private client: RedisClientType | RedisClusterType;
  private static instance: RedisConnection;
  private isCluster: boolean;

  private constructor() {
    this.isCluster = !!config.clusterNodes && config.clusterNodes.length > 0;

    if (this.isCluster) {
      this.client = createCluster({
        rootNodes: config.clusterNodes!.map(node => {
          const [host, port] = node.split(':');
          return { url: `redis://${host}:${port}` };
        }),
        defaults: {
          password: config.password,
          socket: {
            reconnectStrategy: (retries: number) => {
              if (retries > config.maxRetries) {
                logger.error('Redis cluster max retries exceeded');
                return false;
              }
              return Math.min(retries * config.retryDelay, 3000);
            },
          },
        },
      });
    } else {
      this.client = createClient({
        socket: {
          host: config.host,
          port: config.port,
          reconnectStrategy: (retries: number) => {
            if (retries > config.maxRetries) {
              logger.error('Redis max retries exceeded');
              return false;
            }
            return Math.min(retries * config.retryDelay, 3000);
          },
        },
        password: config.password,
        database: config.db,
      });
    }

    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info(`Redis ${this.isCluster ? 'cluster' : 'client'} connecting`);
    });

    this.client.on('ready', () => {
      logger.info(`Redis ${this.isCluster ? 'cluster' : 'client'} ready`);
    });

    this.client.on('error', (error: any) => {
      logger.error(`Redis ${this.isCluster ? 'cluster' : 'client'} error`, {
        error: error.message,
        stack: error.stack,
      });
    });

    this.client.on('end', () => {
      logger.info(`Redis ${this.isCluster ? 'cluster' : 'client'} connection ended`);
    });

    this.client.on('reconnecting', () => {
      logger.warn(`Redis ${this.isCluster ? 'cluster' : 'client'} reconnecting`);
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info(`Redis ${this.isCluster ? 'cluster' : 'client'} connected successfully`);
    } catch (error) {
      logger.error(`Failed to connect to Redis ${this.isCluster ? 'cluster' : 'client'}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public getClient(): RedisClientType | RedisClusterType {
    return this.client;
  }

  public async get(key: string): Promise<string | null> {
    try {
      const result = await this.client.get(key);
      logger.debug('Redis GET operation', { key, found: !!result });
      return result;
    } catch (error) {
      logger.error('Redis GET operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      logger.debug('Redis SET operation', { key, ttl });
    } catch (error) {
      logger.error('Redis SET operation failed', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async del(key: string): Promise<number> {
    try {
      const result = await this.client.del(key);
      logger.debug('Redis DEL operation', { key, deleted: result });
      return result;
    } catch (error) {
      logger.error('Redis DEL operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      logger.debug('Redis EXISTS operation', { key, exists: !!result });
      return !!result;
    } catch (error) {
      logger.error('Redis EXISTS operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async incr(key: string): Promise<number> {
    try {
      const result = await this.client.incr(key);
      logger.debug('Redis INCR operation', { key, value: result });
      return result;
    } catch (error) {
      logger.error('Redis INCR operation failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      logger.debug('Redis EXPIRE operation', { key, seconds, success: result });
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE operation failed', {
        key,
        seconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const result = await this.client.hGetAll(key);
      return result;
    } catch (error) {
      logger.error('Redis hgetall failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async hmset(key: string, data: Record<string, any>): Promise<void> {
    try {
      await this.client.hSet(key, data);
    } catch (error) {
      logger.error('Redis hmset failed', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await (this.client as any).ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.client.quit();
      logger.info(`Redis ${this.isCluster ? 'cluster' : 'client'} connection closed`);
    } catch (error) {
      logger.error(`Error closing Redis ${this.isCluster ? 'cluster' : 'client'} connection`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const redis = RedisConnection.getInstance();
export default redis;
