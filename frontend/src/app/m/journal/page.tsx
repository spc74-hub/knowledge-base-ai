'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DailyJournal {
    id: string;
    date: string;
    morning_intention: string | null;
    energy_morning: string | null;
    energy_noon: string | null;
    energy_afternoon: string | null;
    energy_night: string | null;
    wins: string[];
    gratitudes: string[];
    learnings: string | null;
    forgiveness_items: ForgivenessItem[];
    day_rating: number | null;
    day_word: string | null;
    is_morning_completed: boolean;
    is_day_completed: boolean;
    is_evening_completed: boolean;
}

interface ForgivenessItem {
    id: string;
    text: string;
    type: 'self' | 'other' | 'situation';
}

type EnergyLevel = 'high' | 'medium' | 'low';
type JournalSection = 'morning' | 'day' | 'evening';

const ENERGY_OPTIONS: { value: EnergyLevel; icon: string; label: string; color: string; darkColor: string }[] = [
    { value: 'high', icon: '🔥', label: 'Alta', color: 'bg-green-100 text-green-700 border-green-300', darkColor: 'bg-green-900 text-green-200 border-green-700' },
    { value: 'medium', icon: '⚡', label: 'Media', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', darkColor: 'bg-yellow-900 text-yellow-200 border-yellow-700' },
    { value: 'low', icon: '🔋', label: 'Baja', color: 'bg-red-100 text-red-700 border-red-300', darkColor: 'bg-red-900 text-red-200 border-red-700' },
];

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MobileJournalPage() {
    const [journal, setJournal] = useState<DailyJournal | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<JournalSection>('morning');
    const [isDark, setIsDark] = useState(false);

    // Form states
    const [morningIntention, setMorningIntention] = useState('');
    const [energyMorning, setEnergyMorning] = useState<EnergyLevel | ''>('');
    const [energyNoon, setEnergyNoon] = useState<EnergyLevel | ''>('');
    const [energyAfternoon, setEnergyAfternoon] = useState<EnergyLevel | ''>('');
    const [energyNight, setEnergyNight] = useState<EnergyLevel | ''>('');
    const [wins, setWins] = useState<string[]>(['', '', '']);
    const [gratitudes, setGratitudes] = useState<string[]>(['', '', '']);
    const [learnings, setLearnings] = useState('');
    const [forgivenessItems, setForgivenessItems] = useState<ForgivenessItem[]>([]);
    const [dayRating, setDayRating] = useState<number | null>(null);
    const [dayWord, setDayWord] = useState('');

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

    const fetchJournal = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/journal/${today}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setJournal(data);
                // Populate form
                setMorningIntention(data.morning_intention || '');
                setEnergyMorning(data.energy_morning || '');
                setEnergyNoon(data.energy_noon || '');
                setEnergyAfternoon(data.energy_afternoon || '');
                setEnergyNight(data.energy_night || '');
                setWins(data.wins?.length ? [...data.wins, '', '', ''].slice(0, 3) : ['', '', '']);
                setGratitudes(data.gratitudes?.length ? [...data.gratitudes, '', '', ''].slice(0, 3) : ['', '', '']);
                setLearnings(data.learnings || '');
                setForgivenessItems(data.forgiveness_items || []);
                setDayRating(data.day_rating);
                setDayWord(data.day_word || '');
            }
        } catch (error) {
            console.error('Error fetching journal:', error);
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => {
        fetchJournal();
    }, [fetchJournal]);

    const saveJournal = async (updates: Partial<DailyJournal>) => {
        setSaving(true);
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
            }
        } catch (error) {
            console.error('Error saving journal:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMorning = () => {
        saveJournal({
            morning_intention: morningIntention,
            energy_morning: energyMorning || null,
            is_morning_completed: true,
        });
    };

    const handleSaveDay = () => {
        const filteredWins = wins.filter(w => w.trim());
        saveJournal({
            wins: filteredWins,
            energy_noon: energyNoon || null,
            energy_afternoon: energyAfternoon || null,
            is_day_completed: true,
        });
    };

    const handleSaveEvening = () => {
        const filteredGratitudes = gratitudes.filter(g => g.trim());
        saveJournal({
            gratitudes: filteredGratitudes,
            learnings,
            forgiveness_items: forgivenessItems,
            energy_night: energyNight || null,
            day_rating: dayRating,
            day_word: dayWord,
            is_evening_completed: true,
        });
    };

    const addForgivenessItem = (type: 'self' | 'other' | 'situation') => {
        const newItem: ForgivenessItem = {
            id: Date.now().toString(),
            text: '',
            type,
        };
        setForgivenessItems([...forgivenessItems, newItem]);
    };

    const updateForgivenessItem = (id: string, text: string) => {
        setForgivenessItems(forgivenessItems.map(item =>
            item.id === id ? { ...item, text } : item
        ));
    };

    const removeForgivenessItem = (id: string) => {
        setForgivenessItems(forgivenessItems.filter(item => item.id !== id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const sections: { key: JournalSection; label: string; icon: string; completed: boolean }[] = [
        { key: 'morning', label: 'Manana', icon: '🌅', completed: journal?.is_morning_completed || false },
        { key: 'day', label: 'Dia', icon: '☀️', completed: journal?.is_day_completed || false },
        { key: 'evening', label: 'Noche', icon: '🌙', completed: journal?.is_evening_completed || false },
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
            </div>

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
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🎯 Intencion del dia</h3>
                        <textarea
                            value={morningIntention}
                            onChange={(e) => setMorningIntention(e.target.value)}
                            placeholder="¿Cual es tu intencion para hoy?"
                            className={`w-full h-24 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energia de manana</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setEnergyMorning(option.value)}
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

                    <button
                        onClick={handleSaveMorning}
                        disabled={saving}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                        {saving ? 'Guardando...' : journal?.is_morning_completed ? 'Actualizar Manana' : 'Completar Manana'}
                    </button>
                </div>
            )}

            {/* Day section */}
            {activeSection === 'day' && (
                <div className="space-y-4">
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🏆 Victorias del dia</h3>
                        {wins.map((win, index) => (
                            <input
                                key={index}
                                type="text"
                                value={win}
                                onChange={(e) => {
                                    const newWins = [...wins];
                                    newWins[index] = e.target.value;
                                    setWins(newWins);
                                }}
                                placeholder={`Victoria ${index + 1}`}
                                className={`w-full p-3 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                        ))}
                    </div>

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energia del mediodia</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setEnergyNoon(option.value)}
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

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energia de tarde</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setEnergyAfternoon(option.value)}
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

                    <button
                        onClick={handleSaveDay}
                        disabled={saving}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                        {saving ? 'Guardando...' : journal?.is_day_completed ? 'Actualizar Dia' : 'Completar Dia'}
                    </button>
                </div>
            )}

            {/* Evening section */}
            {activeSection === 'evening' && (
                <div className="space-y-4">
                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>🙏 Gratitudes</h3>
                        {gratitudes.map((gratitude, index) => (
                            <input
                                key={index}
                                type="text"
                                value={gratitude}
                                onChange={(e) => {
                                    const newGratitudes = [...gratitudes];
                                    newGratitudes[index] = e.target.value;
                                    setGratitudes(newGratitudes);
                                }}
                                placeholder={`Gratitud ${index + 1}`}
                                className={`w-full p-3 border rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                            />
                        ))}
                    </div>

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📚 Aprendizajes</h3>
                        <textarea
                            value={learnings}
                            onChange={(e) => setLearnings(e.target.value)}
                            placeholder="¿Que aprendiste hoy?"
                            className={`w-full h-24 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>💚 Perdon</h3>
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => addForgivenessItem('self')}
                                className={`flex-1 py-2 text-xs rounded-lg ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-50 text-blue-700'}`}
                            >
                                + A mi
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
                                + Situacion
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
                                    placeholder="¿Que perdonas?"
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

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⚡ Energia de noche</h3>
                        <div className="flex gap-2">
                            {ENERGY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setEnergyNight(option.value)}
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

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>⭐ Puntuacion del dia</h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {RATINGS.map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setDayRating(rating)}
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

                    <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                        <h3 className={`font-medium mb-3 ${textClass}`}>📝 Palabra del dia</h3>
                        <input
                            type="text"
                            value={dayWord}
                            onChange={(e) => setDayWord(e.target.value)}
                            placeholder="Una palabra que resuma tu dia"
                            className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputClass}`}
                        />
                    </div>

                    <button
                        onClick={handleSaveEvening}
                        disabled={saving}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                        {saving ? 'Guardando...' : journal?.is_evening_completed ? 'Actualizar Noche' : 'Completar Noche'}
                    </button>
                </div>
            )}
        </div>
    );
}
