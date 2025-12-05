'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// =====================================================
// Interfaces
// =====================================================

interface Objective {
    id: string;
    title: string;
    description: string;
    status: string;
    progress: number;
    icon: string;
    color: string;
    target_date: string | null;
    objective_actions: Action[];
}

interface Action {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
}

interface ProcessingStats {
    queued: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}

interface ContentStats {
    total: number;
    by_type: { [key: string]: number };
    favorites: number;
    archived: number;
    this_week: number;
}

interface Folder {
    id: string;
    name: string;
    color: string;
    icon: string;
    parent_id: string | null;
    content_count?: number;
}

interface RecentContent {
    id: string;
    title: string;
    content_type: string;
    source_url: string | null;
    created_at: string;
    is_favorite: boolean;
}

interface Project {
    id: string;
    name: string;
    status: string;
    color: string;
    icon: string;
}

// =====================================================
// Dashboard Component
// =====================================================

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // State
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
    const [contentStats, setContentStats] = useState<ContentStats | null>(null);
    const [recentContents, setRecentContents] = useState<RecentContent[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [usageCost, setUsageCost] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'recent' | 'favorites' | 'projects'>('recent');

    // Quick actions state
    const [showQuickUrl, setShowQuickUrl] = useState(false);
    const [quickUrl, setQuickUrl] = useState('');
    const [quickUrlLoading, setQuickUrlLoading] = useState(false);

    // =====================================================
    // Data Fetching
    // =====================================================

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const headers = {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            };

            // Fetch all data in parallel
            const results = await Promise.allSettled([
                fetch(`${API_URL}/api/v1/objectives/active`, { headers }),
                fetch(`${API_URL}/api/v1/content/stats`, { headers }),
                fetch(`${API_URL}/api/v1/process/stats`, { headers }),
                fetch(`${API_URL}/api/v1/content/?limit=10`, { headers }),
                fetch(`${API_URL}/api/v1/folders/`, { headers }),
                fetch(`${API_URL}/api/v1/projects/?status=active`, { headers }),
                fetch(`${API_URL}/api/v1/usage/summary?days=30`, { headers }),
            ]);

            // Process objectives
            if (results[0].status === 'fulfilled' && results[0].value.ok) {
                const data = await results[0].value.json();
                setObjectives(data.objectives || []);
            }

            // Process content stats
            if (results[1].status === 'fulfilled' && results[1].value.ok) {
                const data = await results[1].value.json();
                setContentStats(data);
            }

            // Process processing stats
            if (results[2].status === 'fulfilled' && results[2].value.ok) {
                const data = await results[2].value.json();
                setProcessingStats(data);
            }

            // Process recent contents
            if (results[3].status === 'fulfilled' && results[3].value.ok) {
                const data = await results[3].value.json();
                setRecentContents(data.data || []);
            }

            // Process folders
            if (results[4].status === 'fulfilled' && results[4].value.ok) {
                const data = await results[4].value.json();
                setFolders(data || []);
            }

            // Process projects
            if (results[5].status === 'fulfilled' && results[5].value.ok) {
                const data = await results[5].value.json();
                setProjects(data || []);
            }

            // Process usage
            if (results[6].status === 'fulfilled' && results[6].value.ok) {
                const data = await results[6].value.json();
                setUsageCost(data.total_cost_usd || 0);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (user) {
            fetchDashboardData();
        }
    }, [user, authLoading, router, fetchDashboardData]);

    // =====================================================
    // Actions
    // =====================================================

    const handleQuickSaveUrl = async () => {
        if (!quickUrl.trim()) return;

        setQuickUrlLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/quick-save/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: quickUrl }),
            });

            if (res.ok) {
                setQuickUrl('');
                setShowQuickUrl(false);
                fetchDashboardData();
            }
        } catch (error) {
            console.error('Error saving URL:', error);
        } finally {
            setQuickUrlLoading(false);
        }
    };

    const handleRetryFailed = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/process/retry-failed`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            fetchDashboardData();
        } catch (error) {
            console.error('Error retrying failed:', error);
        }
    };

    const handleToggleAction = async (objectiveId: string, actionId: string, currentState: boolean) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions/${actionId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_completed: !currentState }),
            });
            fetchDashboardData();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    // =====================================================
    // Render
    // =====================================================

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const pendingProcessing = (processingStats?.queued || 0) + (processingStats?.pending || 0) + (processingStats?.processing || 0);
    const failedCount = processingStats?.failed || 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* ===== SIDEBAR CARPETAS (Colapsable) ===== */}
            <aside className={`${sidebarCollapsed ? 'w-12' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}>
                {/* Toggle button */}
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
                >
                    {sidebarCollapsed ? (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    )}
                </button>

                {!sidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto p-3">
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Carpetas</h3>
                        {folders.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500">Sin carpetas</p>
                        ) : (
                            <ul className="space-y-1">
                                {folders.filter(f => !f.parent_id).map(folder => (
                                    <li key={folder.id}>
                                        <button
                                            onClick={() => router.push(`/explore?folder=${folder.id}`)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                                        >
                                            <span>{folder.icon || '📁'}</span>
                                            <span className="truncate">{folder.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Acceso Rapido</h3>
                            <ul className="space-y-1">
                                <li>
                                    <Link href="/explore?is_favorite=true" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
                                        <span>⭐</span><span>Favoritos</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/explore?is_archived=true" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
                                        <span>📦</span><span>Archivados</span>
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                {sidebarCollapsed && (
                    <div className="flex-1 flex flex-col items-center py-3 space-y-2">
                        <button onClick={() => router.push('/explore?is_favorite=true')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Favoritos">⭐</button>
                        <button onClick={() => router.push('/explore?is_archived=true')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Archivados">📦</button>
                        {folders.slice(0, 5).map(f => (
                            <button key={f.id} onClick={() => router.push(`/explore?folder=${f.id}`)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={f.name}>
                                {f.icon || '📁'}
                            </button>
                        ))}
                    </div>
                )}
            </aside>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 overflow-y-auto">
                {/* HEADER */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowQuickUrl(!showQuickUrl)}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm flex items-center gap-2"
                            >
                                <span>+</span> URL
                            </button>
                            <Link href="/notes/new" className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2">
                                <span>+</span> Nota
                            </Link>
                            <Link href="/chat" className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2">
                                💬 Chat
                            </Link>
                            <ThemeToggle />
                        </div>
                    </div>

                    {/* Quick URL Input */}
                    {showQuickUrl && (
                        <div className="mt-4 flex gap-2">
                            <input
                                type="url"
                                value={quickUrl}
                                onChange={(e) => setQuickUrl(e.target.value)}
                                placeholder="https://..."
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickSaveUrl()}
                            />
                            <button
                                onClick={handleQuickSaveUrl}
                                disabled={quickUrlLoading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {quickUrlLoading ? '...' : 'Guardar'}
                            </button>
                        </div>
                    )}
                </header>

                <div className="p-6 space-y-6">
                    {/* ===== ZONA 1: METRICAS ===== */}
                    <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{contentStats?.total || 0}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Procesando</p>
                            <p className="text-2xl font-bold text-yellow-600">{pendingProcessing}</p>
                        </div>
                        <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border ${failedCount > 0 ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Fallidos</p>
                            <p className={`text-2xl font-bold ${failedCount > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{failedCount}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Esta semana</p>
                            <p className="text-2xl font-bold text-green-600">+{contentStats?.this_week || 0}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Costo (30d)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">${usageCost.toFixed(2)}</p>
                        </div>
                    </section>

                    {/* ===== ZONA 2: FOCO Y ALERTAS ===== */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Objetivo Activo */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    🎯 Objetivo Activo
                                </h2>
                                <Link href="/objectives" className="text-sm text-indigo-600 hover:underline">Ver todos</Link>
                            </div>

                            {objectives.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 dark:text-gray-400 mb-4">No tienes objetivos activos</p>
                                    <Link href="/objectives" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                        Crear objetivo
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {objectives.slice(0, 1).map(obj => (
                                        <div key={obj.id}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-2xl">{obj.icon}</span>
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900 dark:text-white">{obj.title}</h3>
                                                    {obj.target_date && (
                                                        <p className="text-xs text-gray-500">Deadline: {new Date(obj.target_date).toLocaleDateString()}</p>
                                                    )}
                                                </div>
                                                <span className="text-lg font-bold" style={{ color: obj.color }}>{obj.progress}%</span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                                                <div
                                                    className="h-2 rounded-full transition-all"
                                                    style={{ width: `${obj.progress}%`, backgroundColor: obj.color }}
                                                />
                                            </div>

                                            {/* Actions */}
                                            {obj.objective_actions && obj.objective_actions.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Proximas acciones:</p>
                                                    {obj.objective_actions.filter(a => !a.is_completed).slice(0, 3).map(action => (
                                                        <label key={action.id} className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={action.is_completed}
                                                                onChange={() => handleToggleAction(obj.id, action.id, action.is_completed)}
                                                                className="rounded border-gray-300 text-indigo-600"
                                                            />
                                                            <span className="text-sm text-gray-700 dark:text-gray-300">{action.title}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Alertas y Acciones Pendientes */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚡ Centro de Acciones</h2>

                            <div className="space-y-3">
                                {failedCount > 0 && (
                                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <span className="text-sm text-red-800 dark:text-red-200">
                                            🔴 {failedCount} contenidos fallidos
                                        </span>
                                        <button
                                            onClick={handleRetryFailed}
                                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                )}

                                {pendingProcessing > 0 && (
                                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                                            🟡 {pendingProcessing} en cola de procesamiento
                                        </span>
                                        <Link href="/import" className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
                                            Ver cola
                                        </Link>
                                    </div>
                                )}

                                {projects.filter(p => p.status === 'active').length > 0 && (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <span className="text-sm text-blue-800 dark:text-blue-200">
                                            📁 {projects.filter(p => p.status === 'active').length} proyectos activos
                                        </span>
                                        <Link href="/projects" className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                            Ver
                                        </Link>
                                    </div>
                                )}

                                {failedCount === 0 && pendingProcessing === 0 && projects.length === 0 && (
                                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                        ✅ Todo al dia
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ===== ZONA 3: NAVEGACION + CONTENIDO ===== */}
                    <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Navegacion */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🧭 Navegar</h2>

                            <div className="space-y-2">
                                <Link href="/explore" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🔍</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Explorar</span>
                                </Link>
                                <Link href="/taxonomy" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🌳</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Taxonomia</span>
                                </Link>
                                <Link href="/knowledge-graph" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🕸️</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Knowledge Graph</span>
                                </Link>
                                <Link href="/chat" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">💬</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Chat IA</span>
                                </Link>

                                <hr className="my-3 border-gray-200 dark:border-gray-700" />

                                <Link href="/objectives" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🎯</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Objetivos</span>
                                </Link>
                                <Link href="/projects" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">📁</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Proyectos</span>
                                </Link>
                                <Link href="/journal" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">📔</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Diario</span>
                                </Link>
                                <Link href="/mental-models" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🧠</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Modelos Mentales</span>
                                </Link>
                                <Link href="/tags" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🏷️</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Tags</span>
                                </Link>

                                <hr className="my-3 border-gray-200 dark:border-gray-700" />

                                <Link href="/import" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">📥</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Importar URLs</span>
                                </Link>
                                <Link href="/import-apple-notes" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">🍎</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Apple Notes</span>
                                </Link>
                                <Link href="/quick-save" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">⚡</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Quick Save</span>
                                </Link>
                                <Link href="/usage" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span className="text-xl">📊</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Uso API</span>
                                </Link>
                            </div>
                        </div>

                        {/* Contenido Reciente */}
                        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveTab('recent')}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'recent' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        Reciente
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('favorites')}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'favorites' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        Favoritos
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('projects')}
                                        className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === 'projects' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        Proyectos
                                    </button>
                                </div>
                                <Link href="/explore" className="text-sm text-indigo-600 hover:underline">Ver todo →</Link>
                            </div>

                            {activeTab === 'recent' && (
                                <div className="space-y-2">
                                    {recentContents.length === 0 ? (
                                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay contenidos recientes</p>
                                    ) : (
                                        recentContents.map(content => (
                                            <Link
                                                key={content.id}
                                                href={`/explore?content=${content.id}`}
                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                                            >
                                                <span className="text-lg">
                                                    {content.content_type === 'note' ? '📝' :
                                                     content.content_type === 'url' ? '🔗' :
                                                     content.content_type === 'apple_note' ? '🍎' : '📄'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{content.title}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {new Date(content.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                {content.is_favorite && <span>⭐</span>}
                                            </Link>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'favorites' && (
                                <div className="space-y-2">
                                    {recentContents.filter(c => c.is_favorite).length === 0 ? (
                                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay favoritos</p>
                                    ) : (
                                        recentContents.filter(c => c.is_favorite).map(content => (
                                            <Link
                                                key={content.id}
                                                href={`/explore?content=${content.id}`}
                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <span>⭐</span>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{content.title}</p>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'projects' && (
                                <div className="space-y-2">
                                    {projects.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500 dark:text-gray-400 mb-4">No hay proyectos activos</p>
                                            <Link href="/projects" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                                Crear proyecto
                                            </Link>
                                        </div>
                                    ) : (
                                        projects.map(project => (
                                            <Link
                                                key={project.id}
                                                href={`/projects?id=${project.id}`}
                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <span className="text-lg">{project.icon}</span>
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</p>
                                                    <p className="text-xs text-gray-500">{project.status}</p>
                                                </div>
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                                            </Link>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
