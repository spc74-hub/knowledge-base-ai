'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - always use HTTPS in production
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

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

export interface AreaAction {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
    created_at: string;
}

export interface AreaMentalModel {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
}

export interface AreaObjective {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress: number;
    icon: string;
    color: string;
    horizon: string;
    target_date: string | null;
}

export interface AreaProject {
    id: string;
    name: string;
    description: string | null;
    status: string;
    icon: string;
    color: string;
}

export interface AreaNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    created_at: string;
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
    area_actions?: AreaAction[];
    mental_models?: AreaMentalModel[];
    objectives?: AreaObjective[];
    projects?: AreaProject[];
    notes?: AreaNote[];
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

// =====================================================
// Actions CRUD
// =====================================================

/**
 * Hook for creating an action in an area.
 */
export function useCreateAreaAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, title }: { areaId: string; title: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/actions`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
        },
    });
}

/**
 * Hook for updating an action in an area.
 */
export function useUpdateAreaAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, actionId, title, is_completed }: {
            areaId: string;
            actionId: string;
            title?: string;
            is_completed?: boolean;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/actions/${actionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ title, is_completed }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
        },
    });
}

/**
 * Hook for deleting an action from an area.
 */
export function useDeleteAreaAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, actionId }: { areaId: string; actionId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/actions/${actionId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
        },
    });
}

// =====================================================
// Notes Linking
// =====================================================

/**
 * Hook for linking notes to an area.
 */
export function useLinkNotesToArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, noteIds }: { areaId: string; noteIds: string[] }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/link-notes`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
        },
    });
}

/**
 * Hook for unlinking a note from an area.
 */
export function useUnlinkNoteFromArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, noteId }: { areaId: string; noteId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/unlink-note/${noteId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
        },
    });
}

// =====================================================
// Object Linking (Projects, Objectives, Habits, Mental Models)
// =====================================================

/**
 * Hook for linking a project to an area.
 */
export function useLinkProjectToArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, projectId }: { areaId: string; projectId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/link-project/${projectId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}

/**
 * Hook for unlinking a project from an area.
 */
export function useUnlinkProjectFromArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, projectId }: { areaId: string; projectId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/unlink-project/${projectId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}

/**
 * Hook for linking an objective to an area.
 */
export function useLinkObjectiveToArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, objectiveId }: { areaId: string; objectiveId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/link-objective/${objectiveId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['objectives'] });
        },
    });
}

/**
 * Hook for unlinking an objective from an area.
 */
export function useUnlinkObjectiveFromArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, objectiveId }: { areaId: string; objectiveId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/unlink-objective/${objectiveId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['objectives'] });
        },
    });
}

/**
 * Hook for linking a habit to an area.
 */
export function useLinkHabitToArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, habitId }: { areaId: string; habitId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/link-habit/${habitId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['habits'] });
        },
    });
}

/**
 * Hook for unlinking a habit from an area.
 */
export function useUnlinkHabitFromArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, habitId }: { areaId: string; habitId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/unlink-habit/${habitId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['habits'] });
        },
    });
}

/**
 * Hook for linking a mental model to an area.
 */
export function useLinkMentalModelToArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, mentalModelId }: { areaId: string; mentalModelId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/mental-models`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ mental_model_id: mentalModelId }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['mental-models'] });
        },
    });
}

/**
 * Hook for unlinking a mental model from an area.
 */
export function useUnlinkMentalModelFromArea() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ areaId, mentalModelId }: { areaId: string; mentalModelId: string }) => {
            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/mental-models/${mentalModelId}`, {
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
        onSettled: (_, __, { areaId }) => {
            queryClient.invalidateQueries({ queryKey: AREAS_KEYS.detail(areaId) });
            queryClient.invalidateQueries({ queryKey: ['mental-models'] });
        },
    });
}
