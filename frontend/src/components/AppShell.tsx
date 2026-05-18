/**
 * AppShell — wraps an authenticated page with the desktop sidebar and a
 * mobile hamburger that opens the sidebar as a drawer.
 */
'use client';

import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop sidebar — hidden below md */}
            <Sidebar />

            {/* Mobile drawer + hamburger */}
            <MobileTopBar onToggle={() => setDrawerOpen(true)} />
            {drawerOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div
                        className="fixed inset-0 bg-foreground/30 backdrop-blur-sm"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="relative z-10 shadow-card-hover animate-in slide-in-from-left duration-200">
                        <Sidebar asDrawer onNavigate={() => setDrawerOpen(false)} />
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-x-hidden md:pt-0 pt-14">{children}</main>
        </div>
    );
}

function MobileTopBar({ onToggle }: { onToggle: () => void }) {
    return (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-surface-muted border-b border-border flex items-center justify-between px-4">
            <button
                onClick={onToggle}
                aria-label="Abrir menú"
                className="w-9 h-9 rounded-md hover:bg-surface flex items-center justify-center"
            >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
            </button>
            <span className="font-serif text-lg font-medium text-primary tracking-tight">Kbia</span>
            <div className="w-9" />
        </div>
    );
}
