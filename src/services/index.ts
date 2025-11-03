/**
 * Service exports for URL Shortener
 * Provides centralized access to all service modules
 */

// ID Generation Services
export { IDGenerator } from './idGenerator';
export { CounterService } from './counterService';
export { HashIdGenerator } from './hashIdGenerator';
export { FallbackManager } from './fallbackManager';

// URL Services
export { URLShortenerService } from './urlShortenerService';
export { URLValidator } from './urlValidator';
export { AliasChecker } from './aliasChecker';
export { URLCacheService } from './urlCacheService';
export { URLRedirectService } from './urlRedirectService';

// Cache Services
export { LRUCache } from './lruCache';
export { MultiLayerCacheService } from './multiLayerCacheService';

// Analytics Services
export { analyticsEventProducer } from './analyticsEventProducer';

// Expiry Management Services
export { ExpiryManagerService } from './expiryManagerService';

// Type exports
export type {
    IDGeneratorOptions,
    GeneratedID
} from './idGenerator';

export type {
    CounterRange
} from './counterService';

export type {
    HashGeneratorOptions,
    HashGenerationResult
} from './hashIdGenerator';

export type {
    FallbackStatus,
    FallbackConfig
} from './fallbackManager';

export type {
    CreateUrlRequest,
    CreateUrlResponse,
    UrlCreationError
} from './urlShortenerService';

export type {
    ValidationResult,
    CustomAliasValidationResult
} from './urlValidator';

export type {
    AliasAvailabilityResult
} from './aliasChecker';

export type {
    CacheOptions,
    CacheStats
} from './urlCacheService';

export type {
    RedirectResult,
    RedirectStats
} from './urlRedirectService';

export type {
    LRUCacheStats
} from './lruCache';

export type {
    CacheLookupResult,
    MultiLayerCacheStats
} from './multiLayerCacheService';

export type {
    ClickEventPayload
} from './analyticsEventProducer';

export type {
    ExpiryManagerStats
} from './expiryManagerService';