import { URLRedirectService } from '../services/urlRedirectService';
import { Request, Response } from 'express';

// Mock the dependencies
jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../config/kafka');

describe('URLRedirectService', () => {
    let redirectService: URLRedirectService;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        redirectService = new URLRedirectService();

        mockRequest = {
            ip: '127.0.0.1',
            get: jest.fn((header: string) => {
                switch (header) {
                    case 'User-Agent':
                        return 'Mozilla/5.0 (Test Browser)';
                    case 'Referer':
                        return 'https://example.com';
                    default:
                        return undefined;
                }
            }),
            connection: {
                remoteAddress: '127.0.0.1'
            } as any,
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            redirect: jest.fn().mockReturnThis(),
        };
    });

    describe('resolveUrl', () => {
        it('should return not_found for non-existent URL', async () => {
            const result = await redirectService.resolveUrl('nonexistent');

            expect(result.status).toBe('not_found');
            expect(result.urlMapping).toBeNull();
            expect(result.latency).toBeGreaterThan(0);
        });
    });

    describe('getStats', () => {
        it('should return initial statistics', () => {
            const stats = redirectService.getStats();

            expect(stats.totalRedirects).toBe(0);
            expect(stats.successfulRedirects).toBe(0);
            expect(stats.notFoundErrors).toBe(0);
            expect(stats.expiredErrors).toBe(0);
            expect(stats.serverErrors).toBe(0);
            expect(stats.averageLatency).toBe(0);
            expect(stats.cacheHitRate).toBe(0);
        });
    });

    describe('healthCheck', () => {
        it('should return health status', async () => {
            const health = await redirectService.healthCheck();

            expect(health).toHaveProperty('service');
            expect(health).toHaveProperty('cache');
            expect(health).toHaveProperty('analytics');
            expect(health.cache).toHaveProperty('memory');
            expect(health.cache).toHaveProperty('redis');
            expect(health.cache).toHaveProperty('database');
            expect(health.cache).toHaveProperty('overall');
        });
    });

    describe('getPerformanceMetrics', () => {
        it('should return comprehensive metrics', () => {
            const metrics = redirectService.getPerformanceMetrics();

            expect(metrics).toHaveProperty('stats');
            expect(metrics).toHaveProperty('cacheStats');
            expect(metrics).toHaveProperty('analyticsStats');
            expect(metrics).toHaveProperty('healthStatus');
        });
    });
});