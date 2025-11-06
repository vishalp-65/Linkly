import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Define validation schema for environment variables
const envSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().default('localhost'),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MIN: Joi.number().min(1).default(2),
  DB_POOL_MAX: Joi.number().min(1).default(10),
  DB_CONNECTION_TIMEOUT: Joi.number().min(1000).default(30000),
  DB_IDLE_TIMEOUT: Joi.number().min(1000).default(30000),

  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().min(0).max(15).default(0),
  REDIS_CLUSTER_NODES: Joi.string().optional(),
  REDIS_MAX_RETRIES: Joi.number().min(0).default(3),
  REDIS_RETRY_DELAY: Joi.number().min(10).default(100),

  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  API_KEY_SECRET: Joi.string().min(32).required(),
  BCRYPT_ROUNDS: Joi.number().min(8).max(15).default(12),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().min(1).default(100),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('logs/app.log'),
  LOG_MAX_SIZE: Joi.string().default('10m'),
  LOG_MAX_FILES: Joi.number().min(1).default(5),

  // Analytics
  KAFKA_BROKERS: Joi.string().optional(),
  KAFKA_TOPIC_CLICKS: Joi.string().default('url_clicks'),
  KAFKA_CLIENT_ID: Joi.string().default('url-shortener-api'),

  // Monitoring
  METRICS_PORT: Joi.number().port().default(9090),
  HEALTH_CHECK_TIMEOUT: Joi.number().min(1000).default(5000),

  // Tracing
  JAEGER_ENDPOINT: Joi.string().uri().optional(),
  ZIPKIN_ENDPOINT: Joi.string().uri().optional(),
  TRACING_ENABLED: Joi.boolean().default(true),
}).unknown(true); // Allow unknown environment variables

// Validate environment variables
const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error('Environment validation failed:', error.details.map(detail => ({
    key: detail.path.join('.'),
    message: detail.message,
  })));
  process.exit(1);
}

// Export validated environment configuration
export const config = {
  // Server
  nodeEnv: env.NODE_ENV as string,
  port: env.PORT as number,
  host: env.HOST as string,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // Database
  database: {
    host: env.DB_HOST as string,
    port: env.DB_PORT as number,
    name: env.DB_NAME as string,
    user: env.DB_USER as string,
    password: env.DB_PASSWORD as string,
    pool: {
      min: env.DB_POOL_MIN as number,
      max: env.DB_POOL_MAX as number,
      connectionTimeout: env.DB_CONNECTION_TIMEOUT as number,
      idleTimeout: env.DB_IDLE_TIMEOUT as number,
    },
  },

  // Redis
  redis: {
    host: env.REDIS_HOST as string,
    port: env.REDIS_PORT as number,
    password: env.REDIS_PASSWORD as string | undefined,
    db: env.REDIS_DB as number,
    clusterNodes: env.REDIS_CLUSTER_NODES?.split(',') || undefined,
    maxRetries: env.REDIS_MAX_RETRIES as number,
    retryDelay: env.REDIS_RETRY_DELAY as number,
  },

  // Security
  jwtSecret: env.JWT_SECRET as string,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET as string,
  security: {
    jwtSecret: env.JWT_SECRET as string,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET as string,
    apiKeySecret: env.API_KEY_SECRET as string,
    bcryptRounds: env.BCRYPT_ROUNDS as number,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS as number,
  },

  // Logging
  logging: {
    level: env.LOG_LEVEL as string,
    filePath: env.LOG_FILE_PATH as string,
    maxSize: env.LOG_MAX_SIZE as string,
    maxFiles: env.LOG_MAX_FILES as number,
  },

  // Analytics
  analytics: {
    kafkaBrokers: env.KAFKA_BROKERS as string | undefined,
    kafkaTopicClicks: env.KAFKA_TOPIC_CLICKS as string,
    kafkaClientId: env.KAFKA_CLIENT_ID as string,
  },

  // Monitoring
  monitoring: {
    metricsPort: env.METRICS_PORT as number,
    healthCheckTimeout: env.HEALTH_CHECK_TIMEOUT as number,
  },

  // Tracing
  tracing: {
    jaegerEndpoint: env.JAEGER_ENDPOINT as string | undefined,
    zipkinEndpoint: env.ZIPKIN_ENDPOINT as string | undefined,
    enabled: env.TRACING_ENABLED as boolean,
  },
};

// Configuration loaded successfully
// Logging will be done in the server startup to avoid circular dependencies

export default config;
