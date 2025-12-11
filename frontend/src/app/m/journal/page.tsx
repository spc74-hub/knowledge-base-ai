'use client';

import { useState, useEffect, useRef } from 'react';
import { useTodayJournal, useUpdateTodayJournal, useCloseDay, useAddQuickCapture, useRefreshInspirational, BigRockItem, JOURNAL_KEYS } from '@/hooks/use-journal';
import { useQueryClient } from '@tanstack/react-query';
import { useObjectivesTree } from '@/hooks/use-objectives';
import { useProjectsTree } from '@/hooks/use-projects';

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
    const queryClient = useQueryClient();
    const { data: journal, isLoading, error } = useTodayJournal();
    const updateJournal = useUpdateTodayJournal();
    const closeDay = useCloseDay();
    const addQuickCapture = useAddQuickCapture();
    const refreshInspirational = useRefreshInspirational();
    const { data: objectives } = useObjectivesTree();
    const { data: projects } = useProjectsTree();

    const [activeSection, setActiveSection] = useState<JournalSection>('morning');
    const [isDark, setIsDark] = useState(false);
    const [inspirationalCollapsed, setInspirationalCollapsed] = useState(false);

    // Form states
    const [morningIntention, setMorningIntention] = useState('');
    const [energyMorning, setEnergyMorning] = useState<EnergyLevel | ''>('');
    const [energyNoon, setEnergyNoon] = useState<EnergyLevel | ''>('');
    const [energyAfternoon, setEnergyAfternoon] = useState<EnergyLevel | ''>('');
    const [energyNight, setEnergyNight] = useState<EnergyLevel | ''>('');
    const [bigRocks, setBigRocks] = useState<BigRockItem[]>([]);
    const [bigRocksCount, setBigRocksCount] = useState(3);
    const [newCaptureText, setNewCaptureText] = useState('');
    const [wins, setWins] = useState<string[]>(['', '', '']);
    const [gratitudes, setGratitudes] = useState<string[]>(['', '', '']);
    const [learnings, setLearnings] = useState('');
    const [failures, setFailures] = useState('');
    const [doDifferent, setDoDifferent] = useState('');
    const [noteToTomorrow, setNoteToTomorrow] = useState('');
    const [dayRating, setDayRating] = useState<number | null>(null);
    const [dayWord, setDayWord] = useState('');
    const [showBigRockSelector, setShowBigRockSelector] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced values for autosave
    const debouncedIntention = useDebounce(morningIntention, 1500);
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

    // Populate form when journal loads
    useEffect(() => {
        if (journal) {
            setMorningIntention(journal.morning_intention || '');
            setEnergyMorning((journal.energy_morning as EnergyLevel) || '');
            setEnergyNoon((journal.energy_noon as EnergyLevel) || '');
            setEnergyAfternoon((journal.energy_afternoon as EnergyLevel) || '');
            setEnergyNight((journal.energy_night as EnergyLevel) || '');
            setBigRocks(journal.big_rocks || []);
            setBigRocksCount(journal.big_rocks_count || 3);
            setWins(journal.wins?.length ? [...journal.wins, '', '', ''].slice(0, 3) : ['', '', '']);
            setGratitudes(journal.gratitudes?.length ? [...journal.gratitudes, '', '', ''].slice(0, 3) : ['', '', '']);
            setLearnings(journal.learnings || '');
            setFailures(journal.failures || '');
            setDoDifferent(journal.do_different || '');
            setNoteToTomorrow(journal.note_to_tomorrow || '');
            setDayRating(journal.day_rating);
            setDayWord(journal.day_word || '');
        }
    }, [journal]);

    // Autosave effect for text fields
    useEffect(() => {
        if (!journal) return;

        const hasChanges =
            debouncedIntention !== (journal.morning_intention || '') ||
            debouncedLearnings !== (journal.learnings || '') ||
            debouncedFailures !== (journal.failures || '') ||
            debouncedDoDifferent !== (journal.do_different || '') ||
            debouncedNoteToTomorrow !== (journal.note_to_tomorrow || '') ||
            debouncedDayWord !== (journal.day_word || '');

        if (hasChanges) {
            updateJournal.mutate({
                morning_intention: debouncedIntention || undefined,
                learnings: debouncedLearnings || undefined,
                failures: debouncedFailures || undefined,
                do_different: debouncedDoDifferent || undefined,
                note_to_tomorrow: debouncedNoteToTomorrow || undefined,
                day_word: debouncedDayWord || undefined,
            });
        }
    }, [debouncedIntention, debouncedLearnings, debouncedFailures, debouncedDoDifferent, debouncedNoteToTomorrow, debouncedDayWord]);

    // Energy handlers with immediate save
    const handleEnergyChange = (type: 'morning' | 'noon' | 'afternoon' | 'night', value: EnergyLevel) => {
        if (type === 'morning') {
            setEnergyMorning(value);
            updateJournal.mutate({ energy_morning: value });
        } else if (type === 'noon') {
            setEnergyNoon(value);
            updateJournal.mutate({ energy_noon: value });
        } else if (type === 'afternoon') {
            setEnergyAfternoon(value);
            updateJournal.mutate({ energy_afternoon: value });
        } else {
            setEnergyNight(value);
            updateJournal.mutate({ energy_night: value });
        }
    };

    // Big Rocks handlers
    const handleBigRocksCountChange = (count: number) => {
        setBigRocksCount(count);
        updateJournal.mutate({ big_rocks_count: count });
    };

    const addBigRock = (rock: Omit<BigRockItem, 'id' | 'order'>) => {
        const newRock: BigRockItem = {
            ...rock,
            id: Date.now().toString(),
            order: bigRocks.length,
        };
        const newRocks = [...bigRocks, newRock];
        setBigRocks(newRocks);
        updateJournal.mutate({ big_rocks: newRocks });
        setShowBigRockSelector(false);
    };

    const toggleBigRock = (id: string) => {
        const newRocks = bigRocks.map(r =>
            r.id === id ? { ...r, completed: !r.completed } : r
        );
        setBigRocks(newRocks);
        updateJournal.mutate({ big_rocks: newRocks });
    };

    const removeBigRock = (id: string) => {
        const newRocks = bigRocks.filter(r => r.id !== id);
        setBigRocks(newRocks);
        updateJournal.mutate({ big_rocks: newRocks });
    };

    // Quick capture handler
    const handleAddCapture = () => {
        if (!newCaptureText.trim()) return;
        addQuickCapture.mutate(newCaptureText.trim());
        setNewCaptureText('');
    };

    // Wins handler with debounced save
    const handleWinChange = (index: number, value: string) => {
        const newWins = [...wins];
        newWins[index] = value;
        setWins(newWins);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            updateJournal.mutate({ wins: newWins.filter(w => w.trim()) });
        }, 1500);
    };

    // Gratitudes handler with debounced save
    const handleGratitudeChange = (index: number, value: string) => {
        const newGratitudes = [...gratitudes];
        newGratitudes[index] = value;
        setGratitudes(newGratitudes);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            updateJournal.mutate({ gratitudes: newGratitudes.filter(g => g.trim()) });
        }, 1500);
    };

    // Day rating handler
    const handleRatingChange = (rating: number) => {
        setDayRating(rating);
        updateJournal.mutate({ day_rating: rating });
    };

    // Close day handler
    const handleCloseDay = async () => {
        setIsClosing(true);
        try {
            await closeDay.mutateAsync();
            setShowCloseConfirm(false);
        } catch (error) {
            console.error('Error closing day:', error);
        } finally {
            setIsClosing(false);
        }
    };

    // Refresh inspirational content handler
    const handleRefreshInspirational = async () => {
        try {
            const newContent = await refreshInspirational.mutateAsync();
            if (newContent && journal) {
                updateJournal.mutate({ inspirational_content: newContent } as any);
            }
            queryClient.invalidateQueries({ queryKey: JOURNAL_KEYS.today });
        } catch (error) {
            console.error('Error refreshing inspirational content:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-red-500">Error loading journal</p>
            </div>
        );
    }

    const isMorningCompleted = journal?.is_morning_completed || false;
    const isDayCompleted = journal?.is_day_completed || false;
    const isEveningCompleted = journal?.is_evening_completed || false;
    const inspirationalContent = journal?.inspirational_content;

    const sections: { key: JournalSection; label: string; icon: string; completed: boolean }[] = [
        { key: 'morning', label: 'Mañana', icon: '🌅', completed: isMorningCompleted },
        { key: 'day', label: 'Inbox', icon: '📥', completed: isDayCompleted },
        { key: 'evening', label: 'Cierre', icon: '🌙', completed: isEveningCompleted },
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
                {updateJournal.isPending && <p className={`text-xs ${mutedTextClass}`}>Guardando...</p>}
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
                    <div className="flex items-center bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 p-4 text-white">
                        <button
                            onClick={() => setInspirationalCollapsed(!inspirationalCollapsed)}
                            className="flex-1 text-left"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">✨ Inspiración del día</span>
                                <span className={`transition-transform ${inspirationalCollapsed ? '' : 'rotate-180'}`}>▼</span>
                            </div>
                        </button>
                        <button
                            onClick={handleRefreshInspirational}
                            disabled={refreshInspirational.isPending}
                            className="ml-3 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all disabled:opacity-50"
                            title="Obtener nuevo contenido"
                        >
                            <svg
                                className={`w-4 h-4 ${refreshInspirational.isPending ? 'animate-spin' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {!inspirationalCollapsed && (
                        <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 px-4 pb-4 text-white space-y-4">
                            {inspirationalContent.quote && (
                                <div>
                                    <p className="text-lg italic font-light">"{inspirationalContent.quote}"</p>
                                    {inspirationalContent.quote_author && (
                                        <p className="text-sm opacity-80 mt-1">- {inspirationalContent.quote_author}</p>
                                    )}
                                </div>
                            )}

                            {inspirationalContent.quote && (inspirationalContent.refran || inspirationalContent.challenge || inspirationalContent.question) && (
                                <div className="border-t border-white/20" />
                            )}

                            {inspirationalContent.refran && (
                                <div>
                                    <p className="text-xs uppercase tracking-wider opacity-70">Refrán del día:</p>
                                    <p className="font-medium">{inspirationalContent.refran}</p>
                                </div>
                            )}

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

                            {(inspirationalContent.quote || inspirationalContent.refran || inspirationalContent.challenge || inspirationalContent.question) && inspirationalContent.word && (
                                <div className="border-t border-white/20" />
                            )}

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

                    {/* Big Rocks - Configurable */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`font-medium ${textClass}`}>🪨 Rocas Grandes ({bigRocks.length}/{bigRocksCount})</h3>
                            <select
                                value={bigRocksCount}
                                onChange={(e) => handleBigRocksCountChange(Number(e.target.value))}
                                className={`text-sm p-1 rounded border ${inputClass}`}
                            >
                                {[1, 2, 3, 4, 5].map(n => (
                                    <option key={n} value={n}>{n} roca{n > 1 ? 's' : ''}</option>
                                ))}
                            </select>
                        </div>

                        {/* Existing Big Rocks */}
                        <div className="space-y-2 mb-3">
                            {bigRocks.map((rock) => (
                                <div key={rock.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <button
                                        onClick={() => toggleBigRock(rock.id)}
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                            rock.completed
                                                ? 'bg-green-500 border-green-500 text-white'
                                                : isDark ? 'border-gray-500' : 'border-gray-300'
                                        }`}
                                    >
                                        {rock.completed && '✓'}
                                    </button>
                                    <span className={`flex-1 text-sm ${rock.completed ? 'line-through opacity-60' : ''} ${textClass}`}>
                                        {rock.text}
                                        {rock.type !== 'custom' && (
                                            <span className={`ml-2 text-xs px-1 py-0.5 rounded ${
                                                rock.type === 'objective'
                                                    ? (isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700')
                                                    : (isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-700')
                                            }`}>
                                                {rock.type === 'objective' ? 'OBJ' : 'PROY'}
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        onClick={() => removeBigRock(rock.id)}
                                        className="text-red-500 text-xs px-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Big Rock Button */}
                        {bigRocks.length < bigRocksCount && (
                            <button
                                onClick={() => setShowBigRockSelector(true)}
                                className={`w-full py-2 rounded-lg border-2 border-dashed ${
                                    isDark ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
                                }`}
                            >
                                + Añadir roca grande
                            </button>
                        )}
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

                    {/* Mark complete button */}
                    <button
                        onClick={() => updateJournal.mutate({ is_morning_completed: !isMorningCompleted })}
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

            {/* Day section (Inbox) */}
            {activeSection === 'day' && (
                <div className="space-y-4">
                    {/* Quick Captures / Inbox */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📥 Inbox - Capturas rápidas</h3>
                        <p className={`text-xs mb-3 ${mutedTextClass}`}>Captura todo aquí. Clasifica después.</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newCaptureText}
                                onChange={(e) => setNewCaptureText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCapture()}
                                placeholder="Idea, tarea, pensamiento..."
                                className={`flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                            <button
                                onClick={handleAddCapture}
                                disabled={addQuickCapture.isPending}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                            >
                                +
                            </button>
                        </div>
                        <div className="space-y-2">
                            {journal?.quick_captures?.map((capture) => (
                                <div key={capture.id} className={`flex items-start gap-2 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                    <span className={`flex-1 text-sm ${textClass}`}>{capture.text}</span>
                                    <span className={`text-xs ${mutedTextClass}`}>
                                        {new Date(capture.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            {(!journal?.quick_captures || journal.quick_captures.length === 0) && (
                                <p className={`text-center text-sm py-4 ${mutedTextClass}`}>
                                    Sin capturas aún. ¡Empieza a capturar!
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Energy tracking during day */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energía del día</h3>
                        <div className="space-y-3">
                            <div>
                                <p className={`text-xs mb-2 ${mutedTextClass}`}>Mediodía</p>
                                <div className="flex gap-2">
                                    {ENERGY_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleEnergyChange('noon', option.value)}
                                            className={`flex-1 py-2 rounded-lg border text-center text-sm ${
                                                energyNoon === option.value
                                                    ? (isDark ? option.darkColor : option.color)
                                                    : isDark ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {option.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className={`text-xs mb-2 ${mutedTextClass}`}>Tarde</p>
                                <div className="flex gap-2">
                                    {ENERGY_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleEnergyChange('afternoon', option.value)}
                                            className={`flex-1 py-2 rounded-lg border text-center text-sm ${
                                                energyAfternoon === option.value
                                                    ? (isDark ? option.darkColor : option.color)
                                                    : isDark ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {option.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
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

                    {/* Mark complete button */}
                    <button
                        onClick={() => updateJournal.mutate({ is_day_completed: !isDayCompleted })}
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

            {/* Evening section (Cierre) */}
            {activeSection === 'evening' && (
                <div className="space-y-4">
                    {/* Review Big Rocks */}
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🪨 Revisión de Rocas Grandes</h3>
                        {bigRocks.length > 0 ? (
                            <div className="space-y-2">
                                {bigRocks.map((rock) => (
                                    <div key={rock.id} className={`flex items-center gap-2 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                                        <button
                                            onClick={() => toggleBigRock(rock.id)}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                rock.completed
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : isDark ? 'border-gray-500' : 'border-gray-300'
                                            }`}
                                        >
                                            {rock.completed && '✓'}
                                        </button>
                                        <span className={`flex-1 text-sm ${rock.completed ? 'line-through opacity-60' : ''} ${textClass}`}>
                                            {rock.text}
                                        </span>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <p className={`text-sm ${mutedTextClass}`}>
                                        Completadas: {bigRocks.filter(r => r.completed).length}/{bigRocks.length}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className={`text-sm ${mutedTextClass}`}>No definiste rocas grandes hoy</p>
                        )}
                    </div>

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

                    {/* Close Day Button */}
                    {!journal?.generated_note_id ? (
                        <button
                            onClick={() => setShowCloseConfirm(true)}
                            className="w-full py-4 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                        >
                            🌙 Cerrar Día y Generar Nota
                        </button>
                    ) : (
                        <div className={`p-4 rounded-xl border ${isDark ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center gap-2">
                                <span className="text-green-500 text-xl">✓</span>
                                <div>
                                    <p className={`font-medium ${isDark ? 'text-green-200' : 'text-green-800'}`}>Día cerrado</p>
                                    <p className={`text-xs ${isDark ? 'text-green-300' : 'text-green-600'}`}>Tu Full Note fue generada</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Big Rock Selector Modal */}
            {showBigRockSelector && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div className={`w-full max-h-[80vh] overflow-y-auto rounded-t-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="sticky top-0 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-inherit">
                            <h3 className={`font-semibold ${textClass}`}>Añadir Roca Grande</h3>
                            <button onClick={() => setShowBigRockSelector(false)} className="text-gray-500">✕</button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Custom */}
                            <div>
                                <h4 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Personalizada</h4>
                                <input
                                    type="text"
                                    placeholder="Escribe tu roca grande..."
                                    className={`w-full p-3 border rounded-lg ${inputClass}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                            addBigRock({ text: e.currentTarget.value.trim(), type: 'custom', ref_id: null, completed: false });
                                        }
                                    }}
                                />
                            </div>

                            {/* From Objectives */}
                            {objectives && objectives.length > 0 && (
                                <div>
                                    <h4 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>De tus Objetivos</h4>
                                    <div className="space-y-2">
                                        {objectives.filter(o => o.status === 'active').slice(0, 5).map((obj) => (
                                            <button
                                                key={obj.id}
                                                onClick={() => addBigRock({ text: obj.title, type: 'objective', ref_id: obj.id, completed: false })}
                                                className={`w-full p-3 text-left rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-blue-50 border-blue-200'}`}
                                            >
                                                <span className={`text-sm ${textClass}`}>{obj.title}</span>
                                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'}`}>
                                                    Objetivo
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* From Projects */}
                            {projects && projects.length > 0 && (
                                <div>
                                    <h4 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>De tus Proyectos</h4>
                                    <div className="space-y-2">
                                        {projects.filter(p => p.status === 'active').slice(0, 5).map((proj) => (
                                            <button
                                                key={proj.id}
                                                onClick={() => addBigRock({ text: proj.name, type: 'project', ref_id: proj.id, completed: false })}
                                                className={`w-full p-3 text-left rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-purple-50 border-purple-200'}`}
                                            >
                                                <span className={`text-sm ${textClass}`}>{proj.name}</span>
                                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-700'}`}>
                                                    Proyecto
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Close Day Confirmation Modal */}
            {showCloseConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <h3 className={`text-lg font-semibold mb-2 ${textClass}`}>🌙 Cerrar el día</h3>
                        <p className={`text-sm mb-4 ${mutedTextClass}`}>
                            Se generará una Full Note con el resumen de tu día usando IA.
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCloseConfirm(false)}
                                className={`flex-1 py-2 rounded-lg border ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'}`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCloseDay}
                                disabled={isClosing}
                                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium disabled:opacity-50"
                            >
                                {isClosing ? 'Generando...' : 'Cerrar día'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
