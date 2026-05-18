/**
 * AreaTile — the hero unit on the PARA-first home.
 */
import Link from 'next/link';

export interface AreaTileData {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    description?: string | null;
    counts?: {
        projects_active: number;
        objectives_active: number;
        habits_active: number;
        captures_untriaged: number;
    };
}

export default function AreaTile({ area }: { area: AreaTileData }) {
    const counts = area.counts ?? {
        projects_active: 0,
        objectives_active: 0,
        habits_active: 0,
        captures_untriaged: 0,
    };
    const accent = area.color || '#1e3a5f';

    return (
        <Link
            href={`/areas/${area.id}`}
            className="group block rounded-xl border border-border bg-surface p-6 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
        >
            <div className="text-2xl mb-3" style={{ color: accent }}>
                {area.icon || '📌'}
            </div>
            <h3 className="font-serif text-lg font-medium text-foreground mb-1">{area.name}</h3>
            {area.description && (
                <p className="text-xs text-muted line-clamp-2 mb-4">{area.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <Stat n={counts.projects_active} label="proyectos" />
                <Stat n={counts.objectives_active} label="objetivos" />
                <Stat n={counts.habits_active} label="hábitos" />
            </div>

            {counts.captures_untriaged > 0 && (
                <div className="mt-3 text-xs font-medium" style={{ color: 'hsl(var(--warning-foreground))' }}>
                    {counts.captures_untriaged} capture{counts.captures_untriaged === 1 ? '' : 's'} pendiente{counts.captures_untriaged === 1 ? '' : 's'}
                </div>
            )}
        </Link>
    );
}

function Stat({ n, label }: { n: number; label: string }) {
    return (
        <span>
            <strong className="text-foreground font-semibold">{n}</strong> {label}
        </span>
    );
}
