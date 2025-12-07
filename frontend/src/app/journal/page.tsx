'use client';

import { useEffect, useState, useCallback } from 'react';
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
    is_completed: boolean;
    created_at: string;
    updated_at: string;
    // Enriched data from search
    source_content?: { id: string; title: string; type: string; url?: string };
    linked_project?: { id: string; name: string; icon?: string; color?: string };
    linked_model?: { id: string; tag: string; taxonomy_value: string };
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

interface ObjectiveItem {
    id: string;
    title: string;
    icon: string;
    color: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NOTE_TYPES = {
    reflection: { label: 'Reflexion', icon: '💭', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    idea: { label: 'Idea', icon: '💡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    question: { label: 'Pregunta', icon: '❓', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    connection: { label: 'Conexion', icon: '🔗', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    journal: { label: 'Diario', icon: '📓', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    action: { label: 'Accion', icon: '✅', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
} as const;

type LinkType = 'content' | 'project' | 'objective';

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
    const [showCompleted, setShowCompleted] = useState(true);

    // Quick create form state (simplified)
    const [quickContent, setQuickContent] = useState('');
    const [quickType, setQuickType] = useState<string>('reflection');
    const [quickLinkType, setQuickLinkType] = useState<LinkType | null>(null);
    const [quickLinkedId, setQuickLinkedId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Available items for linking
    const [availableContents, setAvailableContents] = useState<ContentItem[]>([]);
    const [availableProjects, setAvailableProjects] = useState<ProjectItem[]>([]);
    const [availableObjectives, setAvailableObjectives] = useState<ObjectiveItem[]>([]);
    const [linkSearchQuery, setLinkSearchQuery] = useState('');
    const [showLinkSelector, setShowLinkSelector] = useState(false);

    // Edit mode
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editType, setEditType] = useState('');

    // Handle URL params for creating notes from content detail
    useEffect(() => {
        const newParam = searchParams.get('new');
        const typeParam = searchParams.get('type');
        const contentIdParam = searchParams.get('content_id');

        if (newParam === 'true') {
            if (typeParam && Object.keys(NOTE_TYPES).includes(typeParam)) {
                setQuickType(typeParam);
            }
            if (contentIdParam) {
                setQuickLinkType('content');
                setQuickLinkedId(contentIdParam);
            }
            setShowCreateModal(true);
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
    }, [user, filterType, searchQuery, showCompleted]);

    const fetchAvailableItems = async () => {
        try {
            const { data: contents } = await supabase
                .from('contents')
                .select('id, title, type')
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .limit(100);
            if (contents) setAvailableContents(contents);

            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, icon, color')
                .order('created_at', { ascending: false });
            if (projects) setAvailableProjects(projects);

            const { data: objectives } = await supabase
                .from('objectives')
                .select('id, title, icon, color')
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            if (objectives) setAvailableObjectives(objectives);
        } catch (error) {
            console.error('Error fetching available items:', error);
        }
    };

    const fetchNotes = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const requestBody: Record<string, unknown> = {
                limit: 100,
                offset: 0,
            };

            if (filterType !== 'all') {
                requestBody.note_types = [filterType];
            }
            if (searchQuery) {
                requestBody.query = searchQuery;
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
                let data = result.data || [];

                // Filter completed actions if needed
                if (!showCompleted && filterType === 'action') {
                    data = data.filter((n: Note) => !n.is_completed);
                }

                setNotes(data);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickContent.trim()) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            // Generate title from content (first line or first 50 chars)
            const firstLine = quickContent.split('\n')[0].trim();
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

            const noteData: Record<string, unknown> = {
                title,
                content: quickContent,
                note_type: quickType,
                tags: [],
                linked_content_ids: quickLinkType === 'content' && quickLinkedId ? [quickLinkedId] : [],
                linked_note_ids: [],
                linked_project_id: quickLinkType === 'project' && quickLinkedId ? quickLinkedId : null,
                linked_model_id: null,
            };

            // For objectives, we'll store in source_content_id with a prefix or use linked_content_ids
            // Actually objectives link through content, so we'll need to handle this differently
            // For now, store objective link in a tag or source_content_id
            if (quickLinkType === 'objective' && quickLinkedId) {
                noteData.source_content_id = quickLinkedId; // Temporary: using source_content_id for objectives
            }

            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(noteData),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetQuickForm();
                fetchNotes();
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleComplete = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
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
                // Optimistic update
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

    const handleTogglePin = async (note: Note, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
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

    const handleUpdateNote = async (e: React.FormEvent) => {
        e.preventDefault();
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
                setShowDetailModal(false);
                setSelectedNote(null);
                fetchNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const resetQuickForm = () => {
        setQuickContent('');
        setQuickType('reflection');
        setQuickLinkType(null);
        setQuickLinkedId(null);
        setLinkSearchQuery('');
        setShowLinkSelector(false);
    };

    const openNoteDetail = (note: Note) => {
        setSelectedNote(note);
        setEditContent(note.content);
        setEditType(note.note_type);
        setShowDetailModal(true);
        setEditMode(false);
    };

    const getLinkedItemName = useCallback(() => {
        if (!quickLinkedId) return null;
        if (quickLinkType === 'content') {
            const item = availableContents.find(c => c.id === quickLinkedId);
            return item ? `📄 ${item.title}` : null;
        }
        if (quickLinkType === 'project') {
            const item = availableProjects.find(p => p.id === quickLinkedId);
            return item ? `${item.icon || '📁'} ${item.name}` : null;
        }
        if (quickLinkType === 'objective') {
            const item = availableObjectives.find(o => o.id === quickLinkedId);
            return item ? `${item.icon || '🎯'} ${item.title}` : null;
        }
        return null;
    }, [quickLinkedId, quickLinkType, availableContents, availableProjects, availableObjectives]);

    const getFilteredItems = useCallback(() => {
        const query = linkSearchQuery.toLowerCase();
        if (quickLinkType === 'content') {
            return availableContents.filter(c => c.title.toLowerCase().includes(query));
        }
        if (quickLinkType === 'project') {
            return availableProjects.filter(p => p.name.toLowerCase().includes(query));
        }
        if (quickLinkType === 'objective') {
            return availableObjectives.filter(o => o.title.toLowerCase().includes(query));
        }
        return [];
    }, [quickLinkType, linkSearchQuery, availableContents, availableProjects, availableObjectives]);

    // Get linked object display for list view
    const getLinkedObjectDisplay = (note: Note) => {
        if (note.source_content) {
            return {
                icon: '📄',
                label: note.source_content.title,
                href: `/dashboard?content=${note.source_content.id}`,
                color: 'text-blue-600 dark:text-blue-400',
            };
        }
        if (note.linked_project) {
            return {
                icon: note.linked_project.icon || '📁',
                label: note.linked_project.name,
                href: `/projects?id=${note.linked_project.id}`,
                color: 'text-green-600 dark:text-green-400',
            };
        }
        if (note.linked_model) {
            return {
                icon: '🧠',
                label: note.linked_model.taxonomy_value,
                href: `/mental-models?id=${note.linked_model.id}`,
                color: 'text-amber-600 dark:text-amber-400',
            };
        }
        // Check linked_content_ids (for manually linked contents)
        if (note.linked_content_ids && note.linked_content_ids.length > 0) {
            const content = availableContents.find(c => c.id === note.linked_content_ids[0]);
            if (content) {
                return {
                    icon: '📄',
                    label: content.title,
                    href: `/dashboard?content=${content.id}`,
                    color: 'text-blue-600 dark:text-blue-400',
                };
            }
        }
        return null;
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
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
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
                                resetQuickForm();
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
            <div className="max-w-5xl mx-auto px-4 py-4">
                <div className="flex gap-4 items-center flex-wrap">
                    <input
                        type="text"
                        placeholder="Buscar notas..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-4 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg w-64"
                    />
                    <div className="flex gap-2 flex-wrap">
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
                    {filterType === 'action' && (
                        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <input
                                type="checkbox"
                                checked={showCompleted}
                                onChange={(e) => setShowCompleted(e.target.checked)}
                                className="rounded"
                            />
                            Mostrar completadas
                        </label>
                    )}
                </div>
            </div>

            {/* Main content - List view */}
            <main className="max-w-5xl mx-auto px-4 py-4">
                {notes.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📝</div>
                        <h2 className="text-xl font-semibold mb-2 dark:text-white">No tienes notas</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Escribe reflexiones, ideas, preguntas, conexiones o acciones.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear primera nota
                        </button>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 divide-y dark:divide-gray-700">
                        {notes.map(note => {
                            const typeConfig = NOTE_TYPES[note.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                            const linkedObject = getLinkedObjectDisplay(note);
                            const isAction = note.note_type === 'action';

                            return (
                                <div
                                    key={note.id}
                                    onClick={() => openNoteDetail(note)}
                                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${note.is_completed ? 'opacity-60' : ''}`}
                                >
                                    {/* Checkbox for actions */}
                                    {isAction && (
                                        <button
                                            onClick={(e) => handleToggleComplete(note, e)}
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                note.is_completed
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'border-gray-400 dark:border-gray-500 hover:border-green-500'
                                            }`}
                                        >
                                            {note.is_completed && '✓'}
                                        </button>
                                    )}

                                    {/* Type badge */}
                                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${typeConfig.color}`}>
                                        {typeConfig.icon}
                                    </span>

                                    {/* Pin indicator */}
                                    {note.is_pinned && (
                                        <span className="text-indigo-500 flex-shrink-0">📌</span>
                                    )}

                                    {/* Content preview */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm dark:text-gray-200 truncate ${note.is_completed ? 'line-through' : ''}`}>
                                            {note.content.split('\n')[0].slice(0, 100)}
                                        </p>
                                    </div>

                                    {/* Linked object */}
                                    {linkedObject && (
                                        <Link
                                            href={linkedObject.href}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`flex items-center gap-1 text-xs ${linkedObject.color} hover:underline flex-shrink-0 max-w-[200px]`}
                                        >
                                            <span>{linkedObject.icon}</span>
                                            <span className="truncate">{linkedObject.label}</span>
                                        </Link>
                                    )}

                                    {/* Date */}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                        {new Date(note.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Quick Create Modal - Simplified */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
                        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold dark:text-white">Nueva Nota</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleQuickCreate} className="p-4">
                            {/* Type selector */}
                            <div className="flex gap-2 flex-wrap mb-4">
                                {Object.entries(NOTE_TYPES).map(([type, config]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setQuickType(type)}
                                        className={`px-3 py-1 rounded-full text-sm ${quickType === type ? config.color : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                                    >
                                        {config.icon} {config.label}
                                    </button>
                                ))}
                            </div>

                            {/* Single text box */}
                            <textarea
                                value={quickContent}
                                onChange={(e) => setQuickContent(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm resize-none"
                                rows={6}
                                placeholder="Escribe tu nota aqui..."
                                autoFocus
                            />

                            {/* Link selector */}
                            <div className="mt-4">
                                {getLinkedItemName() ? (
                                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                                        <span className="text-sm dark:text-gray-300 truncate">{getLinkedItemName()}</span>
                                        <button
                                            type="button"
                                            onClick={() => { setQuickLinkedId(null); setQuickLinkType(null); }}
                                            className="text-red-500 hover:text-red-700 ml-2"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowLinkSelector(!showLinkSelector)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-left text-sm flex items-center justify-between"
                                        >
                                            <span>+ Vincular a contenido, proyecto u objetivo</span>
                                            <span>{showLinkSelector ? '▲' : '▼'}</span>
                                        </button>

                                        {showLinkSelector && (
                                            <div className="mt-2 border dark:border-gray-600 rounded-lg overflow-hidden">
                                                {/* Link type tabs */}
                                                <div className="flex border-b dark:border-gray-600">
                                                    {[
                                                        { type: 'content' as LinkType, label: '📄 Contenido', count: availableContents.length },
                                                        { type: 'project' as LinkType, label: '📁 Proyecto', count: availableProjects.length },
                                                        { type: 'objective' as LinkType, label: '🎯 Objetivo', count: availableObjectives.length },
                                                    ].map(tab => (
                                                        <button
                                                            key={tab.type}
                                                            type="button"
                                                            onClick={() => { setQuickLinkType(tab.type); setLinkSearchQuery(''); }}
                                                            className={`flex-1 px-2 py-2 text-xs ${quickLinkType === tab.type ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {quickLinkType && (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={linkSearchQuery}
                                                            onChange={(e) => setLinkSearchQuery(e.target.value)}
                                                            placeholder="Buscar..."
                                                            className="w-full px-3 py-2 border-b dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                                                        />
                                                        <div className="max-h-40 overflow-y-auto">
                                                            {getFilteredItems().slice(0, 15).map((item: ContentItem | ProjectItem | ObjectiveItem) => (
                                                                <button
                                                                    key={item.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setQuickLinkedId(item.id);
                                                                        setShowLinkSelector(false);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-300"
                                                                >
                                                                    {'title' in item ? item.title : item.name}
                                                                </button>
                                                            ))}
                                                            {getFilteredItems().length === 0 && (
                                                                <div className="px-3 py-2 text-sm text-gray-500">No hay items</div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="flex gap-2 justify-end mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !quickContent.trim()}
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b dark:border-gray-700 flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const typeConfig = NOTE_TYPES[selectedNote.note_type as keyof typeof NOTE_TYPES] || NOTE_TYPES.reflection;
                                    return (
                                        <span className={`text-sm px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                            {typeConfig.icon} {typeConfig.label}
                                        </span>
                                    );
                                })()}
                                {selectedNote.is_completed && (
                                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                                        Completada
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTogglePin(selectedNote)}
                                    className={`p-2 rounded-lg ${selectedNote.is_pinned ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    title={selectedNote.is_pinned ? 'Desanclar' : 'Anclar'}
                                >
                                    📌
                                </button>
                                {selectedNote.note_type === 'action' && (
                                    <button
                                        onClick={(e) => handleToggleComplete(selectedNote, e)}
                                        className={`p-2 rounded-lg ${selectedNote.is_completed ? 'bg-green-100 dark:bg-green-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title={selectedNote.is_completed ? 'Marcar pendiente' : 'Completar'}
                                    >
                                        ✅
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setSelectedNote(null);
                                        setEditMode(false);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1">
                            {editMode ? (
                                <form onSubmit={handleUpdateNote}>
                                    <div className="flex gap-2 flex-wrap mb-4">
                                        {Object.entries(NOTE_TYPES).map(([type, config]) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setEditType(type)}
                                                className={`px-3 py-1 rounded-full text-sm ${editType === type ? config.color : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                                            >
                                                {config.icon} {config.label}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm resize-none"
                                        rows={12}
                                    />
                                    <div className="flex gap-2 justify-end mt-4">
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
                                    <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 text-sm">
                                        {selectedNote.content}
                                    </pre>

                                    {/* Linked objects */}
                                    {(() => {
                                        const linked = getLinkedObjectDisplay(selectedNote);
                                        if (!linked) return null;
                                        return (
                                            <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                                    Vinculado a
                                                </h4>
                                                <Link
                                                    href={linked.href}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 ${linked.color}`}
                                                >
                                                    <span>{linked.icon}</span>
                                                    <span className="text-sm">{linked.label}</span>
                                                </Link>
                                            </div>
                                        );
                                    })()}

                                    {/* Date */}
                                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                                        Creada: {new Date(selectedNote.created_at).toLocaleString()}
                                    </div>
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
