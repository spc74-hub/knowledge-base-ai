'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Query keys
export const OBJECTIVES_KEYS = {
    all: ['objectives'] as const,
    tree: (horizon?: string) => ['objectives', 'tree', horizon] as const,
    detail: (id: string) => ['objectives', 'detail', id] as const,
};

// Types
export interface ObjectiveTree {
    id: string;
    title: string;
    icon: string;
    color: string;
    status: string;
    progress: number;
    parent_id: string | null;
    horizon: string;
    children: ObjectiveTree[];
}

export interface Action {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
}

export interface Content {
    id: string;
    title: string;
    content_type: string;
    is_favorite: boolean;
    created_at: string;
}

export interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    created_at: string;
}

export interface Project {
    id: string;
    name: string;
    status: string;
    color: string;
    icon: string;
}

export interface MentalModel {
    id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
}

export interface ObjectiveDetail {
    id: string;
    title: string;
    description: string | null;
    horizon: string;
    target_date: string | null;
    status: string;
    progress: number;
    color: string;
    icon: string;
    parent_id: string | null;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
    objective_actions: Action[];
    contents: Content[];
    contents_count: number;
    notes: StandaloneNote[];
    projects: Project[];
    mental_models: MentalModel[];
    children: ObjectiveTree[];
}

/**
 * Hook for fetching objectives tree.
 */
export function useObjectivesTree(horizon?: string) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: OBJECTIVES_KEYS.tree(horizon),
        queryFn: async (): Promise<ObjectiveTree[]> => {
            const params = new URLSearchParams();
            if (horizon) params.set('horizon', horizon);

            const response = await fetch(`${API_URL}/api/v1/objectives/tree?${params}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching objective detail.
 */
export function useObjectiveDetail(objectiveId: string | null) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: OBJECTIVES_KEYS.detail(objectiveId || ''),
        queryFn: async (): Promise<ObjectiveDetail> => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}`, {
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
        enabled: !!user && !!token && !!objectiveId,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for creating an objective.
 */
export function useCreateObjective() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            title: string;
            description?: string;
            horizon: string;
            target_date?: string;
            status?: string;
            color?: string;
            icon?: string;
            parent_id?: string | null;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al crear objetivo');
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

/**
 * Hook for updating an objective.
 */
export function useUpdateObjective() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: {
            id: string;
            title?: string;
            description?: string;
            horizon?: string;
            target_date?: string;
            status?: string;
            progress?: number;
            color?: string;
            icon?: string;
            parent_id?: string | null;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${id}`, {
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

/**
 * Hook for deleting an objective.
 */
export function useDeleteObjective() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (objectiveId: string) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}`, {
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
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

/**
 * Hook for toggling objective favorite status.
 */
export function useToggleObjectiveFavorite() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (objectiveId: string) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/favorite`, {
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
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

/**
 * Hook for moving an objective (reorder/reparent).
 */
export function useMoveObjective() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ objectiveId, targetParentId }: { objectiveId: string; targetParentId: string | null }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    objective_id: objectiveId,
                    new_parent_id: targetParentId,
                    new_position: 0,
                }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

/**
 * Hook for managing objective actions.
 */
export function useCreateObjectiveAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ objectiveId, title }: { objectiveId: string; title: string }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ title }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

export function useToggleObjectiveAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ objectiveId, actionId, isCompleted }: { objectiveId: string; actionId: string; isCompleted: boolean }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions/${actionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ is_completed: !isCompleted }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}

export function useDeleteObjectiveAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ objectiveId, actionId }: { objectiveId: string; actionId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions/${actionId}`, {
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
            queryClient.invalidateQueries({ queryKey: OBJECTIVES_KEYS.all });
        },
    });
}
