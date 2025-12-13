'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;
const API_BASE = `${API_URL}/api/v1`;

// Query keys
export const EXPLORER_KEYS = {
    all: ['explorer'] as const,
    facets: ['explorer', 'facets'] as const,
    experts: ['explorer', 'experts'] as const,
    tags: ['explorer', 'tags'] as const,
    contents: (params: ContentsSearchParams) => ['explorer', 'contents', params] as const,
    notes: (params: NotesSearchParams) => ['explorer', 'notes', params] as const,
};

// Types
export interface Facet {
    value: string;
    count: number;
}

export interface Facets {
    types: Facet[];
    categories: Facet[];
    concepts: Facet[];
    organizations: Facet[];
    products: Facet[];
    persons: Facet[];
    user_tags: Facet[];
    total_contents: number;
}

export interface Expert {
    id: string;
    person_name: string;
    expertise_area: string | null;
    is_active: boolean;
}

export interface AvailableTags {
    user_tags: string[];
    inherited_tags: { tag: string; color: string }[];
}

export interface Content {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    iab_tier2: string | null;
    iab_tier3: string | null;
    concepts: string[];
    entities: {
        organizations?: Array<string | { name: string }>;
        products?: Array<string | { name: string }>;
        persons?: Array<string | { name: string }>;
    } | null;
    schema_type: string | null;
    content_format: string | null;
    technical_level: string | null;
    language: string | null;
    sentiment: string | null;
    reading_time_minutes: number | null;
    processing_status: string;
    maturity_level: string | null;
    is_favorite: boolean;
    is_archived: boolean;
    user_tags: string[];
    user_note: string | null;
    note_category: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    raw_content: string | null;
    relevance_score?: number;
    match_fields?: string[];
}

export interface ContentsFilters {
    types: string[];
    types_exclude: string[];
    categories: string[];
    concepts: string[];
    organizations: string[];
    products: string[];
    persons: string[];
    experts: string[];
    user_tags: string[];
    inherited_tags: string[];
    processing_status: string[];
    maturity_level: string[];
    maturity_level_exclude: string[];
    has_comment: boolean | null;
    is_favorite: boolean | null;
    date_from: string | null;
    date_to: string | null;
    min_views: number | null;
    max_views: number | null;
}

export interface ContentsSearchParams {
    query?: string;
    filters: ContentsFilters;
    sortBy: 'created_at' | 'view_count' | 'title';
    sortOrder: 'asc' | 'desc';
}

export interface ContentsSearchResponse {
    data: Content[];
    meta?: {
        total_results: number;
    };
}

// Notes types
export interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    source_content_id: string | null;
    source_content?: {
        id: string;
        title: string;
        type: string;
        url: string;
    } | null;
    linked_project_id: string | null;
    linked_project?: {
        id: string;
        name: string;
        icon: string;
        color: string;
    } | null;
    linked_model_id: string | null;
    linked_model?: {
        id: string;
        taxonomy_value: string;
    } | null;
    is_pinned: boolean;
    is_full_note?: boolean;
    created_at: string;
    updated_at: string;
}

export interface NoteTypeFacet {
    value: string;
    label: string;
    icon: string;
    count: number;
}

export interface LinkageFacet {
    value: string;
    label: string;
    icon: string;
    count: number;
}

export interface NotesFacets {
    note_types: NoteTypeFacet[];
    linkage: LinkageFacet[];
    total_notes: number;
    pinned_count: number;
}

export interface NotesFilters {
    note_types: string[];
    has_source_content: boolean | null;
    linkage_type: string | null;
    is_pinned: boolean | null;
}

export interface NotesSearchParams {
    query?: string;
    filters: NotesFilters;
}

export interface NotesSearchResponse {
    data: StandaloneNote[];
    facets: NotesFacets | null;
}

const PAGE_SIZE = 50;

/**
 * Hook for fetching explorer facets (static counts).
 */
export function useExplorerFacets() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: EXPLORER_KEYS.facets,
        queryFn: async (): Promise<Facets> => {
            const response = await fetch(`${API_BASE}/search/facets`, {
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
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching user's saved experts (gurus).
 */
export function useUserExperts() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: EXPLORER_KEYS.experts,
        queryFn: async (): Promise<Expert[]> => {
            const response = await fetch(`${API_BASE}/experts/`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.experts || [];
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching available tags.
 */
export function useAvailableTags() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: EXPLORER_KEYS.tags,
        queryFn: async (): Promise<AvailableTags> => {
            const response = await fetch(`${API_BASE}/tags/available`, {
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
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for searching contents with filters.
 * Uses infinite query for pagination support.
 */
export function useContentsSearch(params: ContentsSearchParams) {
    const { user, token } = useAuth();
    const { query, filters, sortBy, sortOrder } = params;

    // Check if we should use global search (query + no filters)
    const hasFilters = Object.entries(filters).some(([key, val]) => {
        if (key === 'has_comment' || key === 'is_favorite') return val !== null;
        if (key === 'date_from' || key === 'date_to') return val !== null;
        if (key === 'min_views' || key === 'max_views') return val !== null;
        return Array.isArray(val) && val.length > 0;
    });
    const useGlobalSearch = !!query && !hasFilters;

    return useInfiniteQuery({
        queryKey: EXPLORER_KEYS.contents(params),
        queryFn: async ({ pageParam = 0 }): Promise<ContentsSearchResponse & { nextOffset?: number }> => {
            if (useGlobalSearch) {
                // Global search
                const response = await fetch(`${API_BASE}/search/global`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        query,
                        limit: PAGE_SIZE,
                        offset: pageParam,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}`);
                }

                const data = await response.json();
                return {
                    data: data.data,
                    meta: { total_results: data.meta?.total_results || data.data.length },
                    nextOffset: data.data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
                };
            } else {
                // Faceted search
                const allPersons = [...filters.persons, ...filters.experts];
                const requestBody = {
                    query: query || null,
                    types: filters.types.length > 0 ? filters.types : null,
                    types_exclude: filters.types_exclude.length > 0 ? filters.types_exclude : null,
                    categories: filters.categories.length > 0 ? filters.categories : null,
                    concepts: filters.concepts.length > 0 ? filters.concepts : null,
                    organizations: filters.organizations.length > 0 ? filters.organizations : null,
                    products: filters.products.length > 0 ? filters.products : null,
                    persons: allPersons.length > 0 ? allPersons : null,
                    user_tags: filters.user_tags.length > 0 ? filters.user_tags : null,
                    inherited_tags: filters.inherited_tags.length > 0 ? filters.inherited_tags : null,
                    processing_status: filters.processing_status.length > 0 ? filters.processing_status : null,
                    maturity_level: filters.maturity_level.length > 0 ? filters.maturity_level : null,
                    maturity_level_exclude: filters.maturity_level_exclude.length > 0 ? filters.maturity_level_exclude : null,
                    has_comment: filters.has_comment,
                    is_favorite: filters.is_favorite,
                    date_from: filters.date_from,
                    date_to: filters.date_to,
                    min_views: filters.min_views,
                    max_views: filters.max_views,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                    limit: PAGE_SIZE,
                    offset: pageParam,
                };

                const response = await fetch(`${API_BASE}/search/faceted`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}`);
                }

                const data = await response.json();
                return {
                    data: data.data,
                    meta: { total_results: data.meta?.total_results || data.data.length },
                    nextOffset: data.data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
                };
            }
        },
        getNextPageParam: (lastPage) => lastPage.nextOffset,
        initialPageParam: 0,
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for searching notes (Reflexiones) with filters.
 * Uses infinite query for pagination support.
 */
export function useNotesSearch(params: NotesSearchParams) {
    const { user, token } = useAuth();
    const { query, filters } = params;

    return useInfiniteQuery({
        queryKey: EXPLORER_KEYS.notes(params),
        queryFn: async ({ pageParam = 0 }): Promise<NotesSearchResponse & { nextOffset?: number }> => {
            const requestBody = {
                query: query || null,
                note_types: filters.note_types.length > 0 ? filters.note_types : null,
                has_source_content: filters.has_source_content,
                linkage_type: filters.linkage_type,
                is_pinned: filters.is_pinned,
                limit: PAGE_SIZE,
                offset: pageParam,
            };

            const response = await fetch(`${API_BASE}/notes/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            const data = await response.json();
            return {
                data: data.data,
                facets: data.facets,
                nextOffset: data.data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextOffset,
        initialPageParam: 0,
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for toggling content favorite status.
 */
export function useToggleContentFavorite() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contentId: string) => {
            const response = await fetch(`${API_BASE}/content/${contentId}/favorite`, {
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });
        },
    });
}

/**
 * Hook for toggling note pin status.
 */
export function useToggleNotePin() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteId: string) => {
            const response = await fetch(`${API_BASE}/notes/${noteId}/pin`, {
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });
        },
    });
}

/**
 * Hook for bulk archiving contents.
 */
export function useBulkArchiveContents() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contentIds: string[]) => {
            const response = await fetch(`${API_BASE}/content/bulk/archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(contentIds),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });
        },
    });
}

/**
 * Hook for bulk deleting contents.
 */
export function useBulkDeleteContents() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contentIds: string[]) => {
            const response = await fetch(`${API_BASE}/content/bulk/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(contentIds),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });
        },
    });
}

/**
 * Hook for bulk deleting notes.
 */
export function useBulkDeleteNotes() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (noteIds: string[]) => {
            const response = await fetch(`${API_BASE}/notes/bulk/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(noteIds),
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }

            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });
        },
    });
}
