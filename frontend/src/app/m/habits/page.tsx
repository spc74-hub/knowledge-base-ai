'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
    is_active: boolean;
    today_log: HabitLog | null;
    is_completed?: boolean;
}

const TIME_OF_DAY_OPTIONS: { value: string; label: string; icon: string }[] = [
    { value: 'anytime', label: 'Cualquier momento', icon: '🕐' },
    { value: 'morning', label: 'Manana', icon: '🌅' },
    { value: 'afternoon', label: 'Tarde', icon: '☀️' },
    { value: 'evening', label: 'Noche', icon: '🌙' },
];

const STATUS_OPTIONS = [
    { value: 'completed', label: 'Completado', icon: '✓', color: 'bg-green-500' },
    { value: 'partial', label: 'Parcial', icon: '½', color: 'bg-blue-400' },
    { value: 'skipped', label: 'Omitido', icon: '−', color: 'bg-yellow-400' },
];

const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'custom', label: 'Personalizado' },
];

export default function MobileHabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>('all');
    const [statusModalHabit, setStatusModalHabit] = useState<Habit | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isDark, setIsDark] = useState(false);

    // CRUD modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
    const [viewingHabit, setViewingHabit] = useState<Habit | null>(null);
    const [showManageMode, setShowManageMode] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '✅',
        color: '#10b981',
        frequency_type: 'daily',
        time_of_day: 'anytime',
    });

    const today = new Date().toISOString().split('T')[0];

    // Check dark mode
    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const fetchHabits = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            // Fetch all habits when in manage mode, otherwise only active
            const url = showManageMode
                ? `${API_URL}/api/v1/habits/`
                : `${API_URL}/api/v1/habits/?active_only=true`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const habitsArray = Array.isArray(data) ? data : (data.habits || data.data || []);
                setHabits(habitsArray);
            }
        } catch (error) {
            console.error('Error fetching habits:', error);
        } finally {
            setLoading(false);
        }
    }, [showManageMode]);

    useEffect(() => {
        fetchHabits();
    }, [fetchHabits]);

    const logHabit = async (habit: Habit, status: string) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits/${habit.id}/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    date: today,
                    status,
                    value: status === 'completed' ? 1 : status === 'partial' ? 0.5 : 0,
                }),
            });

            if (response.ok) {
                fetchHabits();
                setShowStatusModal(false);
                setStatusModalHabit(null);
            }
        } catch (error) {
            console.error('Error logging habit:', error);
        }
    };

    // Create habit
    const handleCreate = async () => {
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
                    name: formData.name,
                    description: formData.description || null,
                    icon: formData.icon,
                    color: formData.color,
                    frequency_type: formData.frequency_type,
                    time_of_day: formData.time_of_day,
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchHabits();
            }
        } catch (error) {
            console.error('Error creating habit:', error);
        }
    };

    // Update habit
    const handleUpdate = async () => {
        if (!editingHabit) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits/${editingHabit.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                    icon: formData.icon,
                    color: formData.color,
                    frequency_type: formData.frequency_type,
                    time_of_day: formData.time_of_day,
                }),
            });

            if (response.ok) {
                setShowEditModal(false);
                setEditingHabit(null);
                resetForm();
                fetchHabits();
            }
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    };

    // Delete habit
    const handleDelete = async (habit: Habit) => {
        if (!confirm('¿Eliminar este habito?')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits/${habit.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setShowDetailModal(false);
                setViewingHabit(null);
                fetchHabits();
            }
        } catch (error) {
            console.error('Error deleting habit:', error);
        }
    };

    // Archive/restore habit
    const handleToggleActive = async (habit: Habit) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const endpoint = habit.is_active
                ? `${API_URL}/api/v1/habits/${habit.id}/archive`
                : `${API_URL}/api/v1/habits/${habit.id}/restore`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setShowDetailModal(false);
                setViewingHabit(null);
                fetchHabits();
            }
        } catch (error) {
            console.error('Error toggling habit active state:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            icon: '✅',
            color: '#10b981',
            frequency_type: 'daily',
            time_of_day: 'anytime',
        });
    };

    const openEditModal = (habit: Habit) => {
        setEditingHabit(habit);
        setFormData({
            name: habit.name,
            description: habit.description || '',
            icon: habit.icon,
            color: habit.color,
            frequency_type: habit.frequency_type,
            time_of_day: habit.time_of_day,
        });
        setShowEditModal(true);
    };

    const openDetailModal = (habit: Habit) => {
        setViewingHabit(habit);
        setShowDetailModal(true);
    };

    const getHabitStatus = (habit: Habit) => {
        if (!habit.today_log) return null;
        return habit.today_log.status;
    };

    const getStatusColor = (status: string | null) => {
        if (!status) return isDark ? 'bg-gray-600' : 'bg-gray-200';
        const option = STATUS_OPTIONS.find(o => o.value === status);
        return option?.color || (isDark ? 'bg-gray-600' : 'bg-gray-200');
    };

    const filteredHabits = habits.filter(habit => {
        if (selectedTimeFilter === 'all') return true;
        return habit.time_of_day === selectedTimeFilter;
    });

    // Group habits by time of day
    const groupedHabits = filteredHabits.reduce((acc, habit) => {
        const time = habit.time_of_day || 'anytime';
        if (!acc[time]) acc[time] = [];
        acc[time].push(habit);
        return acc;
    }, {} as Record<string, Habit[]>);

    const completedCount = habits.filter(h => h.today_log?.status === 'completed').length;
    const totalCount = habits.filter(h => h.is_active).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

    return (
        <div className="space-y-4">
            {/* Progress header */}
            <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className={`font-semibold ${textClass}`}>Progreso de hoy</h2>
                    <span className="text-2xl font-bold text-amber-600">
                        {completedCount}/{totalCount}
                    </span>
                </div>
                <div className={`w-full rounded-full h-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                        className="bg-gradient-to-r from-amber-500 to-orange-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        resetForm();
                        setShowCreateModal(true);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500/80 text-white font-medium flex items-center justify-center gap-2"
                >
                    <span className="text-lg">+</span>
                    <span>Nuevo habito</span>
                </button>
                <button
                    onClick={() => setShowManageMode(!showManageMode)}
                    className={`px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 ${
                        showManageMode
                            ? 'bg-blue-500 text-white'
                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    <span>{showManageMode ? '✓' : '⚙️'}</span>
                </button>
            </div>

            {/* Time filter */}
            {!showManageMode && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    <button
                        onClick={() => setSelectedTimeFilter('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedTimeFilter === 'all'
                                ? 'bg-amber-500 text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-gray-200 text-gray-700'
                        }`}
                    >
                        Todos
                    </button>
                    {TIME_OF_DAY_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setSelectedTimeFilter(option.value)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                selectedTimeFilter === option.value
                                    ? 'bg-amber-500 text-white'
                                    : isDark
                                        ? 'bg-gray-700 text-gray-300'
                                        : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                            {option.icon} {option.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Habits list */}
            {filteredHabits.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">✅</div>
                    <p className={mutedTextClass}>No hay habitos para mostrar</p>
                </div>
            ) : showManageMode ? (
                // Manage mode - flat list with edit option
                <div className="space-y-3">
                    {filteredHabits.map(habit => (
                        <div
                            key={habit.id}
                            onClick={() => openDetailModal(habit)}
                            className={`w-full rounded-xl p-4 shadow-sm border flex items-center gap-4 cursor-pointer active:opacity-80 transition-all ${
                                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
                            } ${!habit.is_active ? 'opacity-50' : ''}`}
                        >
                            <span
                                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                                style={{ backgroundColor: habit.color + '30' }}
                            >
                                {habit.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {habit.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs ${mutedTextClass}`}>
                                        {FREQUENCY_OPTIONS.find(f => f.value === habit.frequency_type)?.label || habit.frequency_type}
                                    </span>
                                    <span className={`text-xs ${mutedTextClass}`}>·</span>
                                    <span className={`text-xs ${mutedTextClass}`}>
                                        {TIME_OF_DAY_OPTIONS.find(t => t.value === habit.time_of_day)?.icon}
                                        {' '}
                                        {TIME_OF_DAY_OPTIONS.find(t => t.value === habit.time_of_day)?.label}
                                    </span>
                                    {!habit.is_active && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                            Archivado
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className={mutedTextClass}>›</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {selectedTimeFilter === 'all' ? (
                        // Show grouped by time of day
                        Object.entries(groupedHabits).map(([time, timeHabits]) => {
                            const timeOption = TIME_OF_DAY_OPTIONS.find(t => t.value === time);
                            return (
                                <div key={time} className="space-y-2">
                                    <h3 className={`text-sm font-medium flex items-center gap-2 ${mutedTextClass}`}>
                                        <span>{timeOption?.icon || '🕐'}</span>
                                        <span>{timeOption?.label || 'Cualquier momento'}</span>
                                    </h3>
                                    {timeHabits.filter(h => h.is_active).map(habit => (
                                        <HabitCard
                                            key={habit.id}
                                            habit={habit}
                                            status={getHabitStatus(habit)}
                                            statusColor={getStatusColor(getHabitStatus(habit))}
                                            isDark={isDark}
                                            onTap={() => {
                                                setStatusModalHabit(habit);
                                                setShowStatusModal(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })
                    ) : (
                        // Show flat list
                        filteredHabits.filter(h => h.is_active).map(habit => (
                            <HabitCard
                                key={habit.id}
                                habit={habit}
                                status={getHabitStatus(habit)}
                                statusColor={getStatusColor(getHabitStatus(habit))}
                                isDark={isDark}
                                onTap={() => {
                                    setStatusModalHabit(habit);
                                    setShowStatusModal(true);
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Status selection modal */}
            {showStatusModal && statusModalHabit && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-4">
                    <div
                        className={`w-full mx-4 rounded-2xl p-4 animate-slide-down ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: 'calc(100vh - 100px)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                                    style={{ backgroundColor: statusModalHabit.color + '30' }}
                                >
                                    {statusModalHabit.icon}
                                </span>
                                <h3 className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {statusModalHabit.name}
                                </h3>
                            </div>
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setStatusModalHabit(null);
                                }}
                                className={`p-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {STATUS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => logHabit(statusModalHabit, option.value)}
                                    className={`py-4 rounded-xl ${option.color} text-white font-medium flex flex-col items-center gap-2 active:scale-95 transition-transform`}
                                >
                                    <span className="text-2xl">{option.icon}</span>
                                    <span className="text-sm">{option.label}</span>
                                </button>
                            ))}
                        </div>

                        {statusModalHabit.today_log && (
                            <p className={`text-center text-sm mt-4 ${mutedTextClass}`}>
                                Estado actual: {STATUS_OPTIONS.find(o => o.value === statusModalHabit.today_log?.status)?.label || 'No registrado'}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '85vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold text-lg ${textClass}`}>Nuevo habito</h3>
                            <button onClick={() => setShowCreateModal(false)} className={mutedTextClass}>✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Nombre</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    placeholder="Nombre del habito"
                                />
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Descripcion</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    rows={2}
                                    placeholder="Descripcion (opcional)"
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Icono</label>
                                    <input
                                        type="text"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass} text-center text-2xl`}
                                        maxLength={4}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Color</label>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full mt-1 h-10 rounded-lg border cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Frecuencia</label>
                                <select
                                    value={formData.frequency_type}
                                    onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                >
                                    {FREQUENCY_OPTIONS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Momento del dia</label>
                                <select
                                    value={formData.time_of_day}
                                    onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                >
                                    {TIME_OF_DAY_OPTIONS.map(t => (
                                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={!formData.name}
                                className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium disabled:opacity-50"
                            >
                                Crear habito
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingHabit && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '85vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold text-lg ${textClass}`}>Editar habito</h3>
                            <button onClick={() => { setShowEditModal(false); setEditingHabit(null); }} className={mutedTextClass}>✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Nombre</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                />
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Descripcion</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    rows={2}
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Icono</label>
                                    <input
                                        type="text"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass} text-center text-2xl`}
                                        maxLength={4}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Color</label>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full mt-1 h-10 rounded-lg border cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Frecuencia</label>
                                <select
                                    value={formData.frequency_type}
                                    onChange={(e) => setFormData({ ...formData, frequency_type: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                >
                                    {FREQUENCY_OPTIONS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Momento del dia</label>
                                <select
                                    value={formData.time_of_day}
                                    onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                >
                                    {TIME_OF_DAY_OPTIONS.map(t => (
                                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleUpdate}
                                className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium"
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && viewingHabit && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '80vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: viewingHabit.color + '30' }}
                                >
                                    {viewingHabit.icon}
                                </div>
                                <div>
                                    <h3 className={`font-semibold text-lg ${textClass}`}>{viewingHabit.name}</h3>
                                    {!viewingHabit.is_active && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                            Archivado
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => { setShowDetailModal(false); setViewingHabit(null); }} className={mutedTextClass}>✕</button>
                        </div>

                        {viewingHabit.description && (
                            <p className={`${mutedTextClass} mb-4`}>{viewingHabit.description}</p>
                        )}

                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between">
                                <span className={mutedTextClass}>Frecuencia:</span>
                                <span className={textClass}>
                                    {FREQUENCY_OPTIONS.find(f => f.value === viewingHabit.frequency_type)?.label}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className={mutedTextClass}>Momento:</span>
                                <span className={textClass}>
                                    {TIME_OF_DAY_OPTIONS.find(t => t.value === viewingHabit.time_of_day)?.icon}
                                    {' '}
                                    {TIME_OF_DAY_OPTIONS.find(t => t.value === viewingHabit.time_of_day)?.label}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    setShowDetailModal(false);
                                    openEditModal(viewingHabit);
                                }}
                                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                <span>✏️</span>
                                Editar
                            </button>
                            <button
                                onClick={() => handleToggleActive(viewingHabit)}
                                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    viewingHabit.is_active
                                        ? 'bg-yellow-500/20 text-yellow-600'
                                        : 'bg-green-500/20 text-green-600'
                                }`}
                            >
                                <span>{viewingHabit.is_active ? '📦' : '✅'}</span>
                                {viewingHabit.is_active ? 'Archivar' : 'Restaurar'}
                            </button>
                            <button
                                onClick={() => handleDelete(viewingHabit)}
                                className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-red-500/20 text-red-500"
                            >
                                <span>🗑️</span>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-down {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

function HabitCard({
    habit,
    status,
    statusColor,
    isDark,
    onTap,
}: {
    habit: Habit;
    status: string | null;
    statusColor: string;
    isDark: boolean;
    onTap: () => void;
}) {
    return (
        <button
            onClick={onTap}
            className={`w-full rounded-xl p-4 shadow-sm border flex items-center gap-4 active:opacity-80 transition-all text-left ${
                isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-100'
            }`}
        >
            <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: habit.color + '30' }}
            >
                {habit.icon}
            </span>
            <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {habit.name}
                </h4>
                {habit.description && (
                    <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {habit.description}
                    </p>
                )}
            </div>
            <div
                className={`w-8 h-8 rounded-full ${statusColor} flex items-center justify-center text-white font-bold flex-shrink-0`}
            >
                {status === 'completed' && '✓'}
                {status === 'partial' && '½'}
                {status === 'skipped' && '−'}
            </div>
        </button>
    );
}
