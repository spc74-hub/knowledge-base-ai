/**
 * Auth token management (replaces Supabase client).
 * Stores JWT tokens in localStorage.
 */

const TOKEN_KEY = 'kbia_access_token';
const REFRESH_TOKEN_KEY = 'kbia_refresh_token';

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Legacy compatibility - some components import 'supabase' from here
// This is a no-op stub so they don't crash at import time
export const supabase = {
    auth: {
        getSession: async () => {
            const token = getAccessToken();
            if (token) {
                return {
                    data: {
                        session: {
                            access_token: token,
                            user: null, // Will be populated by useAuth
                        }
                    }
                };
            }
            return { data: { session: null } };
        },
        onAuthStateChange: (_callback: any) => {
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithPassword: async (_creds: any) => ({ error: new Error('Use API login') }),
        signUp: async (_creds: any) => ({ error: new Error('Use API register') }),
        signOut: async () => { clearTokens(); },
    }
};
