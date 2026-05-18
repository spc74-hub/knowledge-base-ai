/**
 * Hook for the Apple Notes archive.
 * Reuses /api/v1/content with metadata.source = apple_notes filter.
 * For now we just fetch type=note and filter on the client by metadata.source
 * because the existing endpoint doesn't have a metadata->>source filter param.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AppleNoteItem {
    id: string;
    title: string;
    summary?: string | null;
    url: string;
    created_at: string;
    metadata?: { source?: string; apple_notes_folder?: string; [k: string]: unknown } | null;
    user_tags?: string[];
}

interface AppleNotesResponse {
    data: AppleNoteItem[];
    meta: { page: number; per_page: number; total: number; total_pages: number };
}

export function useAppleNotes(page = 1, perPage = 30, query?: string) {
    return useQuery<AppleNotesResponse>({
        queryKey: ['apple-notes', page, perPage, query],
        queryFn: async () => {
            // Backend /content endpoint already supports type=note + q filter.
            // We filter apple_notes via metadata.source on the client (small enough).
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: perPage.toString(),
                type: 'note',
            });
            if (query) params.set('q', query);

            const raw = await api.get<AppleNotesResponse>(`/content/?${params.toString()}`);
            const filtered = (raw.data || []).filter((n) => n.metadata?.source === 'apple_notes');
            return { ...raw, data: filtered };
        },
        staleTime: 5 * 60_000,
    });
}
