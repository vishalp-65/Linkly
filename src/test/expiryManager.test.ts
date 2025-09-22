import { ExpiryManagerService } from '../services/expiryManagerService';

describe('ExpiryManagerService', () => {
    let expiryManager: ExpiryManagerService;

    beforeEach(() => {
        expiryManager = new ExpiryManagerService();
    });

    afterEach(() => {
        if (expiryManager.isActive()) {
            expiryManager.stop();
        }
    });

    describe('Service Lifecycle', () => {
        it('should initialize with correct default state', () => {
            expect(expiryManager.isActive()).toBe(false);

            const stats = expiryManager.getStats();
            expect(stats.activeExpiryJob.totalRuns).toBe(0);
            expect(stats.hardDeletionJob.totalRuns).toBe(0);
        });

        it('should start and stop correctly', () => {
            expect(expiryManager.isActive()).toBe(false);

            expiryManager.start();
            expect(expiryManager.isActive()).toBe(true);

            expiryManager.stop();
            expect(expiryManager.isActive()).toBe(false);
        });

        it('should handle multiple start calls gracefully', () => {
            expiryManager.start();
            expect(expiryManager.isActive()).toBe(true);

            // Should not throw or cause issues
            expiryManager.start();
            expect(expiryManager.isActive()).toBe(true);
        });

        it('should handle multiple stop calls gracefully', () => {
            expiryManager.start();
            expiryManager.stop();
            expect(expiryManager.isActive()).toBe(false);

            // Should not throw or cause issues
            expiryManager.stop();
            expect(expiryManager.isActive()).toBe(false);
        });
    });

    describe('Statistics', () => {
        it('should provide initial statistics', () => {
            const stats = expiryManager.getStats();

            expect(stats).toHaveProperty('activeExpiryJob');
            expect(stats).toHaveProperty('hardDeletionJob');

            expect(stats.activeExpiryJob.totalRuns).toBe(0);
            expect(stats.activeExpiryJob.urlsProcessed).toBe(0);
            expect(stats.activeExpiryJob.urlsExpired).toBe(0);
            expect(stats.activeExpiryJob.errors).toBe(0);

            expect(stats.hardDeletionJob.totalRuns).toBe(0);
            expect(stats.hardDeletionJob.urlsDeleted).toBe(0);
            expect(stats.hardDeletionJob.errors).toBe(0);
        });

        it('should reset statistics correctly', () => {
            const stats = expiryManager.getStats();

            // Modify stats (in real scenario, these would be updated by job runs)
            stats.activeExpiryJob.totalRuns = 5;
            stats.hardDeletionJob.totalRuns = 2;

            expiryManager.resetStats();

            const resetStats = expiryManager.getStats();
            expect(resetStats.activeExpiryJob.totalRuns).toBe(0);
            expect(resetStats.hardDeletionJob.totalRuns).toBe(0);
        });
    });

    describe('Next Run Times', () => {
        it('should return null for next run times when not started', () => {
            const nextRuns = expiryManager.getNextRunTimes();

            expect(nextRuns.activeExpiry).toBeNull();
            expect(nextRuns.hardDeletion).toBeNull();
        });

        it('should return valid dates for next run times when started', () => {
            expiryManager.start();

            const nextRuns = expiryManager.getNextRunTimes();

            expect(nextRuns.activeExpiry).toBeInstanceOf(Date);
            expect(nextRuns.hardDeletion).toBeInstanceOf(Date);

            // Next active expiry should be within 5 minutes
            const now = new Date();
            const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
            expect(nextRuns.activeExpiry!.getTime()).toBeLessThanOrEqual(fiveMinutesFromNow.getTime());

            // Next hard deletion should be tomorrow at 2 AM or today at 2 AM if it's before 2 AM
            expect(nextRuns.hardDeletion!.getHours()).toBe(2);
            expect(nextRuns.hardDeletion!.getMinutes()).toBe(0);
        });
    });
});