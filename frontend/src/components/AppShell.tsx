/**
 * AppShell — wraps any authenticated page with the sidebar.
 * Pages that already manage their own layout can opt out.
 */
'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden">
                {children}
            </main>
        </div>
    );
}
