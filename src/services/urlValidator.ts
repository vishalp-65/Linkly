import { logger } from '../config/logger';

/**
 * URL Validation and Sanitization Service
 * Handles URL format validation, malicious domain blocking, and input sanitization
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedUrl?: string;
}

export interface CustomAliasValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedAlias?: string;
}

export class URLValidator {
    private static readonly MAX_URL_LENGTH = 2048;
    private static readonly CUSTOM_ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

    // Malicious domains blocklist (in production, this would be loaded from a database or external service)
    private static readonly BLOCKED_DOMAINS = new Set([
        'malware.com',
        'phishing.net',
        'spam.org',
        'virus.info',
        'scam.site',
        // Add more blocked domains as needed
    ]);

    // Dangerous URL patterns that could indicate injection attacks
    private static readonly DANGEROUS_PATTERNS = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /ftp:/i,
        /<script/i,
        /onload=/i,
        /onerror=/i,
        /onclick=/i,
    ];

    /**
     * Validate and sanitize a URL
     */
    static validateUrl(url: string): ValidationResult {
        try {
            // Basic length check
            if (!url || url.trim().length === 0) {
                return {
                    isValid: false,
                    error: 'URL cannot be empty',
                };
            }

            const trimmedUrl = url.trim();

            // Length validation
            if (trimmedUrl.length > this.MAX_URL_LENGTH) {
                return {
                    isValid: false,
                    error: `URL exceeds maximum length of ${this.MAX_URL_LENGTH} characters`,
                };
            }

            // Check for dangerous patterns first
            for (const pattern of this.DANGEROUS_PATTERNS) {
                if (pattern.test(trimmedUrl)) {
                    logger.warn('Dangerous URL pattern detected', {
                        url: trimmedUrl.substring(0, 100), // Log only first 100 chars for security
                        pattern: pattern.toString(),
                    });
                    return {
                        isValid: false,
                        error: 'URL contains potentially dangerous content',
                    };
                }
            }

            // Sanitize URL by removing potentially harmful characters
            const sanitizedUrl = this.sanitizeUrl(trimmedUrl);

            // URL format validation
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(sanitizedUrl);
            } catch (error) {
                return {
                    isValid: false,
                    error: 'Invalid URL format',
                };
            }

            // Protocol validation - only allow HTTP and HTTPS
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return {
                    isValid: false,
                    error: 'Only HTTP and HTTPS protocols are allowed',
                };
            }

            // Domain validation
            const domain = parsedUrl.hostname.toLowerCase();

            // Check against blocked domains
            if (this.BLOCKED_DOMAINS.has(domain)) {
                logger.warn('Blocked domain detected', { domain });
                return {
                    isValid: false,
                    error: 'This domain is not allowed',
                };
            }

            // Check for suspicious domain patterns
            if (this.isSuspiciousDomain(domain)) {
                logger.warn('Suspicious domain detected', { domain });
                return {
                    isValid: false,
                    error: 'This domain appears to be suspicious',
                };
            }

            // Additional security checks
            if (this.hasOpenRedirectRisk(sanitizedUrl)) {
                return {
                    isValid: false,
                    error: 'URL contains potential open redirect vulnerability',
                };
            }

            logger.debug('URL validation successful', {
                originalLength: url.length,
                sanitizedLength: sanitizedUrl.length,
                domain,
            });

            return {
                isValid: true,
                sanitizedUrl,
            };
        } catch (error) {
            logger.error('URL validation error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                isValid: false,
                error: 'URL validation failed',
            };
        }
    }

    /**
     * Validate custom alias format and availability
     */
    static validateCustomAlias(alias: string): CustomAliasValidationResult {
        try {
            if (!alias || alias.trim().length === 0) {
                return {
                    isValid: false,
                    error: 'Custom alias cannot be empty',
                };
            }

            const trimmedAlias = alias.trim();

            // Format validation
            if (!this.CUSTOM_ALIAS_PATTERN.test(trimmedAlias)) {
                return {
                    isValid: false,
                    error: 'Custom alias must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores',
                };
            }

            // Reserved words check
            if (this.isReservedAlias(trimmedAlias)) {
                return {
                    isValid: false,
                    error: 'This alias is reserved and cannot be used',
                };
            }

            // Sanitize alias
            const sanitizedAlias = this.sanitizeAlias(trimmedAlias);

            return {
                isValid: true,
                sanitizedAlias,
            };
        } catch (error) {
            logger.error('Custom alias validation error', {
                alias,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                isValid: false,
                error: 'Custom alias validation failed',
            };
        }
    }

    /**
     * Sanitize URL by removing or encoding potentially harmful characters
     */
    private static sanitizeUrl(url: string): string {
        // Remove null bytes and control characters
        let sanitized = url.replace(/[\x00-\x1F\x7F]/g, '');

        // Remove leading/trailing whitespace
        sanitized = sanitized.trim();

        // Normalize Unicode characters
        sanitized = sanitized.normalize('NFC');

        return sanitized;
    }

    /**
     * Sanitize custom alias
     */
    private static sanitizeAlias(alias: string): string {
        // Convert to lowercase for consistency
        let sanitized = alias.toLowerCase();

        // Remove any characters that aren't allowed
        sanitized = sanitized.replace(/[^a-z0-9_-]/g, '');

        return sanitized;
    }

    /**
     * Check if domain appears suspicious
     */
    private static isSuspiciousDomain(domain: string): boolean {
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
            /[0-9]{10,}/, // Long sequences of numbers
            /(.)\1{5,}/, // Repeated characters (e.g., aaaaaa.com)
            /^[a-z]{1,2}\./, // Very short subdomains
        ];

        return suspiciousPatterns.some(pattern => pattern.test(domain));
    }

    /**
     * Check for open redirect vulnerabilities
     */
    private static hasOpenRedirectRisk(url: string): boolean {
        // Look for patterns that might indicate open redirect attempts
        const openRedirectPatterns = [
            /[?&]url=/i,
            /[?&]redirect=/i,
            /[?&]return=/i,
            /[?&]goto=/i,
            /[?&]next=/i,
            /\/\/.*\/\//,  // Double slashes in path
            /@/,           // @ symbol (can be used for redirects)
        ];

        return openRedirectPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Check if alias is reserved
     */
    private static isReservedAlias(alias: string): boolean {
        const reservedAliases = new Set([
            'api',
            'www',
            'admin',
            'root',
            'help',
            'support',
            'about',
            'contact',
            'terms',
            'privacy',
            'login',
            'logout',
            'register',
            'signup',
            'signin',
            'dashboard',
            'analytics',
            'settings',
            'profile',
            'account',
            'health',
            'status',
            'metrics',
            'docs',
            'documentation',
            'blog',
            'news',
            'faq',
            'legal',
            'security',
            'abuse',
            'dmca',
            'copyright',
            'trademark',
        ]);

        return reservedAliases.has(alias.toLowerCase());
    }

    /**
     * Add domain to blocklist (for dynamic blocking)
     */
    static addBlockedDomain(domain: string): void {
        this.BLOCKED_DOMAINS.add(domain.toLowerCase());
        logger.info('Domain added to blocklist', { domain });
    }

    /**
     * Remove domain from blocklist
     */
    static removeBlockedDomain(domain: string): void {
        this.BLOCKED_DOMAINS.delete(domain.toLowerCase());
        logger.info('Domain removed from blocklist', { domain });
    }

    /**
     * Get current blocked domains (for admin purposes)
     */
    static getBlockedDomains(): string[] {
        return Array.from(this.BLOCKED_DOMAINS);
    }

    /**
     * Validate URL length only (for quick checks)
     */
    static isValidLength(url?: string | null): boolean {
        if (!url) return false;
        const trimmed = url.trim();
        return trimmed.length > 0 && trimmed.length <= this.MAX_URL_LENGTH;
    }


    /**
     * Extract domain from URL
     */
    static extractDomain(url: string): string | null {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.toLowerCase();
        } catch {
            return null;
        }
    }
}