'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Note {
    id: string;
    title: string;
    content: string;
    note_type: string;
    is_pinned: boolean;
    is_completed: boolean;
    is_full_note?: boolean;
    priority: string | null;
    created_at: string;
}

const NOTE_TYPES = {
    reflection: { label: 'Reflexion', icon: '💭', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    idea: { label: 'Idea', icon: '💡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    question: { label: 'Pregunta', icon: '❓', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    connection: { label: 'Conexion', icon: '🔗', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    journal: { label: 'Diario', icon: '📓', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    action: { label: 'Accion', icon: '✅', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    shopping: { label: 'Shopping', icon: '🛒', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
    full_note: { label: 'Completa', icon: '📄', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
} as const;

const PRIORITIES = {
    important: { label: 'Importante', icon: '🔴' },
    urgent: { label: 'Urgente', icon: '🟠' },
    A: { label: 'A', icon: '🔵' },
    B: { label: 'B', icon: '🔷' },
    C: { label: 'C', icon: '🩵' },
} as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const stripHtmlTags = (html: string): string => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
};

export default function MobileNotesPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [isDark, setIsDark] = useState(false);

    // Quick note form
    const [quickContent, setQuickContent] = useState('');
    const [quickType, setQuickType] = useState<string>('reflection');
    const [saving, setSaving] = useState(false);

    // Edit mode
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editType, setEditType] = useState('');

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
            if (!session.data.session) return;

            const requestBody: Record<string, unknown> = {
                limit: 50,
                offset: 0,
                include_full_notes: true,
                sort_by: 'created_at',
                sort_order: 'desc',
            };

            if (filterType !== 'all') {
                requestBody.note_types = [filterType];
            }

            const response = await fetch(`${API_URL}/api/v1/notes/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (response.ok) {
                const result = await response.json();
                setNotes(result.data || []);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const handleQuickCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickContent.trim()) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const firstLine = quickContent.split('\n')[0].trim();
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title,
                    content: quickContent,
                    note_type: quickType,
                    tags: [],
                    linked_content_ids: [],
                    linked_note_ids: [],
                }),
            });

            if (response.ok) {
                setShowCreate(false);
                setQuickContent('');
                setQuickType('reflection');
                fetchNotes();
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleComplete = async (note: Note) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/${note.id}/complete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setNotes(prev => prev.map(n =>
                    n.id === note.id ? { ...n, is_completed: !n.is_completed } : n
                ));
                if (selectedNote?.id === note.id) {
                    setSelectedNote({ ...note, is_completed: !note.is_completed });
                }
            }
        } catch (error) {
            console.error('Error toggling complete:', error);
        }
    };

    const handleTogglePin = async (note: Note) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/${note.id}/pin`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                fetchNotes();
                if (selectedNote?.id === note.id) {
                    setSelectedNote({ ...note, is_pinned: !note.is_pinned });
                }
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleUpdateNote = async () => {
        if (!selectedNote || !editContent.trim()) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const firstLine = editContent.split('\n')[0].trim();
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

            const response = await fetch(`${API_URL}/api/v1/notes/${selectedNote.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title,
                    content: editContent,
                    note_type: editType,
                }),
            });

            if (response.ok) {
                setEditMode(false);
                fetchNotes();
                const updated = await response.json();
                setSelectedNote(updated);
            }
        } catch (error) {
            console.error('Error updating note:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteNote = async () => {
        if (!selectedNote || !confirm('¿Eliminar esta nota?')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/${selectedNote.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setShowDetail(false);
                setSelectedNote(null);
                fetchNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const openNoteDetail = (note: Note) => {
        setSelectedNote(note);
        setEditContent(stripHtmlTags(note.content));
        setEditType(note.note_type);
        setShowDetail(true);
        setEditMode(false);
    };

    if (loading && notes.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Quick filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <button
                    onClick={() => setFilterType('all')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        filterType === 'all'
                            ? 'bg-amber-500 text-white'
                            : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    Todas
                </button>
                {Object.entries(NOTE_TYPES).slice(0, -1).map(([type, config]) => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filterType === type
                                ? 'bg-amber-500 text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-gray-200 text-gray-700'
                        }`}
                    >
                        {config.icon} {config.label}
                    </button>
                ))}
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">📝</div>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No hay notas</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notes.map(note => {
                        const typeConfig = NOTE_TYPES[note.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                        const isAction = note.note_type === 'action';

                        return (
                            <div
                                key={note.id}
                                onClick={() => openNoteDetail(note)}
                                className={`rounded-xl p-4 shadow-sm border active:opacity-80 transition-all ${
                                    note.is_completed ? 'opacity-60' : ''
                                } ${
                                    isDark
                                        ? 'bg-gray-800 border-gray-700'
                                        : 'bg-white border-gray-100'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Checkbox for actions */}
                                    {isAction && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleComplete(note);
                                            }}
                                            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                note.is_completed
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : isDark
                                                        ? 'border-gray-500'
                                                        : 'border-gray-300'
                                            }`}
                                        >
                                            {note.is_completed && '✓'}
                                        </button>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {/* Header */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                                {typeConfig.icon}
                                            </span>
                                            {note.is_pinned && <span className="text-amber-500">📌</span>}
                                            {note.priority && (
                                                <span className="text-xs">
                                                    {PRIORITIES[note.priority as keyof typeof PRIORITIES]?.icon}
                                                </span>
                                            )}
                                            {note.is_full_note && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                    isDark
                                                        ? 'bg-indigo-900 text-indigo-200'
                                                        : 'bg-indigo-100 text-indigo-700'
                                                }`}>
                                                    Completa
                                                </span>
                                            )}
                                        </div>

                                        {/* Content preview */}
                                        <p className={`text-sm line-clamp-2 ${
                                            note.is_completed ? 'line-through' : ''
                                        } ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {stripHtmlTags(note.title || note.content)}
                                        </p>

                                        {/* Date */}
                                        <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {new Date(note.created_at).toLocaleDateString('es-ES', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* FAB - Create button */}
            <button
                onClick={() => setShowCreate(true)}
                className="fixed right-4 bottom-24 w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform z-40"
            >
                +
            </button>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div
                        className={`w-full rounded-t-2xl overflow-hidden animate-slide-up flex flex-col ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 60px)' }}
                    >
                        <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${
                            isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Nueva Nota
                            </h2>
                            <button
                                onClick={() => setShowCreate(false)}
                                className={`p-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleQuickCreate} className="p-4 space-y-4 flex-1 overflow-y-auto">
                            {/* Type selector */}
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                                {Object.entries(NOTE_TYPES).filter(([key]) => key !== 'full_note').map(([type, config]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setQuickType(type)}
                                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm ${
                                            quickType === type
                                                ? config.color
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-300'
                                                    : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {config.icon} {config.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content input */}
                            <textarea
                                value={quickContent}
                                onChange={(e) => setQuickContent(e.target.value)}
                                placeholder="Escribe tu nota..."
                                className={`w-full h-40 p-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                                    isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                                }`}
                                autoFocus
                            />

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={saving || !quickContent.trim()}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                            >
                                {saving ? 'Guardando...' : 'Guardar Nota'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && selectedNote && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                    <div
                        className={`w-full rounded-t-2xl overflow-hidden animate-slide-up flex flex-col ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 60px)' }}
                    >
                        {/* Header */}
                        <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${
                            isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const typeConfig = NOTE_TYPES[selectedNote.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                                    return (
                                        <span className={`text-sm px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                            {typeConfig.icon} {typeConfig.label}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTogglePin(selectedNote)}
                                    className={`p-2 rounded-lg ${selectedNote.is_pinned ? 'bg-amber-100 dark:bg-amber-900' : ''}`}
                                >
                                    📌
                                </button>
                                {selectedNote.note_type === 'action' && (
                                    <button
                                        onClick={() => handleToggleComplete(selectedNote)}
                                        className={`p-2 rounded-lg ${selectedNote.is_completed ? 'bg-green-100 dark:bg-green-900' : ''}`}
                                    >
                                        ✅
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowDetail(false);
                                        setSelectedNote(null);
                                        setEditMode(false);
                                    }}
                                    className={`p-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1">
                            {editMode ? (
                                <div className="space-y-4">
                                    {/* Type selector for edit */}
                                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                                        {Object.entries(NOTE_TYPES).filter(([key]) => key !== 'full_note').map(([type, config]) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setEditType(type)}
                                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm ${
                                                    editType === type
                                                        ? config.color
                                                        : isDark
                                                            ? 'bg-gray-700 text-gray-300'
                                                            : 'bg-gray-100 text-gray-600'
                                                }`}
                                            >
                                                {config.icon} {config.label}
                                            </button>
                                        ))}
                                    </div>

                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className={`w-full h-60 p-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                                            isDark
                                                ? 'bg-gray-700 border-gray-600 text-white'
                                                : 'bg-white border-gray-200 text-gray-900'
                                        }`}
                                    />
                                </div>
                            ) : (
                                <>
                                    {selectedNote.content.includes('<') ? (
                                        <div
                                            className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-gray-200' : 'text-gray-700'}`}
                                            dangerouslySetInnerHTML={{ __html: selectedNote.content }}
                                        />
                                    ) : (
                                        <pre className={`whitespace-pre-wrap font-sans text-sm ${
                                            isDark ? 'text-gray-200' : 'text-gray-700'
                                        }`}>
                                            {selectedNote.content}
                                        </pre>
                                    )}
                                    <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {new Date(selectedNote.created_at).toLocaleString('es-ES')}
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Footer with buttons */}
                        <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {editMode ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setEditMode(false)}
                                        className={`flex-1 py-3 border rounded-xl font-medium ${
                                            isDark
                                                ? 'border-gray-600 text-gray-300'
                                                : 'border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleUpdateNote}
                                        disabled={saving}
                                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeleteNote}
                                        className={`flex-1 py-3 text-red-600 border rounded-xl font-medium ${
                                            isDark ? 'border-red-900' : 'border-red-200'
                                        }`}
                                    >
                                        Eliminar
                                    </button>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium"
                                    >
                                        Editar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
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
