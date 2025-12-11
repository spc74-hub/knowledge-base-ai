/**
 * Application providers.
 */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from '@/hooks/use-theme';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5 minutes - prevents re-fetching when switching tabs
                        gcTime: 10 * 60 * 1000, // 10 minutes cache time
                        refetchOnWindowFocus: false,
                        refetchOnMount: false, // Don't refetch if data is fresh
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    );
}
