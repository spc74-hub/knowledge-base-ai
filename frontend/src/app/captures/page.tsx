/**
 * Captures inbox — ContentHub bridge items waiting for triage.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCapturesInbox, InboxStatus, useUntriageCapture } from '@/hooks/use-captures';
import AppShell from '@/components/AppShell';
import CaptureRow, { CaptureItem } from '@/components/CaptureRow';
import TriagePopover from '@/components/TriagePopover';

export default function CapturesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<InboxStatus>('untriaged');
    const { data, isLoading } = useCapturesInbox(status);
    const [triagingId, setTriagingId] = useState<string | null>(null);
    const untriage = useUntriageCapture();

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
                    <h1 className="font-serif text-4xl text-primary mb-1">Captures</h1>
                    <p className="text-sm text-muted max-w-2xl">
                        Cuando envías un contenido desde <strong>ContentHub</strong> con
                        “Send to Kbia”, aparece aquí. Cada capture lleva un badge
                        <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-primary-soft text-primary text-xs font-medium">
                            🔗 ContentHub
                        </span>
                        para que sepas de dónde viene. Asigna a PARA y sale del inbox.
                    </p>
                </header>

                <div className="flex gap-1 mb-6 border-b border-border">
                    <FilterTab label="Sin triage" active={status === 'untriaged'} onClick={() => setStatus('untriaged')} />
                    <FilterTab label="Asignados" active={status === 'triaged'} onClick={() => setStatus('triaged')} />
                    <FilterTab label="Todos" active={status === 'all'} onClick={() => setStatus('all')} />
                    {data && (
                        <span className="ml-auto self-end pb-2 text-xs text-muted">
                            {data.meta.total} resultado{data.meta.total === 1 ? '' : 's'}
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-14 rounded-md bg-surface-muted animate-pulse" />
                        ))}
                    </div>
                ) : !data?.data?.length ? (
                    <Empty status={status} />
                ) : (
                    <div className="rounded-xl border border-border bg-surface px-6 divide-y divide-border">
                        {data.data.map((c) => (
                            <CaptureRowWithActions
                                key={c.id}
                                capture={c}
                                isOpen={triagingId === c.id}
                                onOpenTriage={() => setTriagingId(c.id)}
                                onCloseTriage={() => setTriagingId(null)}
                                onUntriage={() => untriage.mutate(c.id)}
                                isUntriaging={untriage.isPending}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function CaptureRowWithActions({
    capture,
    isOpen,
    onOpenTriage,
    onCloseTriage,
    onUntriage,
    isUntriaging,
}: {
    capture: CaptureItem;
    isOpen: boolean;
    onOpenTriage: () => void;
    onCloseTriage: () => void;
    onUntriage: () => void;
    isUntriaging: boolean;
}) {
    return (
        <div>
            <div className="flex items-start">
                <div className="flex-1 min-w-0">
                    <CaptureRow capture={capture} />
                </div>
                <div className="flex-shrink-0 self-center pl-3 flex gap-1.5">
                    {!capture.is_triaged ? (
                        <button
                            onClick={onOpenTriage}
                            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-xs font-medium"
                        >
                            Asignar →
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onOpenTriage}
                                className="px-3 py-1.5 rounded-md border border-border text-muted hover:text-foreground hover:bg-surface-muted text-xs"
                            >
                                Editar
                            </button>
                            <button
                                onClick={onUntriage}
                                disabled={isUntriaging}
                                className="px-3 py-1.5 rounded-md border border-warning/30 text-warning-foreground hover:bg-warning/10 text-xs disabled:opacity-50"
                                title="Devolver al inbox"
                            >
                                ↩
                            </button>
                        </>
                    )}
                </div>
            </div>
            {isOpen && (
                <div className="pl-12 pb-4 pt-1">
                    <TriagePopover
                        captureId={capture.id}
                        initial={{
                            area_id: capture.area_id,
                            project_id: capture.project_id,
                        }}
                        onDone={onCloseTriage}
                        onCancel={onCloseTriage}
                    />
                </div>
            )}
        </div>
    );
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={
                'px-4 py-2 text-sm transition-colors border-b-2 -mb-px ' +
                (active
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted hover:text-foreground')
            }
        >
            {label}
        </button>
    );
}

function Empty({ status }: { status: InboxStatus }) {
    if (status === 'all') {
        return (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-3">🔗</div>
                <h3 className="font-serif text-xl text-foreground mb-2">Aún no tienes captures</h3>
                <p className="text-sm text-muted max-w-md mx-auto">
                    Desde <strong>ContentHub</strong> pulsa <em>“Send to Kbia”</em> en el
                    contenido que quieras decidir aquí: aparecerá en este inbox con un
                    botón para abrirlo de vuelta en ContentHub cuando lo necesites.
                </p>
            </div>
        );
    }
    const message = {
        untriaged: 'No tienes captures pendientes de triage. Buena señal.',
        triaged: 'Aún no has asignado ningún capture a tu PARA.',
    }[status];
    return (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-muted">{message}</p>
        </div>
    );
}
