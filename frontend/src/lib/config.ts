// Centralized API configuration - v3
// Hardcoded because Railway/Next.js env var injection is broken
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';

// Use runtime detection instead of build-time env vars
export const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        return window.location.hostname === 'localhost' ? DEV_API : PRODUCTION_API;
    }
    // SSR fallback - use production
    return PRODUCTION_API;
};

export const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? PRODUCTION_API
    : DEV_API;
