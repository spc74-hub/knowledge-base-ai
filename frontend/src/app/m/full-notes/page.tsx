'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

interface FullNote {
    id: string;
    title: string;
    summary: string | null;
    raw_content?: string;
    user_tags: string[];
    priority: string | null;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
}

const PRIORITIES = {
    important: { label: 'Importante', icon: '🔴', color: 'bg-red-500' },
    urgent: { label: 'Urgente', icon: '🟠', color: 'bg-orange-500' },
    A: { label: 'A', icon: '🔵', color: 'bg-blue-500' },
    B: { label: 'B', icon: '🔷', color: 'bg-blue-400' },
    C: { label: 'C', icon: '🩵', color: 'bg-cyan-400' },
} as const;

const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
};

export default function MobileFullNotesPage() {
    const [notes, setNotes] = useState<FullNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [isDark, setIsDark] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

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

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                setLoading(false);
                return;
            }

            const params = new URLSearchParams({
                type: 'note',
                per_page: '100',
                sort_by: 'updated_at',
                sort_order: 'desc',
            });

            if (appliedSearch) {
                params.set('q', appliedSearch);
            }

            const response = await fetch(`${API_URL}/api/v1/content/?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const result = await response.json();
                setNotes(result.data || []);
            } else {
                console.error('Error fetching full notes:', response.status);
            }
        } catch (error) {
            console.error('Error fetching full notes:', error);
        } finally {
            setLoading(false);
        }
    }, [appliedSearch]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const toggleFavorite = async (note: FullNote, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/content/${note.id}/favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setNotes(prev => prev.map(n =>
                    n.id === note.id ? { ...n, is_favorite: !n.is_favorite } : n
                ));
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleSearch = () => {
        setAppliedSearch(searchQuery);
    };

    const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardClass = isDark ? 'bg-gray-800' : 'bg-white';
    const textClass = isDark ? 'text-white' : 'text-gray-900';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
    const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';

    if (loading) {
        return (
            <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${bgClass} pb-20`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 ${cardClass} border-b ${borderClass} px-4 py-3`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/m/dashboard" className={mutedTextClass}>
                            ←
                        </Link>
                        <h1 className={`text-lg font-bold ${textClass}`}>
                            📄 Full Notes
                        </h1>
                        <span className={`text-sm ${mutedTextClass}`}>
                            ({notes.length})
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSearch(!showSearch)}
                            className={`p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                        >
                            🔍
                        </button>
                        <Link
                            href="/m/full-notes/new"
                            className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium"
                        >
                            + Nueva
                        </Link>
                    </div>
                </div>

                {/* Search bar */}
                {showSearch && (
                    <div className="mt-3 flex gap-2">
                        <input
                            type="text"
                            placeholder="Buscar en notas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className={`flex-1 px-4 py-2 rounded-lg border ${
                                isDark
                                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                            }`}
                            autoFocus
                        />
                        <button
                            onClick={handleSearch}
                            className="px-3 py-2 bg-indigo-500 text-white rounded-lg"
                        >
                            Buscar
                        </button>
                        {appliedSearch && (
                            <button
                                onClick={() => { setSearchQuery(''); setAppliedSearch(''); }}
                                className={`px-3 py-2 ${mutedTextClass}`}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Notes list */}
            <div className="p-4 space-y-3">
                {notes.length === 0 ? (
                    <div className={`${cardClass} rounded-xl p-8 text-center`}>
                        <div className="text-5xl mb-4">📄</div>
                        <h2 className={`text-lg font-semibold mb-2 ${textClass}`}>
                            {appliedSearch ? 'No se encontraron notas' : 'No tienes Full Notes'}
                        </h2>
                        <p className={`text-sm mb-4 ${mutedTextClass}`}>
                            {appliedSearch
                                ? 'Intenta con otros términos'
                                : 'Las Full Notes son notas completas con editor enriquecido.'
                            }
                        </p>
                        {!appliedSearch && (
                            <Link
                                href="/m/full-notes/new"
                                className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm"
                            >
                                Crear primera nota
                            </Link>
                        )}
                    </div>
                ) : (
                    notes.map(note => (
                        <Link
                            key={note.id}
                            href={`/m/full-notes/${note.id}`}
                            className={`block ${cardClass} rounded-xl p-4 border ${borderClass}`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h3 className={`font-semibold ${textClass} line-clamp-2 flex-1`}>
                                    {note.title || 'Sin título'}
                                </h3>
                                <button
                                    onClick={(e) => toggleFavorite(note, e)}
                                    className="text-lg flex-shrink-0 ml-2"
                                >
                                    {note.is_favorite ? '★' : '☆'}
                                </button>
                            </div>

                            <p className={`text-sm ${mutedTextClass} line-clamp-2 mb-3`}>
                                {note.summary || stripHtmlTags(note.raw_content || '').slice(0, 120) || 'Sin contenido'}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {note.priority && (
                                        <span className={`w-2 h-2 rounded-full ${PRIORITIES[note.priority as keyof typeof PRIORITIES]?.color || 'bg-gray-400'}`} />
                                    )}
                                    {note.user_tags && note.user_tags.length > 0 && (
                                        <span className={`text-xs ${mutedTextClass}`}>
                                            {note.user_tags.slice(0, 2).join(', ')}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-xs ${mutedTextClass}`}>
                                    {new Date(note.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
