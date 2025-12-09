'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface HabitLog {
    id: string;
    status: string;
    value: number;
    date: string;
}

interface Habit {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    frequency_type: string;
    frequency_days: number[];
    target_count: number;
    target_time: string | null;
    is_active: boolean;
    area_id: string | null;
    today_log: HabitLog | null;
    is_completed?: boolean;
}

interface HabitStats {
    total_habits: number;
    habits_for_today: number;
    completed_today: number;
    today_progress: number;
    completed_this_week: number;
}

interface Area {
    id: string;
    name: string;
    icon: string;
}

const HABIT_ICONS = ['✅', '💪', '📚', '🧘', '💧', '🏃', '🥗', '😴', '📝', '🎯', '💰', '🎵', '🌱', '🧠', '⏰', '🙏'];
const HABIT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const FREQUENCY_TYPES = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'custom', label: 'Personalizado' },
];
const DAYS_OF_WEEK = [
    { value: 0, label: 'Dom' },
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mie' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sab' },
];

export default function HabitsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [habits, setHabits] = useState<Habit[]>([]);
    const [todayHabits, setTodayHabits] = useState<Habit[]>([]);
    const [stats, setStats] = useState<HabitStats | null>(null);
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'today' | 'all' | 'stats'>('today');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIcon, setFormIcon] = useState('✅');
    const [formColor, setFormColor] = useState('#10b981');
    const [formFrequency, setFormFrequency] = useState('daily');
    const [formDays, setFormDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
    const [formTargetTime, setFormTargetTime] = useState('');
    const [formAreaId, setFormAreaId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fetchData = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = { 'Authorization': `Bearer ${session.data.session.access_token}` };

            // Fetch in parallel
            const [habitsRes, todayRes, statsRes, areasRes] = await Promise.all([
                fetch(`${API_URL}/api/v1/habits`, { headers }),
                fetch(`${API_URL}/api/v1/habits/today`, { headers }),
                fetch(`${API_URL}/api/v1/habits/stats/overview`, { headers }),
                fetch(`${API_URL}/api/v1/areas?status_filter=active`, { headers }),
            ]);

            if (habitsRes.ok) {
                const data = await habitsRes.json();
                setHabits(data.data || []);
            }
            if (todayRes.ok) {
                const data = await todayRes.json();
                setTodayHabits(data.data || []);
            }
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
            if (areasRes.ok) {
                const data = await areasRes.json();
                setAreas(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, fetchData]);

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormIcon('✅');
        setFormColor('#10b981');
        setFormFrequency('daily');
        setFormDays([0, 1, 2, 3, 4, 5, 6]);
        setFormTargetTime('');
        setFormAreaId('');
    };

    const handleCreate = async () => {
        if (!formName.trim()) return;

        setSaving(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: formName.trim(),
                    description: formDescription.trim() || null,
                    icon: formIcon,
                    color: formColor,
                    frequency_type: formFrequency,
                    frequency_days: formFrequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : formDays,
                    target_time: formTargetTime || null,
                    area_id: formAreaId || null,
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchData();
            }
        } catch (error) {
            console.error('Error creating habit:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleComplete = async (habit: Habit) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const today = new Date().toISOString().split('T')[0];
            const newStatus = habit.is_completed ? 'skipped' : 'completed';

            await fetch(`${API_URL}/api/v1/habits/${habit.id}/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    date: today,
                    status: newStatus,
                }),
            });

            // Update local state
            setTodayHabits(prev => prev.map(h =>
                h.id === habit.id
                    ? { ...h, is_completed: !habit.is_completed, today_log: { ...h.today_log, status: newStatus } as any }
                    : h
            ));

            // Update stats
            if (stats) {
                setStats({
                    ...stats,
                    completed_today: habit.is_completed ? stats.completed_today - 1 : stats.completed_today + 1,
                    today_progress: Math.round(((habit.is_completed ? stats.completed_today - 1 : stats.completed_today + 1) / stats.habits_for_today) * 100),
                });
            }
        } catch (error) {
            console.error('Error toggling habit:', error);
        }
    };

    const handleDelete = async (habit: Habit) => {
        if (!confirm(`¿Eliminar el habito "${habit.name}"? Se eliminaran todos los registros.`)) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/habits/${habit.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            fetchData();
        } catch (error) {
            console.error('Error deleting habit:', error);
        }
    };

    const toggleDay = (day: number) => {
        setFormDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        );
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                ← Dashboard
                            </Link>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Habitos</h1>
                        </div>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            + Nuevo Habito
                        </button>
                    </div>

                    {/* Stats bar */}
                    {stats && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-600">{stats.completed_today}/{stats.habits_for_today}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Completados hoy</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-indigo-600">{stats.today_progress}%</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Progreso</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-purple-600">{stats.completed_this_week}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Esta semana</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{stats.total_habits}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total habitos</div>
                            </div>
                        </div>
                    )}

                    {/* View tabs */}
                    <div className="flex gap-1 mt-4 border-b dark:border-gray-700">
                        {[
                            { key: 'today', label: 'Hoy' },
                            { key: 'all', label: 'Todos' },
                            { key: 'stats', label: 'Estadisticas' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveView(tab.key as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                                    activeView === tab.key
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
                {/* Today View */}
                {activeView === 'today' && (
                    <div className="space-y-4">
                        {todayHabits.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                                <div className="text-5xl mb-4">🎉</div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No tienes habitos para hoy
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    Crea nuevos habitos o ajusta la frecuencia de los existentes.
                                </p>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setShowCreateModal(true);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Crear habito
                                </button>
                            </div>
                        ) : (
                            todayHabits.map((habit) => (
                                <div
                                    key={habit.id}
                                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-4 flex items-center gap-4 transition-all ${
                                        habit.is_completed ? 'opacity-60' : ''
                                    }`}
                                    style={{ borderLeftColor: habit.color }}
                                >
                                    <button
                                        onClick={() => handleToggleComplete(habit)}
                                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl transition-all ${
                                            habit.is_completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                        }`}
                                    >
                                        {habit.is_completed ? '✓' : habit.icon}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-gray-900 dark:text-white ${habit.is_completed ? 'line-through' : ''}`}>
                                            {habit.name}
                                        </p>
                                        {habit.target_time && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Objetivo: {habit.target_time}
                                            </p>
                                        )}
                                    </div>
                                    <Link
                                        href={`/habits/${habit.id}`}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2"
                                    >
                                        →
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* All Habits View */}
                {activeView === 'all' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {habits.length === 0 ? (
                            <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No tienes habitos todavia
                                </h3>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setShowCreateModal(true);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Crear primer habito
                                </button>
                            </div>
                        ) : (
                            habits.map((habit) => (
                                <div
                                    key={habit.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden"
                                >
                                    <div className="h-1" style={{ backgroundColor: habit.color }}></div>
                                    <div className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{habit.icon}</span>
                                                <div>
                                                    <h3 className="font-medium text-gray-900 dark:text-white">{habit.name}</h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {habit.frequency_type === 'daily' ? 'Diario' :
                                                         habit.frequency_type === 'weekly' ? 'Semanal' : 'Personalizado'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Link
                                                    href={`/habits/${habit.id}`}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-600"
                                                    title="Ver detalles"
                                                >
                                                    📊
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(habit)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600"
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        {habit.description && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                                                {habit.description}
                                            </p>
                                        )}

                                        {/* Frequency days display */}
                                        {habit.frequency_type !== 'daily' && (
                                            <div className="flex gap-1 mt-3">
                                                {DAYS_OF_WEEK.map((day) => (
                                                    <span
                                                        key={day.value}
                                                        className={`w-6 h-6 text-xs flex items-center justify-center rounded ${
                                                            habit.frequency_days?.includes(day.value)
                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                                                        }`}
                                                    >
                                                        {day.label[0]}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Stats View */}
                {activeView === 'stats' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Estadisticas detalladas
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Selecciona un habito en la vista &quot;Todos&quot; para ver sus estadisticas completas,
                            incluyendo rachas, tasas de cumplimiento y graficos de progreso.
                        </p>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {habits.slice(0, 4).map((habit) => (
                                <Link
                                    key={habit.id}
                                    href={`/habits/${habit.id}`}
                                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{habit.icon}</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{habit.name}</span>
                                        <span className="ml-auto text-indigo-600 dark:text-indigo-400">Ver stats →</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Nuevo Habito
                            </h2>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Ej: Meditar, Ejercicio, Leer..."
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripcion
                                    </label>
                                    <textarea
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Opcional..."
                                        rows={2}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                {/* Icon */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Icono
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {HABIT_ICONS.map((icon) => (
                                            <button
                                                key={icon}
                                                onClick={() => setFormIcon(icon)}
                                                className={`text-xl p-2 rounded-lg ${formIcon === icon ? 'bg-green-100 dark:bg-green-900 ring-2 ring-green-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Color
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {HABIT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setFormColor(color)}
                                                className={`w-8 h-8 rounded-full ${formColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Frequency */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Frecuencia
                                    </label>
                                    <select
                                        value={formFrequency}
                                        onChange={(e) => setFormFrequency(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        {FREQUENCY_TYPES.map((freq) => (
                                            <option key={freq.value} value={freq.value}>{freq.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom days */}
                                {formFrequency !== 'daily' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Dias
                                        </label>
                                        <div className="flex gap-2">
                                            {DAYS_OF_WEEK.map((day) => (
                                                <button
                                                    key={day.value}
                                                    onClick={() => toggleDay(day.value)}
                                                    className={`w-10 h-10 rounded-lg text-sm font-medium ${
                                                        formDays.includes(day.value)
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                    }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Target time */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Hora objetivo (opcional)
                                    </label>
                                    <input
                                        type="time"
                                        value={formTargetTime}
                                        onChange={(e) => setFormTargetTime(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                {/* Area */}
                                {areas.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Area (opcional)
                                        </label>
                                        <select
                                            value={formAreaId}
                                            onChange={(e) => setFormAreaId(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="">Sin area</option>
                                            {areas.map((area) => (
                                                <option key={area.id} value={area.id}>{area.icon} {area.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={saving || !formName.trim()}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? 'Creando...' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
