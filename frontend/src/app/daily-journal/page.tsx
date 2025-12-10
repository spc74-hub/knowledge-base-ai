'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  time?: string;
}

interface CommitmentItem {
  id: string;
  time: string;
  text: string;
  completed: boolean;
}

interface QuickCapture {
  id: string;
  text: string;
  timestamp: string;
  converted_to_note_id?: string;
}

interface DailyJournal {
  id: string;
  user_id: string;
  date: string;
  morning_intention: string | null;
  energy_morning: string | null;
  inspirational_content: {
    quote?: string;
    quote_author?: string;
    refran?: string;
    challenge?: string;
    question?: string;
    word?: string;
  };
  big_rock_type: string | null;
  big_rock_id: string | null;
  big_rock_text: string | null;
  big_rock_completed: boolean;
  energy_noon: string | null;
  energy_afternoon: string | null;
  energy_night: string | null;
  daily_tasks: TaskItem[];
  commitments: CommitmentItem[];
  quick_captures: QuickCapture[];
  wins: string[];
  learnings: string | null;
  gratitudes: string[];
  failures: string | null;
  forgiveness: string | null;
  forgiveness_items: ForgivenessItem[];
  do_different: string | null;
  note_to_tomorrow: string | null;
  day_rating: number | null;
  day_word: string | null;
  is_morning_completed: boolean;
  is_day_completed: boolean;
  is_evening_completed: boolean;
  created_at: string;
  updated_at: string;
}

interface HabitWithLog {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_completed: boolean;
  today_log: any;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
}

interface ForgivenessItem {
  id: string;
  text: string;
  type: 'self' | 'other' | 'situation';
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

interface JournalHistory {
  id: string;
  date: string;
  day_rating: number | null;
  day_word: string | null;
  is_morning_completed: boolean;
  is_evening_completed: boolean;
}

interface JournalStats {
  current_streak: number;
  longest_streak: number;
  total_journals: number;
  completed_journals: number;
}

interface JournalInsights {
  period_days: number;
  total_journals: number;
  completion_rate: number;
  average_rating: number | null;
  rating_trend: { date: string; rating: number }[];
  energy_patterns: {
    morning: { high: number; medium: number; low: number };
    noon: { high: number; medium: number; low: number };
    afternoon: { high: number; medium: number; low: number };
    night: { high: number; medium: number; low: number };
  };
  day_of_week_ratings: Record<string, number>;
  best_day_of_week: string | null;
  worst_day_of_week: string | null;
  top_wins_themes: { word: string; count: number }[];
  top_gratitude_themes: { word: string; count: number }[];
  total_wins: number;
  total_gratitudes: number;
  big_rock_completion_rate: number;
  task_completion_rate: number;
  morning_routine_rate: number;
  evening_routine_rate: number;
}

interface AISummary {
  summary: string;
  period_days: number;
  journals_analyzed: number;
  generated_at: string;
  stats: {
    completion_rate: number;
    average_rating: number | string;
    best_day: string;
    worst_day: string;
    big_rock_rate: number;
    task_rate: number;
  };
}

// Mini Calendar Component
function MiniCalendar({
  history,
  onSelectDate,
  selectedDate
}: {
  history: JournalHistory[];
  onSelectDate: (date: string) => void;
  selectedDate?: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create a Set of dates that have journal entries for quick lookup
  const journalDates = new Set(history.map(h => h.date));

  // Get journal data for a specific date
  const getJournalForDate = (dateStr: string) => {
    return history.find(h => h.date === dateStr);
  };

  // Get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);

  // Navigate months
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

  // Format date as YYYY-MM-DD
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

  // Build calendar grid
  const calendarDays = [];

  // Empty cells for days before the 1st
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="w-8 h-8" />);
  }

  // Days of the month
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
        className={`w-8 h-8 rounded-full text-sm relative transition-all ${
          isSelected
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
        {/* Dot indicator for journals */}
        {!isSelected && !isFuture && (
          <span className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
            hasJournal
              ? journalData?.is_evening_completed
                ? 'bg-green-500'
                : journalData?.is_morning_completed
                ? 'bg-yellow-500'
                : 'bg-gray-400'
              : 'bg-red-500'  // Red dot for past days without journal
          }`} />
        )}
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
      {/* Header */}
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

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((name, i) => (
          <div key={name} className={`w-8 h-6 flex items-center justify-center text-xs font-medium ${
            i === 0 || i === 6 ? 'text-red-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays}
      </div>

      {/* Legend */}
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
  const [journal, setJournal] = useState<DailyJournal | null>(null);
  const [habits, setHabits] = useState<HabitWithLog[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<JournalSection>('morning');
  const [newTask, setNewTask] = useState('');
  const [newCapture, setNewCapture] = useState('');
  const [newWin, setNewWin] = useState('');
  const [newGratitude, setNewGratitude] = useState('');
  const [newForgiveness, setNewForgiveness] = useState('');
  const [forgivenessType, setForgivenessType] = useState<'self' | 'other' | 'situation'>('self');

  // History and stats
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<JournalHistory[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewingPastJournal, setViewingPastJournal] = useState(false);
  const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);
  const [insights, setInsights] = useState<JournalInsights | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [savingSummaryAsNote, setSavingSummaryAsNote] = useState(false);

  // Local state for text fields with debounce (to avoid saving on every keystroke)
  const [localIntention, setLocalIntention] = useState('');
  const [localLearnings, setLocalLearnings] = useState('');
  const [localFailures, setLocalFailures] = useState('');
  const [localForgiveness, setLocalForgiveness] = useState('');
  const [localDoDifferent, setLocalDoDifferent] = useState('');
  const [localNoteToTomorrow, setLocalNoteToTomorrow] = useState('');
  const [localDayWord, setLocalDayWord] = useState('');

  // State for Big Rock selection mode
  const [bigRockSelectionMode, setBigRockSelectionMode] = useState<'objective' | 'project' | null>(null);

  // Debounced values
  const debouncedIntention = useDebounce(localIntention, 800);
  const debouncedLearnings = useDebounce(localLearnings, 800);
  const debouncedFailures = useDebounce(localFailures, 800);
  const debouncedForgiveness = useDebounce(localForgiveness, 800);
  const debouncedDoDifferent = useDebounce(localDoDifferent, 800);
  const debouncedNoteToTomorrow = useDebounce(localNoteToTomorrow, 800);
  const debouncedDayWord = useDebounce(localDayWord, 800);

  // Fetch yesterday's journal to get note_to_tomorrow
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
      // It's okay if yesterday's journal doesn't exist
      console.log('No journal found for yesterday');
    }
  }, [token]);

  // Fetch journal data
  const fetchJournal = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/daily-journal/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setJournal(data);
      }
    } catch (error) {
      console.error('Error fetching journal:', error);
    }
  }, [token]);

  // Fetch habits for today
  const fetchHabits = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/habits/today`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        // API returns { data: habits[], date: string }
        setHabits(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching habits:', error);
    }
  }, [token]);

  // Fetch objectives
  const fetchObjectives = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/objectives?status=active&limit=5`, {
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
      const response = await fetch(`${API_URL}/api/v1/projects?status=active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not { projects: [] }
        setProjects(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [token]);

  // Fetch journal history
  const fetchHistory = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/daily-journal/history?limit=90`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.journals || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [token]);

  // Fetch journal stats
  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/daily-journal/stats/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  // Fetch journal insights
  const fetchInsights = useCallback(async (days: number = 30) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/daily-journal/stats/insights?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  }, [token]);

  // Generate AI summary
  const generateAiSummary = useCallback(async (days: number = 30) => {
    if (!token) return;

    setLoadingAiSummary(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/daily-journal/summary/ai-generate?days=${days}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAiSummary(data);
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al generar resumen');
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Error al generar resumen con IA');
    } finally {
      setLoadingAiSummary(false);
    }
  }, [token]);

  // Save AI summary as a standalone note
  const saveAiSummaryAsNote = useCallback(async () => {
    if (!token || !aiSummary) return;

    setSavingSummaryAsNote(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const noteData = {
        title: `Resumen de Mi Diario - ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        content: aiSummary.summary,
        note_type: 'journal',
        tags: ['resumen-ia', 'diario', 'reflexion'],
      };

      const response = await fetch(`${API_URL}/api/v1/notes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(noteData),
      });

      if (response.ok) {
        alert('Resumen guardado como nota');
      } else {
        const error = await response.json();
        alert(error.detail || 'Error al guardar la nota');
      }
    } catch (error) {
      console.error('Error saving AI summary as note:', error);
      alert('Error al guardar la nota');
    } finally {
      setSavingSummaryAsNote(false);
    }
  }, [token, aiSummary]);

  // Load or create a journal for a specific date
  const loadJournalByDate = useCallback(async (dateStr: string) => {
    if (!token) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = dateStr === todayStr;

    try {
      // First try to get existing journal
      const response = await fetch(`${API_URL}/api/v1/daily-journal/by-date/${dateStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setJournal(data);
        setSelectedDate(dateStr);
        setViewingPastJournal(!isToday);
        setShowHistory(false);
      } else if (response.status === 404 && !isToday) {
        // Journal doesn't exist for this past date - create it
        const createResponse = await fetch(`${API_URL}/api/v1/daily-journal/create-for-date`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ date: dateStr }),
        });

        if (createResponse.ok) {
          const data = await createResponse.json();
          setJournal(data);
          setSelectedDate(dateStr);
          setViewingPastJournal(true);
          setShowHistory(false);
          // Refresh history to include the new journal
          fetchHistory();
        }
      }
    } catch (error) {
      console.error('Error loading journal:', error);
    }
  }, [token, fetchHistory]);

  // Update journal (works for both today and past dates)
  const updateJournal = useCallback(async (updates: Partial<DailyJournal>) => {
    if (!token || !journal) return;

    setSaving(true);
    try {
      // Use the journal ID endpoint for past journals, or today endpoint for today
      const endpoint = viewingPastJournal
        ? `${API_URL}/api/v1/daily-journal/${journal.id}`
        : `${API_URL}/api/v1/daily-journal/today`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setJournal(data);
      }
    } catch (error) {
      console.error('Error updating journal:', error);
    } finally {
      setSaving(false);
    }
  }, [token, journal, viewingPastJournal]);

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

  useEffect(() => {
    if (token && !authLoading) {
      setLoading(true);
      Promise.all([fetchJournal(), fetchHabits(), fetchObjectives(), fetchProjects(), fetchYesterdayNote()])
        .finally(() => setLoading(false));
    }
  }, [token, authLoading, fetchJournal, fetchHabits, fetchObjectives, fetchProjects, fetchYesterdayNote]);

  // Determine which section should be active based on time
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
    if (journal) {
      setLocalIntention(journal.morning_intention || '');
      setLocalLearnings(journal.learnings || '');
      setLocalFailures(journal.failures || '');
      setLocalForgiveness(journal.forgiveness || '');
      setLocalDoDifferent(journal.do_different || '');
      setLocalNoteToTomorrow(journal.note_to_tomorrow || '');
      setLocalDayWord(journal.day_word || '');
    }
  }, [journal?.id]); // Only sync when journal ID changes (not on every update)

  // Auto-save debounced values
  useEffect(() => {
    if (journal && debouncedIntention !== (journal.morning_intention || '')) {
      updateJournal({ morning_intention: debouncedIntention });
    }
  }, [debouncedIntention]);

  useEffect(() => {
    if (journal && debouncedLearnings !== (journal.learnings || '')) {
      updateJournal({ learnings: debouncedLearnings });
    }
  }, [debouncedLearnings]);

  useEffect(() => {
    if (journal && debouncedFailures !== (journal.failures || '')) {
      updateJournal({ failures: debouncedFailures });
    }
  }, [debouncedFailures]);

  useEffect(() => {
    if (journal && debouncedForgiveness !== (journal.forgiveness || '')) {
      updateJournal({ forgiveness: debouncedForgiveness });
    }
  }, [debouncedForgiveness]);

  useEffect(() => {
    if (journal && debouncedDoDifferent !== (journal.do_different || '')) {
      updateJournal({ do_different: debouncedDoDifferent });
    }
  }, [debouncedDoDifferent]);

  useEffect(() => {
    if (journal && debouncedNoteToTomorrow !== (journal.note_to_tomorrow || '')) {
      updateJournal({ note_to_tomorrow: debouncedNoteToTomorrow });
    }
  }, [debouncedNoteToTomorrow]);

  useEffect(() => {
    if (journal && debouncedDayWord !== (journal.day_word || '')) {
      updateJournal({ day_word: debouncedDayWord });
    }
  }, [debouncedDayWord]);

  // Handlers
  const handleAddTask = () => {
    if (!newTask.trim() || !journal) return;
    const task: TaskItem = {
      id: crypto.randomUUID(),
      text: newTask.trim(),
      completed: false,
    };
    updateJournal({ daily_tasks: [...(journal.daily_tasks || []), task] });
    setNewTask('');
  };

  const handleToggleTask = (taskId: string) => {
    if (!journal) return;
    const tasks = journal.daily_tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    updateJournal({ daily_tasks: tasks });
  };

  const handleDeleteTask = (taskId: string) => {
    if (!journal) return;
    const tasks = journal.daily_tasks.filter(t => t.id !== taskId);
    updateJournal({ daily_tasks: tasks });
  };

  const handleAddCapture = () => {
    if (!newCapture.trim() || !journal) return;
    const capture: QuickCapture = {
      id: crypto.randomUUID(),
      text: newCapture.trim(),
      timestamp: new Date().toISOString(),
    };
    updateJournal({ quick_captures: [...(journal.quick_captures || []), capture] });
    setNewCapture('');
  };

  const handleAddWin = () => {
    if (!newWin.trim() || !journal) return;
    updateJournal({ wins: [...(journal.wins || []), newWin.trim()] });
    setNewWin('');
  };

  const handleRemoveWin = (index: number) => {
    if (!journal) return;
    const wins = journal.wins.filter((_, i) => i !== index);
    updateJournal({ wins });
  };

  const handleAddGratitude = () => {
    if (!newGratitude.trim() || !journal) return;
    updateJournal({ gratitudes: [...(journal.gratitudes || []), newGratitude.trim()] });
    setNewGratitude('');
  };

  const handleRemoveGratitude = (index: number) => {
    if (!journal) return;
    const gratitudes = journal.gratitudes.filter((_, i) => i !== index);
    updateJournal({ gratitudes });
  };

  const handleAddForgivenessItem = () => {
    if (!newForgiveness.trim() || !journal) return;
    const item: ForgivenessItem = {
      id: crypto.randomUUID(),
      text: newForgiveness.trim(),
      type: forgivenessType,
    };
    updateJournal({ forgiveness_items: [...(journal.forgiveness_items || []), item] });
    setNewForgiveness('');
  };

  const handleRemoveForgivenessItem = (id: string) => {
    if (!journal) return;
    const items = (journal.forgiveness_items || []).filter(item => item.id !== id);
    updateJournal({ forgiveness_items: items });
  };

  const handleSetEnergy = (field: string, level: EnergyLevel) => {
    updateJournal({ [field]: level });
  };

  const handleSetBigRock = (type: string, id?: string, text?: string) => {
    updateJournal({
      big_rock_type: type,
      big_rock_id: id || null,
      big_rock_text: text || null,
    });
  };

  const handleToggleBigRock = () => {
    if (!journal) return;
    updateJournal({ big_rock_completed: !journal.big_rock_completed });
  };

  const handleSetDayRating = (rating: number) => {
    updateJournal({ day_rating: rating });
  };

  const handleToggleMorningComplete = () => {
    updateJournal({ is_morning_completed: !journal?.is_morning_completed });
  };

  const handleToggleDayComplete = () => {
    updateJournal({ is_day_completed: !journal?.is_day_completed });
  };

  const handleToggleEveningComplete = () => {
    updateJournal({ is_evening_completed: !journal?.is_evening_completed });
  };

  // Complete entire day (verifies all sections and all habits have a status)
  const handleCompleteDayTotal = () => {
    if (!journal) return;

    const missingParts: string[] = [];
    if (!journal.is_morning_completed) missingParts.push('Manana');
    if (!journal.is_day_completed) missingParts.push('Durante el Dia');
    if (!journal.is_evening_completed) missingParts.push('Noche');

    // Check if all habits have been tracked (have a today_log with any status)
    const unloggedHabits = habits.filter(h => !h.today_log);
    if (unloggedHabits.length > 0) {
      const habitNames = unloggedHabits.map(h => h.name).join(', ');
      missingParts.push(`Habitos sin registrar: ${habitNames}`);
    }

    if (missingParts.length > 0) {
      alert(`Faltan por completar:\n${missingParts.join('\n')}`);
      return;
    }

    // All sections are complete and all habits tracked
    alert('Dia completado! Todas las secciones estan completas y todos los habitos registrados.');
  };

  // Open history panel
  const handleOpenHistory = async () => {
    setShowHistory(true);
    await Promise.all([fetchHistory(), fetchStats(), fetchInsights(30)]);
  };

  // Toggle insights view
  const handleToggleInsights = () => {
    setShowInsights(!showInsights);
  };

  // Go back to today
  const handleGoToToday = async () => {
    setShowHistory(false);
    setViewingPastJournal(false);
    setSelectedDate(null);
    await fetchJournal();
  };

  if (authLoading || loading) {
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
          <p className="text-gray-600 dark:text-gray-400 mb-4">Por favor, inicia sesion para ver tu diario</p>
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

  // Format the journal date for display
  const journalDisplayDate = journal ? new Date(journal.date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : today;

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
              {/* History button */}
              <button
                onClick={showHistory ? handleGoToToday : handleOpenHistory}
                className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 relative"
                title={showHistory ? 'Volver a Hoy' : 'Ver Historial'}
              >
                {showHistory ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              <Link href="/dashboard" className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-2 mt-4">
            {(['morning', 'day', 'evening'] as JournalSection[]).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === section
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {section === 'morning' && '🌅 Manana'}
                {section === 'day' && '☀️ Durante el Dia'}
                {section === 'evening' && '🌙 Noche'}
                {section === 'morning' && journal?.is_morning_completed && ' ✓'}
                {section === 'day' && journal?.is_day_completed && ' ✓'}
                {section === 'evening' && journal?.is_evening_completed && ' ✓'}
              </button>
            ))}
          </div>
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

            {/* Toggle Insights Button */}
            <div className="flex gap-2">
              <button
                onClick={handleToggleInsights}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  showInsights
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {showInsights ? '📊 Ocultar Estadisticas' : '📊 Ver Estadisticas Detalladas'}
              </button>
              <button
                onClick={() => generateAiSummary(30)}
                disabled={loadingAiSummary}
                className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              >
                {loadingAiSummary ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generando...
                  </span>
                ) : (
                  '🤖 Generar Resumen IA'
                )}
              </button>
            </div>

            {/* AI Summary */}
            {aiSummary && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 shadow-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                    🤖 Resumen con IA
                  </h3>
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    {aiSummary.journals_analyzed} diarios analizados
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {aiSummary.summary}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveAiSummaryAsNote}
                    disabled={savingSummaryAsNote}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {savingSummaryAsNote ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <span>📝</span>
                        Guardar como Nota
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Detailed Insights */}
            {showInsights && insights && (
              <div className="space-y-4">
                {/* Completion Rates */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📈 Tasas de Completacion (30 dias)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-green-500"
                            strokeDasharray={`${(insights.morning_routine_rate / 100) * 175.9} 175.9`} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{insights.morning_routine_rate}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Rutina Manana</p>
                    </div>
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-purple-500"
                            strokeDasharray={`${(insights.evening_routine_rate / 100) * 175.9} 175.9`} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{insights.evening_routine_rate}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Rutina Noche</p>
                    </div>
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-amber-500"
                            strokeDasharray={`${(insights.big_rock_completion_rate / 100) * 175.9} 175.9`} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{insights.big_rock_completion_rate}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Big Rocks</p>
                    </div>
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="none" className="text-blue-500"
                            strokeDasharray={`${(insights.task_completion_rate / 100) * 175.9} 175.9`} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{insights.task_completion_rate}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Tareas</p>
                    </div>
                  </div>
                </div>

                {/* Best/Worst Days */}
                {(insights.best_day_of_week || insights.worst_day_of_week) && (
                  <div className="grid grid-cols-2 gap-4">
                    {insights.best_day_of_week && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                        <p className="text-sm text-green-600 dark:text-green-400">Mejor dia</p>
                        <p className="text-xl font-bold text-green-800 dark:text-green-300">{insights.best_day_of_week}</p>
                      </div>
                    )}
                    {insights.worst_day_of_week && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                        <p className="text-sm text-red-600 dark:text-red-400">Dia mas dificil</p>
                        <p className="text-xl font-bold text-red-800 dark:text-red-300">{insights.worst_day_of_week}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Themes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {insights.top_wins_themes.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🏆 Temas en Logros</h4>
                      <div className="flex flex-wrap gap-2">
                        {insights.top_wins_themes.map((theme, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs">
                            {theme.word} ({theme.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {insights.top_gratitude_themes.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🙏 Temas en Gratitudes</h4>
                      <div className="flex flex-wrap gap-2">
                        {insights.top_gratitude_themes.map((theme, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs">
                            {theme.word} ({theme.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary Stats */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📊 Resumen del Periodo</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{insights.total_wins}</p>
                      <p className="text-xs text-gray-500">Logros</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{insights.total_gratitudes}</p>
                      <p className="text-xs text-gray-500">Gratitudes</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {insights.average_rating ? `${insights.average_rating}/5` : '-'}
                      </p>
                      <p className="text-xs text-gray-500">Rating Prom.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Calendar */}
            <MiniCalendar
              history={history}
              onSelectDate={loadJournalByDate}
              selectedDate={selectedDate || undefined}
            />

            {/* History List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                📋 Ultimos Diarios
              </h3>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay diarios anteriores</p>
                ) : (
                  history.map((entry) => {
                    const entryDate = new Date(entry.date);
                    const isToday = entry.date === new Date().toISOString().split('T')[0];
                    return (
                      <button
                        key={entry.id}
                        onClick={() => loadJournalByDate(entry.date)}
                        className={`w-full p-4 rounded-lg border transition-all text-left flex items-center justify-between ${
                          isToday
                            ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              {entryDate.getDate()}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">
                              {entryDate.toLocaleDateString('es-ES', { month: 'short' })}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {entryDate.toLocaleDateString('es-ES', { weekday: 'long' })}
                              {isToday && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">(Hoy)</span>}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {entry.is_morning_completed && <span className="text-green-500">🌅✓</span>}
                              {entry.is_evening_completed && <span className="text-green-500">🌙✓</span>}
                              {entry.day_word && <span className="italic">&quot;{entry.day_word}&quot;</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.day_rating && (
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`text-sm ${star <= entry.day_rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          )}
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

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
        {!showHistory && activeSection === 'morning' && journal && (
          <div className="space-y-6">
            {/* Yesterday's Note (if exists and viewing today) */}
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
            {journal.inspirational_content && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                {journal.inspirational_content.quote && (
                  <div className="mb-4">
                    <p className="text-lg italic">&ldquo;{journal.inspirational_content.quote}&rdquo;</p>
                    {journal.inspirational_content.quote_author && (
                      <p className="text-sm mt-2 opacity-80">- {journal.inspirational_content.quote_author}</p>
                    )}
                  </div>
                )}
                {journal.inspirational_content.refran && (
                  <div className="border-t border-white/20 pt-4 mt-4">
                    <p className="text-sm opacity-80">Refran del dia:</p>
                    <p className="font-medium">{journal.inspirational_content.refran}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
                  {journal.inspirational_content.challenge && (
                    <div>
                      <p className="text-xs opacity-80">Reto</p>
                      <p className="text-sm">{journal.inspirational_content.challenge}</p>
                    </div>
                  )}
                  {journal.inspirational_content.question && (
                    <div>
                      <p className="text-xs opacity-80">Pregunta</p>
                      <p className="text-sm">{journal.inspirational_content.question}</p>
                    </div>
                  )}
                </div>
                {journal.inspirational_content.word && (
                  <div className="mt-4 pt-4 border-t border-white/20 text-center">
                    <p className="text-xs opacity-80">Palabra del dia</p>
                    <p className="text-2xl font-bold">{journal.inspirational_content.word}</p>
                  </div>
                )}
              </div>
            )}

            {/* Morning Habits */}
            {habits.filter(h => h.time_of_day === 'morning').length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🌅 Habitos de Manana
                  <span className="text-sm font-normal text-gray-500">
                    ({habits.filter(h => h.time_of_day === 'morning' && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'morning').length})
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {habits.filter(h => h.time_of_day === 'morning').map((habit) => (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id, habit.is_completed)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        habit.is_completed
                          ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
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
                🎯 Intencion de Hoy
              </h3>
              <textarea
                value={localIntention}
                onChange={(e) => setLocalIntention(e.target.value)}
                placeholder="¿Cual es tu intencion principal para hoy?"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
              />
            </div>

            {/* Morning Energy */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                ⚡ Energia al despertar
              </h3>
              <div className="flex gap-3">
                {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleSetEnergy('energy_morning', level)}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      journal.energy_morning === level
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

            {/* Big Rock */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                🪨 Big Rock del Dia
                <span className="text-sm font-normal text-gray-500">(La tarea mas importante)</span>
              </h3>

              {!journal.big_rock_type && !bigRockSelectionMode ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona tu Big Rock:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setBigRockSelectionMode('objective')}
                      className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      🎯 Objetivo
                    </button>
                    <button
                      onClick={() => setBigRockSelectionMode('project')}
                      className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      📂 Proyecto
                    </button>
                    <button
                      onClick={() => {
                        const text = prompt('Escribe tu Big Rock personalizado:');
                        if (text) handleSetBigRock('custom', undefined, text);
                      }}
                      className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                    >
                      ✏️ Personalizado
                    </button>
                  </div>
                </div>
              ) : bigRockSelectionMode === 'objective' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona un objetivo:</p>
                    <button
                      onClick={() => setBigRockSelectionMode(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      ← Volver
                    </button>
                  </div>
                  {objectives.length > 0 ? (
                    <div className="space-y-2">
                      {objectives.map((obj) => (
                        <button
                          key={obj.id}
                          onClick={() => {
                            handleSetBigRock('objective', obj.id, obj.title);
                            setBigRockSelectionMode(null);
                          }}
                          className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-900 dark:text-white"
                        >
                          🎯 {obj.title}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      No hay objetivos activos. <a href="/objectives" className="text-indigo-600 hover:underline">Crear objetivo</a>
                    </p>
                  )}
                </div>
              ) : bigRockSelectionMode === 'project' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona un proyecto:</p>
                    <button
                      onClick={() => setBigRockSelectionMode(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      ← Volver
                    </button>
                  </div>
                  {projects.length > 0 ? (
                    <div className="space-y-2">
                      {projects.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => {
                            handleSetBigRock('project', proj.id, proj.name);
                            setBigRockSelectionMode(null);
                          }}
                          className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-900 dark:text-white"
                        >
                          📂 {proj.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      No hay proyectos activos. <a href="/projects" className="text-indigo-600 hover:underline">Crear proyecto</a>
                    </p>
                  )}
                </div>
              ) : journal.big_rock_type ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleBigRock}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                      journal.big_rock_completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                    }`}
                  >
                    {journal.big_rock_completed && '✓'}
                  </button>
                  <span className={`flex-1 text-lg ${journal.big_rock_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                    {journal.big_rock_text}
                  </span>
                  <button
                    onClick={() => {
                      handleSetBigRock('');
                      setBigRockSelectionMode(null);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Complete Morning Button - Toggleable */}
            <button
              onClick={handleToggleMorningComplete}
              className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${
                journal.is_morning_completed
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
              }`}
            >
              {journal.is_morning_completed ? '✓ Rutina de Mañana Completada (clic para deshacer)' : 'Completar Rutina de Mañana ✓'}
            </button>
          </div>
        )}

        {/* DAY SECTION */}
        {!showHistory && activeSection === 'day' && journal && (
          <div className="space-y-6">
            {/* Afternoon Habits */}
            {habits.filter(h => h.time_of_day === 'afternoon').length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  ☀️ Habitos de Tarde
                  <span className="text-sm font-normal text-gray-500">
                    ({habits.filter(h => h.time_of_day === 'afternoon' && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'afternoon').length})
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {habits.filter(h => h.time_of_day === 'afternoon').map((habit) => (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id, habit.is_completed)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        habit.is_completed
                          ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{habit.icon}</span>
                      <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {habit.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anytime Habits */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  ✅ Habitos del Dia
                  <span className="text-sm font-normal text-gray-500">
                    ({habits.filter(h => h.time_of_day === 'anytime' && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'anytime').length})
                  </span>
                </h3>
                <Link
                  href="/habits"
                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                >
                  Ver todos
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {habits.filter(h => h.time_of_day === 'anytime').map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id, habit.is_completed)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      habit.is_completed
                        ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{habit.icon}</span>
                    <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {habit.name}
                    </p>
                  </button>
                ))}
                {habits.filter(h => h.time_of_day === 'anytime').length === 0 && (
                  <p className="col-span-full text-center text-gray-500 py-4">
                    No hay habitos de dia. <Link href="/habits" className="text-indigo-600 hover:underline">Crear habitos</Link>
                  </p>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                📋 Tareas del Dia
              </h3>
              <div className="space-y-2">
                {journal.daily_tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        task.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {task.completed && '✓'}
                    </button>
                    <span className={`flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="Nueva tarea..."
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Energy Check-ins */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚡ Energia durante el dia</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { field: 'energy_noon', label: 'Mediodia', value: journal.energy_noon },
                  { field: 'energy_afternoon', label: 'Tarde', value: journal.energy_afternoon },
                  { field: 'energy_night', label: 'Noche', value: journal.energy_night },
                ].map(({ field, label, value }) => (
                  <div key={field} className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{label}</p>
                    <div className="flex justify-center gap-1">
                      {(['high', 'medium', 'low'] as EnergyLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => handleSetEnergy(field, level)}
                          className={`w-10 h-10 rounded-lg transition-all ${
                            value === level
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

            {/* Quick Captures */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💡 Capturas Rapidas</h3>
              <div className="space-y-2 mb-4">
                {journal.quick_captures.map((capture) => (
                  <div key={capture.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-400">
                    <p className="text-gray-900 dark:text-white">{capture.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(capture.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCapture}
                  onChange={(e) => setNewCapture(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCapture()}
                  placeholder="Captura una idea..."
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleAddCapture}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                >
                  +
                </button>
              </div>
            </div>

            {/* Complete Day Button - Toggleable */}
            <button
              onClick={handleToggleDayComplete}
              className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${
                journal.is_day_completed
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
              }`}
            >
              {journal.is_day_completed ? '✓ Sección del Día Completada (clic para deshacer)' : 'Completar Sección del Día ✓'}
            </button>
          </div>
        )}

        {/* EVENING SECTION */}
        {!showHistory && activeSection === 'evening' && journal && (
          <div className="space-y-6">
            {/* Evening Habits */}
            {habits.filter(h => h.time_of_day === 'evening').length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  🌙 Habitos de Noche
                  <span className="text-sm font-normal text-gray-500">
                    ({habits.filter(h => h.time_of_day === 'evening' && h.is_completed).length}/{habits.filter(h => h.time_of_day === 'evening').length})
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {habits.filter(h => h.time_of_day === 'evening').map((habit) => (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id, habit.is_completed)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        habit.is_completed
                          ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{habit.icon}</span>
                      <p className={`text-sm mt-1 ${habit.is_completed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {habit.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. Logros (Wins) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🏆 Logros de Hoy</h3>
              <div className="space-y-2 mb-4">
                {journal.wins.map((win, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-green-500">✓</span>
                    <span className="flex-1 text-gray-900 dark:text-white">{win}</span>
                    <button onClick={() => handleRemoveWin(index)} className="text-gray-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWin}
                  onChange={(e) => setNewWin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddWin()}
                  placeholder="¿Que lograste hoy?"
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button onClick={handleAddWin} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">+</button>
              </div>
            </div>

            {/* 2. Gracias (Gratitudes) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🙏 Gracias</h3>
              <div className="space-y-2 mb-4">
                {journal.gratitudes.map((gratitude, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <span className="text-purple-500">💜</span>
                    <span className="flex-1 text-gray-900 dark:text-white">{gratitude}</span>
                    <button onClick={() => handleRemoveGratitude(index)} className="text-gray-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGratitude}
                  onChange={(e) => setNewGratitude(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGratitude()}
                  placeholder="¿Por que estas agradecido hoy?"
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button onClick={handleAddGratitude} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">+</button>
              </div>
            </div>

            {/* 3. Perdones (Forgiveness) - Structured */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💚 Perdones</h3>
              <div className="space-y-2 mb-4">
                {(journal.forgiveness_items || []).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                    <span className="text-teal-500">
                      {item.type === 'self' ? '🙏' : item.type === 'other' ? '🤝' : '🌿'}
                    </span>
                    <span className="flex-1 text-gray-900 dark:text-white">{item.text}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300">
                      {item.type === 'self' ? 'A mi' : item.type === 'other' ? 'A otro' : 'Situacion'}
                    </span>
                    <button onClick={() => handleRemoveForgivenessItem(item.id)} className="text-gray-400 hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={forgivenessType}
                    onChange={(e) => setForgivenessType(e.target.value as 'self' | 'other' | 'situation')}
                    className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="self">A mi mismo</option>
                    <option value="other">A otra persona</option>
                    <option value="situation">Una situacion</option>
                  </select>
                  <input
                    type="text"
                    value={newForgiveness}
                    onChange={(e) => setNewForgiveness(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddForgivenessItem()}
                    placeholder="¿Que te perdonas hoy?"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button onClick={handleAddForgivenessItem} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">+</button>
                </div>
              </div>
            </div>

            {/* 4. Pendientes (What didn't work out) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⏳ Pendientes / No Conseguido</h3>
              <textarea
                value={localFailures}
                onChange={(e) => setLocalFailures(e.target.value)}
                placeholder="¿Que quedo pendiente o no salio como esperabas?"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
              />
            </div>

            {/* 5. Reflexion */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🔮 Reflexion</h3>
              <textarea
                value={localDoDifferent}
                onChange={(e) => setLocalDoDifferent(e.target.value)}
                placeholder="¿Que aprendiste hoy? ¿Que harias diferente?"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
              />
            </div>

            {/* 6. Nota para Manana */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📝 Nota para Manana</h3>
              <textarea
                value={localNoteToTomorrow}
                onChange={(e) => setLocalNoteToTomorrow(e.target.value)}
                placeholder="¿Que quieres recordar o hacer manana?"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Esta nota aparecera en la seccion de manana del dia siguiente
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
                    className={`w-12 h-12 rounded-full text-2xl transition-all ${
                      journal.day_rating && rating <= journal.day_rating
                        ? 'bg-yellow-400 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Complete Evening Button - Toggleable */}
            <button
              onClick={handleToggleEveningComplete}
              className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${
                journal.is_evening_completed
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
              }`}
            >
              {journal.is_evening_completed ? '✓ Rutina de Noche Completada (clic para deshacer)' : 'Completar Rutina de Noche ✓'}
            </button>

            {/* Day Complete Total Button */}
            <button
              onClick={handleCompleteDayTotal}
              className={`w-full py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all ${
                journal.is_morning_completed && journal.is_day_completed && journal.is_evening_completed
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {journal.is_morning_completed && journal.is_day_completed && journal.is_evening_completed
                ? '🎉 ¡Día Completado!'
                : '📋 Verificar Día Completado'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
