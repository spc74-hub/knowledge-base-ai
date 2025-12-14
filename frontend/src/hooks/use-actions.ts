'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { API_URL } from '@/lib/config';

// Query keys
export const ACTIONS_KEYS = {
    all: ['actions'] as const,
    unified: (params?: UnifiedActionsParams) => ['actions', 'unified', params] as const,
};

// Types
export interface UnifiedAction {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
    completed_at: string | null;
    created_at: string;
    parent_type: 'area' | 'objective' | 'project' | 'mental_model';
    parent_id: string;
    parent_name: string;
    parent_icon: string;
    parent_color: string;
}

export interface GroupedActions {
    parent_type: string;
    parent_id: string;
    parent_name: string;
    parent_icon: string;
    parent_color: string;
    actions: UnifiedAction[];
    pending_count: number;
    completed_count: number;
}

export interface AllActionsResponse {
    groups: GroupedActions[];
    total_pending: number;
    total_completed: number;
}

export interface UnifiedActionsParams {
    include_completed?: boolean;
    parent_type?: 'area' | 'objective' | 'project' | 'mental_model';
}

/**
 * Hook for fetching all actions across areas, objectives, projects, and mental models.
 */
export function useUnifiedActions(params: UnifiedActionsParams = {}) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: ACTIONS_KEYS.unified(params),
        queryFn: async (): Promise<AllActionsResponse> => {
            const urlParams = new URLSearchParams();
            if (params.include_completed !== undefined) {
                urlParams.set('include_completed', String(params.include_completed));
            }
            if (params.parent_type) {
                urlParams.set('parent_type', params.parent_type);
            }

            const response = await fetch(`${API_URL}/api/v1/actions/all?${urlParams}`, {
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
        staleTime: 30 * 1000, // 30 seconds - actions change frequently
    });
}

// Helper function to get the correct endpoint for CRUD operations
function getActionEndpoint(parentType: string, parentId: string, actionId?: string): string {
    const baseEndpoints: Record<string, string> = {
        area: `${API_URL}/api/v1/areas/${parentId}/actions`,
        objective: `${API_URL}/api/v1/objectives/${parentId}/actions`,
        project: `${API_URL}/api/v1/projects/${parentId}/actions`,
        mental_model: `${API_URL}/api/v1/mental-models/${parentId}/actions`,
    };
    const base = baseEndpoints[parentType];
    return actionId ? `${base}/${actionId}` : base;
}

/**
 * Hook for creating an action in any parent type.
 */
export function useCreateAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            parentType,
            parentId,
            title,
        }: {
            parentType: 'area' | 'objective' | 'project' | 'mental_model';
            parentId: string;
            title: string;
        }) => {
            const response = await fetch(getActionEndpoint(parentType, parentId), {
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
            queryClient.invalidateQueries({ queryKey: ACTIONS_KEYS.all });
        },
    });
}

/**
 * Hook for updating an action (toggle completed, edit title).
 */
export function useUpdateAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            parentType,
            parentId,
            actionId,
            title,
            is_completed,
        }: {
            parentType: 'area' | 'objective' | 'project' | 'mental_model';
            parentId: string;
            actionId: string;
            title?: string;
            is_completed?: boolean;
        }) => {
            const body: Record<string, unknown> = {};
            if (title !== undefined) body.title = title;
            if (is_completed !== undefined) body.is_completed = is_completed;

            const response = await fetch(getActionEndpoint(parentType, parentId, actionId), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ACTIONS_KEYS.all });
        },
    });
}

/**
 * Hook for deleting an action.
 */
export function useDeleteAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            parentType,
            parentId,
            actionId,
        }: {
            parentType: 'area' | 'objective' | 'project' | 'mental_model';
            parentId: string;
            actionId: string;
        }) => {
            const response = await fetch(getActionEndpoint(parentType, parentId, actionId), {
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
            queryClient.invalidateQueries({ queryKey: ACTIONS_KEYS.all });
        },
    });
}

/**
 * Hook for toggling action completion status.
 */
export function useToggleAction() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            parentType,
            parentId,
            actionId,
            currentStatus,
        }: {
            parentType: 'area' | 'objective' | 'project' | 'mental_model';
            parentId: string;
            actionId: string;
            currentStatus: boolean;
        }) => {
            const response = await fetch(getActionEndpoint(parentType, parentId, actionId), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ is_completed: !currentStatus }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ACTIONS_KEYS.all });
        },
    });
}
