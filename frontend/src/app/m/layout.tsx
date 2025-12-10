'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

export default function MobileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (!user) return null;

    const navItems = [
        { href: '/m/notes', icon: '📝', label: 'Notas' },
        { href: '/m/journal', icon: '📓', label: 'Diario' },
        { href: '/m/habits', icon: '✅', label: 'Habitos' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 sticky top-0 z-40 safe-area-top">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">KBAI</h1>
                    <Link
                        href="/dashboard"
                        className="text-sm opacity-80 hover:opacity-100"
                    >
                        Desktop
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className="px-4 py-4">
                {children}
            </main>

            {/* Bottom navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                                    isActive
                                        ? 'text-amber-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span className="text-2xl mb-1">{item.icon}</span>
                                <span className="text-xs font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
