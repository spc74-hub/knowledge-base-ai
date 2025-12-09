'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DayStat {
    day: number;
    name: string;
    completed: number;
    total: number;
    rate: number;
}

interface HabitStats {
    current_streak: number;
    best_streak: number;
    total_completions: number;
    completion_rate_week: number;
    completion_rate_month: number;
    completion_rate_year: number;
    day_stats: DayStat[];
}

interface HabitLog {
    id: string;
    date: string;
    status: string;
    value: number;
    notes: string | null;
}

interface HabitDetail {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    frequency_type: string;
    frequency_days: number[];
    target_time: string | null;
    is_active: boolean;
    created_at: string;
    statistics: HabitStats;
    recent_logs: HabitLog[];
}

interface CalendarDay {
    date: string;
    day: number;
    day_of_week: number;
    habits: {
        habit_id: string;
        status: string | null;
    }[];
    completed: number;
    total: number;
}

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function HabitDetailPage() {
    const router = useRouter();
    const params = useParams();
    const habitId = params.id as string;
    const { user, loading: authLoading } = useAuth();
    const [habit, setHabit] = useState<HabitDetail | null>(null);
    const [calendar, setCalendar] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'logs'>('overview');

    // Calendar navigation
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fetchHabit = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits/${habitId}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setHabit(data);
            } else if (response.status === 404) {
                router.push('/habits');
            }
        } catch (error) {
            console.error('Error fetching habit:', error);
        } finally {
            setLoading(false);
        }
    }, [habitId, router]);

    const fetchCalendar = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(
                `${API_URL}/api/v1/habits/stats/calendar/${calendarYear}/${calendarMonth}`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.data.session.access_token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setCalendar(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching calendar:', error);
        }
    }, [calendarYear, calendarMonth]);

    useEffect(() => {
        if (user && habitId) {
            fetchHabit();
        }
    }, [user, habitId, fetchHabit]);

    useEffect(() => {
        if (user && activeTab === 'calendar') {
            fetchCalendar();
        }
    }, [user, activeTab, fetchCalendar]);

    const handleLogDay = async (date: string, status: string) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/habits/${habitId}/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ date, status }),
            });

            fetchHabit();
            if (activeTab === 'calendar') {
                fetchCalendar();
            }
        } catch (error) {
            console.error('Error logging habit:', error);
        }
    };

    const prevMonth = () => {
        if (calendarMonth === 1) {
            setCalendarMonth(12);
            setCalendarYear(calendarYear - 1);
        } else {
            setCalendarMonth(calendarMonth - 1);
        }
    };

    const nextMonth = () => {
        if (calendarMonth === 12) {
            setCalendarMonth(1);
            setCalendarYear(calendarYear + 1);
        } else {
            setCalendarMonth(calendarMonth + 1);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user || !habit) return null;

    const stats = habit.statistics;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="h-2" style={{ backgroundColor: habit.color }}></div>
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/habits" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                ← Habitos
                            </Link>
                            <span className="text-4xl">{habit.icon}</span>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{habit.name}</h1>
                                {habit.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{habit.description}</p>
                                )}
                            </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            habit.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                            {habit.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-orange-600">{stats.current_streak}</div>
                            <div className="text-sm text-orange-700 dark:text-orange-300">Racha actual</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-purple-600">{stats.best_streak}</div>
                            <div className="text-sm text-purple-700 dark:text-purple-300">Mejor racha</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{stats.total_completions}</div>
                            <div className="text-sm text-green-700 dark:text-green-300">Total completado</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">{stats.completion_rate_month}%</div>
                            <div className="text-sm text-blue-700 dark:text-blue-300">Este mes</div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 border-b dark:border-gray-700">
                        {[
                            { key: 'overview', label: 'Estadisticas' },
                            { key: 'calendar', label: 'Calendario' },
                            { key: 'logs', label: 'Historial' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                                    activeTab === tab.key
                                        ? 'border-green-500 text-green-600 dark:text-green-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Completion rates */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tasa de cumplimiento</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Esta semana</span>
                                        <span className="font-medium">{stats.completion_rate_week}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-green-500 h-3 rounded-full transition-all"
                                            style={{ width: `${stats.completion_rate_week}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Este mes</span>
                                        <span className="font-medium">{stats.completion_rate_month}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-blue-500 h-3 rounded-full transition-all"
                                            style={{ width: `${stats.completion_rate_month}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Este ano</span>
                                        <span className="font-medium">{stats.completion_rate_year}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                        <div
                                            className="bg-purple-500 h-3 rounded-full transition-all"
                                            style={{ width: `${stats.completion_rate_year}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Day of week stats */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Rendimiento por dia</h3>
                            <div className="grid grid-cols-7 gap-2">
                                {stats.day_stats.map((day) => (
                                    <div key={day.day} className="text-center">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{day.name}</div>
                                        <div
                                            className="mx-auto w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium"
                                            style={{
                                                backgroundColor: `rgba(16, 185, 129, ${day.rate / 100})`,
                                                color: day.rate > 50 ? 'white' : '#374151',
                                            }}
                                        >
                                            {day.rate}%
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">{day.completed}/{day.total}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent activity */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 lg:col-span-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Actividad reciente (30 dias)</h3>
                            <div className="flex flex-wrap gap-1">
                                {habit.recent_logs.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400">Sin registros recientes</p>
                                ) : (
                                    habit.recent_logs.slice(0, 30).reverse().map((log) => (
                                        <div
                                            key={log.id}
                                            className={`w-6 h-6 rounded ${
                                                log.status === 'completed'
                                                    ? 'bg-green-500'
                                                    : log.status === 'skipped'
                                                    ? 'bg-yellow-400'
                                                    : log.status === 'partial'
                                                    ? 'bg-blue-400'
                                                    : 'bg-red-400'
                                            }`}
                                            title={`${log.date}: ${log.status}`}
                                        ></div>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Completado</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded"></span> Omitido</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded"></span> Parcial</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded"></span> Fallido</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Calendar Tab */}
                {activeTab === 'calendar' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        {/* Calendar navigation */}
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                ←
                            </button>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {MONTHS[calendarMonth - 1]} {calendarYear}
                            </h3>
                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                →
                            </button>
                        </div>

                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Header */}
                            {DAYS_OF_WEEK.map((day) => (
                                <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                                    {day}
                                </div>
                            ))}

                            {/* Empty cells for first week alignment */}
                            {calendar.length > 0 && Array.from({ length: calendar[0].day_of_week }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                            ))}

                            {/* Calendar days */}
                            {calendar.map((day) => {
                                const habitForDay = day.habits.find(h => h.habit_id === habitId);
                                const isToday = day.date === new Date().toISOString().split('T')[0];

                                return (
                                    <button
                                        key={day.date}
                                        onClick={() => {
                                            const newStatus = habitForDay?.status === 'completed' ? 'skipped' : 'completed';
                                            handleLogDay(day.date, newStatus);
                                        }}
                                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                                            isToday ? 'ring-2 ring-indigo-500' : ''
                                        } ${
                                            habitForDay?.status === 'completed'
                                                ? 'bg-green-500 text-white'
                                                : habitForDay?.status === 'skipped'
                                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                                                : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        <span className="font-medium">{day.day}</span>
                                        {habitForDay?.status === 'completed' && <span className="text-xs">✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <div className="p-6 border-b dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Historial de registros</h3>
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {habit.recent_logs.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay registros todavia
                                </div>
                            ) : (
                                habit.recent_logs.map((log) => (
                                    <div key={log.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                                                log.status === 'completed' ? 'bg-green-500' :
                                                log.status === 'skipped' ? 'bg-yellow-500' :
                                                log.status === 'partial' ? 'bg-blue-500' : 'bg-red-500'
                                            }`}>
                                                {log.status === 'completed' ? '✓' :
                                                 log.status === 'skipped' ? '−' :
                                                 log.status === 'partial' ? '½' : '✗'}
                                            </span>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {new Date(log.date).toLocaleDateString('es-ES', {
                                                        weekday: 'long',
                                                        day: 'numeric',
                                                        month: 'long',
                                                    })}
                                                </p>
                                                {log.notes && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{log.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            log.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            log.status === 'skipped' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                            log.status === 'partial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        }`}>
                                            {log.status === 'completed' ? 'Completado' :
                                             log.status === 'skipped' ? 'Omitido' :
                                             log.status === 'partial' ? 'Parcial' : 'Fallido'}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
