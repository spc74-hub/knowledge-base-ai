/**
 * Authentication hook.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
    id: string;
    email: string;
}

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                });
            }
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser({
                    id: session.user.id,
                    email: session.user.email || '',
                });
            } else {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: error.message };
            }

            return {};
        } catch (err) {
            return { error: 'An error occurred during sign in' };
        }
    }, []);

    const signUp = useCallback(async (email: string, password: string, name?: string) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            });

            if (error) {
                return { error: error.message };
            }

            return {};
        } catch (err) {
            return { error: 'An error occurred during sign up' };
        }
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
    }, []);

    return {
        user,
        loading,
        signIn,
        signUp,
        signOut,
    };
}
