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

export default function MobileHabitsPage() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>('all');
    const [statusModalHabit, setStatusModalHabit] = useState<Habit | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isDark, setIsDark] = useState(false);

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

            const response = await fetch(`${API_URL}/api/v1/habits/?active_only=true`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Handle both array and object responses
                const habitsArray = Array.isArray(data) ? data : (data.habits || data.data || []);
                setHabits(habitsArray);
            }
        } catch (error) {
            console.error('Error fetching habits:', error);
        } finally {
            setLoading(false);
        }
    }, []);

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
    const totalCount = habits.length;

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

            {/* Time filter */}
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

            {/* Habits list */}
            {filteredHabits.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">✅</div>
                    <p className={mutedTextClass}>No hay habitos para mostrar</p>
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
                                    {timeHabits.map(habit => (
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
                        filteredHabits.map(habit => (
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4">
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
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
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
