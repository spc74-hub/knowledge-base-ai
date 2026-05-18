/**
 * Home — PARA-first dashboard.
 * Hero: active areas as tiles. Bands below: untriaged captures, today, recent.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useHome } from '@/hooks/use-home';
import AppShell from '@/components/AppShell';
import AreaTile from '@/components/AreaTile';
import CaptureRow, { CaptureItem } from '@/components/CaptureRow';
import BridgeBanner from '@/components/BridgeBanner';
import TriagePopover from '@/components/TriagePopover';

export default function HomePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { data, isLoading } = useHome();
    const [triagingId, setTriagingId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
        }
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
                <header className="mb-10">
                    <h1 className="font-serif text-4xl text-primary mb-1">Tus áreas</h1>
                    <p className="text-sm text-muted">Lo que importa esta semana</p>
                </header>

                <BridgeBanner untriagedCount={data?.captures_recent_untriaged?.length ?? 0} />

                {isLoading ? (
                    <SkeletonGrid />
                ) : data?.areas?.length ? (
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                        {data.areas.map((area) => (
                            <AreaTile key={area.id} area={area} />
                        ))}
                    </section>
                ) : (
                    <EmptyAreas />
                )}

                {data?.captures_recent_untriaged && data.captures_recent_untriaged.length > 0 && (
                    <section className="mb-12">
                        <BandHeader title="Captures pendientes" link="/captures" />
                        <div className="rounded-xl border border-border bg-surface px-6 divide-y divide-border">
                            {data.captures_recent_untriaged.slice(0, 5).map((c) => (
                                <HomeCaptureRow
                                    key={c.id}
                                    capture={c}
                                    isOpen={triagingId === c.id}
                                    onOpen={() => setTriagingId(c.id)}
                                    onClose={() => setTriagingId(null)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {data?.today && (data.today.habits.length > 0 || data.today.journal) && (
                    <section className="mb-12">
                        <BandHeader title="Hoy" link="/daily-journal" />
                        <TodayBlock today={data.today} />
                    </section>
                )}

                {data?.recent && (data.recent.notes.length > 0 || data.recent.objectives.length > 0) && (
                    <section className="mb-12">
                        <BandHeader title="Recientes" />
                        <RecentBlock recent={data.recent} />
                    </section>
                )}
            </div>
        </AppShell>
    );
}

function HomeCaptureRow({
    capture,
    isOpen,
    onOpen,
    onClose,
}: {
    capture: CaptureItem;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    return (
        <div>
            <div className="flex items-start">
                <div className="flex-1 min-w-0">
                    <CaptureRow capture={capture} compact />
                </div>
                <div className="flex-shrink-0 self-center pl-3">
                    <button
                        onClick={onOpen}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-xs font-medium"
                    >
                        Asignar →
                    </button>
                </div>
            </div>
            {isOpen && (
                <div className="pl-12 pb-4 pt-1">
                    <TriagePopover
                        captureId={capture.id}
                        initial={{ area_id: capture.area_id, project_id: capture.project_id }}
                        onDone={onClose}
                        onCancel={onClose}
                    />
                </div>
            )}
        </div>
    );
}

function BandHeader({ title, link }: { title: string; link?: string }) {
    return (
        <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-foreground">{title}</h2>
            {link && (
                <Link href={link} className="text-sm text-primary hover:underline">
                    Ver todos →
                </Link>
            )}
        </div>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-surface-muted animate-pulse" />
            ))}
        </div>
    );
}

function EmptyAreas() {
    return (
        <div className="rounded-xl border border-dashed border-border p-12 text-center mb-12">
            <p className="text-muted mb-3">No tienes áreas activas todavía.</p>
            <Link
                href="/areas"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
                Crear un área
            </Link>
        </div>
    );
}

function TodayBlock({ today }: { today: NonNullable<ReturnType<typeof useHome>['data']>['today'] }) {
    return (
        <div className="rounded-xl border border-border bg-surface p-6">
            {today.journal?.morning_intention && (
                <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-1">Intención del día</div>
                    <div className="text-foreground">{today.journal.morning_intention}</div>
                </div>
            )}
            {today.habits.length > 0 && (
                <div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-2">Hábitos de hoy</div>
                    <div className="flex flex-wrap gap-2">
                        {today.habits.slice(0, 8).map((h) => {
                            const done = h.status_today === 'completed';
                            return (
                                <span
                                    key={h.id}
                                    className={
                                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ' +
                                        (done
                                            ? 'bg-primary-soft text-primary line-through opacity-60'
                                            : 'bg-surface-muted text-foreground')
                                    }
                                >
                                    <span>{h.icon || '•'}</span>
                                    {h.name}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function RecentBlock({ recent }: { recent: NonNullable<ReturnType<typeof useHome>['data']>['recent'] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface p-5">
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-3">Notas recientes</div>
                {recent.notes.length === 0 ? (
                    <div className="text-sm text-muted">Aún nada.</div>
                ) : (
                    <ul className="space-y-2">
                        {recent.notes.slice(0, 5).map((n) => (
                            <li key={n.id} className="text-sm text-foreground truncate">{n.title}</li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
                <div className="text-[10px] uppercase tracking-[0.1em] text-muted mb-3">Objetivos activos</div>
                {recent.objectives.length === 0 ? (
                    <div className="text-sm text-muted">Aún nada.</div>
                ) : (
                    <ul className="space-y-2">
                        {recent.objectives.slice(0, 5).map((o) => (
                            <li key={o.id} className="text-sm text-foreground truncate">
                                {o.icon || '•'} {o.title}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
