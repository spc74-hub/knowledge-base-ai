'use client';
// Force rebuild: 20241213-v5

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    useTodayJournal,
    useJournalByDate,
    useJournalHistory,
    useJournalStats,
    useUpdateTodayJournal,
    useUpdateJournalById,
    useAddQuickCapture,
    useCloseDay,
    useGenerateAISummary,
    useCreateJournalForDate,
    useRefreshInspirational,
    BigRockItem,
    DailyJournal,
    JournalHistoryItem,
    JOURNAL_KEYS,
} from '@/hooks/use-journal';
import { useQueryClient } from '@tanstack/react-query';

// Hardcoded API URL - bypass broken env var system
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

// Debounce hook for text inputs
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Types
interface HabitWithLog {
    id: string;
    name: string;
    icon: string;
    color: string;
    is_completed: boolean;
    is_scheduled: boolean;  // True if habit is scheduled for today
    today_log: any;
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
}

interface Objective {
    id: string;
    title: string;
    status: string;
}

interface Project {
    id: string;
    name: string;
    status: string;
}

type EnergyLevel = 'high' | 'medium' | 'low';
type JournalSection = 'morning' | 'day' | 'evening';

const ENERGY_ICONS: Record<EnergyLevel, string> = {
    high: '🔥',
    medium: '⚡',
    low: '🔋',
};

const ENERGY_COLORS: Record<EnergyLevel, string> = {
    high: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface JournalStats {
    current_streak: number;
    longest_streak: number;
    total_journals: number;
    completed_journals: number;
}

// Mini Calendar Component
function MiniCalendar({
    history,
    onSelectDate,
    selectedDate
}: {
    history: JournalHistoryItem[];
    onSelectDate: (date: string) => void;
    selectedDate?: string;
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const journalDates = new Set(history.map(h => h.date));

    const getJournalForDate = (dateStr: string) => {
        return history.find(h => h.date === dateStr);
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        return { daysInMonth, startingDay };
    };

    const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        if (next <= new Date()) {
            setCurrentMonth(next);
        }
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    const formatDate = (day: number) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${year}-${month}-${dayStr}`;
    };

    const today = new Date().toISOString().split('T')[0];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    const calendarDays = [];

    for (let i = 0; i < startingDay; i++) {
        calendarDays.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDate(day);
        const hasJournal = journalDates.has(dateStr);
        const journalData = hasJournal ? getJournalForDate(dateStr) : null;
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedDate;
        const isFuture = dateStr > today;

        calendarDays.push(
            <button
                key={day}
                onClick={() => !isFuture && onSelectDate(dateStr)}
                disabled={isFuture}
                className={`w-8 h-8 rounded-full text-sm relative transition-all ${isSelected
                    ? 'bg-indigo-600 text-white font-bold'
                    : isToday
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-400'
                        : isFuture
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : hasJournal
                                ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                title={hasJournal && journalData ?
                    `${journalData.is_morning_completed ? '🌅' : ''}${journalData.is_evening_completed ? '🌙' : ''} ${journalData.day_word || ''}`
                    : dateStr === today ? 'Hoy' : 'Sin diario'}
            >
                {day}
                {!isSelected && !isFuture && (
                    <span className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full ${hasJournal
                        ? journalData?.is_evening_completed
                            ? 'bg-green-500'
                            : journalData?.is_morning_completed
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                        : 'bg-red-500'
                        }`} />
                )}
            </button>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={prevMonth}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button
                    onClick={goToToday}
                    className="text-lg font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </button>
                <button
                    onClick={nextMonth}
                    disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((name, i) => (
                    <div key={name} className={`w-8 h-6 flex items-center justify-center text-xs font-medium ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {name}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {calendarDays}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Completado</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Parcial</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Iniciado</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Sin diario</span>
                </div>
            </div>
        </div>
    );
}

export default function DailyJournalPage() {
    const { user, loading: authLoading, token } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // React Query hooks
    const { data: journal, isLoading: journalLoading } = useTodayJournal();
    const { data: historyData } = useJournalHistory(90);
    const { data: stats } = useJournalStats();
    const updateTodayMutation = useUpdateTodayJournal();
    const updateByIdMutation = useUpdateJournalById();
    const addCaptureMutation = useAddQuickCapture();
    const closeDayMutation = useCloseDay();
    const generateAISummaryMutation = useGenerateAISummary();
    const createJournalForDateMutation = useCreateJournalForDate();
    const refreshInspirationalMutation = useRefreshInspirational();

    // Local state
    const [habits, setHabits] = useState<HabitWithLog[]>([]);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSection, setActiveSection] = useState<JournalSection>('morning');
    const [newCapture, setNewCapture] = useState('');

    // History and past journal viewing
    const [showHistory, setShowHistory] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [viewingPastJournal, setViewingPastJournal] = useState(false);
    const [pastJournal, setPastJournal] = useState<DailyJournal | null>(null);
    const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);

    // Big Rock selection
    const [bigRockSelectionMode, setBigRockSelectionMode] = useState<'objective' | 'project' | null>(null);
    const [editingBigRockIndex, setEditingBigRockIndex] = useState<number | null>(null);

    // Local state for text fields with debounce
    const [localIntention, setLocalIntention] = useState('');
    const [localLearnings, setLocalLearnings] = useState('');
    const [localFailures, setLocalFailures] = useState('');
    const [localDoDifferent, setLocalDoDifferent] = useState('');
    const [localNoteToTomorrow, setLocalNoteToTomorrow] = useState('');
    const [localDayWord, setLocalDayWord] = useState('');

    // Generated note modal state
    const [generatedNote, setGeneratedNote] = useState<{
        noteId: string;
        noteTitle: string;
        noteContent: string;
    } | null>(null);

    // Debounced values
    const debouncedIntention = useDebounce(localIntention, 800);
    const debouncedLearnings = useDebounce(localLearnings, 800);
    const debouncedFailures = useDebounce(localFailures, 800);
    const debouncedDoDifferent = useDebounce(localDoDifferent, 800);
    const debouncedNoteToTomorrow = useDebounce(localNoteToTomorrow, 800);
    const debouncedDayWord = useDebounce(localDayWord, 800);

    // Get active journal (today or past)
    const activeJournal = viewingPastJournal ? pastJournal : journal;

    // Journal is editable if evening is not completed (allows editing past journals)
    const isJournalEditable = activeJournal && !activeJournal.is_evening_completed;

    // Wrapper function to update the correct journal (today or past by ID)
    const updateJournal = useCallback((updates: Record<string, unknown>) => {
        if (!activeJournal?.id) return;

        if (viewingPastJournal) {
            // Update past journal by ID
            updateByIdMutation.mutate({ journalId: activeJournal.id, updates });
            // Also update local state for immediate feedback
            setPastJournal(prev => prev ? { ...prev, ...updates } as DailyJournal : null);
        } else {
            // Update today's journal
            updateTodayMutation.mutate(updates);
        }
    }, [activeJournal?.id, viewingPastJournal, updateByIdMutation, updateTodayMutation]);

    // Check if mutation is pending
    const updateJournalPending = updateTodayMutation.isPending || updateByIdMutation.isPending;

    // Fetch habits - gets ALL active habits
    const fetchHabits = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/v1/habits?status=active&limit=100`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const result = await response.json();
                setHabits(result.habits || []);
            }
        } catch (error) {
            console.error('Error fetching habits:', error);
        }
    }, [token]);

    // Fetch objectives
    const fetchObjectives = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/v1/objectives/?status=active&limit=10`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setObjectives(data.objectives || []);
            }
        } catch (error) {
            console.error('Error fetching objectives:', error);
        }
    }, [token]);

    // Fetch projects
    const fetchProjects = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/v1/projects/?status=active`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setProjects(Array.isArray(data) ? data : (data.projects || []));
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    }, [token]);

    // Fetch yesterday's note
    const fetchYesterdayNote = useCallback(async () => {
        if (!token) return;
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const response = await fetch(`${API_URL}/api/v1/daily-journal/by-date/${yesterdayStr}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.note_to_tomorrow) {
                    setYesterdayNote(data.note_to_tomorrow);
                }
            }
        } catch (error) {
            console.log('No journal found for yesterday');
        }
    }, [token]);

    // Toggle habit
    const toggleHabit = useCallback(async (habitId: string, currentStatus: boolean) => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/api/v1/habits/${habitId}/log`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: currentStatus ? 'pending' : 'completed',
                }),
            });
            if (response.ok) {
                fetchHabits();
            }
        } catch (error) {
            console.error('Error toggling habit:', error);
        }
    }, [token, fetchHabits]);

    // Initial data fetch
    useEffect(() => {
        if (token && !authLoading) {
            fetchHabits();
            fetchObjectives();
            fetchProjects();
            fetchYesterdayNote();
        }
    }, [token, authLoading, fetchHabits, fetchObjectives, fetchProjects, fetchYesterdayNote]);

    // Determine active section based on time
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setActiveSection('morning');
        } else if (hour < 18) {
            setActiveSection('day');
        } else {
            setActiveSection('evening');
        }
    }, []);

    // Sync local state with journal when loaded
    useEffect(() => {
        if (activeJournal) {
            setLocalIntention(activeJournal.morning_intention || '');
            setLocalLearnings(activeJournal.learnings || '');
            setLocalFailures(activeJournal.failures || '');
            setLocalDoDifferent(activeJournal.do_different || '');
            setLocalNoteToTomorrow(activeJournal.note_to_tomorrow || '');
            setLocalDayWord(activeJournal.day_word || '');
        }
    }, [activeJournal?.id]);

    // Auto-save debounced values (only if journal is editable - not completed)
    useEffect(() => {
        if (isJournalEditable && debouncedIntention !== (activeJournal.morning_intention || '')) {
            updateJournal({ morning_intention: debouncedIntention });
        }
    }, [debouncedIntention, isJournalEditable]);

    useEffect(() => {
        if (isJournalEditable && debouncedLearnings !== (activeJournal.learnings || '')) {
            updateJournal({ learnings: debouncedLearnings });
        }
    }, [debouncedLearnings, isJournalEditable]);

    useEffect(() => {
        if (isJournalEditable && debouncedFailures !== (activeJournal.failures || '')) {
            updateJournal({ failures: debouncedFailures });
        }
    }, [debouncedFailures, isJournalEditable]);

    useEffect(() => {
        if (isJournalEditable && debouncedDoDifferent !== (activeJournal.do_different || '')) {
            updateJournal({ do_different: debouncedDoDifferent });
        }
    }, [debouncedDoDifferent, isJournalEditable]);

    useEffect(() => {
        if (isJournalEditable && debouncedNoteToTomorrow !== (activeJournal.note_to_tomorrow || '')) {
            updateJournal({ note_to_tomorrow: debouncedNoteToTomorrow });
        }
    }, [debouncedNoteToTomorrow, isJournalEditable]);

    useEffect(() => {
        if (isJournalEditable && debouncedDayWord !== (activeJournal.day_word || '')) {
            updateJournal({ day_word: debouncedDayWord });
        }
    }, [debouncedDayWord, isJournalEditable]);

    // Handlers
    const handleAddCapture = () => {
        if (!newCapture.trim() || !activeJournal) return;

        if (viewingPastJournal) {
            // For past journals, update the quick_captures array directly
            const newCaptureItem = {
                id: crypto.randomUUID(),
                text: newCapture.trim(),
                created_at: new Date().toISOString(),
            };
            const currentCaptures = activeJournal.quick_captures || [];
            updateJournal({ quick_captures: [...currentCaptures, newCaptureItem] });
        } else {
            // For today, use the dedicated endpoint
            addCaptureMutation.mutate(newCapture.trim());
        }
        setNewCapture('');
    };

    const handleSetEnergy = (field: string, level: EnergyLevel) => {
        updateJournal({ [field]: level });
    };

    const handleSetDayRating = (rating: number) => {
        updateJournal({ day_rating: rating });
    };

    const handleToggleMorningComplete = () => {
        updateJournal({ is_morning_completed: !activeJournal?.is_morning_completed });
    };

    const handleToggleEveningComplete = () => {
        updateJournal({ is_evening_completed: !activeJournal?.is_evening_completed });
    };

    // Big Rocks handlers
    const handleSetBigRocksCount = (count: number) => {
        if (!activeJournal) return;
        const currentRocks = activeJournal.big_rocks || [];
        let newRocks = [...currentRocks];

        if (count > currentRocks.length) {
            // Add empty rocks
            for (let i = currentRocks.length; i < count; i++) {
                newRocks.push({
                    id: crypto.randomUUID(),
                    text: '',
                    type: 'custom',
                    ref_id: null,
                    completed: false,
                    order: i,
                });
            }
        } else {
            // Remove extra rocks (from the end)
            newRocks = newRocks.slice(0, count);
        }

        updateJournal({
            big_rocks_count: count,
            big_rocks: newRocks,
        });
    };

    const handleAddBigRock = (type: 'custom' | 'objective' | 'project', refId?: string, text?: string) => {
        if (!activeJournal) return;
        const currentRocks = activeJournal.big_rocks || [];
        const count = activeJournal.big_rocks_count || 3;

        if (editingBigRockIndex !== null && editingBigRockIndex < currentRocks.length) {
            // Update existing rock
            const newRocks = [...currentRocks];
            newRocks[editingBigRockIndex] = {
                ...newRocks[editingBigRockIndex],
                text: text || '',
                type,
                ref_id: refId || null,
            };
            updateJournal({ big_rocks: newRocks });
        } else if (currentRocks.length < count) {
            // Add new rock
            const newRock: BigRockItem = {
                id: crypto.randomUUID(),
                text: text || '',
                type,
                ref_id: refId || null,
                completed: false,
                order: currentRocks.length,
            };
            updateJournal({ big_rocks: [...currentRocks, newRock] });
        }

        setBigRockSelectionMode(null);
        setEditingBigRockIndex(null);
    };

    const handleToggleBigRock = (index: number) => {
        if (!activeJournal) return;
        const newRocks = [...(activeJournal.big_rocks || [])];
        if (newRocks[index]) {
            newRocks[index] = { ...newRocks[index], completed: !newRocks[index].completed };
            updateJournal({ big_rocks: newRocks });
        }
    };

    const handleRemoveBigRock = (index: number) => {
        if (!activeJournal) return;
        const newRocks = (activeJournal.big_rocks || []).filter((_, i) => i !== index);
        updateJournal({ big_rocks: newRocks });
    };

    // Close Day handler
    const handleCloseDay = async () => {
        if (!activeJournal) return;

        // Check for pending scheduled habits
        const pendingScheduledHabits = habits.filter(h => h.is_scheduled && !h.is_completed);
        let confirmMessage = '¿Cerrar el día y generar una nota de diario?\n\nEsto creará una nota Full con el resumen de tu día.';

        if (pendingScheduledHabits.length > 0) {
            confirmMessage += `\n\n⚠️ Tienes ${pendingScheduledHabits.length} hábito(s) programado(s) sin completar que se marcarán como "perdidos".`;
        }

        const confirmed = confirm(confirmMessage);
        if (!confirmed) return;

        try {
            // First, mark pending scheduled habits as missed
            if (pendingScheduledHabits.length > 0) {
                await fetch(`${API_URL}/api/v1/habits/close-day`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });
            }

            // Then close the journal and generate the note
            const result = await closeDayMutation.mutateAsync();

            // Refresh habits to show updated statuses
            fetchHabits();

            // Show the generated note in a modal
            if (result.note_content) {
                setGeneratedNote({
                    noteId: result.note_id,
                    noteTitle: result.note_title,
                    noteContent: result.note_content,
                });
            }
        } catch (error: any) {
            alert(error.message || 'Error al cerrar el día');
        }
    };

    // Refresh inspirational content handler
    const handleRefreshInspirational = async () => {
        try {
            const newContent = await refreshInspirationalMutation.mutateAsync();
            if (newContent && activeJournal) {
                updateJournal({ inspirational_content: newContent } as any);
            }
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today });
        } catch (error) {
            console.error('Error refreshing inspirational content:', error);
        }
    };

    // History handlers
    const loadJournalByDate = async (dateStr: string) => {
        if (!token) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = dateStr === todayStr;

        if (isToday) {
            setViewingPastJournal(false);
            setPastJournal(null);
            setSelectedDate(null);
            setShowHistory(false);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/v1/daily-journal/by-date/${dateStr}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                setPastJournal(data);
                setSelectedDate(dateStr);
                setViewingPastJournal(true);
                setShowHistory(false);
            } else if (response.status === 404) {
                // Create journal for past date
                const newJournal = await createJournalForDateMutation.mutateAsync(dateStr);
                setPastJournal(newJournal);
                setSelectedDate(dateStr);
                setViewingPastJournal(true);
                setShowHistory(false);
            }
        } catch (error) {
            console.error('Error loading journal:', error);
        }
    };

    const handleGoToToday = () => {
        setShowHistory(false);
        setViewingPastJournal(false);
        setPastJournal(null);
        setSelectedDate(null);
    };

    // Loading state
    if (authLoading || journalLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Por favor, inicia sesión para ver tu diario</p>
                    <Link href="/login" className="text-indigo-600 hover:underline">Ir a Login</Link>
                </div>
            </div>
        );
    }

    const today = new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const journalDisplayDate = activeJournal ? new Date(activeJournal.date + 'T00:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : today;

    const history = historyData?.journals || [];
    const saving = updateJournalPending || addCaptureMutation.isPending;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                Mi Diario
                                {viewingPastJournal && (
                                    <span className="text-sm font-normal px-2 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-full">
                                        Editando pasado
                                    </span>
                                )}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                {viewingPastJournal ? journalDisplayDate : today}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {saving && (
                                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Guardando...
                                </span>
                            )}
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                                title={showHistory ? 'Volver a Hoy' : 'Ver Historial'}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                            <Link href="/dashboard" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            </Link>
                        </div>
                    </div>

                    {/* Section Tabs */}
                    {!showHistory && (
                        <div className="flex gap-2 mt-4">
                            {(['morning', 'day', 'evening'] as JournalSection[]).map((section) => (
                                <button
                                    key={section}
                                    onClick={() => setActiveSection(section)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === section
                                        ? 'bg-indigo-600 text-white shadow-lg'
                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {section === 'morning' && '🌅 Mañana'}
                                    {section === 'day' && '☀️ Día (Inbox)'}
                                    {section === 'evening' && '🌙 Cierre'}
                                    {section === 'morning' && activeJournal?.is_morning_completed && ' ✓'}
                                    {section === 'evening' && activeJournal?.is_evening_completed && ' ✓'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* HISTORY PANEL */}
                {showHistory && (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        {stats && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
                                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.current_streak}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Racha actual</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
                                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.longest_streak}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Mejor racha</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
                                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completed_journals}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Completados</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
                                    <p className="text-3xl font-bold text-gray-600 dark:text-gray-400">{stats.total_journals}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total diarios</p>
                                </div>
                            </div>
                        )}

                        {/* Calendar */}
                        <MiniCalendar
                            history={history}
                            onSelectDate={loadJournalByDate}
                            selectedDate={selectedDate || undefined}
                        />

                        {/* Back to Today Button */}
                        <button
                            onClick={handleGoToToday}
                            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                        >
                            ← Volver al Diario de Hoy
                        </button>
                    </div>
                )}

                {/* MORNING SECTION */}
                {!showHistory && activeSection === 'morning' && activeJournal && (
                    <div className="space-y-6">
                        {/* Yesterday's Note */}
                        {yesterdayNote && !viewingPastJournal && (
                            <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-6 shadow-lg border border-amber-200 dark:border-amber-700">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">📝</span>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300 mb-2">
                                            Nota de ayer para hoy
                                        </h3>
                                        <p className="text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                                            {yesterdayNote}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Gospel of the Day Link */}
                        <a
                            href="https://www.opusdei.org/es-es/gospel/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 rounded-2xl p-5 shadow-lg border border-sky-200 dark:border-sky-700 hover:shadow-xl transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-3xl">✝️</span>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-sky-800 dark:text-sky-300 group-hover:text-sky-600 dark:group-hover:text-sky-200">
                                        Evangelio del Día
                                    </h3>
                                    <p className="text-sm text-sky-600 dark:text-sky-400">
                                        Lectura y meditación diaria - Opus Dei
                                    </p>
                                </div>
                                <svg className="w-5 h-5 text-sky-500 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                        </a>

                        {/* Inspirational Content */}
                        {activeJournal.inspirational_content && (
                            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl relative">
                                {/* Refresh button */}
                                <button
                                    onClick={handleRefreshInspirational}
                                    disabled={refreshInspirationalMutation.isPending}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all disabled:opacity-50"
                                    title="Obtener nuevo contenido inspiracional"
                                >
                                    <svg
                                        className={`w-5 h-5 ${refreshInspirationalMutation.isPending ? 'animate-spin' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                                {/* Quote */}
                                {activeJournal.inspirational_content.quote && (
                                    <div className="mb-5">
                                        <p className="text-xl italic font-light">&ldquo;{activeJournal.inspirational_content.quote}&rdquo;</p>
                                        {activeJournal.inspirational_content.quote_author && (
                                            <p className="text-sm mt-2 opacity-80">- {activeJournal.inspirational_content.quote_author}</p>
                                        )}
                                    </div>
                                )}

                                {/* Refran */}
                                {activeJournal.inspirational_content.refran && (
                                    <div className="border-t border-white/20 pt-4 mt-4">
                                        <p className="text-xs uppercase tracking-wider opacity-70 mb-1">Refrán del día</p>
                                        <p className="font-medium">{activeJournal.inspirational_content.refran}</p>
                                    </div>
                                )}

                                {/* Challenge & Question in grid */}
                                {(activeJournal.inspirational_content.challenge || activeJournal.inspirational_content.question) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/20 pt-4 mt-4">
                                        {activeJournal.inspirational_content.challenge && (
                                            <div className="bg-white/10 rounded-xl p-4">
                                                <p className="text-xs uppercase tracking-wider opacity-70 mb-1 flex items-center gap-1">
                                                    <span>🎯</span> Micro-reto del día
                                                </p>
                                                <p className="font-medium">{activeJournal.inspirational_content.challenge}</p>
                                            </div>
                                        )}
                                        {activeJournal.inspirational_content.question && (
                                            <div className="bg-white/10 rounded-xl p-4">
                                                <p className="text-xs uppercase tracking-wider opacity-70 mb-1 flex items-center gap-1">
                                                    <span>💭</span> Pregunta para reflexionar
                                                </p>
                                                <p className="font-medium">{activeJournal.inspirational_content.question}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Word of the day */}
                                {activeJournal.inspirational_content.word && (
                                    <div className="border-t border-white/20 pt-4 mt-4 text-center">
                                        <p className="text-xs uppercase tracking-wider opacity-70 mb-2">Palabra del día para explorar</p>
                                        <p className="text-2xl font-bold">{activeJournal.inspirational_content.word}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Morning Habits */}
                        {habits.filter(h => h.time_of_day === 'morning').length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    🌅 Hábitos de Mañana
                                    <span className="text-sm font-normal text-gray-500">
                                        ({habits.filter(h => h.time_of_day === 'morning' && h.is_scheduled && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'morning' && h.is_scheduled).length})
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {habits.filter(h => h.time_of_day === 'morning').map((habit) => (
                                        <button
                                            key={habit.id}
                                            onClick={() => toggleHabit(habit.id, habit.is_completed)}
                                            className={`p-4 rounded-lg border-2 transition-all relative ${habit.is_completed
                                                ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                                                : habit.is_scheduled
                                                    ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                                    : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                                                }`}
                                            title={habit.is_scheduled ? '' : 'No programado para hoy'}
                                        >
                                            {!habit.is_scheduled && (
                                                <span className="absolute top-1 right-1 text-xs text-gray-400">➕</span>
                                            )}
                                            <span className="text-2xl">{habit.icon}</span>
                                            <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {habit.name}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Morning Intention */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                🎯 Intención de Hoy
                            </h3>
                            <textarea
                                value={localIntention}
                                onChange={(e) => setLocalIntention(e.target.value)}
                                placeholder="¿Cuál es tu intención principal para hoy?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Morning Energy */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                ⚡ Energía al despertar
                            </h3>
                            <div className="flex gap-3">
                                {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => handleSetEnergy('energy_morning', level)}
                                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${activeJournal.energy_morning === level
                                            ? ENERGY_COLORS[level] + ' border-current'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">{ENERGY_ICONS[level]}</span>
                                        <p className="text-sm mt-1 font-medium capitalize">
                                            {level === 'high' ? 'Alta' : level === 'medium' ? 'Media' : 'Baja'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BIG ROCKS - Multiple Configurable */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    🪨 Big Rocks del Día
                                    <span className="text-sm font-normal text-gray-500">(Tareas más importantes)</span>
                                </h3>
                                {/* Count selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Cantidad:</span>
                                    <select
                                        value={activeJournal.big_rocks_count || 3}
                                        onChange={(e) => handleSetBigRocksCount(parseInt(e.target.value))}
                                        className="p-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                    >
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Big Rocks list */}
                            <div className="space-y-3">
                                {(activeJournal.big_rocks || []).map((rock, index) => (
                                    <div key={rock.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <button
                                            onClick={() => handleToggleBigRock(index)}
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${rock.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                                }`}
                                        >
                                            {rock.completed && '✓'}
                                        </button>
                                        <div className="flex-1">
                                            {rock.text ? (
                                                <span className={`${rock.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {rock.type === 'objective' && '🎯 '}
                                                    {rock.type === 'project' && '📂 '}
                                                    {rock.text}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingBigRockIndex(index);
                                                        setBigRockSelectionMode(null);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                                                >
                                                    + Definir Big Rock {index + 1}
                                                </button>
                                            )}
                                        </div>
                                        {rock.text && (
                                            <button
                                                onClick={() => handleRemoveBigRock(index)}
                                                className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Add more rocks button if below count */}
                                {(activeJournal.big_rocks || []).length < (activeJournal.big_rocks_count || 3) && (
                                    <button
                                        onClick={() => {
                                            setEditingBigRockIndex(null);
                                            setBigRockSelectionMode(null);
                                        }}
                                        className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all"
                                    >
                                        + Añadir Big Rock
                                    </button>
                                )}
                            </div>

                            {/* Big Rock Selection Panel */}
                            {(editingBigRockIndex !== null || bigRockSelectionMode !== null) && (
                                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    {!bigRockSelectionMode ? (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Selecciona el tipo de Big Rock:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => setBigRockSelectionMode('objective')}
                                                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
                                                >
                                                    🎯 Objetivo
                                                </button>
                                                <button
                                                    onClick={() => setBigRockSelectionMode('project')}
                                                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
                                                >
                                                    📂 Proyecto
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const text = prompt('Escribe tu Big Rock personalizado:');
                                                        if (text) handleAddBigRock('custom', undefined, text);
                                                    }}
                                                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm"
                                                >
                                                    ✏️ Personalizado
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingBigRockIndex(null);
                                                    setBigRockSelectionMode(null);
                                                }}
                                                className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : bigRockSelectionMode === 'objective' ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Selecciona un objetivo:</p>
                                                <button
                                                    onClick={() => setBigRockSelectionMode(null)}
                                                    className="text-sm text-gray-500 hover:text-gray-700"
                                                >
                                                    ← Volver
                                                </button>
                                            </div>
                                            {objectives.length > 0 ? (
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {objectives.map((obj) => (
                                                        <button
                                                            key={obj.id}
                                                            onClick={() => handleAddBigRock('objective', obj.id, obj.title)}
                                                            className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-900 dark:text-white"
                                                        >
                                                            🎯 {obj.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-center text-gray-500 py-4">
                                                    No hay objetivos activos. <Link href="/objectives" className="text-indigo-600 hover:underline">Crear objetivo</Link>
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-gray-600 dark:text-gray-400">Selecciona un proyecto:</p>
                                                <button
                                                    onClick={() => setBigRockSelectionMode(null)}
                                                    className="text-sm text-gray-500 hover:text-gray-700"
                                                >
                                                    ← Volver
                                                </button>
                                            </div>
                                            {projects.length > 0 ? (
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {projects.map((proj) => (
                                                        <button
                                                            key={proj.id}
                                                            onClick={() => handleAddBigRock('project', proj.id, proj.name)}
                                                            className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-900 dark:text-white"
                                                        >
                                                            📂 {proj.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-center text-gray-500 py-4">
                                                    No hay proyectos activos. <Link href="/projects" className="text-indigo-600 hover:underline">Crear proyecto</Link>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Complete Morning Button */}
                        <button
                            onClick={handleToggleMorningComplete}
                            className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${activeJournal.is_morning_completed
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                }`}
                        >
                            {activeJournal.is_morning_completed ? '✓ Mañana Completada (clic para deshacer)' : 'Completar Mañana ✓'}
                        </button>
                    </div>
                )}

                {/* DAY SECTION - INBOX ONLY */}
                {!showHistory && activeSection === 'day' && activeJournal && (
                    <div className="space-y-6">
                        {/* Inbox Explanation */}
                        <div className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-2xl p-5 shadow-lg border border-yellow-200 dark:border-yellow-700">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">📥</span>
                                <div>
                                    <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">
                                        Inbox del Día
                                    </h3>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                        Captura todo lo que pase por tu mente: ideas, reflexiones, tareas, pensamientos...
                                        Sin clasificar, sin preocuparte. Al cerrar el día, todo se organizará automáticamente.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Captures / Inbox */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                💡 Capturas del Día
                                <span className="text-sm font-normal text-gray-500">
                                    ({(activeJournal.quick_captures || []).length})
                                </span>
                            </h3>

                            {/* Add new capture - at the top for easy access */}
                            {isJournalEditable && (
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newCapture}
                                        onChange={(e) => setNewCapture(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddCapture()}
                                        placeholder="¿Qué tienes en mente? Ideas, tareas, pensamientos..."
                                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleAddCapture}
                                        disabled={addCaptureMutation.isPending || updateJournalPending}
                                        className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                                    >
                                        {(addCaptureMutation.isPending || updateJournalPending) ? '...' : 'Capturar'}
                                    </button>
                                </div>
                            )}

                            {/* Captures list */}
                            <div className="space-y-2">
                                {(activeJournal.quick_captures || []).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <span className="text-4xl">📭</span>
                                        <p className="mt-2">Tu inbox está vacío</p>
                                        <p className="text-sm">Captura cualquier idea o pensamiento que surja durante el día</p>
                                    </div>
                                ) : (
                                    (activeJournal.quick_captures || []).map((capture) => (
                                        <div key={capture.id} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-400">
                                            <p className="text-gray-900 dark:text-white">{capture.text}</p>
                                            <p className="text-xs text-gray-500 mt-2">
                                                {new Date(capture.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Energy Check-ins */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚡ Energía durante el día</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { field: 'energy_morning', label: 'Mañana', value: activeJournal.energy_morning },
                                    { field: 'energy_afternoon', label: 'Tarde', value: activeJournal.energy_afternoon },
                                    { field: 'energy_night', label: 'Noche', value: activeJournal.energy_night },
                                ].map(({ field, label, value }) => (
                                    <div key={field} className="text-center">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{label}</p>
                                        <div className="flex justify-center gap-1">
                                            {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => (
                                                <button
                                                    key={level}
                                                    onClick={() => handleSetEnergy(field, level)}
                                                    className={`w-10 h-10 rounded-lg transition-all ${value === level
                                                        ? ENERGY_COLORS[level]
                                                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {ENERGY_ICONS[level]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Anytime Habits */}
                        {habits.filter(h => h.time_of_day === 'anytime' || h.time_of_day === 'afternoon').length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        ✅ Hábitos del Día
                                        <span className="text-sm font-normal text-gray-500">
                                            ({habits.filter(h => (h.time_of_day === 'anytime' || h.time_of_day === 'afternoon') && h.is_scheduled && h.is_completed).length}/{habits.filter(h => (h.time_of_day === 'anytime' || h.time_of_day === 'afternoon') && h.is_scheduled).length})
                                        </span>
                                    </h3>
                                    <Link
                                        href="/habits"
                                        className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                                    >
                                        Ver todos →
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {habits.filter(h => h.time_of_day === 'anytime' || h.time_of_day === 'afternoon').map((habit) => (
                                        <button
                                            key={habit.id}
                                            onClick={() => toggleHabit(habit.id, habit.is_completed)}
                                            className={`p-4 rounded-lg border-2 transition-all relative ${habit.is_completed
                                                ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                                                : habit.is_scheduled
                                                    ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                                    : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                                                }`}
                                            title={habit.is_scheduled ? '' : 'No programado para hoy'}
                                        >
                                            {!habit.is_scheduled && (
                                                <span className="absolute top-1 right-1 text-xs text-gray-400">➕</span>
                                            )}
                                            <span className="text-2xl">{habit.icon}</span>
                                            <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {habit.name}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* EVENING SECTION - REVIEW + CLOSE DAY */}
                {!showHistory && activeSection === 'evening' && activeJournal && (
                    <div className="space-y-6">
                        {/* Review Header */}
                        <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-5 shadow-lg border border-purple-200 dark:border-purple-700">
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">🌙</span>
                                <div>
                                    <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">
                                        Cierre del Día
                                    </h3>
                                    <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                                        Revisa tu día, celebra logros, y prepárate para mañana.
                                        Al cerrar el día se generará una nota automática con el resumen.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Big Rocks Review */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                🪨 Revisión de Big Rocks
                            </h3>
                            <div className="space-y-2">
                                {(activeJournal.big_rocks || []).filter(r => r.text).map((rock, index) => (
                                    <div key={rock.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <button
                                            onClick={() => handleToggleBigRock(index)}
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${rock.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                                                }`}
                                        >
                                            {rock.completed && '✓'}
                                        </button>
                                        <span className={`flex-1 ${rock.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                            {rock.type === 'objective' && '🎯 '}
                                            {rock.type === 'project' && '📂 '}
                                            {rock.text}
                                        </span>
                                    </div>
                                ))}
                                {(activeJournal.big_rocks || []).filter(r => r.text).length === 0 && (
                                    <p className="text-center text-gray-500 py-4">No hay Big Rocks definidos para hoy</p>
                                )}
                            </div>
                        </div>

                        {/* Evening Habits */}
                        {habits.filter(h => h.time_of_day === 'evening').length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    🌙 Hábitos de Noche
                                    <span className="text-sm font-normal text-gray-500">
                                        ({habits.filter(h => h.time_of_day === 'evening' && h.is_scheduled && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'evening' && h.is_scheduled).length})
                                    </span>
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {habits.filter(h => h.time_of_day === 'evening').map((habit) => (
                                        <button
                                            key={habit.id}
                                            onClick={() => toggleHabit(habit.id, habit.is_completed)}
                                            className={`p-4 rounded-lg border-2 transition-all relative ${habit.is_completed
                                                ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                                                : habit.is_scheduled
                                                    ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                                    : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                                                }`}
                                            title={habit.is_scheduled ? '' : 'No programado para hoy'}
                                        >
                                            {!habit.is_scheduled && (
                                                <span className="absolute top-1 right-1 text-xs text-gray-400">➕</span>
                                            )}
                                            <span className="text-2xl">{habit.icon}</span>
                                            <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {habit.name}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Wins */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🏆 Logros de Hoy</h3>
                            <textarea
                                value={localLearnings}
                                onChange={(e) => setLocalLearnings(e.target.value)}
                                placeholder="¿Qué lograste hoy? ¿Qué aprendiste?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Pendientes */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⏳ Pendientes / No Conseguido</h3>
                            <textarea
                                value={localFailures}
                                onChange={(e) => setLocalFailures(e.target.value)}
                                placeholder="¿Qué quedó pendiente o no salió como esperabas?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Reflexión */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🔮 Reflexión</h3>
                            <textarea
                                value={localDoDifferent}
                                onChange={(e) => setLocalDoDifferent(e.target.value)}
                                placeholder="¿Qué harías diferente? ¿Qué te llevas de hoy?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                rows={3}
                            />
                        </div>

                        {/* Nota para Mañana */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📝 Nota para Mañana</h3>
                            <textarea
                                value={localNoteToTomorrow}
                                onChange={(e) => setLocalNoteToTomorrow(e.target.value)}
                                placeholder="¿Qué quieres recordar o hacer mañana?"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                                rows={3}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Esta nota aparecerá en la sección de mañana del día siguiente
                            </p>
                        </div>

                        {/* Day Rating */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⭐ Califica tu día</h3>
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                    <button
                                        key={rating}
                                        onClick={() => handleSetDayRating(rating)}
                                        className={`w-12 h-12 rounded-full text-2xl transition-all ${activeJournal.day_rating && rating <= activeJournal.day_rating
                                            ? 'bg-yellow-400 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                            }`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Day Word */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💬 Una palabra para hoy</h3>
                            <input
                                type="text"
                                value={localDayWord}
                                onChange={(e) => setLocalDayWord(e.target.value)}
                                placeholder="Gratitud, Productivo, Cansado, Feliz..."
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg"
                            />
                        </div>

                        {/* Complete Evening Button */}
                        <button
                            onClick={handleToggleEveningComplete}
                            className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${activeJournal.is_evening_completed
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                                }`}
                        >
                            {activeJournal.is_evening_completed ? '✓ Reflexión Completada (clic para deshacer)' : 'Completar Reflexión ✓'}
                        </button>

                        {/* CLOSE DAY BUTTON - Main CTA */}
                        {!activeJournal.generated_note_id && (
                            <button
                                onClick={handleCloseDay}
                                disabled={closeDayMutation.isPending}
                                className="w-full py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {closeDayMutation.isPending ? (
                                    <>
                                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Generando nota del día...
                                    </>
                                ) : (
                                    <>
                                        <span className="text-2xl">🌟</span>
                                        Cerrar el Día y Generar Nota
                                    </>
                                )}
                            </button>
                        )}

                        {/* Day already closed message */}
                        {activeJournal.generated_note_id && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 text-center">
                                <span className="text-4xl">🎉</span>
                                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mt-2">
                                    ¡Día cerrado!
                                </h3>
                                <p className="text-green-700 dark:text-green-400 mt-1">
                                    Se ha generado la nota de tu diario
                                </p>
                                <Link
                                    href={`/notes/${activeJournal.generated_note_id}/edit`}
                                    className="inline-block mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Ver nota generada →
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Generated Note Modal */}
            {generatedNote && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🎉</span>
                                    <div>
                                        <h2 className="text-xl font-bold">¡Día cerrado!</h2>
                                        <p className="text-sm opacity-90">{generatedNote.noteTitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setGeneratedNote(null)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Markdown rendered */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="prose prose-sm dark:prose-invert max-w-none
                                prose-headings:text-indigo-700 dark:prose-headings:text-indigo-300
                                prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4
                                prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-h2:text-purple-600 dark:prose-h2:text-purple-400
                                prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:my-2
                                prose-ul:my-2 prose-li:my-1
                                prose-strong:text-gray-900 dark:prose-strong:text-white
                                prose-em:text-gray-600 dark:prose-em:text-gray-400
                                prose-hr:my-6 prose-hr:border-gray-200 dark:prose-hr:border-gray-700
                            ">
                                {generatedNote.noteContent.split('\n').map((line, idx) => {
                                    // Parse markdown-like content
                                    if (line.startsWith('# ')) {
                                        return <h1 key={idx}>{line.substring(2)}</h1>;
                                    }
                                    if (line.startsWith('## ')) {
                                        return <h2 key={idx}>{line.substring(3)}</h2>;
                                    }
                                    if (line.startsWith('### ')) {
                                        return <h3 key={idx}>{line.substring(4)}</h3>;
                                    }
                                    if (line.startsWith('- ')) {
                                        return <li key={idx} className="ml-4">{line.substring(2)}</li>;
                                    }
                                    if (line.startsWith('* ')) {
                                        return <li key={idx} className="ml-4">{line.substring(2)}</li>;
                                    }
                                    if (line.startsWith('---')) {
                                        return <hr key={idx} />;
                                    }
                                    if (line.trim() === '') {
                                        return <br key={idx} />;
                                    }
                                    // Handle bold and italic
                                    const parsedLine = line
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                        .replace(/_(.+?)_/g, '<em>$1</em>');
                                    return <p key={idx} dangerouslySetInnerHTML={{ __html: parsedLine }} />;
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <button
                                onClick={() => setGeneratedNote(null)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                            >
                                Cerrar
                            </button>
                            <Link
                                href={`/notes/${generatedNote.noteId}/edit`}
                                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors font-medium flex items-center gap-2"
                            >
                                <span>Editar nota</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
