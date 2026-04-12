// Centralized API configuration
// Uses NEXT_PUBLIC_API_URL environment variable for Docker deployment

const getApiUrl = (): string => {
    // Check for environment variable first (Docker/production)
    if (process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    // Development fallback
    if (typeof window !== 'undefined') {
        return window.location.hostname === 'localhost'
            ? 'http://localhost:8000'
            : `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
};

export { getApiUrl };
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
