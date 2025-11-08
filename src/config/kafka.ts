import { Kafka, KafkaConfig, Producer, Consumer, Admin } from 'kafkajs';
import { logger } from './logger';

interface KafkaConfiguration extends KafkaConfig {
    brokers: string[];
    clientId: string;
    connectionTimeout: number;
    requestTimeout: number;
    retry: {
        initialRetryTime: number;
        retries: number;
    };
}

const config: KafkaConfiguration = {
    clientId: process.env.KAFKA_CLIENT_ID || 'url-shortener-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '2000'),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '5000'),
    retry: {
        initialRetryTime: parseInt(process.env.KAFKA_INITIAL_RETRY_TIME || '100'),
        retries: parseInt(process.env.KAFKA_RETRIES || '2'),
    },
    ssl: process.env.KAFKA_SSL_ENABLED === 'true' ? {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
    } : false,
    sasl: process.env.KAFKA_SASL_MECHANISM ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM as any,
        username: process.env.KAFKA_SASL_USERNAME || '',
        password: process.env.KAFKA_SASL_PASSWORD || '',
    } : undefined,
};

class KafkaConnection {
    private kafka: Kafka;
    private producer: Producer | null = null;
    private admin: Admin | null = null;
    private static instance: KafkaConnection;
    private isConnected = false;

    private constructor() {
        this.kafka = new Kafka(config);
        this.setupEventHandlers();
    }

    public static getInstance(): KafkaConnection {
        if (!KafkaConnection.instance) {
            KafkaConnection.instance = new KafkaConnection();
        }
        return KafkaConnection.instance;
    }

    private setupEventHandlers(): void {
        // Producer event handlers will be set up when producer is created
    }

    public async connect(): Promise<void> {
        try {
            if (this.isConnected) {
                return;
            }

            // Initialize admin client for topic management
            this.admin = this.kafka.admin();
            await this.admin.connect();

            // Initialize producer
            this.producer = this.kafka.producer({
                maxInFlightRequests: 1,
                idempotent: true,
                transactionTimeout: 30000,
                retry: {
                    initialRetryTime: 100,
                    retries: 8,
                },
            });

            // Set up producer event handlers
            this.producer.on('producer.connect', () => {
                logger.info('Kafka producer connected');
            });

            this.producer.on('producer.disconnect', () => {
                logger.warn('Kafka producer disconnected');
                this.isConnected = false;
            });

            this.producer.on('producer.network.request_timeout', (payload) => {
                logger.error('Kafka producer request timeout', { payload });
            });

            await this.producer.connect();
            this.isConnected = true;

            logger.info('Kafka connection established', {
                clientId: config.clientId,
                brokers: config.brokers,
            });

        } catch (error) {
            logger.error('Failed to connect to Kafka', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    public async createTopics(): Promise<void> {
        if (!this.admin) {
            throw new Error('Kafka admin client not initialized');
        }

        try {
            const topics = [
                {
                    topic: 'url_clicks',
                    numPartitions: parseInt(process.env.KAFKA_URL_CLICKS_PARTITIONS || '6'),
                    replicationFactor: parseInt(process.env.KAFKA_REPLICATION_FACTOR || '1'),
                    configEntries: [
                        {
                            name: 'retention.ms',
                            value: process.env.KAFKA_URL_CLICKS_RETENTION || '604800000', // 7 days
                        },
                        {
                            name: 'cleanup.policy',
                            value: 'delete',
                        },
                        {
                            name: 'compression.type',
                            value: 'snappy',
                        },
                        {
                            name: 'segment.ms',
                            value: '86400000', // 1 day
                        },
                    ],
                },
            ];

            // Check existing topics
            const existingTopics = await this.admin.listTopics();
            const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic.topic));

            if (topicsToCreate.length > 0) {
                await this.admin.createTopics({
                    topics: topicsToCreate,
                    waitForLeaders: true,
                    timeout: 30000,
                });

                logger.info('Kafka topics created', {
                    topics: topicsToCreate.map(t => t.topic),
                });
            } else {
                logger.info('All required Kafka topics already exist');
            }

        } catch (error) {
            logger.error('Failed to create Kafka topics', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    public getProducer(): Producer {
        if (!this.producer) {
            throw new Error('Kafka producer not initialized. Call connect() first.');
        }
        return this.producer;
    }

    public createConsumer(groupId: string): Consumer {
        return this.kafka.consumer({
            groupId,
            sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000'),
            rebalanceTimeout: parseInt(process.env.KAFKA_REBALANCE_TIMEOUT || '60000'),
            heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000'),
            maxBytesPerPartition: parseInt(process.env.KAFKA_MAX_BYTES_PER_PARTITION || '1048576'),
            retry: {
                initialRetryTime: 100,
                retries: 8,
            },
        });
    }

    public async healthCheck(): Promise<boolean> {
        try {
            if (!this.admin) {
                return false;
            }

            // Try to list topics as a health check
            await this.admin.listTopics();
            return this.isConnected;
        } catch (error) {
            logger.error('Kafka health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.producer) {
                await this.producer.disconnect();
                this.producer = null;
            }

            if (this.admin) {
                await this.admin.disconnect();
                this.admin = null;
            }

            this.isConnected = false;
            logger.info('Kafka connection closed');
        } catch (error) {
            logger.error('Error disconnecting from Kafka', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    public isKafkaConnected(): boolean {
        return this.isConnected;
    }
}

export const kafka = KafkaConnection.getInstance();
export default kafka;