'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { NoteEditor } from '@/components/editor';

// Hardcoded API URL - always use HTTPS in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const PRIORITIES = {
    important: { label: 'Importante', icon: '🔴', color: 'bg-red-500' },
    urgent: { label: 'Urgente', icon: '🟠', color: 'bg-orange-500' },
    A: { label: 'A', icon: '🔵', color: 'bg-blue-500' },
    B: { label: 'B', icon: '🔷', color: 'bg-blue-400' },
    C: { label: 'C', icon: '🩵', color: 'bg-cyan-400' },
} as const;

interface NoteContent {
    id: string;
    title: string;
    raw_content: string;
    user_tags: string[];
    type: string;
    priority: string | null;
}

export default function MobileEditNotePage() {
    const router = useRouter();
    const params = useParams();
    const noteId = params.id as string;
    const [note, setNote] = useState<NoteContent | null>(null);
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState('');
    const [priority, setPriority] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (noteId) {
            fetchNote();
        }
    }, [noteId]);

    const fetchNote = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('contents')
                .select('id, title, raw_content, user_tags, type, priority')
                .eq('id', noteId)
                .eq('type', 'note')
                .single();

            if (fetchError) throw fetchError;

            if (!data) {
                setError('Nota no encontrada');
                return;
            }

            setNote(data);
            setTitle(data.title || '');
            setTags((data.user_tags || []).join(', '));
            setPriority(data.priority || null);
            setContent(data.raw_content || '');
            setHtmlContent(data.raw_content || '');
        } catch (err: any) {
            setError(err.message || 'Error al cargar la nota');
        } finally {
            setLoading(false);
        }
    };

    const handleEditorChange = useCallback((text: string, html: string) => {
        setContent(text);
        setHtmlContent(html);
    }, []);

    const handleSave = async () => {
        if (!title.trim()) {
            setError('El titulo es obligatorio');
            return;
        }

        if (!content.trim()) {
            setError('El contenido es obligatorio');
            return;
        }

        setError(null);
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const response = await fetch(`${API_URL}/api/v1/content/note/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: title.trim(),
                    content: htmlContent || content.trim(),
                    tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
                    priority: priority || ''
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al guardar la nota');
            }

            router.push('/m/full-notes');

        } catch (err: any) {
            setError(err.message || 'Error al guardar la nota');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Eliminar esta nota?')) {
            return;
        }

        setDeleting(true);
        setError(null);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const response = await fetch(`${API_URL}/api/v1/content/${noteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al eliminar la nota');
            }

            router.push('/m/full-notes');

        } catch (err: any) {
            setError(err.message || 'Error al eliminar la nota');
        } finally {
            setDeleting(false);
        }
    };

    const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardClass = isDark ? 'bg-gray-800' : 'bg-white';
    const textClass = isDark ? 'text-white' : 'text-gray-900';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
    const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400';

    if (loading) {
        return (
            <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error && !note) {
        return (
            <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
                <div className={`${cardClass} rounded-xl p-6 text-center max-w-sm`}>
                    <p className="text-red-500 mb-4">{error}</p>
                    <Link
                        href="/m/full-notes"
                        className="inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg"
                    >
                        Volver a Full Notes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${bgClass}`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 ${cardClass} border-b ${borderClass} px-4 py-3`}>
                <div className="flex items-center justify-between">
                    <Link href="/m/full-notes" className={`${mutedTextClass} text-lg`}>
                        ←
                    </Link>
                    <h1 className={`text-base font-semibold ${textClass} truncate mx-2 flex-1`}>
                        Editar Nota
                    </h1>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDelete}
                            disabled={deleting || saving}
                            className="px-3 py-1.5 text-red-500 text-sm disabled:opacity-50"
                        >
                            {deleting ? '...' : '🗑️'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || deleting}
                            className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {error && (
                    <div className="bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Title */}
                <div>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Titulo de la nota"
                        className={`w-full px-4 py-3 text-xl font-semibold rounded-xl border ${inputClass}`}
                        disabled={saving}
                    />
                </div>

                {/* Priority */}
                <div className="flex items-center gap-2">
                    <span className={`text-sm ${mutedTextClass}`}>Prioridad:</span>
                    <select
                        value={priority || ''}
                        onChange={(e) => setPriority(e.target.value || null)}
                        disabled={saving}
                        className={`flex-1 px-3 py-2 rounded-lg border text-sm ${inputClass}`}
                    >
                        <option value="">Sin prioridad</option>
                        {Object.entries(PRIORITIES).map(([key, val]) => (
                            <option key={key} value={key}>{val.icon} {val.label}</option>
                        ))}
                    </select>
                </div>

                {/* Editor */}
                <div className={`${cardClass} rounded-xl border ${borderClass} overflow-hidden`}>
                    {note && (
                        <NoteEditor
                            initialContent={note.raw_content || ''}
                            placeholder="Escribe tu nota aqui..."
                            currentNoteId={noteId}
                            onChange={handleEditorChange}
                            disabled={saving}
                        />
                    )}
                </div>

                {/* Tags */}
                <div>
                    <label className={`block text-sm font-medium ${mutedTextClass} mb-2`}>
                        Tags (separados por coma)
                    </label>
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="personal, ideas, proyecto"
                        className={`w-full px-4 py-2 rounded-xl border ${inputClass}`}
                        disabled={saving}
                    />
                </div>
            </div>
        </div>
    );
}
