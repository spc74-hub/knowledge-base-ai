'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - always use HTTPS in production
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

// Query keys
export const TAXONOMY_KEYS = {
    all: ['taxonomy'] as const,
    nodes: (params: TaxonomyParams) => ['taxonomy', 'nodes', params] as const,
    contents: (params: TaxonomyContentsParams) => ['taxonomy', 'contents', params] as const,
    types: ['taxonomy', 'types'] as const,
    facets: ['taxonomy', 'facets'] as const,
};

// Types
export interface TaxonomyNode {
    id: string;
    label: string;
    count: number;
    type: string;
}

export interface ContentItem {
    id: string;
    title: string;
    type: string;
    url: string;
    iab_tier1: string;
    summary: string;
    created_at: string;
    metadata: Record<string, unknown>;
}

export interface BreadcrumbItem {
    type: string;
    value: string;
    label: string;
}

export type RootType = 'category' | 'person' | 'organization' | 'product' | 'concept';

export interface TaxonomyParams {
    rootType: RootType;
    breadcrumb: BreadcrumbItem[];
    typeFilters?: string[];
    categories?: string[];
    concepts?: string[];
    organizations?: string[];
    products?: string[];
    persons?: string[];
    processing_status?: string[];
    maturity_level?: string[];
    has_comment?: boolean | null;
    is_favorite?: boolean | null;
}

export interface TaxonomyContentsParams {
    breadcrumb: BreadcrumbItem[];
    typeFilters?: string[];
    offset?: number;
    limit?: number;
    categories?: string[];
    concepts?: string[];
    organizations?: string[];
    products?: string[];
    persons?: string[];
    processing_status?: string[];
    maturity_level?: string[];
    has_comment?: boolean | null;
    is_favorite?: boolean | null;
}

export interface Facet {
    value: string;
    count: number;
}

export interface Facets {
    categories: Facet[];
    concepts: Facet[];
    organizations: Facet[];
    products: Facet[];
    persons: Facet[];
}

/**
 * Hook for fetching taxonomy nodes at a given level.
 */
export function useTaxonomyNodes(params: TaxonomyParams) {
    const { user, token } = useAuth();
    const {
        rootType,
        breadcrumb,
        typeFilters = [],
        categories,
        concepts,
        organizations,
        products,
        persons,
        processing_status,
        maturity_level,
        has_comment,
        is_favorite
    } = params;

    return useQuery({
        queryKey: TAXONOMY_KEYS.nodes(params),
        queryFn: async (): Promise<{ nodes: TaxonomyNode[]; total_contents: number }> => {
            // Determine parent_type and parent_value from breadcrumb
            const parent_type = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].type : undefined;
            const parent_value = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].value : undefined;

            const requestBody = {
                root_type: rootType,
                type_filters: typeFilters.length > 0 ? typeFilters : null,
                parent_type,
                parent_value,
                categories: categories && categories.length > 0 ? categories : null,
                concepts: concepts && concepts.length > 0 ? concepts : null,
                organizations: organizations && organizations.length > 0 ? organizations : null,
                products: products && products.length > 0 ? products : null,
                persons: persons && persons.length > 0 ? persons : null,
                processing_status: processing_status && processing_status.length > 0 ? processing_status : null,
                maturity_level: maturity_level && maturity_level.length > 0 ? maturity_level : null,
                has_comment,
                is_favorite,
            };

            const response = await fetch(`${API_URL}/api/v1/taxonomy/nodes`, {
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
            const data = await response.json();
            return {
                nodes: data.nodes || [],
                total_contents: data.total_contents || 0,
            };
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching contents at a taxonomy path.
 */
export function useTaxonomyContents(params: TaxonomyContentsParams) {
    const { user, token } = useAuth();
    const {
        breadcrumb,
        typeFilters = [],
        offset = 0,
        limit = 100,
        categories,
        concepts,
        organizations,
        products,
        persons,
        processing_status,
        maturity_level,
        has_comment,
        is_favorite
    } = params;

    return useQuery({
        queryKey: TAXONOMY_KEYS.contents(params),
        queryFn: async (): Promise<{ contents: ContentItem[]; total: number; hasMore: boolean }> => {
            // Build filters from breadcrumb
            const filters: Record<string, string> = {};
            breadcrumb.forEach(item => {
                filters[item.type] = item.value;
            });

            const requestBody = {
                filters,
                type_filters: typeFilters.length > 0 ? typeFilters : null,
                categories: categories && categories.length > 0 ? categories : null,
                concepts: concepts && concepts.length > 0 ? concepts : null,
                organizations: organizations && organizations.length > 0 ? organizations : null,
                products: products && products.length > 0 ? products : null,
                persons: persons && persons.length > 0 ? persons : null,
                processing_status: processing_status && processing_status.length > 0 ? processing_status : null,
                maturity_level: maturity_level && maturity_level.length > 0 ? maturity_level : null,
                has_comment,
                is_favorite,
                limit,
                offset,
            };

            const response = await fetch(`${API_URL}/api/v1/taxonomy/contents`, {
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
            const data = await response.json();
            const total = data.total || data.contents?.length || 0;
            return {
                contents: data.contents || [],
                total,
                hasMore: (data.contents?.length || 0) < total,
            };
        },
        enabled: !!user && !!token && breadcrumb.length > 0,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching available content types.
 */
export function useTaxonomyTypes(filters?: {
    persons?: string[];
    is_favorite?: boolean | null;
    has_comment?: boolean | null;
    processing_status?: string[];
    maturity_level?: string[];
}) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: [...TAXONOMY_KEYS.types, filters],
        queryFn: async (): Promise<{ value: string; label: string; count: number }[]> => {
            // Check if we have any filters that should affect type counts
            const hasFilters =
                (filters?.persons && filters.persons.length > 0) ||
                filters?.is_favorite !== null ||
                filters?.has_comment !== null ||
                (filters?.processing_status && filters.processing_status.length > 0) ||
                (filters?.maturity_level && filters.maturity_level.length > 0);

            let response;
            if (hasFilters && filters) {
                // Use POST with filters
                response = await fetch(`${API_URL}/api/v1/taxonomy/types`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        persons: filters.persons && filters.persons.length > 0 ? filters.persons : null,
                        is_favorite: filters.is_favorite,
                        has_comment: filters.has_comment,
                        processing_status: filters.processing_status && filters.processing_status.length > 0 ? filters.processing_status : null,
                        maturity_level: filters.maturity_level && filters.maturity_level.length > 0 ? filters.maturity_level : null,
                    }),
                });
            } else {
                // Use GET without filters (faster)
                response = await fetch(`${API_URL}/api/v1/taxonomy/types`, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                });
            }

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.types || [];
        },
        enabled: !!user && !!token,
        staleTime: 10 * 60 * 1000, // 10 minutes for types
    });
}

/**
 * Hook for fetching taxonomy facets.
 */
export function useTaxonomyFacets() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: TAXONOMY_KEYS.facets,
        queryFn: async (): Promise<Facets> => {
            const response = await fetch(`${API_URL}/api/v1/search/facets`, {
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
 * Hook to invalidate taxonomy queries.
 */
export function useInvalidateTaxonomy() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: TAXONOMY_KEYS.all });
}
