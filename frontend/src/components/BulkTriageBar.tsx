/**
 * BulkTriageBar — sticky bar that appears at the top of /captures when the
 * user has selected one or more rows. Lets them apply the SAME area /
 * project to all of them in a single mutation.
 */
'use client';

import { useState } from 'react';
import { useAreas } from '@/hooks/use-areas';
import { useProjects } from '@/hooks/use-projects';
import { useTriageCapture } from '@/hooks/use-captures';

export default function BulkTriageBar({
    selectedIds,
    onClear,
}: {
    selectedIds: string[];
    onClear: () => void;
}) {
    const { data: areas } = useAreas({ statusFilter: 'active' });
    const { data: projects } = useProjects();
    const triage = useTriageCapture();

    const [areaId, setAreaId] = useState<string>('');
    const [projectId, setProjectId] = useState<string>('');
    const [working, setWorking] = useState(false);

    const filteredProjects = ((projects as { id: string; name: string; area_id?: string | null }[]) || [])
        .filter((p) => !areaId || p.area_id === areaId || !p.area_id);

    const apply = async () => {
        if (!areaId && !projectId) return;
        setWorking(true);
        try {
            const payload = {
                ...(areaId ? { area_id: areaId } : {}),
                ...(projectId ? { project_id: projectId } : {}),
            };
            // Serial requests — easier to reason about than parallel + the
            // mutation invalidates the inbox query every time anyway.
            for (const id of selectedIds) {
                await triage.mutateAsync({ id, input: payload });
            }
            onClear();
        } finally {
            setWorking(false);
        }
    };

    if (selectedIds.length === 0) return null;

    return (
        <div className="sticky top-0 z-30 mb-4 -mx-4 px-4 py-3 bg-primary-soft border border-primary/30 rounded-xl shadow-card flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-primary whitespace-nowrap">
                {selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}
            </span>

            <span className="text-xs text-muted">→</span>

            <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                disabled={working}
                className="px-2 py-1.5 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
            >
                <option value="">Área…</option>
                {((areas as { id: string; name: string; icon?: string | null }[]) || []).map((a) => (
                    <option key={a.id} value={a.id}>
                        {a.icon ? `${a.icon} ` : ''}
                        {a.name}
                    </option>
                ))}
            </select>

            <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={working}
                className="px-2 py-1.5 rounded-md border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
            >
                <option value="">Proyecto…</option>
                {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>

            <button
                onClick={apply}
                disabled={working || (!areaId && !projectId)}
                className="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
            >
                {working ? `Asignando ${selectedIds.length}…` : 'Asignar a todos'}
            </button>

            <button
                onClick={onClear}
                disabled={working}
                className="ml-auto px-3 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface text-sm"
            >
                Limpiar
            </button>
        </div>
    );
}
