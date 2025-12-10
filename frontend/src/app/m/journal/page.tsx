'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TaskItem {
    id: string;
    text: string;
    completed: boolean;
    time?: string;
}

interface QuickCapture {
    id: string;
    text: string;
    timestamp: string;
}

interface ForgivenessItem {
    id: string;
    text: string;
    type: 'self' | 'other' | 'situation';
}

interface InspirationalContent {
    quote?: string;
    quote_author?: string;
    refran?: string;
    challenge?: string;
    question?: string;
    word?: string;
}

interface DailyJournal {
    id: string;
    date: string;
    morning_intention: string | null;
    energy_morning: string | null;
    energy_noon: string | null;
    energy_afternoon: string | null;
    energy_night: string | null;
    inspirational_content: InspirationalContent | null;
    big_rock_text: string | null;
    big_rock_completed: boolean;
    daily_tasks: TaskItem[];
    quick_captures: QuickCapture[];
    wins: string[];
    gratitudes: string[];
    learnings: string | null;
    failures: string | null;
    forgiveness_items: ForgivenessItem[];
    do_different: string | null;
    note_to_tomorrow: string | null;
    day_rating: number | null;
    day_word: string | null;
    is_morning_completed: boolean;
    is_day_completed: boolean;
    is_evening_completed: boolean;
}

type EnergyLevel = 'high' | 'medium' | 'low';
type JournalSection = 'morning' | 'day' | 'evening';

const ENERGY_OPTIONS: { value: EnergyLevel; icon: string; label: string; color: string; darkColor: string }[] = [
    { value: 'high', icon: '🔥', label: 'Alta', color: 'bg-green-100 text-green-700 border-green-300', darkColor: 'bg-green-900 text-green-200 border-green-700' },
    { value: 'medium', icon: '⚡', label: 'Media', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', darkColor: 'bg-yellow-900 text-yellow-200 border-yellow-700' },
    { value: 'low', icon: '🔋', label: 'Baja', color: 'bg-red-100 text-red-700 border-red-300', darkColor: 'bg-red-900 text-red-200 border-red-700' },
];

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function MobileJournalPage() {
    const [journal, setJournal] = useState<DailyJournal | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<JournalSection>('morning');
    const [isDark, setIsDark] = useState(false);
    const [inspirationalCollapsed, setInspirationalCollapsed] = useState(false);
    const [inspirationalContent, setInspirationalContent] = useState<InspirationalContent | null>(null);

    // Form states
    const [morningIntention, setMorningIntention] = useState('');
    const [energyMorning, setEnergyMorning] = useState<EnergyLevel | ''>('');
    const [energyNoon, setEnergyNoon] = useState<EnergyLevel | ''>('');
    const [energyAfternoon, setEnergyAfternoon] = useState<EnergyLevel | ''>('');
    const [energyNight, setEnergyNight] = useState<EnergyLevel | ''>('');
    const [bigRockText, setBigRockText] = useState('');
    const [bigRockCompleted, setBigRockCompleted] = useState(false);
    const [dailyTasks, setDailyTasks] = useState<TaskItem[]>([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [quickCaptures, setQuickCaptures] = useState<QuickCapture[]>([]);
    const [newCaptureText, setNewCaptureText] = useState('');
    const [wins, setWins] = useState<string[]>(['', '', '']);
    const [gratitudes, setGratitudes] = useState<string[]>(['', '', '']);
    const [learnings, setLearnings] = useState('');
    const [failures, setFailures] = useState('');
    const [forgivenessItems, setForgivenessItems] = useState<ForgivenessItem[]>([]);
    const [doDifferent, setDoDifferent] = useState('');
    const [noteToTomorrow, setNoteToTomorrow] = useState('');
    const [dayRating, setDayRating] = useState<number | null>(null);
    const [dayWord, setDayWord] = useState('');

    // Section completion states
    const [isMorningCompleted, setIsMorningCompleted] = useState(false);
    const [isDayCompleted, setIsDayCompleted] = useState(false);
    const [isEveningCompleted, setIsEveningCompleted] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced values for autosave
    const debouncedIntention = useDebounce(morningIntention, 1500);
    const debouncedBigRock = useDebounce(bigRockText, 1500);
    const debouncedLearnings = useDebounce(learnings, 1500);
    const debouncedFailures = useDebounce(failures, 1500);
    const debouncedDoDifferent = useDebounce(doDifferent, 1500);
    const debouncedNoteToTomorrow = useDebounce(noteToTomorrow, 1500);
    const debouncedDayWord = useDebounce(dayWord, 1500);

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

    const fetchJournal = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = {
                'Authorization': `Bearer ${session.data.session.access_token}`,
                'Content-Type': 'application/json',
            };

            // Try to get the journal
            let response = await fetch(`${API_URL}/api/v1/journal/${today}`, { headers });

            // If not found, create it
            if (response.status === 404) {
                response = await fetch(`${API_URL}/api/v1/journal`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ date: today }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                setJournal(data);
                populateForm(data);
            }
        } catch (error) {
            console.error('Error fetching journal:', error);
        } finally {
            setLoading(false);
        }
    }, [today]);

    const populateForm = (data: DailyJournal) => {
        setMorningIntention(data.morning_intention || '');
        setEnergyMorning((data.energy_morning as EnergyLevel) || '');
        setEnergyNoon((data.energy_noon as EnergyLevel) || '');
        setEnergyAfternoon((data.energy_afternoon as EnergyLevel) || '');
        setEnergyNight((data.energy_night as EnergyLevel) || '');
        setInspirationalContent(data.inspirational_content || null);
        setBigRockText(data.big_rock_text || '');
        setBigRockCompleted(data.big_rock_completed || false);
        setDailyTasks(data.daily_tasks || []);
        setQuickCaptures(data.quick_captures || []);
        setWins(data.wins?.length ? [...data.wins, '', '', ''].slice(0, 3) : ['', '', '']);
        setGratitudes(data.gratitudes?.length ? [...data.gratitudes, '', '', ''].slice(0, 3) : ['', '', '']);
        setLearnings(data.learnings || '');
        setFailures(data.failures || '');
        setForgivenessItems(data.forgiveness_items || []);
        setDoDifferent(data.do_different || '');
        setNoteToTomorrow(data.note_to_tomorrow || '');
        setDayRating(data.day_rating);
        setDayWord(data.day_word || '');
        setIsMorningCompleted(data.is_morning_completed || false);
        setIsDayCompleted(data.is_day_completed || false);
        setIsEveningCompleted(data.is_evening_completed || false);
    };

    useEffect(() => {
        fetchJournal();
    }, [fetchJournal]);

    const saveJournal = async (updates: Partial<DailyJournal>, showSaving = true) => {
        if (showSaving) setSaving(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/journal/${today}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(updates),
            });

            if (response.ok) {
                const data = await response.json();
                setJournal(data);
                // Update completion states from response
                setIsMorningCompleted(data.is_morning_completed);
                setIsDayCompleted(data.is_day_completed);
                setIsEveningCompleted(data.is_evening_completed);
            }
        } catch (error) {
            console.error('Error saving journal:', error);
        } finally {
            if (showSaving) setSaving(false);
        }
    };

    // Autosave effect for text fields
    useEffect(() => {
        if (!journal) return;

        const hasChanges =
            debouncedIntention !== (journal.morning_intention || '') ||
            debouncedBigRock !== (journal.big_rock_text || '') ||
            debouncedLearnings !== (journal.learnings || '') ||
            debouncedFailures !== (journal.failures || '') ||
            debouncedDoDifferent !== (journal.do_different || '') ||
            debouncedNoteToTomorrow !== (journal.note_to_tomorrow || '') ||
            debouncedDayWord !== (journal.day_word || '');

        if (hasChanges) {
            saveJournal({
                morning_intention: debouncedIntention || null,
                big_rock_text: debouncedBigRock || null,
                learnings: debouncedLearnings || null,
                failures: debouncedFailures || null,
                do_different: debouncedDoDifferent || null,
                note_to_tomorrow: debouncedNoteToTomorrow || null,
                day_word: debouncedDayWord || null,
            }, false);
        }
    }, [debouncedIntention, debouncedBigRock, debouncedLearnings, debouncedFailures, debouncedDoDifferent, debouncedNoteToTomorrow, debouncedDayWord]);

    // Toggle section completion
    const toggleSectionComplete = (section: JournalSection) => {
        if (section === 'morning') {
            const newValue = !isMorningCompleted;
            setIsMorningCompleted(newValue);
            saveJournal({ is_morning_completed: newValue });
        } else if (section === 'day') {
            const newValue = !isDayCompleted;
            setIsDayCompleted(newValue);
            saveJournal({ is_day_completed: newValue });
        } else {
            const newValue = !isEveningCompleted;
            setIsEveningCompleted(newValue);
            saveJournal({ is_evening_completed: newValue });
        }
    };

    // Energy handlers with immediate save
    const handleEnergyChange = (type: 'morning' | 'noon' | 'afternoon' | 'night', value: EnergyLevel) => {
        if (type === 'morning') {
            setEnergyMorning(value);
            saveJournal({ energy_morning: value }, false);
        } else if (type === 'noon') {
            setEnergyNoon(value);
            saveJournal({ energy_noon: value }, false);
        } else if (type === 'afternoon') {
            setEnergyAfternoon(value);
            saveJournal({ energy_afternoon: value }, false);
        } else {
            setEnergyNight(value);
            saveJournal({ energy_night: value }, false);
        }
    };

    // Big rock toggle
    const toggleBigRock = () => {
        const newValue = !bigRockCompleted;
        setBigRockCompleted(newValue);
        saveJournal({ big_rock_completed: newValue }, false);
    };

    // Task handlers
    const addTask = () => {
        if (!newTaskText.trim()) return;
        const newTask: TaskItem = {
            id: Date.now().toString(),
            text: newTaskText.trim(),
            completed: false,
        };
        const newTasks = [...dailyTasks, newTask];
        setDailyTasks(newTasks);
        setNewTaskText('');
        saveJournal({ daily_tasks: newTasks }, false);
    };

    const toggleTask = (id: string) => {
        const newTasks = dailyTasks.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        );
        setDailyTasks(newTasks);
        saveJournal({ daily_tasks: newTasks }, false);
    };

    const removeTask = (id: string) => {
        const newTasks = dailyTasks.filter(t => t.id !== id);
        setDailyTasks(newTasks);
        saveJournal({ daily_tasks: newTasks }, false);
    };

    // Quick capture handlers
    const addCapture = () => {
        if (!newCaptureText.trim()) return;
        const newCapture: QuickCapture = {
            id: Date.now().toString(),
            text: newCaptureText.trim(),
            timestamp: new Date().toISOString(),
        };
        const newCaptures = [...quickCaptures, newCapture];
        setQuickCaptures(newCaptures);
        setNewCaptureText('');
        saveJournal({ quick_captures: newCaptures }, false);
    };

    const removeCapture = (id: string) => {
        const newCaptures = quickCaptures.filter(c => c.id !== id);
        setQuickCaptures(newCaptures);
        saveJournal({ quick_captures: newCaptures }, false);
    };

    // Wins handler with debounced save
    const handleWinChange = (index: number, value: string) => {
        const newWins = [...wins];
        newWins[index] = value;
        setWins(newWins);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveJournal({ wins: newWins.filter(w => w.trim()) }, false);
        }, 1500);
    };

    // Gratitudes handler with debounced save
    const handleGratitudeChange = (index: number, value: string) => {
        const newGratitudes = [...gratitudes];
        newGratitudes[index] = value;
        setGratitudes(newGratitudes);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveJournal({ gratitudes: newGratitudes.filter(g => g.trim()) }, false);
        }, 1500);
    };

    // Day rating handler
    const handleRatingChange = (rating: number) => {
        setDayRating(rating);
        saveJournal({ day_rating: rating }, false);
    };

    // Forgiveness handlers
    const addForgivenessItem = (type: 'self' | 'other' | 'situation') => {
        const newItem: ForgivenessItem = {
            id: Date.now().toString(),
            text: '',
            type,
        };
        setForgivenessItems([...forgivenessItems, newItem]);
    };

    const updateForgivenessItem = (id: string, text: string) => {
        const newItems = forgivenessItems.map(item =>
            item.id === id ? { ...item, text } : item
        );
        setForgivenessItems(newItems);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveJournal({ forgiveness_items: newItems }, false);
        }, 1500);
    };

    const removeForgivenessItem = (id: string) => {
        const newItems = forgivenessItems.filter(item => item.id !== id);
        setForgivenessItems(newItems);
        saveJournal({ forgiveness_items: newItems }, false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const sections: { key: JournalSection; label: string; icon: string; completed: boolean }[] = [
        { key: 'morning', label: 'Mañana', icon: '🌅', completed: isMorningCompleted },
        { key: 'day', label: 'Día', icon: '☀️', completed: isDayCompleted },
        { key: 'evening', label: 'Noche', icon: '🌙', completed: isEveningCompleted },
    ];

    const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500';

    return (
        <div className="space-y-4">
            {/* Date header */}
            <div className="text-center">
                <h2 className={`text-lg font-semibold ${textClass}`}>
                    {new Date(today).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                    })}
                </h2>
                {saving && <p className={`text-xs ${mutedTextClass}`}>Guardando...</p>}
            </div>

            {/* Evangelio del día */}
            <a
                href="https://opusdei.org/es-es/gospel/"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isDark ? 'bg-purple-900/30 border-purple-700' : 'bg-purple-50 border-purple-200'
                }`}
            >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-purple-800' : 'bg-purple-200'
                }`}>
                    <span className="text-purple-500 text-xl">✝</span>
                </div>
                <div className="flex-1">
                    <p className={`font-medium text-sm ${isDark ? 'text-purple-200' : 'text-purple-800'}`}>
                        Evangelio del Día
                    </p>
                    <p className={`text-xs ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        Lectura y meditación diaria - Opus Dei
                    </p>
                </div>
                <svg className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
            </a>

            {/* Inspirational Content */}
            {inspirationalContent && (inspirationalContent.quote || inspirationalContent.refran || inspirationalContent.challenge || inspirationalContent.question || inspirationalContent.word) && (
                <div className="rounded-xl overflow-hidden">
                    <button
                        onClick={() => setInspirationalCollapsed(!inspirationalCollapsed)}
                        className="w-full bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 p-4 text-white text-left"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium">✨ Inspiración del día</span>
                            <span className={`transition-transform ${inspirationalCollapsed ? '' : 'rotate-180'}`}>▼</span>
                        </div>
                    </button>

                    {!inspirationalCollapsed && (
                        <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 px-4 pb-4 text-white space-y-4">
                            {/* Quote */}
                            {inspirationalContent.quote && (
                                <div>
                                    <p className="text-lg italic font-light">"{inspirationalContent.quote}"</p>
                                    {inspirationalContent.quote_author && (
                                        <p className="text-sm opacity-80 mt-1">- {inspirationalContent.quote_author}</p>
                                    )}
                                </div>
                            )}

                            {/* Divider */}
                            {inspirationalContent.quote && (inspirationalContent.refran || inspirationalContent.challenge || inspirationalContent.question) && (
                                <div className="border-t border-white/20" />
                            )}

                            {/* Refran */}
                            {inspirationalContent.refran && (
                                <div>
                                    <p className="text-xs uppercase tracking-wider opacity-70">Refrán del día:</p>
                                    <p className="font-medium">{inspirationalContent.refran}</p>
                                </div>
                            )}

                            {/* Challenge & Question */}
                            {(inspirationalContent.challenge || inspirationalContent.question) && (
                                <div className="grid grid-cols-1 gap-3">
                                    {inspirationalContent.challenge && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wider opacity-70">Reto</p>
                                            <p className="text-sm">{inspirationalContent.challenge}</p>
                                        </div>
                                    )}
                                    {inspirationalContent.question && (
                                        <div>
                                            <p className="text-xs uppercase tracking-wider opacity-70">Pregunta</p>
                                            <p className="text-sm">{inspirationalContent.question}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Divider */}
                            {(inspirationalContent.quote || inspirationalContent.refran || inspirationalContent.challenge || inspirationalContent.question) && inspirationalContent.word && (
                                <div className="border-t border-white/20" />
                            )}

                            {/* Word of the day */}
                            {inspirationalContent.word && (
                                <div className="text-center">
                                    <p className="text-xs uppercase tracking-wider opacity-70">Palabra del día</p>
                                    <p className="text-xl font-bold">{inspirationalContent.word}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Section tabs */}
            <div className={`flex gap-2 rounded-xl p-1 shadow-sm ${cardClass}`}>
                {sections.map((section) => (
                    <button
                        key={section.key}
                        onClick={() => setActiveSection(section.key)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${
                            activeSection === section.key
                                ? 'bg-amber-500 text-white'
                                : isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}
                    >
                        <span>{section.icon}</span>
                        <span className="ml-1">{section.label}</span>
                        {section.completed && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                                ✓
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Morning section */}
            {activeSection === 'morning' && (
                <div className="space-y-4">
                    {/* Intention */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🎯 Intención del día</h3>
                        <textarea
                            value={morningIntention}
                            onChange={(e) => setMorningIntention(e.target.value)}
                            placeholder="¿Cuál es tu intención para hoy?"
                            className={`w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Big Rock */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`font-medium ${textClass}`}>🪨 Roca Grande del Día</h3>
                            <button
                                onClick={toggleBigRock}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                    bigRockCompleted
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : isDark ? 'border-gray-600' : 'border-gray-300'
                                }`}
                            >
                                {bigRockCompleted && '✓'}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={bigRockText}
                            onChange={(e) => setBigRockText(e.target.value)}
                            placeholder="Lo más importante que debes lograr hoy"
                            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass} ${
                                bigRockCompleted ? 'line-through opacity-60' : ''
                            }`}
                        />
                    </div>

                    {/* Morning Energy */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energía de mañana</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleEnergyChange('morning', option.value)}
                                    className={`flex-1 py-3 rounded-lg border-2 text-center transition-colors ${
                                        energyMorning === option.value
                                            ? (isDark ? option.darkColor : option.color) + ' border-current'
                                            : isDark
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl">{option.icon}</div>
                                    <div className="text-xs mt-1">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Daily Tasks */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>✅ Tareas del día</h3>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                                placeholder="Nueva tarea..."
                                className={`flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                            <button
                                onClick={addTask}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                            >
                                +
                            </button>
                        </div>
                        <div className="space-y-2">
                            {dailyTasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleTask(task.id)}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                            task.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : isDark ? 'border-gray-600' : 'border-gray-300'
                                        }`}
                                    >
                                        {task.completed && '✓'}
                                    </button>
                                    <span className={`flex-1 text-sm ${task.completed ? 'line-through opacity-60' : ''} ${textClass}`}>
                                        {task.text}
                                    </span>
                                    <button
                                        onClick={() => removeTask(task.id)}
                                        className="text-red-500 text-xs px-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mark complete button */}
                    <button
                        onClick={() => toggleSectionComplete('morning')}
                        className={`w-full py-3 rounded-xl font-medium transition-colors ${
                            isMorningCompleted
                                ? 'bg-green-500 text-white'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                        }`}
                    >
                        {isMorningCompleted ? '✓ Mañana completada' : 'Marcar mañana como completada'}
                    </button>
                </div>
            )}

            {/* Day section */}
            {activeSection === 'day' && (
                <div className="space-y-4">
                    {/* Quick Captures */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📸 Capturas rápidas</h3>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newCaptureText}
                                onChange={(e) => setNewCaptureText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCapture()}
                                placeholder="Captura una idea, pensamiento..."
                                className={`flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                            <button
                                onClick={addCapture}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                            >
                                +
                            </button>
                        </div>
                        <div className="space-y-2">
                            {quickCaptures.map((capture) => (
                                <div key={capture.id} className={`flex items-start gap-2 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <span className={`flex-1 text-sm ${textClass}`}>{capture.text}</span>
                                    <button
                                        onClick={() => removeCapture(capture.id)}
                                        className="text-red-500 text-xs px-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Wins */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🏆 Victorias del día</h3>
                        {wins.map((win, index) => (
                            <input
                                key={index}
                                type="text"
                                value={win}
                                onChange={(e) => handleWinChange(index, e.target.value)}
                                placeholder={`Victoria ${index + 1}`}
                                className={`w-full p-3 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                        ))}
                    </div>

                    {/* Noon Energy */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energía del mediodía</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleEnergyChange('noon', option.value)}
                                    className={`flex-1 py-3 rounded-lg border-2 text-center transition-colors ${
                                        energyNoon === option.value
                                            ? (isDark ? option.darkColor : option.color) + ' border-current'
                                            : isDark
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl">{option.icon}</div>
                                    <div className="text-xs mt-1">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Afternoon Energy */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energía de tarde</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleEnergyChange('afternoon', option.value)}
                                    className={`flex-1 py-3 rounded-lg border-2 text-center transition-colors ${
                                        energyAfternoon === option.value
                                            ? (isDark ? option.darkColor : option.color) + ' border-current'
                                            : isDark
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl">{option.icon}</div>
                                    <div className="text-xs mt-1">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mark complete button */}
                    <button
                        onClick={() => toggleSectionComplete('day')}
                        className={`w-full py-3 rounded-xl font-medium transition-colors ${
                            isDayCompleted
                                ? 'bg-green-500 text-white'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                        }`}
                    >
                        {isDayCompleted ? '✓ Día completado' : 'Marcar día como completado'}
                    </button>
                </div>
            )}

            {/* Evening section */}
            {activeSection === 'evening' && (
                <div className="space-y-4">
                    {/* Gratitudes */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🙏 Gratitudes</h3>
                        {gratitudes.map((gratitude, index) => (
                            <input
                                key={index}
                                type="text"
                                value={gratitude}
                                onChange={(e) => handleGratitudeChange(index, e.target.value)}
                                placeholder={`Gratitud ${index + 1}`}
                                className={`w-full p-3 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                        ))}
                    </div>

                    {/* Learnings */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📚 Aprendizajes</h3>
                        <textarea
                            value={learnings}
                            onChange={(e) => setLearnings(e.target.value)}
                            placeholder="¿Qué aprendiste hoy?"
                            className={`w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Failures */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>❌ ¿Qué no salió bien?</h3>
                        <textarea
                            value={failures}
                            onChange={(e) => setFailures(e.target.value)}
                            placeholder="¿Qué falló o no salió como esperabas?"
                            className={`w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Forgiveness */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>💚 Perdón</h3>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => addForgivenessItem('self')}
                                className={`flex-1 py-2 text-xs rounded-lg ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-50 text-blue-700'}`}
                            >
                                + A mí
                            </button>
                            <button
                                onClick={() => addForgivenessItem('other')}
                                className={`flex-1 py-2 text-xs rounded-lg ${isDark ? 'bg-green-900 text-green-200' : 'bg-green-50 text-green-700'}`}
                            >
                                + A otros
                            </button>
                            <button
                                onClick={() => addForgivenessItem('situation')}
                                className={`flex-1 py-2 text-xs rounded-lg ${isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-50 text-purple-700'}`}
                            >
                                + Situación
                            </button>
                        </div>
                        {forgivenessItems.map((item) => (
                            <div key={item.id} className="flex gap-2 mb-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    item.type === 'self'
                                        ? (isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700')
                                        : item.type === 'other'
                                            ? (isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700')
                                            : (isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-700')
                                }`}>
                                    {item.type === 'self' ? '🙋' : item.type === 'other' ? '👥' : '📍'}
                                </span>
                                <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => updateForgivenessItem(item.id, e.target.value)}
                                    placeholder="¿Qué perdonas?"
                                    className={`flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                                />
                                <button
                                    onClick={() => removeForgivenessItem(item.id)}
                                    className="px-2 text-red-500"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Do Different */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🔄 ¿Qué harías diferente?</h3>
                        <textarea
                            value={doDifferent}
                            onChange={(e) => setDoDifferent(e.target.value)}
                            placeholder="Si pudieras repetir el día, ¿qué cambiarías?"
                            className={`w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Note to Tomorrow */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📝 Nota para mañana</h3>
                        <textarea
                            value={noteToTomorrow}
                            onChange={(e) => setNoteToTomorrow(e.target.value)}
                            placeholder="¿Qué quieres recordar mañana?"
                            className={`w-full h-20 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Night Energy */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energía de noche</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => handleEnergyChange('night', option.value)}
                                    className={`flex-1 py-3 rounded-lg border-2 text-center transition-colors ${
                                        energyNight === option.value
                                            ? (isDark ? option.darkColor : option.color) + ' border-current'
                                            : isDark
                                                ? 'bg-gray-700 border-gray-600 text-gray-400'
                                                : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <div className="text-2xl">{option.icon}</div>
                                    <div className="text-xs mt-1">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Day Rating */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⭐ Puntuación del día</h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {RATINGS.map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => handleRatingChange(rating)}
                                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                                        dayRating === rating
                                            ? 'bg-amber-500 text-white'
                                            : isDark
                                                ? 'bg-gray-700 text-gray-300'
                                                : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Day Word */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>💬 Palabra del día</h3>
                        <input
                            type="text"
                            value={dayWord}
                            onChange={(e) => setDayWord(e.target.value)}
                            placeholder="Una palabra que resuma tu día"
                            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    {/* Mark complete button */}
                    <button
                        onClick={() => toggleSectionComplete('evening')}
                        className={`w-full py-3 rounded-xl font-medium transition-colors ${
                            isEveningCompleted
                                ? 'bg-green-500 text-white'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                        }`}
                    >
                        {isEveningCompleted ? '✓ Noche completada' : 'Marcar noche como completada'}
                    </button>
                </div>
            )}
        </div>
    );
}
