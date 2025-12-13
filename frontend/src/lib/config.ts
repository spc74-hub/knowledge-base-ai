// Centralized API configuration
// Hardcoded for production - Railway env vars not working properly
export const API_URL = typeof window !== 'undefined' && window.location.hostname.includes('railway.app')
  ? 'https://knowledge-base-ai-production.up.railway.app'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
