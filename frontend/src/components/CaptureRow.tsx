/**
 * CaptureRow — compact row for the captures inbox.
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

const TYPE_LABEL: Record<string, string> = {
    web: 'Web',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    twitter: 'X',
    substack: 'Substack',
    pdf: 'PDF',
    podcast: 'Podcast',
};

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function CaptureRow({ capture, compact = false }: { capture: CaptureItem; compact?: boolean }) {
    const fromBridge = capture.source_metadata?.origin === 'contenthub_bridge';
    const typeLabel = TYPE_LABEL[capture.type] || capture.type;

    return (
        <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
            <span className="text-muted text-sm pt-0.5 select-none">·</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted mb-0.5">
                    <span>{typeLabel}</span>
                    <span>·</span>
                    <span>{relativeTime(capture.created_at)}</span>
                    {fromBridge && (
                        <>
                            <span>·</span>
                            <span className="text-primary/70">from ContentHub</span>
                        </>
                    )}
                </div>
                <div className="text-sm text-foreground truncate">{capture.title}</div>
                {!compact && capture.summary && (
                    <div className="text-xs text-muted line-clamp-2 mt-1">{capture.summary}</div>
                )}
            </div>
            <div className="text-xs text-muted whitespace-nowrap shrink-0">
                {capture.area_id || capture.project_id ? (
                    <span className="text-primary/80">→ asignado</span>
                ) : (
                    <span>sin asignar</span>
                )}
            </div>
        </div>
    );
}
