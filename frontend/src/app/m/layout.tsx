'use client';

import { useEffect, useState } from 'react';
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
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        // Load dark mode preference
        const saved = localStorage.getItem('kbai-dark-mode');
        if (saved !== null) {
            setDarkMode(saved === 'true');
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setDarkMode(prefersDark);
        }
    }, []);

    useEffect(() => {
        // Apply dark mode to document
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('kbai-dark-mode', String(darkMode));
    }, [darkMode]);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (!user) return null;

    const navItems = [
        { href: '/m/dashboard', icon: '🏠', label: 'Panel' },
        { href: '/m/habits', icon: '✅', label: 'Hábitos' },
        { href: '/m/actions', icon: '⚡', label: 'Acciones' },
        { href: '/m/journal', icon: '📓', label: 'Diario' },
        { href: '/m/contents', icon: '📚', label: 'Contenido' },
        { href: '/m/notes', icon: '📋', label: 'Notas' },
    ];

    return (
        <div className={`min-h-screen pb-16 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-white px-4 py-3 sticky top-0 z-40 safe-area-top">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/icons/icon-192.png" alt="KBAI" className="w-8 h-8 rounded-lg" />
                        <h1 className="text-lg font-semibold">KBAI</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Dark mode toggle */}
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="text-xl opacity-80 hover:opacity-100 transition-opacity"
                            aria-label="Toggle dark mode"
                        >
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        <Link
                            href="/dashboard"
                            className="text-sm opacity-80 hover:opacity-100"
                        >
                            Desktop
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main content - pass darkMode as data attribute */}
            <main className="px-4 py-4" data-dark={darkMode}>
                {children}
            </main>

            {/* Bottom navigation */}
            <nav className={`fixed bottom-0 left-0 right-0 border-t safe-area-bottom z-50 ${
                darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
                <div className="flex justify-around items-center h-14">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                                    isActive
                                        ? 'text-blue-500'
                                        : darkMode
                                            ? 'text-gray-400 hover:text-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span className="text-lg mb-0.5">{item.icon}</span>
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Provide dark mode context via CSS variable */}
            <style jsx global>{`
                :root {
                    --dark-mode: ${darkMode ? '1' : '0'};
                }
            `}</style>
        </div>
    );
}
