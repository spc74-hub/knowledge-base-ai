/**
 * Contents hook using React Query.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
    Content,
    ContentDetail,
    ContentCreateInput,
    ContentUpdateInput,
    ContentFilters,
    ContentStats,
    PaginatedResponse,
} from '@/types/content';

interface UseContentsOptions {
    page?: number;
    perPage?: number;
    filters?: ContentFilters;
}

// Query keys
const CONTENTS_KEY = 'contents';
const CONTENT_KEY = 'content';
const STATS_KEY = 'content-stats';

/**
 * Hook for fetching paginated contents.
 */
export function useContents(options: UseContentsOptions = {}) {
    const { page = 1, perPage = 20, filters = {} } = options;

    // Build query string
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    if (filters.type) params.set('type', filters.type);
    if (filters.category) params.set('category', filters.category);
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.favorite !== undefined) params.set('favorite', String(filters.favorite));
    if (filters.archived !== undefined) params.set('archived', String(filters.archived));
    if (filters.q) params.set('q', filters.q);

    const queryString = params.toString();

    return useQuery({
        queryKey: [CONTENTS_KEY, page, perPage, filters],
        queryFn: () => api.get<PaginatedResponse<Content>>(`/content?${queryString}`),
    });
}

/**
 * Hook for fetching a single content.
 */
export function useContent(id: string) {
    return useQuery({
        queryKey: [CONTENT_KEY, id],
        queryFn: () => api.get<ContentDetail>(`/content/${id}`),
        enabled: !!id,
    });
}

/**
 * Hook for fetching content stats.
 */
export function useContentStats() {
    return useQuery({
        queryKey: [STATS_KEY],
        queryFn: () => api.get<ContentStats>('/content/stats'),
    });
}

/**
 * Hook for creating content.
 */
export function useCreateContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ContentCreateInput) =>
            api.post<Content>('/content', data),
        onSuccess: () => {
            // Invalidate contents list
            queryClient.invalidateQueries({ queryKey: [CONTENTS_KEY] });
            queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
        },
    });
}

/**
 * Hook for updating content.
 */
export function useUpdateContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ContentUpdateInput }) =>
            api.put<Content>(`/content/${id}`, data),
        onSuccess: (_, { id }) => {
            // Invalidate specific content and list
            queryClient.invalidateQueries({ queryKey: [CONTENT_KEY, id] });
            queryClient.invalidateQueries({ queryKey: [CONTENTS_KEY] });
        },
    });
}

/**
 * Hook for deleting content.
 */
export function useDeleteContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.delete(`/content/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [CONTENTS_KEY] });
            queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
        },
    });
}

/**
 * Hook for toggling favorite status.
 */
export function useToggleFavorite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
            api.put<Content>(`/content/${id}`, { is_favorite: !isFavorite }),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: [CONTENT_KEY, id] });
            queryClient.invalidateQueries({ queryKey: [CONTENTS_KEY] });
        },
    });
}
