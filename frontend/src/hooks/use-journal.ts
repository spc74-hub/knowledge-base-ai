'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Hardcoded API URL - always use HTTPS in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Query keys
export const JOURNAL_KEYS = {
    all: ['journal'] as const,
    today: ['journal', 'today'] as const,
    byDate: (date: string) => ['journal', 'byDate', date] as const,
    history: (limit?: number) => ['journal', 'history', limit] as const,
    stats: ['journal', 'stats'] as const,
    weekSummary: ['journal', 'weekSummary'] as const,
    insights: (days: number) => ['journal', 'insights', days] as const,
};

// Types
export interface BigRockItem {
    id: string;
    text: string;
    type: 'custom' | 'objective' | 'project';
    ref_id: string | null;
    completed: boolean;
    order: number;
}

export interface TaskItem {
    id: string;
    text: string;
    completed: boolean;
    time?: string;
}

export interface CommitmentItem {
    id: string;
    time: string;
    text: string;
    completed: boolean;
}

export interface QuickCapture {
    id: string;
    text: string;
    timestamp: string;
    converted_to_note_id: string | null;
}

export interface ForgivenessItem {
    id: string;
    text: string;
    type: 'self' | 'other' | 'situation';
}

export interface InspirationalContent {
    quote?: string;
    quote_author?: string;
    refran?: string;
    challenge?: string;
    question?: string;
    word?: string;
}

export interface DailyJournal {
    id: string;
    user_id: string;
    date: string;
    // Morning
    morning_intention: string | null;
    energy_morning: 'high' | 'medium' | 'low' | null;
    inspirational_content: InspirationalContent;
    // Big Rocks (new array system)
    big_rocks: BigRockItem[];
    big_rocks_count: number;
    // Legacy big rock (for backwards compatibility)
    big_rock_type: string | null;
    big_rock_id: string | null;
    big_rock_text: string | null;
    big_rock_completed: boolean;
    // During the day
    energy_noon: 'high' | 'medium' | 'low' | null;
    energy_afternoon: 'high' | 'medium' | 'low' | null;
    energy_night: 'high' | 'medium' | 'low' | null;
    daily_tasks: TaskItem[];
    commitments: CommitmentItem[];
    quick_captures: QuickCapture[];
    // Evening
    wins: string[];
    learnings: string | null;
    gratitudes: string[];
    failures: string | null;
    forgiveness: string | null;
    forgiveness_items: ForgivenessItem[];
    do_different: string | null;
    note_to_tomorrow: string | null;
    day_rating: number | null;
    day_word: string | null;
    // Status
    is_morning_completed: boolean;
    is_day_completed: boolean;
    is_evening_completed: boolean;
    generated_note_id: string | null;
    ai_summary: string | null;
    // Timestamps
    created_at: string;
    updated_at: string;
}

export interface JournalUpdate {
    // Morning
    morning_intention?: string;
    energy_morning?: string;
    // Big Rocks
    big_rocks?: BigRockItem[];
    big_rocks_count?: number;
    // Legacy big rock
    big_rock_type?: string;
    big_rock_id?: string;
    big_rock_text?: string;
    big_rock_completed?: boolean;
    // During the day
    energy_noon?: string;
    energy_afternoon?: string;
    energy_night?: string;
    daily_tasks?: TaskItem[];
    commitments?: CommitmentItem[];
    quick_captures?: QuickCapture[];
    // Evening
    wins?: string[];
    learnings?: string;
    gratitudes?: string[];
    failures?: string;
    forgiveness?: string;
    forgiveness_items?: ForgivenessItem[];
    do_different?: string;
    note_to_tomorrow?: string;
    day_rating?: number;
    day_word?: string;
    // Status
    is_morning_completed?: boolean;
    is_day_completed?: boolean;
    is_evening_completed?: boolean;
}

export interface JournalHistoryItem {
    id: string;
    date: string;
    day_rating: number | null;
    day_word: string | null;
    is_morning_completed: boolean;
    is_evening_completed: boolean;
}

export interface JournalStats {
    current_streak: number;
    longest_streak: number;
    total_journals: number;
    completed_journals: number;
}

export interface WeekSummary {
    days_count: number;
    average_rating: number | null;
    energy_distribution: { high: number; medium: number; low: number };
    total_wins: number;
    total_gratitudes: number;
    journals: DailyJournal[];
}

/**
 * Hook for fetching today's journal (or creating if doesn't exist).
 */
export function useTodayJournal() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: JOURNAL_KEYS.today,
        queryFn: async (): Promise<DailyJournal> => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/today`, {
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
        staleTime: 30 * 1000, // 30 seconds - shorter for real-time sync
        refetchOnWindowFocus: true,
    });
}

/**
 * Hook for fetching journal by date.
 */
export function useJournalByDate(date: string | null) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: JOURNAL_KEYS.byDate(date || ''),
        queryFn: async (): Promise<DailyJournal> => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/by-date/${date}`, {
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
        enabled: !!user && !!token && !!date,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching journal history.
 */
export function useJournalHistory(limit: number = 30) {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: JOURNAL_KEYS.history(limit),
        queryFn: async (): Promise<{ journals: JournalHistoryItem[]; count: number }> => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/history?limit=${limit}`, {
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
 * Hook for fetching journal stats (streaks).
 */
export function useJournalStats() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: JOURNAL_KEYS.stats,
        queryFn: async (): Promise<JournalStats> => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/stats/streak`, {
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
 * Hook for fetching week summary.
 */
export function useWeekSummary() {
    const { user, token } = useAuth();

    return useQuery({
        queryKey: JOURNAL_KEYS.weekSummary,
        queryFn: async (): Promise<WeekSummary> => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/summary/week`, {
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
 * Hook for updating today's journal.
 */
export function useUpdateTodayJournal() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (updates: JournalUpdate) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/today`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSuccess: (data) => {
            // Update the cache with the new data
            queryClient.setQueryData(JOURNAL_KEYS.today, data);
        },
        onSettled: () => {
            // Also invalidate related queries
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.stats });
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.weekSummary });
        },
    });
}

/**
 * Hook for updating any journal by ID.
 */
export function useUpdateJournalById() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ journalId, updates }: { journalId: string; updates: JournalUpdate }) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/${journalId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            // Invalidate all journal queries to refresh data
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today });
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.stats });
        },
    });
}

/**
 * Hook for adding a quick capture to today's journal.
 */
export function useAddQuickCapture() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (text: string) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/today/capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text }),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today });
        },
    });
}

/**
 * Hook for adding a task to today's journal.
 */
export function useAddTask() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (task: { text: string; time?: string }) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/today/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(task),
            });
            if (!response.ok) {
                throw new Error(`Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today });
        },
    });
}

/**
 * Hook for closing the day and generating a Full Note.
 */
export function useCloseDay() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/today/close`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
        },
    });
}

/**
 * Hook for generating AI summary.
 */
export function useGenerateAISummary() {
    const { token } = useAuth();

    return useMutation({
        mutationFn: async (days: number = 30) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/summary/ai-generate?days=${days}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Error ${response.status}`);
            }
            return response.json();
        },
    });
}

/**
 * Hook for refreshing inspirational content.
 */
export function useRefreshInspirational() {
    const { token } = useAuth();

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/inspirational/refresh`, {
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
    });
}

/**
 * Hook for creating journal for a specific date.
 */
export function useCreateJournalForDate() {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (date: string) => {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/create-for-date`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ date }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Error ${response.status}`);
            }
            return response.json();
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.history() });
        },
    });
}

/**
 * Helper to invalidate all journal queries.
 */
export function useInvalidateJournal() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.all });
}
