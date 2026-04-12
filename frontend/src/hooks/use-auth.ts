/**
 * Authentication hook.
 * Uses JWT tokens with the self-hosted backend (replaces Supabase auth).
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAccessToken, setTokens, clearTokens } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface User {
    id: string;
    email: string;
}

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    token: string | null;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing token on mount
        const existingToken = getAccessToken();
        if (existingToken) {
            setToken(existingToken);
            // Validate token by calling /auth/me
            fetch(`${API_URL}/api/v1/auth/me`, {
                headers: { 'Authorization': `Bearer ${existingToken}` },
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Invalid token');
                })
                .then(data => {
                    setUser({ id: data.id, email: data.email || '' });
                })
                .catch(() => {
                    clearTokens();
                    setToken(null);
                    setUser(null);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return { error: data.detail || 'Invalid credentials' };
            }

            const data = await res.json();
            const accessToken = data.session.access_token;
            const refreshToken = data.session.refresh_token;

            setTokens(accessToken, refreshToken);
            setToken(accessToken);
            setUser({ id: data.user.id, email: data.user.email || '' });

            return {};
        } catch (err) {
            return { error: 'An error occurred during sign in' };
        }
    }, []);

    const signUp = useCallback(async (email: string, password: string, name?: string) => {
        try {
            const res = await fetch(`${API_URL}/api/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return { error: data.detail || 'Registration failed' };
            }

            const data = await res.json();
            const accessToken = data.session.access_token;
            const refreshToken = data.session.refresh_token;

            setTokens(accessToken, refreshToken);
            setToken(accessToken);
            setUser({ id: data.user.id, email: data.user.email || '' });

            return {};
        } catch (err) {
            return { error: 'An error occurred during sign up' };
        }
    }, []);

    const signOut = useCallback(async () => {
        clearTokens();
        setToken(null);
        setUser(null);
    }, []);

    return {
        user,
        loading,
        token,
        signIn,
        signUp,
        signOut,
    };
}
