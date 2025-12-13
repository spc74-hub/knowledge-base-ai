// Centralized API configuration - v4
// Hardcoded because Railway/Next.js env var injection is broken
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';

// MUST be called at runtime (inside component/hook), NOT at module level
export const getApiUrl = (): string => {
    if (typeof window !== 'undefined') {
        return window.location.hostname === 'localhost' ? DEV_API : PRODUCTION_API;
    }
    // SSR fallback - always use production for safety
    return PRODUCTION_API;
};

// For backwards compatibility - but this gets evaluated at build time on server
// so it may not work correctly. Prefer getApiUrl() instead.
export const API_URL = PRODUCTION_API; // Always default to production
