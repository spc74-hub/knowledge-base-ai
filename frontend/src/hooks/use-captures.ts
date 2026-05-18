/**
 * Hooks for the captures inbox.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CaptureItem } from '@/components/CaptureRow';

export type InboxStatus = 'untriaged' | 'triaged' | 'all';

interface InboxResponse {
    data: CaptureItem[];
    meta: { total: number; offset: number; limit: number; status: InboxStatus };
}

export function useCapturesInbox(status: InboxStatus = 'untriaged', limit = 50, offset = 0) {
    return useQuery<InboxResponse>({
        queryKey: ['captures', 'inbox', status, limit, offset],
        queryFn: () => api.get<InboxResponse>(`/captures/inbox?status=${status}&limit=${limit}&offset=${offset}`),
        staleTime: 30_000,
    });
}

export interface TriageInput {
    area_id?: string;
    project_id?: string;
    objective_ids?: string[];
    mental_model_ids?: string[];
    user_note?: string;
    user_tags?: string[];
}

export function useTriageCapture() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: TriageInput }) =>
            api.post(`/captures/${id}/triage`, input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['captures'] });
            qc.invalidateQueries({ queryKey: ['captures-inbox-count'] });
            qc.invalidateQueries({ queryKey: ['home'] });
        },
    });
}

export function useUntriageCapture() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.post(`/captures/${id}/untriage`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['captures'] });
            qc.invalidateQueries({ queryKey: ['captures-inbox-count'] });
            qc.invalidateQueries({ queryKey: ['home'] });
        },
    });
}
