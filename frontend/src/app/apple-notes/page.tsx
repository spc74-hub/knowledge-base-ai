/**
 * Apple Notes archive — read-mostly catalog of the imported notes.
 * Each row supports inline assignment to area/project via TriagePopover.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppleNotes, useAppleNotesFolders, AppleNoteItem } from '@/hooks/use-apple-notes';
import { useAssignmentResolver } from '@/hooks/use-assignment-resolver';
import AppShell from '@/components/AppShell';
import TriagePopover from '@/components/TriagePopover';

export default function AppleNotesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [folder, setFolder] = useState<string | undefined>(undefined);
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState<string | null>(null);

    const { data, isLoading } = useAppleNotes(page, 30, query.trim() || undefined, folder);
    const { data: folders } = useAppleNotesFolders();
    const resolveLabels = useAssignmentResolver();

    useEffect(() => {
        if (!authLoading && !user) router.replace('/login');
    }, [authLoading, user, router]);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-muted text-sm">Cargando…</div>
            </div>
        );
    }

    return (
        <AppShell>
            <div className="max-w-5xl mx-auto px-12 py-12">
                <header className="mb-8">
                    <h1 className="font-serif text-4xl text-primary mb-1">Archivo · Apple Notes</h1>
                    <p className="text-sm text-muted">
                        {data?.meta?.total ?? '…'} notas importadas. Vinculables a tu PARA;
                        la lista es read-only por defecto.
                    </p>
                </header>

                <div className="flex gap-3 mb-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Buscar por título o contenido…"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                        }}
                        className="flex-1 min-w-[260px] px-4 py-2.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <select
                        value={folder ?? ''}
                        onChange={(e) => {
                            setFolder(e.target.value || undefined);
                            setPage(1);
                        }}
                        className="px-3 py-2.5 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-w-[200px]"
                    >
                        <option value="">Todas las carpetas</option>
                        {folders?.folders?.map((f) => (
                            <option key={f.name} value={f.name}>
                                🍎 {f.name} ({f.count})
                            </option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-16 rounded-md bg-surface-muted animate-pulse" />
                        ))}
                    </div>
                ) : !data?.data?.length ? (
                    <div className="rounded-xl border border-dashed border-border p-12 text-center">
                        <p className="text-muted">
                            {query || folder
                                ? 'Sin resultados para esta búsqueda.'
                                : 'No hay notas importadas. Importa desde la app macOS.'}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-xl border border-border bg-surface divide-y divide-border">
                        {data.data.map((note) => (
                            <AppleNoteRow
                                key={note.id}
                                note={note}
                                assignments={resolveLabels(note)}
                                isOpen={openId === note.id}
                                onOpen={() => setOpenId(note.id)}
                                onClose={() => setOpenId(null)}
                            />
                        ))}
                    </div>
                )}

                {data && data.meta.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-6 text-sm text-muted">
                        <div>
                            Página {data.meta.page} de {data.meta.total_pages} · {data.meta.total} notas
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-surface-muted"
                            >
                                Anterior
                            </button>
                            <button
                                disabled={page >= data.meta.total_pages}
                                onClick={() => setPage((p) => p + 1)}
                                className="px-3 py-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-surface-muted"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function AppleNoteRow({
    note,
    assignments,
    isOpen,
    onOpen,
    onClose,
}: {
    note: AppleNoteItem;
    assignments?: ReturnType<ReturnType<typeof useAssignmentResolver>>;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const folder = note.metadata?.apple_notes_folder;
    const created = new Date(note.created_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    return (
        <div>
            <div className="px-6 py-4 hover:bg-surface-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                            <div className="font-medium text-foreground truncate flex-1">
                                {note.title || 'Sin título'}
                            </div>
                            <div className="text-[11px] text-muted whitespace-nowrap">{created}</div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted mb-1 flex-wrap">
                            {folder && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-surface-muted">
                                    🍎 {folder}
                                </span>
                            )}
                            {assignments?.area && (
                                <span
                                    className="inline-block px-1.5 py-0.5 rounded font-medium"
                                    style={{
                                        background: assignments.area.color ? `${assignments.area.color}22` : 'hsl(var(--primary-soft))',
                                        color: assignments.area.color || 'hsl(var(--primary))',
                                    }}
                                >
                                    {assignments.area.icon || '📌'} {assignments.area.name}
                                </span>
                            )}
                            {assignments?.project && (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-surface-muted">
                                    📁 {assignments.project.name}
                                </span>
                            )}
                            {note.is_favorite && <span>★</span>}
                        </div>
                        {note.summary && (
                            <p className="text-xs text-muted line-clamp-2 mt-2">{note.summary}</p>
                        )}
                    </div>
                    <button
                        onClick={onOpen}
                        className="flex-shrink-0 self-center px-3 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:bg-surface-muted text-xs"
                    >
                        Vincular →
                    </button>
                </div>
            </div>
            {isOpen && (
                <div className="px-6 pb-4">
                    <TriagePopover
                        captureId={note.id}
                        initial={{
                            area_id: note.area_id,
                            project_id: note.project_id,
                            user_note: note.user_note,
                            user_tags: note.user_tags,
                        }}
                        onDone={onClose}
                        onCancel={onClose}
                    />
                </div>
            )}
        </div>
    );
}
