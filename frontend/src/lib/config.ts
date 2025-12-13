// Centralized API configuration - v2
// Hardcoded because Railway/Next.js env var injection is broken
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';

export const API_URL = process.env.NODE_ENV === 'production' ? PRODUCTION_API : DEV_API;

// Force rebuild marker: 20241213-1310
