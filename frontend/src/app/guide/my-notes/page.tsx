'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SystemNote {
    id: string;
    title: string;
    content: string;
    category: string;
    position: number;
    created_at: string;
    updated_at: string;
}

const CATEGORIES = [
    { value: 'general', label: 'General', icon: '📋', color: 'bg-gray-100 dark:bg-gray-700' },
    { value: 'workflow', label: 'Flujo de Trabajo', icon: '🔄', color: 'bg-blue-100 dark:bg-blue-900/30' },
    { value: 'tips', label: 'Tips y Trucos', icon: '💡', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { value: 'reference', label: 'Referencia', icon: '📚', color: 'bg-purple-100 dark:bg-purple-900/30' },
];

export default function MyNotesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [notes, setNotes] = useState<SystemNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit/Create state
    const [showEditor, setShowEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<SystemNote | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formCategory, setFormCategory] = useState('general');
    const [saving, setSaving] = useState(false);

    // Filter
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
            throw new Error('No hay sesión activa');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    };

    const fetchNotes = async () => {
        try {
            const headers = await getAuthHeaders();
            const url = filterCategory === 'all'
                ? `${API_URL}/api/v1/system-notes/`
                : `${API_URL}/api/v1/system-notes/?category=${filterCategory}`;

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Error al cargar notas');

            const data = await response.json();
            setNotes(data.notes);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !formContent.trim()) return;

        setSaving(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();

            if (editingNote) {
                // Update
                const response = await fetch(`${API_URL}/api/v1/system-notes/${editingNote.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        title: formTitle.trim(),
                        content: formContent.trim(),
                        category: formCategory,
                    }),
                });
                if (!response.ok) throw new Error('Error al actualizar');
            } else {
                // Create
                const response = await fetch(`${API_URL}/api/v1/system-notes/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        title: formTitle.trim(),
                        content: formContent.trim(),
                        category: formCategory,
                    }),
                });
                if (!response.ok) throw new Error('Error al crear');
            }

            resetForm();
            fetchNotes();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId: string) => {
        if (!confirm('¿Eliminar esta nota?')) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/system-notes/${noteId}`, {
                method: 'DELETE',
                headers,
            });
            if (!response.ok) throw new Error('Error al eliminar');
            fetchNotes();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const startEdit = (note: SystemNote) => {
        setEditingNote(note);
        setFormTitle(note.title);
        setFormContent(note.content);
        setFormCategory(note.category);
        setShowEditor(true);
    };

    const resetForm = () => {
        setShowEditor(false);
        setEditingNote(null);
        setFormTitle('');
        setFormContent('');
        setFormCategory('general');
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchNotes();
        }
    }, [user, filterCategory]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    const getCategoryInfo = (categoryValue: string) => {
        return CATEGORIES.find(c => c.value === categoryValue) || CATEGORIES[0];
    };

    // Group notes by category
    const groupedNotes = notes.reduce((acc, note) => {
        if (!acc[note.category]) {
            acc[note.category] = [];
        }
        acc[note.category].push(note);
        return acc;
    }, {} as Record<string, SystemNote[]>);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">K</span>
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white">KBase</span>
                            </Link>
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <Link href="/guide" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                                Guía
                            </Link>
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Mis Notas</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <Link
                                href="/guide"
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Volver a Guía
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Description */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-6">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Tus notas personales:</strong> Documenta tu flujo de trabajo, tips, o cualquier referencia
                        que quieras tener a mano sobre cómo usas KBase.
                    </p>
                </div>

                {/* Actions bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    {/* Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Filtrar:</span>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="all">Todas las categorías</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>
                                    {cat.icon} {cat.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Add button */}
                    <button
                        onClick={() => {
                            resetForm();
                            setShowEditor(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nueva Nota
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Editor Modal */}
                {showEditor && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {editingNote ? 'Editar Nota' : 'Nueva Nota'}
                                </h3>
                                <button
                                    onClick={resetForm}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Título
                                        </label>
                                        <input
                                            type="text"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Título de la nota"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Categoría
                                        </label>
                                        <select
                                            value={formCategory}
                                            onChange={(e) => setFormCategory(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>
                                                    {cat.icon} {cat.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Contenido
                                        </label>
                                        <textarea
                                            value={formContent}
                                            onChange={(e) => setFormContent(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[200px] font-mono text-sm"
                                            placeholder="Escribe tu nota aquí... (soporta texto plano)"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm transition-colors"
                                    >
                                        {saving ? 'Guardando...' : editingNote ? 'Guardar Cambios' : 'Crear Nota'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Notes list */}
                {notes.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Sin notas todavía
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Crea tu primera nota para documentar tu flujo de trabajo personal.
                        </p>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowEditor(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Crear Primera Nota
                        </button>
                    </div>
                ) : filterCategory === 'all' ? (
                    // Grouped view
                    <div className="space-y-8">
                        {CATEGORIES.map(category => {
                            const categoryNotes = groupedNotes[category.value];
                            if (!categoryNotes?.length) return null;

                            return (
                                <div key={category.value}>
                                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span>{category.icon}</span>
                                        {category.label}
                                        <span className="text-xs font-normal">({categoryNotes.length})</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {categoryNotes.map(note => (
                                            <NoteCard
                                                key={note.id}
                                                note={note}
                                                onEdit={startEdit}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Flat list when filtering
                    <div className="space-y-3">
                        {notes.map(note => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={startEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function NoteCard({
    note,
    onEdit,
    onDelete,
}: {
    note: SystemNote;
    onEdit: (note: SystemNote) => void;
    onDelete: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="font-medium text-gray-900 dark:text-white">{note.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(note);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Editar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(note.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Eliminar"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 font-sans">
                        {note.content}
                    </pre>
                    <div className="mt-3 text-xs text-gray-400">
                        Actualizado: {new Date(note.updated_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
