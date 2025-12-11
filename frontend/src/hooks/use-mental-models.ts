'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Query keys
export const MENTAL_MODELS_KEYS = {
    all: ['mental-models'] as const,
    list: (includeInactive?: boolean) => ['mental-models', 'list', includeInactive] as const,
    catalog: ['mental-models', 'catalog'] as const,
    detail: (id: string) => ['mental-models', 'detail', id] as const,
    contents: (id: string) => ['mental-models', 'contents', id] as const,
};

// Types
export interface MentalModel {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    notes: string;
    is_active: boolean;
    is_favorite: boolean;
    color: string;
    icon: string;
    content_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CatalogModel {
    slug: string;
    name: string;
    description: string;
    icon: string;
}

export interface ContentItem {
    id: string;
    title: string;
    url: string;
    type: string;
    summary: string;
    iab_tier1: string;
    created_at: string;
    application_notes?: string;
}

/**
 * Hook for fetching user's mental models.
 */
export function useMentalModels(includeInactive: boolean = true) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: MENTAL_MODELS_KEYS.list(includeInactive),
        queryFn: async (): Promise<MentalModel[]> => {
            const response = await fetch(
                `${API_URL}/api/v1/mental-models/?include_inactive=${includeInactive}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }
            );
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.models || [];
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching the mental models catalog.
 */
export function useMentalModelsCatalog() {
    return useQuery({
        queryKey: MENTAL_MODELS_KEYS.catalog,
        queryFn: async (): Promise<CatalogModel[]> => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/catalog`);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.models || [];
        },
        staleTime: 30 * 60 * 1000, // 30 minutes for catalog
    });
}

/**
 * Hook for fetching contents linked to a mental model.
 */
export function useMentalModelContents(modelId: string | null) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: MENTAL_MODELS_KEYS.contents(modelId || ''),
        queryFn: async (): Promise<ContentItem[]> => {
            const response = await fetch(
                `${API_URL}/api/v1/mental-models/${modelId}/contents`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }
            );
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            const data = await response.json();
            return data.contents || [];
        },
        enabled: !!user && !!token && !!modelId,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for activating a mental model from catalog.
 */
export function useActivateMentalModel() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (model: CatalogModel) => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    slug: model.slug,
                    name: model.name,
                    description: model.description,
                    icon: model.icon,
                }),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Error al activar modelo');
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MENTAL_MODELS_KEYS.all });
        },
    });
}

/**
 * Hook for creating a custom mental model.
 */
export function useCreateMentalModel() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description: string; icon: string; color: string }) => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al crear modelo');
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MENTAL_MODELS_KEYS.all });
        },
    });
}

/**
 * Hook for updating a mental model.
 */
export function useUpdateMentalModel() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; icon?: string; color?: string; notes?: string }) => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/${id}`, {
                method: 'PATCH',
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MENTAL_MODELS_KEYS.all });
        },
    });
}

/**
 * Hook for deactivating (deleting) a mental model.
 */
export function useDeactivateMentalModel() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (modelId: string) => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/${modelId}`, {
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MENTAL_MODELS_KEYS.all });
        },
    });
}

/**
 * Hook for toggling favorite status on a mental model.
 */
export function useToggleMentalModelFavorite() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (modelId: string) => {
            const response = await fetch(`${API_URL}/api/v1/mental-models/${modelId}/favorite`, {
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
            queryClient.invalidateQueries({ queryKey: MENTAL_MODELS_KEYS.all });
        },
    });
}
