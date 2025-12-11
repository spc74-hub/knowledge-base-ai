'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Query keys
export const AREAS_KEYS = {
    all: ['areas'] as const,
    list: (statusFilter?: string) => ['areas', 'list', statusFilter] as const,
    detail: (id: string) => ['areas', 'detail', id] as const,
};

// Types
export interface AreaStats {
    objectives: number;
    projects: number;
    contents: number;
    notes: number;
    sub_areas: number;
    mental_models: number;
    habits: number;
}

export interface Area {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    status: string;
    display_order: number;
    created_at: string;
    stats?: AreaStats;
}

export interface AreasParams {
    statusFilter?: string;
}

/**
 * Hook for fetching areas list.
 */
export function useAreas(params: AreasParams = {}) {
    const { user, token } = useAuth();
    const { statusFilter = 'active' } = params;

    return useQuery({
        queryKey: AREAS_KEYS.list(statusFilter),
        queryFn: async (): Promise<Area[]> => {
            const urlParams = new URLSearchParams();
            if (statusFilter && statusFilter !== 'all') {
                urlParams.set('status_filter', statusFilter);
            }

            const response = await fetch(`${API_URL}/api/v1/areas?${urlParams}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data || [];
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching area detail.
 */
export function useAreaDetail(areaId: string | null) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: AREAS_KEYS.detail(areaId || ''),
        queryFn: async (): Promise<Area> => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}`, {
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
        enabled: !!user && !!token && !!areaId,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for creating an area.
 */
export function useCreateArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            name: string;
            description?: string;
            icon?: string;
            color?: string;
            status?: string;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/areas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al crear área');
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.all });
        },
    });
}

/**
 * Hook for updating an area.
 */
export function useUpdateArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: {
            id: string;
            name?: string;
            description?: string;
            icon?: string;
            color?: string;
            status?: string;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${id}`, {
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
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.all });
        },
    });
}

/**
 * Hook for deleting an area.
 */
export function useDeleteArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (areaId: string) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}`, {
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
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.all });
        },
    });
}

/**
 * Hook for reordering areas.
 */
export function useReorderAreas() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (areaIds: string[]) => {
            const response = await fetch(`${API_URL}/api/v1/areas/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ area_ids: areaIds }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.all });
        },
    });
}
