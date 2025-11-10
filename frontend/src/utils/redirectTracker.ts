/**
 * Global redirect tracker to prevent duplicate redirects
 * This helps prevent issues with React StrictMode and other duplicate execution scenarios
 */

class RedirectTracker {
    private redirectedCodes: Set<string> = new Set();
    private redirectTimestamps: Map<string, number> = new Map();
    private readonly COOLDOWN_MS = 1000; // 1 second cooldown between redirects for same code

    /**
     * Check if we should allow a redirect for this short code
     * Returns true if redirect should proceed, false if it should be blocked
     */
    shouldRedirect(shortCode: string): boolean {
        const now = Date.now();
        const lastRedirect = this.redirectTimestamps.get(shortCode);

        // If we've redirected this code recently, block it
        if (lastRedirect && (now - lastRedirect) < this.COOLDOWN_MS) {
            console.log(`RedirectTracker: Blocking duplicate redirect for ${shortCode} (cooldown active)`);
            return false;
        }

        // If we've already redirected this code in this session, block it
        if (this.redirectedCodes.has(shortCode)) {
            console.log(`RedirectTracker: Blocking duplicate redirect for ${shortCode} (already redirected)`);
            return false;
        }

        return true;
    }

    /**
     * Mark a short code as redirected
     */
    markRedirected(shortCode: string): void {
        this.redirectedCodes.add(shortCode);
        this.redirectTimestamps.set(shortCode, Date.now());
        console.log(`RedirectTracker: Marked ${shortCode} as redirected`);
    }

    /**
     * Clear redirect tracking for a short code (useful for testing)
     */
    clearCode(shortCode: string): void {
        this.redirectedCodes.delete(shortCode);
        this.redirectTimestamps.delete(shortCode);
    }

    /**
     * Clear all redirect tracking
     */
    clearAll(): void {
        this.redirectedCodes.clear();
        this.redirectTimestamps.clear();
    }
}

// Export singleton instance
export const redirectTracker = new RedirectTracker();
