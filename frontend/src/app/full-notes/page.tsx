'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    important: { label: 'Importante', icon: '🔴', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    urgent: { label: 'Urgente', icon: '🟠', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    A: { label: 'A', icon: '🔵', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    B: { label: 'B', icon: '🔷', color: 'bg-blue-50 text-blue-600 dark:bg-blue-800 dark:text-blue-300' },
    C: { label: 'C', icon: '🩵', color: 'bg-sky-50 text-sky-500 dark:bg-sky-900 dark:text-sky-300' },
} as const;

// Helper function to strip HTML tags for preview text
const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
};

export default function FullNotesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [notes, setNotes] = useState<FullNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'title'>('updated_at');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [totalNotes, setTotalNotes] = useState(0);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                console.log('No session');
                setLoading(false);
                return;
            }

            const params = new URLSearchParams({
                type: 'note',
                per_page: '100',
                sort_by: sortBy,
                sort_order: sortOrder,
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
                setTotalNotes(result.meta?.total || result.data?.length || 0);
            } else {
                console.error('Error fetching full notes:', response.status);
            }
        } catch (error) {
            console.error('Error fetching full notes:', error);
        } finally {
            setLoading(false);
        }
    }, [appliedSearch, sortBy, sortOrder]);

    useEffect(() => {
        if (user) {
            fetchNotes();
        }
    }, [user, fetchNotes]);

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setAppliedSearch(searchQuery);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            ← Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                            <span>📄</span> Full Notes
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({totalNotes} notas)
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <Link
                            href="/notes/new"
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 font-medium shadow-md"
                        >
                            + Nueva Full Note
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Filters bar */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 mb-6">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 flex gap-2">
                            <input
                                type="text"
                                placeholder="Buscar en notas... (Enter)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 px-4 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                            />
                            {appliedSearch && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); setAppliedSearch(''); }}
                                    className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {/* Sort */}
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                            >
                                <option value="updated_at">Última edición</option>
                                <option value="created_at">Fecha creación</option>
                                <option value="title">Título</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                                className="px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                                title={sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}
                            >
                                {sortOrder === 'desc' ? '↓' : '↑'}
                            </button>
                        </div>
                    </form>
                    {appliedSearch && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Buscando: &quot;{appliedSearch}&quot;
                        </p>
                    )}
                </div>

                {/* Notes list */}
                {notes.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-12 text-center">
                        <div className="text-6xl mb-4">📄</div>
                        <h2 className="text-xl font-semibold mb-2 dark:text-white">
                            {appliedSearch ? 'No se encontraron notas' : 'No tienes Full Notes'}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            {appliedSearch
                                ? 'Intenta con otros términos de búsqueda'
                                : 'Las Full Notes son notas completas con editor enriquecido que se guardan como contenido.'
                            }
                        </p>
                        {!appliedSearch && (
                            <Link
                                href="/notes/new"
                                className="inline-block px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700"
                            >
                                Crear primera Full Note
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {notes.map(note => (
                            <Link
                                key={note.id}
                                href={`/notes/${note.id}/edit`}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 hover:shadow-md transition-shadow group"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-semibold dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2">
                                        {note.title || 'Sin título'}
                                    </h3>
                                    <button
                                        onClick={(e) => toggleFavorite(note, e)}
                                        className="text-lg flex-shrink-0 ml-2"
                                    >
                                        {note.is_favorite ? '★' : '☆'}
                                    </button>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                                    {note.summary || stripHtmlTags(note.raw_content || '').slice(0, 150) || 'Sin contenido'}
                                </p>

                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        {note.priority && (
                                            <span className={`px-2 py-0.5 rounded ${PRIORITIES[note.priority as keyof typeof PRIORITIES]?.color || ''}`}>
                                                {PRIORITIES[note.priority as keyof typeof PRIORITIES]?.icon}
                                            </span>
                                        )}
                                        {note.user_tags && note.user_tags.length > 0 && (
                                            <span className="text-gray-500 dark:text-gray-400">
                                                {note.user_tags.slice(0, 2).join(', ')}
                                                {note.user_tags.length > 2 && '...'}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-gray-400 dark:text-gray-500">
                                        {new Date(note.updated_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
