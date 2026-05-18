/**
 * TriagePopover — inline triage UI for captures.
 *
 * Shows a popover with selects for area / project / objectives / mental
 * models + optional comment + tags, and calls POST /captures/{id}/triage
 * to persist the placement.
 *
 * Reused from /captures rows and from the content detail modal.
 */
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAreas } from '@/hooks/use-areas';
import { useProjects } from '@/hooks/use-projects';
import { useObjectivesTree } from '@/hooks/use-objectives';
import { useMentalModels } from '@/hooks/use-mental-models';
import { useTriageCapture, TriageInput } from '@/hooks/use-captures';

export interface TriagePopoverProps {
    captureId: string;
    initial?: {
        area_id?: string | null;
        project_id?: string | null;
        user_note?: string | null;
        user_tags?: string[] | null;
    };
    onDone?: () => void;
    onCancel?: () => void;
}

export default function TriagePopover({ captureId, initial, onDone, onCancel }: TriagePopoverProps) {
    const { data: areas } = useAreas({ statusFilter: 'active' });
    const { data: projects } = useProjects();
    const { data: objectivesTree } = useObjectivesTree();
    const { data: mentalModels } = useMentalModels(false);
    const triage = useTriageCapture();

    const [areaId, setAreaId] = useState<string>(initial?.area_id ?? '');
    const [projectId, setProjectId] = useState<string>(initial?.project_id ?? '');
    const [objectiveIds, setObjectiveIds] = useState<string[]>([]);
    const [mentalModelIds, setMentalModelIds] = useState<string[]>([]);
    const [note, setNote] = useState<string>(initial?.user_note ?? '');
    const [tagsInput, setTagsInput] = useState<string>((initial?.user_tags ?? []).join(', '));

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onCancel) onCancel();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);

    // If an area is selected, only show projects of that area
    const filteredProjects = useMemo(() => {
        const all = (projects as { id: string; name: string; area_id?: string | null; status?: string }[]) || [];
        if (!areaId) return all;
        return all.filter((p) => p.area_id === areaId || !p.area_id);
    }, [projects, areaId]);

    // Objectives tree -> flat list
    const flatObjectives = useMemo(() => {
        const out: { id: string; title: string; horizon?: string }[] = [];
        const walk = (nodes: unknown[]) => {
            for (const n of nodes) {
                const node = n as { id: string; title: string; horizon?: string; children?: unknown[] };
                out.push({ id: node.id, title: node.title, horizon: node.horizon });
                if (node.children) walk(node.children);
            }
        };
        const tree = (objectivesTree as { data?: unknown[] })?.data;
        if (Array.isArray(tree)) walk(tree);
        else if (Array.isArray(objectivesTree)) walk(objectivesTree as unknown[]);
        return out;
    }, [objectivesTree]);

    const handleSubmit = async () => {
        const payload: TriageInput = {};
        if (areaId) payload.area_id = areaId;
        if (projectId) payload.project_id = projectId;
        if (objectiveIds.length > 0) payload.objective_ids = objectiveIds;
        if (mentalModelIds.length > 0) payload.mental_model_ids = mentalModelIds;
        if (note.trim()) payload.user_note = note.trim();
        const tags = tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        if (tags.length > 0) payload.user_tags = tags;

        try {
            await triage.mutateAsync({ id: captureId, input: payload });
            onDone?.();
        } catch (e) {
            // Surface the error inline; could be improved with a toast.
            console.error('Triage failed', e);
        }
    };

    const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
        setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    };

    return (
        <div
            ref={containerRef}
            className="bg-surface rounded-lg border border-border shadow-card-hover p-5 w-[420px] max-w-[90vw]"
        >
            <div className="font-serif text-lg text-foreground mb-1">Asignar capture</div>
            <p className="text-xs text-muted mb-4">
                Confirma dónde encaja en tu PARA. Lo sacas del inbox.
            </p>

            <div className="space-y-3">
                <Field label="Área">
                    <select
                        value={areaId}
                        onChange={(e) => setAreaId(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                        <option value="">— Ninguna —</option>
                        {(areas || []).map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.icon ? `${a.icon} ` : ''}{a.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Proyecto">
                    <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                        <option value="">— Ninguno —</option>
                        {filteredProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </Field>

                {flatObjectives.length > 0 && (
                    <Field label="Objetivos (opcional)">
                        <ChipMultiSelect
                            options={flatObjectives.map((o) => ({ id: o.id, label: o.title }))}
                            selected={objectiveIds}
                            onToggle={(id) => toggle(objectiveIds, id, setObjectiveIds)}
                        />
                    </Field>
                )}

                {Array.isArray(mentalModels) && mentalModels.length > 0 && (
                    <Field label="Modelos mentales (opcional)">
                        <ChipMultiSelect
                            options={mentalModels.map((m) => ({
                                id: m.id,
                                label: m.icon ? `${m.icon} ${m.name}` : m.name,
                            }))}
                            selected={mentalModelIds}
                            onToggle={(id) => toggle(mentalModelIds, id, setMentalModelIds)}
                        />
                    </Field>
                )}

                <Field label="Comentario (opcional)">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Por qué lo guardas, qué quieres hacer con esto…"
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                </Field>

                <Field label="Tags (separados por coma)">
                    <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="ej: leer-luego, importante"
                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                </Field>
            </div>

            {triage.isError && (
                <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    Error al guardar. Inténtalo de nuevo.
                </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
                <button
                    onClick={onCancel}
                    className="px-3.5 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:bg-surface-muted text-sm"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={triage.isPending}
                    className="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
                >
                    {triage.isPending ? 'Guardando…' : 'Confirmar triage'}
                </button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-medium uppercase tracking-[0.1em] text-muted mb-1.5">
                {label}
            </label>
            {children}
        </div>
    );
}

function ChipMultiSelect({
    options,
    selected,
    onToggle,
}: {
    options: { id: string; label: string }[];
    selected: string[];
    onToggle: (id: string) => void;
}) {
    if (options.length === 0) {
        return <div className="text-xs text-muted italic">Sin opciones</div>;
    }
    return (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {options.map((o) => {
                const on = selected.includes(o.id);
                return (
                    <button
                        key={o.id}
                        type="button"
                        onClick={() => onToggle(o.id)}
                        className={
                            'inline-flex items-center px-2.5 py-1 rounded-md text-xs transition-colors border ' +
                            (on
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-surface text-muted border-border hover:text-foreground hover:border-strong')
                        }
                    >
                        {on ? '✓ ' : ''}
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
