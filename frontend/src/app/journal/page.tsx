'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    source_content_id: string | null;
    linked_project_id: string | null;
    linked_model_id: string | null;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

interface ContentItem {
    id: string;
    title: string;
    type: string;
}

interface ProjectItem {
    id: string;
    name: string;
    icon: string;
    color: string;
}

interface ModelItem {
    id: string;
    tag: string;
    taxonomy_value: string;
}

interface NoteItem {
    id: string;
    title: string;
    note_type: string;
}

type LinkType = 'content' | 'note' | 'project' | 'model';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NOTE_TYPES = {
    reflection: { label: 'Reflexion', icon: '💭', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    idea: { label: 'Idea', icon: '💡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    question: { label: 'Pregunta', icon: '❓', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    connection: { label: 'Conexion', icon: '🔗', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    journal: { label: 'Diario', icon: '📓', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
} as const;

export default function JournalPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
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
    const [formLinkedContentTitle, setFormLinkedContentTitle] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Available items for linking
    const [availableContents, setAvailableContents] = useState<ContentItem[]>([]);
    const [availableProjects, setAvailableProjects] = useState<ProjectItem[]>([]);
    const [availableModels, setAvailableModels] = useState<ModelItem[]>([]);
    const [availableNotes, setAvailableNotes] = useState<NoteItem[]>([]);

    // Link selector state
    const [showLinkSelector, setShowLinkSelector] = useState(false);
    const [linkSelectorType, setLinkSelectorType] = useState<LinkType>('content');
    const [linkSearchQuery, setLinkSearchQuery] = useState('');

    // Form link state
    const [formLinkedProjectId, setFormLinkedProjectId] = useState<string | null>(null);
    const [formLinkedModelId, setFormLinkedModelId] = useState<string | null>(null);
    const [formLinkedNoteIds, setFormLinkedNoteIds] = useState<string[]>([]);

    // Legacy - keep for backwards compatibility
    const [contentSearchQuery, setContentSearchQuery] = useState('');
    const [showContentSelector, setShowContentSelector] = useState(false);

    // Handle URL params for creating notes from content detail
    useEffect(() => {
        const newParam = searchParams.get('new');
        const typeParam = searchParams.get('type');
        const contentIdParam = searchParams.get('content_id');
        const contentTitleParam = searchParams.get('content_title');

        if (newParam === 'true') {
            // Open create modal with pre-filled data
            if (typeParam && Object.keys(NOTE_TYPES).includes(typeParam)) {
                setFormType(typeParam);
            }
            if (contentIdParam) {
                setFormLinkedContentIds([contentIdParam]);
                if (contentTitleParam) {
                    setFormLinkedContentTitle(contentTitleParam);
                    // Pre-fill title with reference to content
                    const typeLabel = typeParam ? NOTE_TYPES[typeParam as keyof typeof NOTE_TYPES]?.label || '' : '';
                    setFormTitle(`${typeLabel} sobre: ${contentTitleParam}`);
                }
            }
            setShowCreateModal(true);
            // Clear URL params after processing
            router.replace('/journal', { scroll: false });
        }
    }, [searchParams, router]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchNotes();
            fetchAvailableItems();
        }
    }, [user, filterType, searchQuery]);

    const fetchAvailableItems = async () => {
        try {
            // Fetch contents
            const { data: contents, error: contentsError } = await supabase
                .from('contents')
                .select('id, title, type')
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .limit(100);

            if (!contentsError && contents) {
                setAvailableContents(contents);
            }

            // Fetch projects
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, icon, color')
                .order('created_at', { ascending: false });

            if (!projectsError && projects) {
                setAvailableProjects(projects);
            }

            // Fetch mental models (taxonomy_tags with tag = 'mental_model')
            const { data: models, error: modelsError } = await supabase
                .from('taxonomy_tags')
                .select('id, tag, taxonomy_value')
                .eq('tag', 'mental_model')
                .order('taxonomy_value', { ascending: true });

            if (!modelsError && models) {
                setAvailableModels(models);
            }

            // Fetch other notes for linking
            const session = await supabase.auth.getSession();
            if (session.data.session) {
                const response = await fetch(`${API_URL}/api/v1/notes/?limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${session.data.session.access_token}`,
                    },
                });
                if (response.ok) {
                    const notesData = await response.json();
                    setAvailableNotes(notesData.map((n: Note) => ({ id: n.id, title: n.title, note_type: n.note_type })));
                }
            }
        } catch (error) {
            console.error('Error fetching available items:', error);
        }
    };

    // Legacy function for backwards compatibility
    const fetchAvailableContents = fetchAvailableItems;

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
                    linked_note_ids: formLinkedNoteIds,
                    linked_project_id: formLinkedProjectId,
                    linked_model_id: formLinkedModelId,
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
                    linked_note_ids: formLinkedNoteIds,
                    linked_project_id: formLinkedProjectId,
                    linked_model_id: formLinkedModelId,
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
        setFormLinkedContentTitle('');
        setFormLinkedNoteIds([]);
        setFormLinkedProjectId(null);
        setFormLinkedModelId(null);
        setShowContentSelector(false);
        setShowLinkSelector(false);
        setLinkSearchQuery('');
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
        setFormLinkedNoteIds(note.linked_note_ids || []);
        setFormLinkedProjectId(note.linked_project_id);
        setFormLinkedModelId(note.linked_model_id);
        setShowDetailModal(true);
    };

    const toggleContentLink = (contentId: string) => {
        setFormLinkedContentIds(prev =>
            prev.includes(contentId)
                ? prev.filter(id => id !== contentId)
                : [...prev, contentId]
        );
    };

    const toggleNoteLink = (noteId: string) => {
        setFormLinkedNoteIds(prev =>
            prev.includes(noteId)
                ? prev.filter(id => id !== noteId)
                : [...prev, noteId]
        );
    };

    // Helper to get filtered items based on link type and search
    const getFilteredContents = () => {
        const query = linkSearchQuery.toLowerCase();
        return availableContents.filter(c => c.title.toLowerCase().includes(query));
    };

    const getFilteredNotes = () => {
        const query = linkSearchQuery.toLowerCase();
        return availableNotes.filter(n => n.title.toLowerCase().includes(query) && n.id !== selectedNote?.id);
    };

    const getFilteredProjects = () => {
        const query = linkSearchQuery.toLowerCase();
        return availableProjects.filter(p => p.name.toLowerCase().includes(query));
    };

    const getFilteredModels = () => {
        const query = linkSearchQuery.toLowerCase();
        return availableModels.filter(m => m.taxonomy_value.toLowerCase().includes(query));
    };

    // Count total links
    const getTotalLinksCount = () => {
        return formLinkedContentIds.length +
               formLinkedNoteIds.length +
               (formLinkedProjectId ? 1 : 0) +
               (formLinkedModelId ? 1 : 0);
    };

    // Get selected items for display
    const getSelectedProject = () => availableProjects.find(p => p.id === formLinkedProjectId);
    const getSelectedModel = () => availableModels.find(m => m.id === formLinkedModelId);

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
                            {/* Links section */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Vincular ({getTotalLinksCount()} vinculados)
                                </label>

                                {/* Current links display */}
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formLinkedContentIds.map(id => {
                                        const content = availableContents.find(c => c.id === id);
                                        return content ? (
                                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded">
                                                📄 {content.title.slice(0, 20)}...
                                                <button type="button" onClick={() => toggleContentLink(id)} className="ml-1 hover:text-red-500">×</button>
                                            </span>
                                        ) : null;
                                    })}
                                    {formLinkedNoteIds.map(id => {
                                        const note = availableNotes.find(n => n.id === id);
                                        return note ? (
                                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs rounded">
                                                📝 {note.title.slice(0, 20)}...
                                                <button type="button" onClick={() => toggleNoteLink(id)} className="ml-1 hover:text-red-500">×</button>
                                            </span>
                                        ) : null;
                                    })}
                                    {getSelectedProject() && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs rounded">
                                            {getSelectedProject()?.icon || '📁'} {getSelectedProject()?.name}
                                            <button type="button" onClick={() => setFormLinkedProjectId(null)} className="ml-1 hover:text-red-500">×</button>
                                        </span>
                                    )}
                                    {getSelectedModel() && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs rounded">
                                            🧠 {getSelectedModel()?.taxonomy_value}
                                            <button type="button" onClick={() => setFormLinkedModelId(null)} className="ml-1 hover:text-red-500">×</button>
                                        </span>
                                    )}
                                </div>

                                {/* Add link button */}
                                <button
                                    type="button"
                                    onClick={() => setShowLinkSelector(!showLinkSelector)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-left flex items-center justify-between"
                                >
                                    <span>+ Añadir vinculo...</span>
                                    <span>{showLinkSelector ? '▲' : '▼'}</span>
                                </button>

                                {showLinkSelector && (
                                    <div className="mt-2 border dark:border-gray-600 rounded-lg overflow-hidden">
                                        {/* Link type tabs */}
                                        <div className="flex border-b dark:border-gray-600">
                                            {[
                                                { type: 'content' as LinkType, label: '📄 Contenido', count: availableContents.length },
                                                { type: 'note' as LinkType, label: '📝 Nota', count: availableNotes.length },
                                                { type: 'project' as LinkType, label: '📁 Proyecto', count: availableProjects.length },
                                                { type: 'model' as LinkType, label: '🧠 Modelo', count: availableModels.length },
                                            ].map(tab => (
                                                <button
                                                    key={tab.type}
                                                    type="button"
                                                    onClick={() => { setLinkSelectorType(tab.type); setLinkSearchQuery(''); }}
                                                    className={`flex-1 px-2 py-2 text-xs ${linkSelectorType === tab.type ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                                                >
                                                    {tab.label} ({tab.count})
                                                </button>
                                            ))}
                                        </div>

                                        {/* Search input */}
                                        <input
                                            type="text"
                                            value={linkSearchQuery}
                                            onChange={(e) => setLinkSearchQuery(e.target.value)}
                                            placeholder={`Buscar ${linkSelectorType === 'content' ? 'contenidos' : linkSelectorType === 'note' ? 'notas' : linkSelectorType === 'project' ? 'proyectos' : 'modelos'}...`}
                                            className="w-full px-3 py-2 border-b dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                        />

                                        {/* Items list */}
                                        <div className="max-h-40 overflow-y-auto">
                                            {linkSelectorType === 'content' && getFilteredContents().slice(0, 15).map((item) => (
                                                <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    <input type="checkbox" checked={formLinkedContentIds.includes(item.id)} onChange={() => toggleContentLink(item.id)} className="rounded" />
                                                    <span className="text-sm dark:text-gray-300 truncate flex-1">{item.title}</span>
                                                    <span className="text-xs text-gray-400">{item.type}</span>
                                                </label>
                                            ))}
                                            {linkSelectorType === 'note' && getFilteredNotes().slice(0, 15).map((item) => (
                                                <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    <input type="checkbox" checked={formLinkedNoteIds.includes(item.id)} onChange={() => toggleNoteLink(item.id)} className="rounded" />
                                                    <span className="text-sm dark:text-gray-300 truncate flex-1">{item.title}</span>
                                                    <span className="text-xs text-gray-400">{NOTE_TYPES[item.note_type as keyof typeof NOTE_TYPES]?.icon || '📝'}</span>
                                                </label>
                                            ))}
                                            {linkSelectorType === 'project' && getFilteredProjects().slice(0, 15).map((item) => (
                                                <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    <input type="radio" name="project" checked={formLinkedProjectId === item.id} onChange={() => setFormLinkedProjectId(item.id)} className="rounded" />
                                                    <span className="text-sm dark:text-gray-300 truncate flex-1">{item.icon || '📁'} {item.name}</span>
                                                </label>
                                            ))}
                                            {linkSelectorType === 'model' && getFilteredModels().slice(0, 15).map((item) => (
                                                <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                    <input type="radio" name="model" checked={formLinkedModelId === item.id} onChange={() => setFormLinkedModelId(item.id)} className="rounded" />
                                                    <span className="text-sm dark:text-gray-300 truncate flex-1">🧠 {item.taxonomy_value}</span>
                                                </label>
                                            ))}
                                            {((linkSelectorType === 'content' && getFilteredContents().length === 0) ||
                                              (linkSelectorType === 'note' && getFilteredNotes().length === 0) ||
                                              (linkSelectorType === 'project' && getFilteredProjects().length === 0) ||
                                              (linkSelectorType === 'model' && getFilteredModels().length === 0)) && (
                                                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No hay items</div>
                                            )}
                                        </div>
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
                                    {/* Links section in edit mode */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                                            Vincular ({getTotalLinksCount()} vinculados)
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {formLinkedContentIds.map(id => {
                                                const content = availableContents.find(c => c.id === id);
                                                return content ? (
                                                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs rounded">
                                                        📄 {content.title.slice(0, 20)}...
                                                        <button type="button" onClick={() => toggleContentLink(id)} className="ml-1 hover:text-red-500">×</button>
                                                    </span>
                                                ) : null;
                                            })}
                                            {formLinkedNoteIds.map(id => {
                                                const note = availableNotes.find(n => n.id === id);
                                                return note ? (
                                                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs rounded">
                                                        📝 {note.title.slice(0, 20)}...
                                                        <button type="button" onClick={() => toggleNoteLink(id)} className="ml-1 hover:text-red-500">×</button>
                                                    </span>
                                                ) : null;
                                            })}
                                            {getSelectedProject() && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs rounded">
                                                    {getSelectedProject()?.icon || '📁'} {getSelectedProject()?.name}
                                                    <button type="button" onClick={() => setFormLinkedProjectId(null)} className="ml-1 hover:text-red-500">×</button>
                                                </span>
                                            )}
                                            {getSelectedModel() && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs rounded">
                                                    🧠 {getSelectedModel()?.taxonomy_value}
                                                    <button type="button" onClick={() => setFormLinkedModelId(null)} className="ml-1 hover:text-red-500">×</button>
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowLinkSelector(!showLinkSelector)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-left flex items-center justify-between"
                                        >
                                            <span>+ Añadir vinculo...</span>
                                            <span>{showLinkSelector ? '▲' : '▼'}</span>
                                        </button>
                                        {showLinkSelector && (
                                            <div className="mt-2 border dark:border-gray-600 rounded-lg overflow-hidden">
                                                <div className="flex border-b dark:border-gray-600">
                                                    {[
                                                        { type: 'content' as LinkType, label: '📄 Contenido' },
                                                        { type: 'note' as LinkType, label: '📝 Nota' },
                                                        { type: 'project' as LinkType, label: '📁 Proyecto' },
                                                        { type: 'model' as LinkType, label: '🧠 Modelo' },
                                                    ].map(tab => (
                                                        <button
                                                            key={tab.type}
                                                            type="button"
                                                            onClick={() => { setLinkSelectorType(tab.type); setLinkSearchQuery(''); }}
                                                            className={`flex-1 px-2 py-2 text-xs ${linkSelectorType === tab.type ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={linkSearchQuery}
                                                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                                                    placeholder="Buscar..."
                                                    className="w-full px-3 py-2 border-b dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                                />
                                                <div className="max-h-32 overflow-y-auto">
                                                    {linkSelectorType === 'content' && getFilteredContents().slice(0, 10).map((item) => (
                                                        <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                            <input type="checkbox" checked={formLinkedContentIds.includes(item.id)} onChange={() => toggleContentLink(item.id)} className="rounded" />
                                                            <span className="text-sm dark:text-gray-300 truncate">{item.title}</span>
                                                        </label>
                                                    ))}
                                                    {linkSelectorType === 'note' && getFilteredNotes().slice(0, 10).map((item) => (
                                                        <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                            <input type="checkbox" checked={formLinkedNoteIds.includes(item.id)} onChange={() => toggleNoteLink(item.id)} className="rounded" />
                                                            <span className="text-sm dark:text-gray-300 truncate">{item.title}</span>
                                                        </label>
                                                    ))}
                                                    {linkSelectorType === 'project' && getFilteredProjects().slice(0, 10).map((item) => (
                                                        <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                            <input type="radio" name="editProject" checked={formLinkedProjectId === item.id} onChange={() => setFormLinkedProjectId(item.id)} />
                                                            <span className="text-sm dark:text-gray-300 truncate">{item.icon || '📁'} {item.name}</span>
                                                        </label>
                                                    ))}
                                                    {linkSelectorType === 'model' && getFilteredModels().slice(0, 10).map((item) => (
                                                        <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                                            <input type="radio" name="editModel" checked={formLinkedModelId === item.id} onChange={() => setFormLinkedModelId(item.id)} />
                                                            <span className="text-sm dark:text-gray-300 truncate">🧠 {item.taxonomy_value}</span>
                                                        </label>
                                                    ))}
                                                </div>
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
