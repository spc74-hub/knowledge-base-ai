// Centralized API configuration
// Hardcoded because Railway/Next.js env var injection is broken
export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://knowledge-base-ai-production.up.railway.app'
  : 'http://localhost:8000';
