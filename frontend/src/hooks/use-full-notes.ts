'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

// Query keys
export const FULL_NOTES_KEYS = {
    all: ['full-notes'] as const,
    list: (params: FullNotesParams) => ['full-notes', 'list', params] as const,
    detail: (id: string) => ['full-notes', 'detail', id] as const,
};

export interface FullNote {
    id: string;
    title: string;
    summary: string | null;
    raw_content?: string;
    user_tags: string[];
    priority: string | null;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
}

export interface FullNotesParams {
    search?: string;
    sortBy?: 'updated_at' | 'created_at' | 'title';
    sortOrder?: 'desc' | 'asc';
    perPage?: number;
}

export interface FullNotesResponse {
    data: FullNote[];
    meta?: {
        total: number;
        page: number;
        per_page: number;
    };
}

/**
 * Hook for fetching full notes list.
 * Uses React Query for caching - data won't be refetched when switching tabs.
 */
export function useFullNotes(params: FullNotesParams = {}) {
    const { user, token } = useAuth();
    const {
        search = '',
        sortBy = 'updated_at',
        sortOrder = 'desc',
        perPage = 100,
    } = params;

    return useQuery({
        queryKey: FULL_NOTES_KEYS.list({ search, sortBy, sortOrder, perPage }),
        queryFn: async (): Promise<FullNotesResponse> => {
            const urlParams = new URLSearchParams({
                type: 'note',
                per_page: String(perPage),
                sort_by: sortBy,
                sort_order: sortOrder,
            });

            if (search) {
                urlParams.set('q', search);
            }

            const response = await fetch(`${API_URL}/api/v1/content/?${urlParams.toString()}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            return response.json();
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook for toggling favorite status on a full note.
 */
export function useToggleFullNoteFavorite() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteId: string) => {
            const response = await fetch(`${API_URL}/api/v1/content/${noteId}/favorite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onMutate: async (noteId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: FULL_NOTES_KEYS.all });

            // Snapshot previous value for rollback
            const previousQueries = queryClient.getQueriesData({ queryKey: FULL_NOTES_KEYS.all });

            // Optimistically update all matching queries
            queryClient.setQueriesData<FullNotesResponse>(
                { queryKey: FULL_NOTES_KEYS.all },
                (old) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((note) =>
                            note.id === noteId
                                ? { ...note, is_favorite: !note.is_favorite }
                                : note
                        ),
                    };
                }
            );

            return { previousQueries };
        },
        onError: (_err, _noteId, context) => {
            // Rollback on error
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Refetch after mutation settles
            queryClient.invalidateQueries({ queryKey: FULL_NOTES_KEYS.all });
        },
    });
}
