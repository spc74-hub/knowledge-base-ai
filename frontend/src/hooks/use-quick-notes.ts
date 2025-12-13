'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

// Query keys
export const QUICK_NOTES_KEYS = {
    all: ['quick-notes'] as const,
    list: (params: QuickNotesParams) => ['quick-notes', 'list', params] as const,
};

export interface QuickNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    linked_content_ids: string[];
    linked_note_ids: string[];
    source_content_id: string | null;
    linked_project_id: string | null;
    linked_model_id: string | null;
    is_pinned: boolean;
    is_completed: boolean;
    is_full_note?: boolean;
    priority: string | null;
    created_at: string;
    updated_at: string;
    source_content?: { id: string; title: string; type: string; url?: string };
    linked_project?: { id: string; name: string; icon?: string; color?: string };
    linked_model?: { id: string; tag: string; taxonomy_value: string };
    linked_objectives?: { id: string; title: string; icon?: string; color?: string; status?: string }[];
}

export interface Facet {
    value: string;
    label: string;
    icon: string;
    count: number;
}

export interface Facets {
    note_types: Facet[];
    linkage: Facet[];
    priorities: Facet[];
    total_notes: number;
    pinned_count: number;
}

export interface QuickNotesParams {
    filterType?: string[];
    excludeTypes?: string[];
    linkageFilter?: string[];
    excludeLinkage?: string[];
    searchQuery?: string;
    showCompleted?: boolean;
    priorityFilter?: string[];
    excludePriorities?: string[];
    favoriteFilter?: 'all' | 'favorites' | 'not_favorites';
    sortBy?: string;
    sortOrder?: string;
}

export interface QuickNotesResponse {
    data: QuickNote[];
    facets: Facets | null;
}

/**
 * Hook for fetching quick notes list with search/filter.
 * Uses React Query for caching - data won't be refetched when switching tabs.
 */
export function useQuickNotes(params: QuickNotesParams = {}) {
    const { user, token } = useAuth();
    const {
        filterType = [],
        excludeTypes = [],
        linkageFilter = [],
        excludeLinkage = [],
        searchQuery = '',
        showCompleted = true,
        priorityFilter = [],
        excludePriorities = [],
        favoriteFilter = 'all',
        sortBy = 'created_at',
        sortOrder = 'desc',
    } = params;

    return useQuery({
        queryKey: QUICK_NOTES_KEYS.list({
            filterType,
            excludeTypes,
            linkageFilter,
            excludeLinkage,
            searchQuery,
            showCompleted,
            priorityFilter,
            excludePriorities,
            favoriteFilter,
            sortBy,
            sortOrder,
        }),
        queryFn: async (): Promise<QuickNotesResponse> => {
            const requestBody: Record<string, unknown> = {
                limit: 100,
                offset: 0,
                include_full_notes: true,
                sort_by: sortBy,
                sort_order: sortOrder,
            };

            if (filterType.length > 0) {
                requestBody.note_types = filterType;
            }
            if (excludeTypes.length > 0) {
                requestBody.exclude_note_types = excludeTypes;
            }
            if (linkageFilter.length > 0) {
                requestBody.linkage_types = linkageFilter;
            }
            if (excludeLinkage.length > 0) {
                requestBody.exclude_linkage_types = excludeLinkage;
            }
            if (searchQuery) {
                requestBody.query = searchQuery;
            }
            if (priorityFilter.length > 0) {
                requestBody.priorities = priorityFilter;
            }
            if (excludePriorities.length > 0) {
                requestBody.exclude_priorities = excludePriorities;
            }
            if (favoriteFilter !== 'all') {
                requestBody.is_pinned = favoriteFilter === 'favorites';
            }

            const response = await fetch(`${API_URL}/api/v1/notes/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            let data = result.data || [];

            // Filter completed actions if needed
            if (!showCompleted && filterType.includes('action')) {
                data = data.filter((n: QuickNote) => !n.is_completed);
            }

            return {
                data,
                facets: result.facets || null,
            };
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for creating a quick note.
 */
export function useCreateQuickNote() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteData: {
            title: string;
            content: string;
            note_type: string;
            tags?: string[];
            linked_content_ids?: string[];
            linked_note_ids?: string[];
            linked_project_id?: string | null;
            linked_model_id?: string | null;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    ...noteData,
                    tags: noteData.tags || [],
                    linked_content_ids: noteData.linked_content_ids || [],
                    linked_note_ids: noteData.linked_note_ids || [],
                }),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUICK_NOTES_KEYS.all });
        },
    });
}

/**
 * Hook for updating a quick note.
 */
export function useUpdateQuickNote() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<QuickNote> }) => {
            const response = await fetch(`${API_URL}/api/v1/notes/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUICK_NOTES_KEYS.all });
        },
    });
}

/**
 * Hook for deleting a quick note.
 */
export function useDeleteQuickNote() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_URL}/api/v1/notes/${id}`, {
                method: 'DELETE',
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUICK_NOTES_KEYS.all });
        },
    });
}

/**
 * Hook for toggling pin status on a quick note.
 */
export function useToggleQuickNotePin() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
            const response = await fetch(`${API_URL}/api/v1/notes/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ is_pinned: !isPinned }),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onMutate: async ({ id, isPinned }) => {
            await queryClient.cancelQueries({ queryKey: QUICK_NOTES_KEYS.all });

            const previousQueries = queryClient.getQueriesData({ queryKey: QUICK_NOTES_KEYS.all });

            queryClient.setQueriesData<QuickNotesResponse>(
                { queryKey: QUICK_NOTES_KEYS.all },
                (old) => {
                    if (!old?.data) return old;
                    return {
                        ...old,
                        data: old.data.map((note) =>
                            note.id === id ? { ...note, is_pinned: !isPinned } : note
                        ),
                    };
                }
            );

            return { previousQueries };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: QUICK_NOTES_KEYS.all });
        },
    });
}
