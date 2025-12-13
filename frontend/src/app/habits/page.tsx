'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ICON_CATEGORIES, ICON_CATEGORY_NAMES } from '@/lib/icons';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

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
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
    is_active: boolean;
    area_id: string | null;
    today_log: HabitLog | null;
    is_completed?: boolean;
}

interface CalendarDayData {
    date: string;
    day: number;
    day_of_week: number;
    habits: {
        habit_id: string;
        name: string;
        icon: string;
        color: string;
        status: string | null;
        is_scheduled?: boolean;
        area_id?: string | null;
    }[];
    completed: number;
    total: number;
}

interface Area {
    id: string;
    name: string;
    icon: string;
}

interface StatsSummary {
    by_period: {
        week: { completed: number; total: number; rate: number };
        month: { completed: number; total: number; rate: number };
        year: { completed: number; total: number; rate: number };
    };
    by_area: {
        area_id: string | null;
        area_name: string;
        area_icon: string;
        completed: number;
        total: number;
        rate: number;
        habits: {
            id: string;
            name: string;
            icon: string;
            color: string;
            completed: number;
            total: number;
            rate: number;
        }[];
    }[];
    by_habit: {
        id: string;
        name: string;
        icon: string;
        color: string;
        area_name: string | null;
        completed: number;
        total: number;
        rate: number;
    }[];
    totals: {
        habits: number;
        total_completions: number;
    };
}

const HABIT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const TIME_OF_DAY_OPTIONS = [
    { value: 'anytime', label: 'Cualquier momento', icon: '🕐' },
    { value: 'morning', label: 'Mañana', icon: '🌅' },
    { value: 'afternoon', label: 'Tarde', icon: '☀️' },
    { value: 'evening', label: 'Noche', icon: '🌙' },
];
// Days of week starting Monday (for calendar display)
const DAYS_OF_WEEK_CALENDAR = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mie' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sab' },
    { value: 0, label: 'Dom' },
];
// Days of week for habit frequency selection (Sunday=0 format for backend)
const DAYS_OF_WEEK = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mie' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sab' },
    { value: 0, label: 'Dom' },
];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const STATUS_OPTIONS = [
    { value: 'completed', label: 'Completado', icon: '✓', color: 'bg-green-500', textColor: 'text-white' },
    { value: 'partial', label: 'Parcial', icon: '½', color: 'bg-blue-400', textColor: 'text-white' },
    { value: 'skipped', label: 'Omitido', icon: '−', color: 'bg-yellow-400', textColor: 'text-yellow-900' },
    { value: 'failed', label: 'Fallido', icon: '✗', color: 'bg-red-500', textColor: 'text-white' },
];

export default function HabitsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [habits, setHabits] = useState<Habit[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);

    // Calendar state
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
    const [calendarData, setCalendarData] = useState<CalendarDayData[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedDayHabits, setSelectedDayHabits] = useState<CalendarDayData['habits']>([]);

    // Create/Edit modal
    const [showModal, setShowModal] = useState(false);
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIcon, setFormIcon] = useState('✅');
    const [formColor, setFormColor] = useState('#10b981');
    const [formFrequency, setFormFrequency] = useState('daily');
    const [formDays, setFormDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
    const [formTimeOfDay, setFormTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');
    const [formAreaId, setFormAreaId] = useState('');
    const [formIconCategory, setFormIconCategory] = useState('Personal');
    const [saving, setSaving] = useState(false);

    // Status selection
    const [statusModalHabit, setStatusModalHabit] = useState<CalendarDayData['habits'][0] | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);

    // Statistics
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<StatsSummary | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // All habits section - collapsed by default
    const [showAllHabits, setShowAllHabits] = useState(false);

    // Non-scheduled habits for selected day (habits that exist but aren't scheduled for this day)
    const [nonScheduledHabits, setNonScheduledHabits] = useState<CalendarDayData['habits']>([]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fetchHabits = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = { 'Authorization': `Bearer ${session.data.session.access_token}` };

            const [habitsRes, areasRes] = await Promise.all([
                fetch(`${API_URL}/api/v1/habits`, { headers }),
                fetch(`${API_URL}/api/v1/areas?status_filter=active`, { headers }),
            ]);

            if (habitsRes.ok) {
                const data = await habitsRes.json();
                setHabits(data.data || []);
            }
            if (areasRes.ok) {
                const data = await areasRes.json();
                setAreas(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching habits:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCalendar = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(
                `${API_URL}/api/v1/habits/stats/calendar/${calendarYear}/${calendarMonth}`,
                {
                    headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setCalendarData(data.data || []);

                // Update selected day habits if within current month
                const selectedDay = data.data?.find((d: CalendarDayData) => d.date === selectedDate);
                if (selectedDay) {
                    setSelectedDayHabits(selectedDay.habits || []);
                }
            }
        } catch (error) {
            console.error('Error fetching calendar:', error);
        }
    }, [calendarYear, calendarMonth, selectedDate]);

    useEffect(() => {
        if (user) {
            fetchHabits();
        }
    }, [user, fetchHabits]);

    useEffect(() => {
        if (user) {
            fetchCalendar();
        }
    }, [user, fetchCalendar]);


    const fetchStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/habits/stats/summary`, {
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        if (showStats && !stats) {
            fetchStats();
        }
    }, [showStats, stats, fetchStats]);

    // Update selected day habits when date changes
    useEffect(() => {
        const dayData = calendarData.find(d => d.date === selectedDate);
        if (dayData) {
            setSelectedDayHabits(dayData.habits || []);
        } else {
            setSelectedDayHabits([]);
        }
    }, [selectedDate, calendarData]);

    // Calculate non-scheduled habits for the selected day
    useEffect(() => {
        if (habits.length === 0) {
            setNonScheduledHabits([]);
            return;
        }

        // Get IDs of scheduled habits
        const scheduledIds = new Set(selectedDayHabits.map(h => h.habit_id));

        // Filter out habits that aren't scheduled for this day
        const nonScheduled = habits
            .filter(h => h.is_active && !scheduledIds.has(h.id))
            .map(h => ({
                habit_id: h.id,
                name: h.name,
                icon: h.icon,
                color: h.color,
                status: h.today_log?.status || null,
                is_scheduled: false,
                area_id: h.area_id,
            }));

        setNonScheduledHabits(nonScheduled);
    }, [habits, selectedDayHabits]);

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormIcon('✅');
        setFormColor('#10b981');
        setFormFrequency('daily');
        setFormDays([0, 1, 2, 3, 4, 5, 6]);
        setFormTimeOfDay('anytime');
        setFormAreaId('');
        setFormIconCategory('Personal');
        setEditingHabit(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (habit: Habit) => {
        setEditingHabit(habit);
        setFormName(habit.name);
        setFormDescription(habit.description || '');
        setFormIcon(habit.icon);
        setFormColor(habit.color);
        setFormFrequency(habit.frequency_type);
        setFormDays(habit.frequency_days || [0, 1, 2, 3, 4, 5, 6]);
        setFormTimeOfDay(habit.time_of_day || 'anytime');
        setFormAreaId(habit.area_id || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;

        setSaving(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const habitData = {
                name: formName.trim(),
                description: formDescription.trim() || null,
                icon: formIcon,
                color: formColor,
                frequency_type: formFrequency,
                frequency_days: formFrequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : formDays,
                time_of_day: formTimeOfDay,
                area_id: formAreaId || null,
            };

            const url = editingHabit
                ? `${API_URL}/api/v1/habits/${editingHabit.id}`
                : `${API_URL}/api/v1/habits`;

            const response = await fetch(url, {
                method: editingHabit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(habitData),
            });

            if (response.ok) {
                setShowModal(false);
                resetForm();
                fetchHabits();
                fetchCalendar();
            }
        } catch (error) {
            console.error('Error saving habit:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (habit: Habit) => {
        if (!confirm(`¿Eliminar "${habit.name}"?`)) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/habits/${habit.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            fetchHabits();
            fetchCalendar();
        } catch (error) {
            console.error('Error deleting habit:', error);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const handleSetStatus = async (habitId: string, status: string) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/habits/${habitId}/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ date: selectedDate, status }),
            });

            fetchCalendar();
            setShowStatusModal(false);
            setStatusModalHabit(null);
        } catch (error) {
            console.error('Error setting status:', error);
        }
    };

    const handleClearStatus = async (habitId: string) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/habits/${habitId}/log/${selectedDate}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            fetchCalendar();
            setShowStatusModal(false);
            setStatusModalHabit(null);
        } catch (error) {
            console.error('Error clearing status:', error);
        }
    };

    const toggleDay = (day: number) => {
        setFormDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        );
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

    const goToToday = () => {
        const now = new Date();
        setCalendarYear(now.getFullYear());
        setCalendarMonth(now.getMonth() + 1);
        setSelectedDate(now.toISOString().split('T')[0]);
    };

    const getStatusColor = (status: string | null) => {
        switch (status) {
            case 'completed': return 'bg-green-500';
            case 'partial': return 'bg-blue-400';
            case 'skipped': return 'bg-yellow-400';
            case 'failed': return 'bg-red-500';
            default: return 'bg-gray-200 dark:bg-gray-600';
        }
    };

    const getStatusIcon = (status: string | null) => {
        switch (status) {
            case 'completed': return '✓';
            case 'partial': return '½';
            case 'skipped': return '−';
            case 'failed': return '✗';
            default: return '';
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const isViewingToday = selectedDate === today;

    // Use calendar data for the selected day
    const displayHabits = selectedDayHabits;
    const scheduledCount = selectedDayHabits.length;

    // Helper to get area info
    const getAreaInfo = (areaId: string | null | undefined) => {
        if (!areaId) return null;
        return areas.find(a => a.id === areaId);
    };

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
                            onClick={openCreateModal}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <span>+</span> Nuevo
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar - Compact */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3">
                        {/* Calendar navigation */}
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={prevMonth}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 text-sm"
                            >
                                ←
                            </button>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {MONTHS[calendarMonth - 1]} {calendarYear}
                                </h2>
                                <button
                                    onClick={goToToday}
                                    className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800"
                                >
                                    Hoy
                                </button>
                            </div>
                            <button
                                onClick={nextMonth}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 text-sm"
                            >
                                →
                            </button>
                        </div>

                        {/* Calendar grid - Compact */}
                        <div className="grid grid-cols-7 gap-0.5">
                            {/* Header - Monday first */}
                            {DAYS_OF_WEEK_CALENDAR.map((day) => (
                                <div key={day.value} className="text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 py-1">
                                    {day.label.charAt(0)}
                                </div>
                            ))}

                            {/* Empty cells for alignment - convert Sunday=0 to Monday=0 */}
                            {calendarData.length > 0 && Array.from({ length: (calendarData[0].day_of_week + 6) % 7 }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                            ))}

                            {/* Calendar days */}
                            {calendarData.map((day) => {
                                const isSelected = day.date === selectedDate;
                                const isDayToday = day.date === today;
                                const hasHabits = day.total > 0;
                                const allDone = day.completed === day.total && day.total > 0;
                                const someProgress = day.completed > 0 && day.completed < day.total;

                                return (
                                    <button
                                        key={day.date}
                                        onClick={() => setSelectedDate(day.date)}
                                        className={`aspect-square rounded flex flex-col items-center justify-center text-xs transition-all relative ${
                                            isSelected
                                                ? 'bg-green-600 text-white'
                                                : isDayToday
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                            {day.day}
                                        </span>

                                        {/* Habit indicators */}
                                        {hasHabits && (
                                            <div className="flex gap-0.5">
                                                {allDone ? (
                                                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`}></span>
                                                ) : someProgress ? (
                                                    <>
                                                        <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`}></span>
                                                        <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-gray-300 dark:bg-gray-500'}`}></span>
                                                    </>
                                                ) : (
                                                    <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-gray-300 dark:bg-gray-500'}`}></span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Legend - Compact */}
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Completado</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 rounded-full"></span> Pendiente</span>
                        </div>
                    </div>

                    {/* Habits list panel - Expanded */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        {/* Selected date header */}
                        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                                    {isViewingToday ? 'Hoy' : selectedDateObj.toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                    })}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {scheduledCount} programado{scheduledCount !== 1 ? 's' : ''} · {displayHabits.filter(h => h.status === 'completed').length} completado{displayHabits.filter(h => h.status === 'completed').length !== 1 ? 's' : ''}
                                </p>
                            </div>
                            {/* Progress indicator */}
                            {scheduledCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-300"
                                            style={{ width: `${(displayHabits.filter(h => h.status === 'completed').length / scheduledCount) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        {Math.round((displayHabits.filter(h => h.status === 'completed').length / scheduledCount) * 100)}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Habits for selected day */}
                        <div className="max-h-[500px] overflow-y-auto">
                            {displayHabits.length === 0 && nonScheduledHabits.length === 0 ? (
                                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                                    <div className="text-3xl mb-2">📅</div>
                                    <p>No hay habitos</p>
                                </div>
                            ) : (
                                // Group habits by area
                                (() => {
                                    const renderHabit = (habit: typeof displayHabits[0], isScheduled: boolean = true) => (
                                        <div
                                            key={habit.habit_id}
                                            className={`p-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg ${!isScheduled ? 'opacity-60' : ''}`}
                                        >
                                            {/* Status indicator / button */}
                                            <button
                                                onClick={() => {
                                                    setStatusModalHabit(habit);
                                                    setShowStatusModal(true);
                                                }}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                                    habit.status
                                                        ? `${getStatusColor(habit.status)} text-white`
                                                        : isScheduled
                                                        ? 'border-2 border-gray-300 dark:border-gray-500 hover:border-green-500'
                                                        : 'border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-500'
                                                }`}
                                            >
                                                {habit.status ? getStatusIcon(habit.status) : ''}
                                            </button>

                                            {/* Habit info */}
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span>{habit.icon}</span>
                                                <span className={`font-medium text-gray-900 dark:text-white text-sm ${
                                                    habit.status === 'completed' ? 'line-through opacity-60' : ''
                                                }`}>
                                                    {habit.name}
                                                </span>
                                            </div>

                                            {/* Quick actions */}
                                            <Link
                                                href={`/habits/${habit.habit_id}`}
                                                className="p-1 text-gray-400 hover:text-indigo-600"
                                                title="Estadisticas"
                                            >
                                                📊
                                            </Link>
                                        </div>
                                    );

                                    // Group scheduled habits by area
                                    const scheduledByArea: Record<string, typeof displayHabits> = {};
                                    const scheduledNoArea: typeof displayHabits = [];

                                    displayHabits.forEach(habit => {
                                        if (habit.area_id) {
                                            if (!scheduledByArea[habit.area_id]) {
                                                scheduledByArea[habit.area_id] = [];
                                            }
                                            scheduledByArea[habit.area_id].push(habit);
                                        } else {
                                            scheduledNoArea.push(habit);
                                        }
                                    });

                                    const sortedAreaIds = Object.keys(scheduledByArea).sort((a, b) => {
                                        const areaA = areas.find(ar => ar.id === a);
                                        const areaB = areas.find(ar => ar.id === b);
                                        return (areaA?.name || '').localeCompare(areaB?.name || '');
                                    });

                                    return (
                                        <div className="p-2 space-y-2">
                                            {/* Scheduled habits section */}
                                            {displayHabits.length > 0 && (
                                                <div className="space-y-2">
                                                    {/* Areas with habits */}
                                                    {sortedAreaIds.map(areaId => {
                                                        const areaInfo = areas.find(a => a.id === areaId);
                                                        const areaHabits = scheduledByArea[areaId];

                                                        return (
                                                            <div key={areaId}>
                                                                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-1">
                                                                    <span className="text-sm">{areaInfo?.icon || '📁'}</span>
                                                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                        {areaInfo?.name || 'Area'}
                                                                    </span>
                                                                </div>
                                                                {areaHabits.map(h => renderHabit(h, true))}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Scheduled habits without area */}
                                                    {scheduledNoArea.length > 0 && (
                                                        <div>
                                                            {sortedAreaIds.length > 0 && (
                                                                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-1">
                                                                    <span className="text-sm">📋</span>
                                                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Sin area</span>
                                                                </div>
                                                            )}
                                                            {scheduledNoArea.map(h => renderHabit(h, true))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Non-scheduled habits section */}
                                            {nonScheduledHabits.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-dashed dark:border-gray-700">
                                                    <div className="flex items-center gap-2 px-2 py-1 mb-2">
                                                        <span className="text-sm">📅</span>
                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                            Otros habitos ({nonScheduledHabits.length})
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {nonScheduledHabits.map(h => renderHabit(h, false))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        {/* Quick complete all button */}
                        {displayHabits.length > 0 && displayHabits.some(h => !h.status) && (
                            <div className="p-3 border-t dark:border-gray-700">
                                <button
                                    onClick={async () => {
                                        for (const habit of displayHabits) {
                                            if (!habit.status) {
                                                await handleSetStatus(habit.habit_id, 'completed');
                                            }
                                        }
                                    }}
                                    className="w-full py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                                >
                                    ✓ Completar todos
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Statistics Section */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="w-full p-4 flex items-center justify-between text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📊</span>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Estadisticas</h3>
                        </div>
                        <span className={`transition-transform ${showStats ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {showStats && (
                        <div className="border-t dark:border-gray-700 p-4">
                            {loadingStats ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                </div>
                            ) : stats ? (
                                <div className="space-y-6">
                                    {/* Period Stats */}
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Por periodo</h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { key: 'week', label: 'Semana', data: stats.by_period.week },
                                                { key: 'month', label: 'Mes', data: stats.by_period.month },
                                                { key: 'year', label: 'Año', data: stats.by_period.year },
                                            ].map(({ key, label, data }) => (
                                                <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                        {data.rate}%
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {label}
                                                    </div>
                                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                                        {data.completed}/{data.total}
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full transition-all"
                                                            style={{ width: `${data.rate}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Area Stats */}
                                    {stats.by_area.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Por area</h4>
                                            <div className="space-y-2">
                                                {stats.by_area.map((area) => (
                                                    <div key={area.area_id || 'no-area'} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span>{area.area_icon}</span>
                                                                <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                                    {area.area_name}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    ({area.habits.length} habito{area.habits.length !== 1 ? 's' : ''})
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                                    {area.rate}%
                                                                </span>
                                                                <span className="text-xs text-gray-400">
                                                                    {area.completed}/{area.total}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-green-500 rounded-full transition-all"
                                                                style={{ width: `${area.rate}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Top Habits */}
                                    {stats.by_habit.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                                                Ranking de habitos (año)
                                            </h4>
                                            <div className="space-y-1">
                                                {stats.by_habit.slice(0, 5).map((habit, index) => (
                                                    <div
                                                        key={habit.id}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                                    >
                                                        <span className="text-sm font-bold text-gray-400 w-5">
                                                            {index + 1}
                                                        </span>
                                                        <span
                                                            className="w-6 h-6 rounded flex items-center justify-center text-sm"
                                                            style={{ backgroundColor: habit.color + '20' }}
                                                        >
                                                            {habit.icon}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {habit.name}
                                                            </div>
                                                            {habit.area_name && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {habit.area_name}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                                {habit.rate}%
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {habit.completed}/{habit.total}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary */}
                                    <div className="pt-4 border-t dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-medium text-gray-900 dark:text-white">{stats.totals.habits}</span> habitos activos ·{' '}
                                        <span className="font-medium text-green-600">{stats.totals.total_completions}</span> completados este año
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    No hay datos de estadisticas
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* All habits section - grouped by area, collapsible */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    <button
                        onClick={() => setShowAllHabits(!showAllHabits)}
                        className="w-full p-4 flex items-center justify-between text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📋</span>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Todos los habitos</h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({habits.length})</span>
                        </div>
                        <span className={`transition-transform ${showAllHabits ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {showAllHabits && habits.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-4xl mb-3">✨</div>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">Crea tu primer habito para empezar</p>
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                + Crear habito
                            </button>
                        </div>
                    ) : showAllHabits && habits.length > 0 ? (
                        <div className="border-t dark:border-gray-700 p-4 space-y-4">
                            {/* Group habits by area */}
                            {(() => {
                                // Build area groups
                                const habitsByArea: Record<string, Habit[]> = {};
                                const noAreaHabits: Habit[] = [];

                                habits.forEach(habit => {
                                    if (habit.area_id) {
                                        if (!habitsByArea[habit.area_id]) {
                                            habitsByArea[habit.area_id] = [];
                                        }
                                        habitsByArea[habit.area_id].push(habit);
                                    } else {
                                        noAreaHabits.push(habit);
                                    }
                                });

                                // Sort areas by name
                                const sortedAreaIds = Object.keys(habitsByArea).sort((a, b) => {
                                    const areaA = areas.find(ar => ar.id === a);
                                    const areaB = areas.find(ar => ar.id === b);
                                    return (areaA?.name || '').localeCompare(areaB?.name || '');
                                });

                                return (
                                    <>
                                        {/* Areas with habits */}
                                        {sortedAreaIds.map(areaId => {
                                            const areaInfo = areas.find(a => a.id === areaId);
                                            const areaHabits = habitsByArea[areaId];

                                            return (
                                                <div key={areaId}>
                                                    {/* Area header */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-lg">{areaInfo?.icon || '📁'}</span>
                                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                                            {areaInfo?.name || 'Area desconocida'}
                                                        </h4>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            ({areaHabits.length} habito{areaHabits.length !== 1 ? 's' : ''})
                                                        </span>
                                                    </div>
                                                    {/* Habits grid */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                        {areaHabits.map((habit) => (
                                                            <div
                                                                key={habit.id}
                                                                className="p-3 rounded-lg border dark:border-gray-700 hover:shadow-md transition-shadow"
                                                            >
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                                                                            style={{ backgroundColor: habit.color + '20' }}
                                                                        >
                                                                            {habit.icon}
                                                                        </span>
                                                                        <div>
                                                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">{habit.name}</h4>
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                                {habit.frequency_type === 'daily' ? 'Diario' :
                                                                                 habit.frequency_days?.length === 7 ? 'Todos los dias' :
                                                                                 `${habit.frequency_days?.length || 0} dias/sem`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                const fullHabit = habits.find(h => h.id === habit.id);
                                                                                if (fullHabit) openEditModal(fullHabit);
                                                                            }}
                                                                            className="p-1 text-gray-400 hover:text-blue-600 text-sm"
                                                                        >
                                                                            ✏️
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(habit)}
                                                                            className="p-1 text-gray-400 hover:text-red-600 text-sm"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Habits without area */}
                                        {noAreaHabits.length > 0 && (
                                            <div>
                                                {/* No area header */}
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-lg">📋</span>
                                                    <h4 className="font-medium text-gray-900 dark:text-white">Sin area</h4>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        ({noAreaHabits.length} habito{noAreaHabits.length !== 1 ? 's' : ''})
                                                    </span>
                                                </div>
                                                {/* Habits grid */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                    {noAreaHabits.map((habit) => (
                                                        <div
                                                            key={habit.id}
                                                            className="p-3 rounded-lg border dark:border-gray-700 hover:shadow-md transition-shadow"
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                                                                        style={{ backgroundColor: habit.color + '20' }}
                                                                    >
                                                                        {habit.icon}
                                                                    </span>
                                                                    <div>
                                                                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{habit.name}</h4>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                            {habit.frequency_type === 'daily' ? 'Diario' :
                                                                             habit.frequency_days?.length === 7 ? 'Todos los dias' :
                                                                             `${habit.frequency_days?.length || 0} dias/sem`}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            const fullHabit = habits.find(h => h.id === habit.id);
                                                                            if (fullHabit) openEditModal(fullHabit);
                                                                        }}
                                                                        className="p-1 text-gray-400 hover:text-blue-600 text-sm"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(habit)}
                                                                        className="p-1 text-gray-400 hover:text-red-600 text-sm"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    ) : null}
                </div>
            </main>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-5">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                {editingHabit ? 'Editar Habito' : 'Nuevo Habito'}
                            </h2>

                            <div className="space-y-4">
                                {/* Name - prominent */}
                                <div>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Nombre del habito..."
                                        className="w-full px-4 py-3 text-lg border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        autoFocus
                                    />
                                </div>

                                {/* Icon selector */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Icono</label>
                                    {/* Category tabs */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {ICON_CATEGORY_NAMES.map((category) => (
                                            <button
                                                key={category}
                                                onClick={() => setFormIconCategory(category)}
                                                className={`px-2 py-1 text-xs rounded ${formIconCategory === category ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Icons grid */}
                                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-24 overflow-y-auto">
                                        {ICON_CATEGORIES[formIconCategory]?.map((icon) => (
                                            <button
                                                key={icon}
                                                onClick={() => setFormIcon(icon)}
                                                className={`text-xl p-1.5 rounded-lg transition-all ${formIcon === icon ? 'bg-green-100 dark:bg-green-900 ring-2 ring-green-500 scale-110' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Seleccionado: {formIcon}
                                    </div>
                                </div>

                                {/* Color selector */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {HABIT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setFormColor(color)}
                                                className={`w-7 h-7 rounded-full ${formColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Frequency */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frecuencia</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setFormFrequency('daily')}
                                            className={`flex-1 py-2 text-sm rounded-lg ${
                                                formFrequency === 'daily'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            Diario
                                        </button>
                                        <button
                                            onClick={() => setFormFrequency('custom')}
                                            className={`flex-1 py-2 text-sm rounded-lg ${
                                                formFrequency === 'custom'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            Dias especificos
                                        </button>
                                    </div>
                                </div>

                                {/* Custom days */}
                                {formFrequency === 'custom' && (
                                    <div className="flex gap-1 justify-center">
                                        {DAYS_OF_WEEK.map((day) => (
                                            <button
                                                key={day.value}
                                                onClick={() => toggleDay(day.value)}
                                                className={`w-9 h-9 rounded-full text-xs font-medium ${
                                                    formDays.includes(day.value)
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Time of day */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Momento del dia</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {TIME_OF_DAY_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setFormTimeOfDay(option.value as typeof formTimeOfDay)}
                                                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${
                                                    formTimeOfDay === option.value
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                <span className="text-lg">{option.icon}</span>
                                                <span>{option.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Area (optional, collapsed) */}
                                {areas.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Area (opcional)</label>
                                        <select
                                            value={formAreaId}
                                            onChange={(e) => setFormAreaId(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formName.trim()}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : editingHabit ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Selection Modal */}
            {showStatusModal && statusModalHabit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xs w-full">
                        <div className="p-4 border-b dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{statusModalHabit.icon}</span>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    {statusModalHabit.name}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {selectedDateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                        <div className="p-3 space-y-2">
                            {STATUS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleSetStatus(statusModalHabit.habit_id, option.value)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:opacity-80 ${
                                        statusModalHabit.status === option.value
                                            ? `${option.color} ${option.textColor} ring-2 ring-offset-2 ring-gray-400`
                                            : `${option.color} ${option.textColor}`
                                    }`}
                                >
                                    <span className="text-lg font-bold">{option.icon}</span>
                                    <span className="font-medium">{option.label}</span>
                                </button>
                            ))}

                            {/* Clear status option */}
                            {statusModalHabit.status && (
                                <button
                                    onClick={() => handleClearStatus(statusModalHabit.habit_id)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    <span className="text-lg">🗑️</span>
                                    <span className="font-medium">Borrar estado</span>
                                </button>
                            )}
                        </div>
                        <div className="p-3 border-t dark:border-gray-700">
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setStatusModalHabit(null);
                                }}
                                className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
