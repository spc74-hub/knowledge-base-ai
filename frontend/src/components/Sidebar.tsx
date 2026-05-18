/**
 * Sidebar — Strategic palette, PARA-first navigation.
 * See plan: ~/.claude/plans/fizzy-bouncing-tiger.md
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface NavItem {
    href: string;
    label: string;
    badgeKey?: 'untriaged';
}

const PRIMARY_NAV: NavItem[] = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/captures', label: 'Captures', badgeKey: 'untriaged' },
    { href: '/notes', label: 'Notas' },
    { href: '/daily-journal', label: 'Diario' },
    { href: '/habits', label: 'Hábitos' },
    { href: '/actions', label: 'Acciones' },
];

const PARA_NAV: NavItem[] = [
    { href: '/areas', label: 'Áreas' },
    { href: '/projects', label: 'Proyectos' },
    { href: '/objectives', label: 'Objetivos' },
    { href: '/mental-models', label: 'Modelos mentales' },
];

const ARCHIVE_NAV: NavItem[] = [
    { href: '/apple-notes', label: 'Apple Notes' },
    { href: '/settings/api-keys', label: 'Configuración' },
];

interface InboxCountResponse {
    untriaged: number;
}

function NavLink({
    href,
    label,
    badge,
    active,
}: {
    href: string;
    label: string;
    badge?: number;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            className={
                'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ' +
                (active
                    ? 'bg-surface text-primary font-medium shadow-card'
                    : 'text-muted hover:text-primary hover:bg-surface/60')
            }
        >
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1.5 py-0.5 min-w-[20px]">
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
}

function NavSection({ label }: { label: string }) {
    return (
        <div className="mt-5 mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
            {label}
        </div>
    );
}

export default function Sidebar() {
    const pathname = usePathname() || '/';

    const { data: inboxCount } = useQuery<InboxCountResponse>({
        queryKey: ['captures-inbox-count'],
        queryFn: () => api.get<InboxCountResponse>('/captures/inbox/count'),
        staleTime: 60_000,
        refetchInterval: 120_000,
    });

    const badges: Record<string, number> = {
        untriaged: inboxCount?.untriaged ?? 0,
    };

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
        return pathname === href || pathname.startsWith(href + '/');
    };

    return (
        <aside className="w-[220px] shrink-0 bg-surface-muted border-r border-border px-4 py-6 hidden md:flex md:flex-col">
            <Link href="/dashboard" className="font-serif text-2xl font-medium text-primary mb-6 tracking-tight">
                Kbia
            </Link>

            <nav className="flex flex-col gap-0.5">
                {PRIMARY_NAV.map((item) => (
                    <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        badge={item.badgeKey ? badges[item.badgeKey] : undefined}
                        active={isActive(item.href)}
                    />
                ))}

                <NavSection label="PARA" />
                {PARA_NAV.map((item) => (
                    <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActive(item.href)}
                    />
                ))}

                <NavSection label="Archivo" />
                {ARCHIVE_NAV.map((item) => (
                    <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActive(item.href)}
                    />
                ))}
            </nav>
        </aside>
    );
}
