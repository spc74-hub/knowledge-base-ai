'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

// Query keys
export const DASHBOARD_KEYS = {
    summary: ['dashboard', 'summary'] as const,
    objects: (type: string) => ['dashboard', 'objects', type] as const,
    journalInsights: ['dashboard', 'journal-insights'] as const,
    journalHistory: ['dashboard', 'journal-history'] as const,
};

// Types
export interface DashboardSummary {
    kpis: {
        contents: { total: number; pending: number; failed: number };
        objectives: { active: number; total: number };
        projects: { active: number; total: number };
        mental_models: { active: number };
        notes: { total: number };
        full_notes: { total: number };
        tags: { total: number };
        folders: { total: number };
        usage: { cost_30d: number };
        areas: { active: number };
        habits: { active: number };
    };
    recent: {
        contents: any[];
        objectives: any[];
        projects: any[];
        mental_models: any[];
        notes: any[];
        simple_notes: any[];
        full_notes: any[];
        areas: any[];
        habits: any[];
    };
    habits_today: {
        logs: any[];
        total: number;
        completed: number;
    };
}

export interface ObjectSummary {
    type: string;
    recent?: any[];
    active?: any[];
    favorites?: any[];
    pinned?: any[];
    items?: any[];
}

/**
 * Hook for fetching main dashboard summary.
 * Uses React Query for caching - data won't be refetched when switching tabs.
 */
export function useDashboardSummary() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: DASHBOARD_KEYS.summary,
        queryFn: async (): Promise<DashboardSummary> => {
            const response = await fetch(`${API_URL}/api/v1/dashboard/summary`, {
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
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook for fetching object-specific summary (contents, objectives, projects, etc).
 */
export function useObjectSummary(objectType: string) {
    const { user, token } = useAuth();
    const enabled = !!user && !!token && objectType !== 'overview' && objectType !== 'daily-journal';

    return useQuery({
        queryKey: DASHBOARD_KEYS.objects(objectType),
        queryFn: async (): Promise<ObjectSummary> => {
            const response = await fetch(`${API_URL}/api/v1/dashboard/objects/${objectType}`, {
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
        enabled,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching journal insights.
 */
export function useJournalInsights(days: number = 30) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: [...DASHBOARD_KEYS.journalInsights, days],
        queryFn: async () => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/stats/insights?days=${days}`, {
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
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching journal history.
 */
export function useJournalHistory(limit: number = 7) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: [...DASHBOARD_KEYS.journalHistory, limit],
        queryFn: async () => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/?limit=${limit}`, {
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
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000,
    });
}
