/**
 * Hook for the Apple Notes archive.
 * Server-side filtering via /api/v1/apple-notes/archive (matches
 * url LIKE 'apple-notes://%' so we never miss a row).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AppleNoteItem {
    id: string;
    url: string;
    title: string;
    summary?: string | null;
    user_tags?: string[];
    user_note?: string | null;
    is_favorite?: boolean;
    is_archived?: boolean;
    metadata?: {
        source?: string;
        apple_notes_folder?: string;
        creation_date?: string;
        modification_date?: string;
        [k: string]: unknown;
    } | null;
    source_metadata?: Record<string, unknown> | null;
    area_id?: string | null;
    project_id?: string | null;
    folder_id?: string | null;
    created_at: string;
    updated_at?: string;
}

interface ArchiveResponse {
    data: AppleNoteItem[];
    meta: {
        total: number;
        limit: number;
        offset: number;
        total_pages: number;
        page: number;
    };
}

export interface FolderItem {
    name: string;
    count: number;
}

interface FoldersResponse {
    folders: FolderItem[];
    total: number;
}

export function useAppleNotes(page = 1, perPage = 30, query?: string, folder?: string) {
    const offset = (page - 1) * perPage;
    const params = new URLSearchParams({
        limit: perPage.toString(),
        offset: offset.toString(),
    });
    if (query) params.set('q', query);
    if (folder) params.set('folder', folder);

    return useQuery<ArchiveResponse>({
        queryKey: ['apple-notes', 'archive', page, perPage, query, folder],
        queryFn: () => api.get<ArchiveResponse>(`/apple-notes/archive?${params.toString()}`),
        staleTime: 5 * 60_000,
    });
}

export function useAppleNotesFolders() {
    return useQuery<FoldersResponse>({
        queryKey: ['apple-notes', 'folders'],
        queryFn: () => api.get<FoldersResponse>('/apple-notes/archive/folders'),
        staleTime: 10 * 60_000,
    });
}
