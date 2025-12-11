'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Query keys
export const PROJECTS_KEYS = {
    all: ['projects'] as const,
    list: (params?: ProjectsParams) => ['projects', 'list', params] as const,
    tree: ['projects', 'tree'] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
};

// Types
export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    deadline: string | null;
    completed_at: string | null;
    color: string;
    icon: string;
    position: number;
    parent_project_id: string | null;
    content_count: number;
    children_count: number;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProjectTree {
    id: string;
    name: string;
    icon: string;
    color: string;
    status: string;
    parent_project_id: string | null;
    children: ProjectTree[];
    content_count: number;
}

export interface Content {
    id: string;
    title: string;
    type: string;
    is_favorite: boolean;
    maturity_level: string;
    created_at: string;
    project_id?: string | null;
}

export interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    linked_project_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectDetail extends Project {
    contents: Content[];
    children: Project[];
    notes?: StandaloneNote[];
}

export interface ProjectsParams {
    status?: string;
    includeArchived?: boolean;
}

/**
 * Hook for fetching projects tree.
 */
export function useProjectsTree() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: PROJECTS_KEYS.tree,
        queryFn: async (): Promise<ProjectTree[]> => {
            const response = await fetch(`${API_URL}/api/v1/projects/tree`, {
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
 * Hook for fetching flat list of projects.
 */
export function useProjects(params: ProjectsParams = {}) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: PROJECTS_KEYS.list(params),
        queryFn: async (): Promise<Project[]> => {
            const urlParams = new URLSearchParams();
            if (params.status) urlParams.set('status', params.status);
            if (params.includeArchived) urlParams.set('include_archived', 'true');

            const response = await fetch(`${API_URL}/api/v1/projects/?${urlParams}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.projects || [];
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching project detail.
 */
export function useProjectDetail(projectId: string | null) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: PROJECTS_KEYS.detail(projectId || ''),
        queryFn: async (): Promise<ProjectDetail> => {
            // Fetch project and linked notes in parallel
            const [projectResponse, notesResponse] = await Promise.all([
                fetch(`${API_URL}/api/v1/projects/${projectId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }),
                fetch(`${API_URL}/api/v1/projects/${projectId}/notes`, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                })
            ]);

            if (!projectResponse.ok) {
                throw new Error(`Error ${projectResponse.status}`);
            }

            const data = await projectResponse.json();

            // Add notes to project data
            if (notesResponse.ok) {
                data.notes = await notesResponse.json();
            } else {
                data.notes = [];
            }

            return data;
        },
        enabled: !!user && !!token && !!projectId,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for creating a project.
 */
export function useCreateProject() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            name: string;
            description?: string;
            status?: string;
            deadline?: string;
            color?: string;
            icon?: string;
            parent_project_id?: string | null;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/projects/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al crear proyecto');
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: PROJECTS_KEYS.all });
        },
    });
}

/**
 * Hook for updating a project.
 */
export function useUpdateProject() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: {
            id: string;
            name?: string;
            description?: string;
            status?: string;
            deadline?: string;
            color?: string;
            icon?: string;
            parent_project_id?: string | null;
        }) => {
            const response = await fetch(`${API_URL}/api/v1/projects/${id}`, {
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
            queryClient.invalidateQueries({ queryKey: PROJECTS_KEYS.all });
        },
    });
}

/**
 * Hook for deleting a project.
 */
export function useDeleteProject() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (projectId: string) => {
            const response = await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
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
            queryClient.invalidateQueries({ queryKey: PROJECTS_KEYS.all });
        },
    });
}

/**
 * Hook for toggling project favorite status.
 */
export function useToggleProjectFavorite() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (projectId: string) => {
            const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/favorite`, {
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
            queryClient.invalidateQueries({ queryKey: PROJECTS_KEYS.all });
        },
    });
}

/**
 * Hook for moving a project (reorder/reparent).
 */
export function useMoveProject() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ projectId, targetParentId }: { projectId: string; targetParentId: string | null }) => {
            const response = await fetch(`${API_URL}/api/v1/projects/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    project_id: projectId,
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
            queryClient.invalidateQueries({ queryKey: PROJECTS_KEYS.all });
        },
    });
}
