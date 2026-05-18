/**
 * Hook for the PARA-first home: single round trip to /api/v1/home/.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AreaTileData } from '@/components/AreaTile';
import { CaptureItem } from '@/components/CaptureRow';

export interface HomeHabitToday {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    time_of_day?: string | null;
    status_today?: string | null;
}

export interface HomeJournalToday {
    big_rocks?: unknown;
    morning_intention?: string | null;
    day_word?: string | null;
}

export interface HomeResponse {
    areas: AreaTileData[];
    captures_recent_untriaged: CaptureItem[];
    today: {
        habits: HomeHabitToday[];
        journal: HomeJournalToday | null;
    };
    recent: {
        notes: { id: string; title: string; note_type?: string; created_at: string }[];
        objectives: { id: string; title: string; icon?: string; color?: string; horizon?: string; progress?: number; status?: string }[];
    };
}

export function useHome() {
    return useQuery<HomeResponse>({
        queryKey: ['home'],
        queryFn: () => api.get<HomeResponse>('/home/'),
        staleTime: 60_000,
    });
}
