/**
 * Resolves area_id / project_id from a capture into name + icon + color
 * for the badge that shows the assignment in CaptureRow.
 */
import { useMemo } from 'react';
import { useAreas } from '@/hooks/use-areas';
import { useProjects } from '@/hooks/use-projects';
import { AssignmentLabels } from '@/components/CaptureRow';

export interface AssignableEntity {
    area_id?: string | null;
    project_id?: string | null;
}

interface AreaLike {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
}
interface ProjectLike {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
}

/**
 * Returns a function that, given a capture, builds the AssignmentLabels
 * needed by <CaptureRow assignments={...} />.
 *
 * Single fetch of areas + projects is shared across all rows.
 */
export function useAssignmentResolver() {
    const { data: areas } = useAreas({ statusFilter: 'all' });
    const { data: projects } = useProjects({ includeArchived: true });

    const areasById = useMemo(() => {
        const m = new Map<string, AreaLike>();
        for (const a of (areas as AreaLike[]) || []) m.set(a.id, a);
        return m;
    }, [areas]);

    const projectsById = useMemo(() => {
        const m = new Map<string, ProjectLike>();
        for (const p of (projects as ProjectLike[]) || []) m.set(p.id, p);
        return m;
    }, [projects]);

    return (capture: AssignableEntity): AssignmentLabels | undefined => {
        const out: AssignmentLabels = {};
        if (capture.area_id) {
            const a = areasById.get(capture.area_id);
            if (a) out.area = { name: a.name, icon: a.icon, color: a.color };
        }
        if (capture.project_id) {
            const p = projectsById.get(capture.project_id);
            if (p) out.project = { name: p.name, icon: p.icon, color: p.color };
        }
        return out.area || out.project ? out : undefined;
    };
}
