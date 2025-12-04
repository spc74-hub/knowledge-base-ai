'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

interface Note {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    linked_content_ids: string[];
    linked_note_ids: string[];
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

interface ContentItem {
    id: string;
    title: string;
    type: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NOTE_TYPES = {
    reflection: { label: 'Reflexion', icon: '💭', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    idea: { label: 'Idea', icon: '💡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    question: { label: 'Pregunta', icon: '❓', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    connection: { label: 'Conexion', icon: '🔗', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
} as const;

export default function JournalPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    // Filters
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formType, setFormType] = useState<string>('reflection');
    const [formTags, setFormTags] = useState('');
    const [formLinkedContentIds, setFormLinkedContentIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Available contents for linking
    const [availableContents, setAvailableContents] = useState<ContentItem[]>([]);
    const [contentSearchQuery, setContentSearchQuery] = useState('');
    const [showContentSelector, setShowContentSelector] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchNotes();
            fetchAvailableContents();
        }
    }, [user, filterType, searchQuery]);

    const fetchAvailableContents = async () => {
        try {
            const { data, error } = await supabase
                .from('contents')
                .select('id, title, type')
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                setAvailableContents(data);
            }
        } catch (error) {
            console.error('Error fetching contents:', error);
        }
    };

    const fetchNotes = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            let url = `${API_URL}/api/v1/notes/?limit=100`;
            if (filterType !== 'all') {
                url += `&note_type=${filterType}`;
            }
            if (searchQuery) {
                url += `&q=${encodeURIComponent(searchQuery)}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setNotes(data);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNote = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: formTitle,
                    content: formContent,
                    note_type: formType,
                    tags: formTags ? formTags.split(',').map(t => t.trim()) : [],
                    linked_content_ids: formLinkedContentIds,
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchNotes();
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedNote) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/${selectedNote.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: formTitle,
                    content: formContent,
                    note_type: formType,
                    tags: formTags ? formTags.split(',').map(t => t.trim()) : [],
                    linked_content_ids: formLinkedContentIds,
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
                setShowDetailModal(false);
                setSelectedNote(null);
                fetchNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const resetForm = () => {
        setFormTitle('');
        setFormContent('');
        setFormType('reflection');
        setFormTags('');
        setFormLinkedContentIds([]);
        setShowContentSelector(false);
        setContentSearchQuery('');
        setEditMode(false);
    };

    const openNoteDetail = (note: Note) => {
        setSelectedNote(note);
        setFormTitle(note.title);
        setFormContent(note.content);
        setFormType(note.note_type);
        setFormTags(note.tags.join(', '));
        setFormLinkedContentIds(note.linked_content_ids || []);
        setShowDetailModal(true);
    };

    const toggleContentLink = (contentId: string) => {
        setFormLinkedContentIds(prev =>
            prev.includes(contentId)
                ? prev.filter(id => id !== contentId)
                : [...prev, contentId]
        );
    };

    const filteredAvailableContents = availableContents.filter(c =>
        c.title.toLowerCase().includes(contentSearchQuery.toLowerCase())
    );

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
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            ← Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold dark:text-white">Diario</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            + Nueva Nota
                        </button>
                    </div>
                </div>
            </header>

            {/* Filters */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex gap-4 items-center flex-wrap">
                    <input
                        type="text"
                        placeholder="Buscar notas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-4 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg w-64"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1 rounded-full text-sm ${filterType === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                            Todas
                        </button>
                        {Object.entries(NOTE_TYPES).map(([type, config]) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1 rounded-full text-sm ${filterType === type ? config.color : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                            >
                                {config.icon} {config.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 py-4">
                {notes.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📝</div>
                        <h2 className="text-xl font-semibold mb-2 dark:text-white">No tienes notas</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Escribe reflexiones, ideas, preguntas o conexiones entre lo que aprendes.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear primera nota
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map(note => {
                            const typeConfig = NOTE_TYPES[note.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                            return (
                                <div
                                    key={note.id}
                                    onClick={() => openNoteDetail(note)}
                                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow ${note.is_pinned ? 'ring-2 ring-indigo-500' : ''}`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                            {typeConfig.icon} {typeConfig.label}
                                        </span>
                                        {note.is_pinned && (
                                            <span className="text-indigo-600">📌</span>
                                        )}
                                    </div>
                                    <h3 className="font-semibold dark:text-white mb-2 line-clamp-1">
                                        {note.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-3">
                                        {note.content}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                        {note.tags.length > 0 && (
                                            <span className="truncate max-w-[150px]">
                                                {note.tags.slice(0, 2).map(t => `#${t}`).join(' ')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Nueva Nota</h2>
                        <form onSubmit={handleCreateNote}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo</label>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(NOTE_TYPES).map(([type, config]) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormType(type)}
                                            className={`px-3 py-1 rounded-full text-sm ${formType === type ? config.color : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                                        >
                                            {config.icon} {config.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Titulo</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Contenido</label>
                                <textarea
                                    value={formContent}
                                    onChange={(e) => setFormContent(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg font-mono text-sm"
                                    rows={8}
                                    placeholder="Escribe en Markdown..."
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tags (separados por coma)</label>
                                <input
                                    type="text"
                                    value={formTags}
                                    onChange={(e) => setFormTags(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    placeholder="idea, proyecto, reflexion"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                    Vincular contenidos ({formLinkedContentIds.length} seleccionados)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowContentSelector(!showContentSelector)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-left flex items-center justify-between"
                                >
                                    <span>{formLinkedContentIds.length > 0 ? `${formLinkedContentIds.length} contenidos vinculados` : 'Seleccionar contenidos...'}</span>
                                    <span>{showContentSelector ? '▲' : '▼'}</span>
                                </button>
                                {showContentSelector && (
                                    <div className="mt-2 border dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                                        <input
                                            type="text"
                                            value={contentSearchQuery}
                                            onChange={(e) => setContentSearchQuery(e.target.value)}
                                            placeholder="Buscar contenidos..."
                                            className="w-full px-3 py-2 border-b dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                        />
                                        {filteredAvailableContents.slice(0, 20).map(content => (
                                            <label
                                                key={content.id}
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formLinkedContentIds.includes(content.id)}
                                                    onChange={() => toggleContentLink(content.id)}
                                                    className="rounded"
                                                />
                                                <span className="text-sm dark:text-gray-300 truncate">{content.title}</span>
                                                <span className="text-xs text-gray-400 ml-auto">{content.type}</span>
                                            </label>
                                        ))}
                                        {filteredAvailableContents.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-500">No hay contenidos</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !formTitle || !formContent}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedNote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b dark:border-gray-700">
                            <div className="flex items-start justify-between">
                                <div>
                                    {(() => {
                                        const typeConfig = NOTE_TYPES[selectedNote.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                                        return (
                                            <span className={`text-sm px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                                {typeConfig.icon} {typeConfig.label}
                                            </span>
                                        );
                                    })()}
                                    <h2 className="text-2xl font-bold dark:text-white mt-2">{selectedNote.title}</h2>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {new Date(selectedNote.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleTogglePin(selectedNote)}
                                        className={`p-2 rounded-lg ${selectedNote.is_pinned ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title={selectedNote.is_pinned ? 'Desanclar' : 'Anclar'}
                                    >
                                        📌
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDetailModal(false);
                                            setSelectedNote(null);
                                            resetForm();
                                        }}
                                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {editMode ? (
                                <form onSubmit={handleUpdateNote}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {Object.entries(NOTE_TYPES).map(([type, config]) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setFormType(type)}
                                                    className={`px-3 py-1 rounded-full text-sm ${formType === type ? config.color : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                                                >
                                                    {config.icon} {config.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Titulo</label>
                                        <input
                                            type="text"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Contenido</label>
                                        <textarea
                                            value={formContent}
                                            onChange={(e) => setFormContent(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg font-mono text-sm"
                                            rows={12}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tags</label>
                                        <input
                                            type="text"
                                            value={formTags}
                                            onChange={(e) => setFormTags(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                                            Vincular contenidos ({formLinkedContentIds.length})
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowContentSelector(!showContentSelector)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-left flex items-center justify-between"
                                        >
                                            <span>{formLinkedContentIds.length > 0 ? `${formLinkedContentIds.length} contenidos vinculados` : 'Seleccionar...'}</span>
                                            <span>{showContentSelector ? '▲' : '▼'}</span>
                                        </button>
                                        {showContentSelector && (
                                            <div className="mt-2 border dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto">
                                                <input
                                                    type="text"
                                                    value={contentSearchQuery}
                                                    onChange={(e) => setContentSearchQuery(e.target.value)}
                                                    placeholder="Buscar..."
                                                    className="w-full px-3 py-2 border-b dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                                />
                                                {filteredAvailableContents.slice(0, 15).map(content => (
                                                    <label
                                                        key={content.id}
                                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formLinkedContentIds.includes(content.id)}
                                                            onChange={() => toggleContentLink(content.id)}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm dark:text-gray-300 truncate">{content.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setEditMode(false)}
                                            className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {saving ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="prose dark:prose-invert max-w-none mb-6">
                                        <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">
                                            {selectedNote.content}
                                        </pre>
                                    </div>

                                    {selectedNote.tags.length > 0 && (
                                        <div className="flex gap-2 flex-wrap">
                                            {selectedNote.tags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Linked Contents */}
                                    {selectedNote.linked_content_ids && selectedNote.linked_content_ids.length > 0 && (
                                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                                Contenidos vinculados ({selectedNote.linked_content_ids.length})
                                            </h4>
                                            <div className="flex flex-col gap-2">
                                                {selectedNote.linked_content_ids.map(contentId => {
                                                    const content = availableContents.find(c => c.id === contentId);
                                                    return (
                                                        <Link
                                                            key={contentId}
                                                            href={`/dashboard?content=${contentId}`}
                                                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                                        >
                                                            <span className="text-lg">🔗</span>
                                                            <span className="text-sm truncate">
                                                                {content?.title || 'Contenido no encontrado'}
                                                            </span>
                                                            {content?.type && (
                                                                <span className="text-xs text-indigo-500 dark:text-indigo-400 ml-auto">
                                                                    {content.type}
                                                                </span>
                                                            )}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!editMode && (
                            <div className="p-4 border-t dark:border-gray-700 flex justify-between">
                                <button
                                    onClick={handleDeleteNote}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                >
                                    Eliminar
                                </button>
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Editar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
