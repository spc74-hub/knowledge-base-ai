/**
 * Captures inbox — ContentHub bridge items waiting for triage.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useCapturesInbox, InboxStatus } from '@/hooks/use-captures';
import AppShell from '@/components/AppShell';
import CaptureRow from '@/components/CaptureRow';

export default function CapturesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<InboxStatus>('untriaged');
    const { data, isLoading } = useCapturesInbox(status);

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
                    <p className="text-sm text-muted">
                        Contenidos enviados desde ContentHub esperando su sitio en PARA.
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
                            <CaptureRow key={c.id} capture={c} />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
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
    const message = {
        untriaged: 'No tienes captures pendientes de triage. Buena señal.',
        triaged: 'Aún no has asignado ningún capture a PARA.',
        all: 'No hay captures de ContentHub todavía. Envía uno desde el bridge.',
    }[status];
    return (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-muted">{message}</p>
        </div>
    );
}
