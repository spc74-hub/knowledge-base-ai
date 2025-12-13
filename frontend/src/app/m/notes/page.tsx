'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
} as const;

const PRIORITIES = {
    important: { label: 'Importante', icon: '🔴', color: 'bg-red-500' },
    urgent: { label: 'Urgente', icon: '🟠', color: 'bg-orange-500' },
    A: { label: 'A', icon: '🔵', color: 'bg-blue-500' },
    B: { label: 'B', icon: '🔷', color: 'bg-blue-400' },
    C: { label: 'C', icon: '🩵', color: 'bg-cyan-400' },
} as const;

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

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
    const [filterPriority, setFilterPriority] = useState<string>('all');
    const [isDark, setIsDark] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    // Form states
    const [quickContent, setQuickContent] = useState('');
    const [quickType, setQuickType] = useState<string>('reflection');
    const [quickPriority, setQuickPriority] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);

    // Edit mode
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editType, setEditType] = useState('');
    const [editPriority, setEditPriority] = useState<string>('');
    const editEditorRef = useRef<HTMLDivElement>(null);

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
                include_full_notes: false,
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
                let notesData = result.data || [];

                // Filter by priority client-side
                if (filterPriority !== 'all') {
                    notesData = notesData.filter((n: Note) => n.priority === filterPriority);
                }

                setNotes(notesData);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType, filterPriority]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    // Rich text formatting
    const insertCheckboxAtCursor = (editorElement: HTMLDivElement | null) => {
        if (!editorElement) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            editorElement.focus();
        }

        const checkboxHtml = '<label class="checkbox-item"><input type="checkbox" class="mr-2 w-4 h-4 accent-amber-500" /><span></span></label><br/>';
        document.execCommand('insertHTML', false, checkboxHtml);
    };

    const execCommand = (command: string, value?: string) => {
        if (command === 'insertCheckbox') {
            insertCheckboxAtCursor(editorRef.current);
        } else {
            document.execCommand(command, false, value);
        }
        editorRef.current?.focus();
    };

    const execEditCommand = (command: string, value?: string) => {
        if (command === 'insertCheckbox') {
            insertCheckboxAtCursor(editEditorRef.current);
        } else {
            document.execCommand(command, false, value);
        }
        editEditorRef.current?.focus();
    };

    const handleQuickCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = editorRef.current?.innerHTML || quickContent;
        if (!content.trim() || content === '<br>') return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const plainText = stripHtmlTags(content);
            const firstLine = plainText.split('\n')[0].trim();
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

            const body: Record<string, unknown> = {
                title,
                content,
                note_type: quickType,
                tags: [],
                linked_content_ids: [],
                linked_note_ids: [],
            };

            if (quickPriority) {
                body.priority = quickPriority;
            }

            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                setShowCreate(false);
                setQuickContent('');
                setQuickType('reflection');
                setQuickPriority('');
                if (editorRef.current) editorRef.current.innerHTML = '';
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

    const handleUpdatePriority = async (note: Note, priority: string | null) => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/${note.id}/priority`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ priority }),
            });

            if (response.ok) {
                fetchNotes();
                if (selectedNote?.id === note.id) {
                    setSelectedNote({ ...note, priority });
                }
            }
        } catch (error) {
            console.error('Error updating priority:', error);
        }
    };

    const handleUpdateNote = async () => {
        if (!selectedNote) return;
        const content = editEditorRef.current?.innerHTML || editContent;
        if (!content.trim()) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const plainText = stripHtmlTags(content);
            const firstLine = plainText.split('\n')[0].trim();
            const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

            const response = await fetch(`${API_URL}/api/v1/notes/${selectedNote.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title,
                    content,
                    note_type: editType,
                }),
            });

            if (response.ok) {
                // Update priority if changed
                if (editPriority !== (selectedNote.priority || '')) {
                    await handleUpdatePriority(selectedNote, editPriority || null);
                }
                setEditMode(false);
                fetchNotes();
                const updated = await response.json();
                setSelectedNote({ ...updated, priority: editPriority || null });
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
        setEditContent(note.content);
        setEditType(note.note_type);
        setEditPriority(note.priority || '');
        setShowDetail(true);
        setEditMode(false);
    };

    // Set edit content when entering edit mode
    useEffect(() => {
        if (editMode && editEditorRef.current && selectedNote) {
            editEditorRef.current.innerHTML = selectedNote.content;
        }
    }, [editMode, selectedNote]);

    if (loading && notes.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    const RichTextToolbar = ({ onCommand, isDark }: { onCommand: (cmd: string, val?: string) => void; isDark: boolean }) => (
        <div className={`flex flex-wrap gap-1 p-2 border-b ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
            <button type="button" onClick={() => onCommand('bold')} className={`p-2 rounded font-bold ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>B</button>
            <button type="button" onClick={() => onCommand('italic')} className={`p-2 rounded italic ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>I</button>
            <button type="button" onClick={() => onCommand('strikeThrough')} className={`p-2 rounded line-through ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>S</button>
            <span className={`w-px mx-1 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></span>
            <button type="button" onClick={() => onCommand('formatBlock', 'h1')} className={`p-2 rounded text-sm font-bold ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>H1</button>
            <button type="button" onClick={() => onCommand('formatBlock', 'h2')} className={`p-2 rounded text-sm font-bold ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}>H2</button>
            <span className={`w-px mx-1 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></span>
            <button type="button" onClick={() => onCommand('insertUnorderedList')} className={`p-2 rounded ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`} title="Lista con viñetas">•</button>
            <button type="button" onClick={() => onCommand('insertOrderedList')} className={`p-2 rounded ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`} title="Lista numerada">1.</button>
            <button type="button" onClick={() => onCommand('insertCheckbox')} className={`p-2 rounded ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`} title="Checkbox">☑</button>
        </div>
    );

    const PrioritySelector = ({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) => (
        <div className="flex gap-1 items-center">
            <button
                type="button"
                onClick={() => onChange('')}
                className={`px-2 py-1 rounded text-xs ${!value ? 'bg-gray-500 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}
            >
                Sin
            </button>
            {Object.entries(PRIORITIES).map(([key, p]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={`p-1.5 rounded text-sm ${value === key ? p.color + ' text-white' : isDark ? 'bg-gray-700' : 'bg-gray-100'}`}
                    title={p.label}
                >
                    {p.icon}
                </button>
            ))}
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header with filter button */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setShowSidebar(true)}
                    className={`p-2 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'} shadow-sm`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                </button>
                <div className="flex gap-2">
                    {filterType !== 'all' && (
                        <span className={`text-xs px-2 py-1 rounded-full ${NOTE_TYPES[filterType as keyof typeof NOTE_TYPES]?.color || 'bg-gray-200'}`}>
                            {NOTE_TYPES[filterType as keyof typeof NOTE_TYPES]?.icon} {NOTE_TYPES[filterType as keyof typeof NOTE_TYPES]?.label}
                        </span>
                    )}
                    {filterPriority !== 'all' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200">
                            {PRIORITIES[filterPriority as keyof typeof PRIORITIES]?.icon}
                        </span>
                    )}
                </div>
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
                        const priorityConfig = note.priority ? PRIORITIES[note.priority as keyof typeof PRIORITIES] : null;

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
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                                                {typeConfig.icon}
                                            </span>
                                            {note.is_pinned && <span className="text-amber-500">📌</span>}
                                            {priorityConfig && (
                                                <span className="text-sm" title={priorityConfig.label}>
                                                    {priorityConfig.icon}
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

            {/* Sidebar Filter */}
            {showSidebar && (
                <div className="fixed inset-0 bg-black/50 z-[100]" onClick={() => setShowSidebar(false)}>
                    <div
                        className={`absolute left-0 top-0 bottom-0 w-72 p-4 animate-slide-right ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Filtros</h2>
                            <button onClick={() => setShowSidebar(false)} className={isDark ? 'text-gray-400' : 'text-gray-500'}>✕</button>
                        </div>

                        {/* Type filter */}
                        <div className="mb-6">
                            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tipo de nota</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => { setFilterType('all'); setShowSidebar(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                        filterType === 'all'
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    Todas
                                </button>
                                {Object.entries(NOTE_TYPES).map(([type, config]) => (
                                    <button
                                        key={type}
                                        onClick={() => { setFilterType(type); setShowSidebar(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                                            filterType === type
                                                ? 'bg-amber-500 text-white'
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <span>{config.icon}</span>
                                        <span>{config.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority filter */}
                        <div>
                            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Prioridad</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => { setFilterPriority('all'); setShowSidebar(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                                        filterPriority === 'all'
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    Todas
                                </button>
                                {Object.entries(PRIORITIES).map(([key, p]) => (
                                    <button
                                        key={key}
                                        onClick={() => { setFilterPriority(key); setShowSidebar(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                                            filterPriority === key
                                                ? 'bg-amber-500 text-white'
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <span>{p.icon}</span>
                                        <span>{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-4 overflow-y-auto pb-20">
                    <div
                        className={`w-full mx-4 my-4 rounded-2xl overflow-hidden animate-slide-down flex flex-col ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 32px)' }}
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

                        <form onSubmit={handleQuickCreate} className="flex-1 overflow-y-auto flex flex-col">
                            <div className="p-4 space-y-4 flex-1">
                                {/* Type selector */}
                                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                                    {Object.entries(NOTE_TYPES).map(([type, config]) => (
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

                                {/* Priority selector */}
                                <div>
                                    <label className={`text-sm font-medium mb-2 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Prioridad
                                    </label>
                                    <PrioritySelector value={quickPriority} onChange={setQuickPriority} isDark={isDark} />
                                </div>

                                {/* Rich text editor */}
                                <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                                    <RichTextToolbar onCommand={execCommand} isDark={isDark} />
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        className={`min-h-[150px] p-3 focus:outline-none ${
                                            isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                                        }`}
                                        onInput={(e) => setQuickContent(e.currentTarget.innerHTML)}
                                        data-placeholder="Escribe tu nota..."
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Nota'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetail && selectedNote && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-4 overflow-y-auto pb-20">
                    <div
                        className={`w-full mx-4 my-4 rounded-2xl overflow-hidden animate-slide-down flex flex-col ${
                            isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 32px)' }}
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
                                {selectedNote.priority && (
                                    <span>{PRIORITIES[selectedNote.priority as keyof typeof PRIORITIES]?.icon}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTogglePin(selectedNote)}
                                    className={`p-2 rounded-lg ${selectedNote.is_pinned ? (isDark ? 'bg-amber-900' : 'bg-amber-100') : ''}`}
                                >
                                    📌
                                </button>
                                {selectedNote.note_type === 'action' && (
                                    <button
                                        onClick={() => handleToggleComplete(selectedNote)}
                                        className={`p-2 rounded-lg ${selectedNote.is_completed ? (isDark ? 'bg-green-900' : 'bg-green-100') : ''}`}
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
                                        {Object.entries(NOTE_TYPES).map(([type, config]) => (
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

                                    {/* Priority selector */}
                                    <div>
                                        <label className={`text-sm font-medium mb-2 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Prioridad
                                        </label>
                                        <PrioritySelector value={editPriority} onChange={setEditPriority} isDark={isDark} />
                                    </div>

                                    {/* Rich text editor */}
                                    <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                                        <RichTextToolbar onCommand={execEditCommand} isDark={isDark} />
                                        <div
                                            ref={editEditorRef}
                                            contentEditable
                                            className={`min-h-[200px] p-3 focus:outline-none ${
                                                isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                                            }`}
                                            onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className={`note-content prose prose-sm max-w-none ${isDark ? 'prose-invert text-gray-200' : 'text-gray-700'}`}
                                        dangerouslySetInnerHTML={{ __html: selectedNote.content }}
                                    />
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
                @keyframes slide-down {
                    from {
                        transform: translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                .animate-slide-down {
                    animation: slide-down 0.3s ease-out;
                }
                @keyframes slide-right {
                    from {
                        transform: translateX(-100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-right {
                    animation: slide-right 0.3s ease-out;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                }
                /* Rich text list styles */
                [contenteditable] ul {
                    list-style-type: disc;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                [contenteditable] ol {
                    list-style-type: decimal;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                [contenteditable] li {
                    margin: 0.25rem 0;
                }
                /* Checkbox styles */
                [contenteditable] .checkbox-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0.25rem 0;
                }
                [contenteditable] .checkbox-item input[type="checkbox"] {
                    width: 1.25rem;
                    height: 1.25rem;
                    accent-color: #f59e0b;
                    cursor: pointer;
                }
                [contenteditable] .checkbox-item input[type="checkbox"]:checked + span {
                    text-decoration: line-through;
                    opacity: 0.6;
                }
                /* Note content display styles */
                .note-content ul {
                    list-style-type: disc;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                .note-content ol {
                    list-style-type: decimal;
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                .note-content li {
                    margin: 0.25rem 0;
                }
                .note-content .checkbox-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0.25rem 0;
                }
                .note-content .checkbox-item input[type="checkbox"] {
                    width: 1.25rem;
                    height: 1.25rem;
                    accent-color: #f59e0b;
                    cursor: pointer;
                }
                .note-content .checkbox-item input[type="checkbox"]:checked + span {
                    text-decoration: line-through;
                    opacity: 0.6;
                }
            `}</style>
        </div>
    );
}
