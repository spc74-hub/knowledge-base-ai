/**
 * CaptureRow — compact row for the captures inbox.
 * Visually distinguishes ContentHub bridge captures with a badge and accent.
 */
import Link from 'next/link';

export interface CaptureItem {
    id: string;
    url: string;
    title: string;
    summary?: string | null;
    type: string;
    area_id?: string | null;
    project_id?: string | null;
    source_metadata?: {
        origin?: string;
        contenthub_url?: string;
        contenthub_id?: number;
    } | null;
    created_at: string;
    is_triaged?: boolean;
}

export interface AssignmentLabels {
    area?: { name: string; icon?: string | null; color?: string | null } | null;
    project?: { name: string; icon?: string | null; color?: string | null } | null;
}

const TYPE_ICON: Record<string, string> = {
    web: '🌐',
    youtube: '🎥',
    tiktok: '📱',
    twitter: '🐦',
    substack: '📰',
    pdf: '📄',
    podcast: '🎧',
    note: '📝',
};

const TYPE_LABEL: Record<string, string> = {
    web: 'Web',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    twitter: 'X',
    substack: 'Substack',
    pdf: 'PDF',
    podcast: 'Podcast',
    note: 'Nota',
};

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `hace ${days} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function CaptureRow({
    capture,
    compact = false,
    assignments,
}: {
    capture: CaptureItem;
    compact?: boolean;
    assignments?: AssignmentLabels;
}) {
    const fromBridge = capture.source_metadata?.origin === 'contenthub_bridge';
    const contenthubUrl = capture.source_metadata?.contenthub_url as string | undefined;
    const typeLabel = TYPE_LABEL[capture.type] || capture.type;
    const typeIcon = TYPE_ICON[capture.type] || '📄';
    const linked = capture.area_id || capture.project_id;

    return (
        <div className="flex items-start gap-4 py-3.5 border-b border-border last:border-b-0">
            <span className="text-lg pt-0.5 select-none w-6 flex-shrink-0 text-center">{typeIcon}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted mb-1 flex-wrap">
                    <span>{typeLabel}</span>
                    <span>·</span>
                    <span>{relativeTime(capture.created_at)}</span>
                    {fromBridge && (
                        <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-soft text-primary font-medium">
                                🔗 ContentHub
                            </span>
                        </>
                    )}
                </div>
                <div className="text-sm text-foreground truncate font-medium">{capture.title}</div>
                {!compact && capture.summary && (
                    <div className="text-xs text-muted line-clamp-2 mt-1">{capture.summary}</div>
                )}
                {fromBridge && contenthubUrl && !compact && (
                    <a
                        href={contenthubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
                    >
                        ↗ Ver en ContentHub
                    </a>
                )}
            </div>
            <div className="text-xs whitespace-nowrap shrink-0 self-center flex flex-col items-end gap-1 max-w-[180px]">
                {linked ? (
                    <>
                        {assignments?.area && (
                            <span
                                className="px-2 py-1 rounded-md font-medium truncate max-w-full"
                                style={{
                                    background: assignments.area.color ? `${assignments.area.color}22` : 'hsl(var(--primary-soft))',
                                    color: assignments.area.color || 'hsl(var(--primary))',
                                }}
                                title={`Área: ${assignments.area.name}`}
                            >
                                {assignments.area.icon ? `${assignments.area.icon} ` : ''}
                                {assignments.area.name}
                            </span>
                        )}
                        {assignments?.project && (
                            <span
                                className="px-2 py-1 rounded-md font-medium bg-surface-muted text-foreground truncate max-w-full"
                                title={`Proyecto: ${assignments.project.name}`}
                            >
                                {assignments.project.icon ? `${assignments.project.icon} ` : '📁 '}
                                {assignments.project.name}
                            </span>
                        )}
                        {!assignments?.area && !assignments?.project && (
                            <span className="px-2 py-1 rounded-md bg-primary-soft text-primary font-medium">
                                ✓ asignado
                            </span>
                        )}
                    </>
                ) : (
                    <span className="px-2 py-1 rounded-md border border-warning/30 text-warning-foreground bg-warning/10 font-medium">
                        sin triage
                    </span>
                )}
            </div>
        </div>
    );
}
