'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { NoteEditor } from '@/components/editor';

interface NoteContent {
    id: string;
    title: string;
    raw_content: string;
    user_tags: string[];
    type: string;
}

export default function EditNotePage() {
    const router = useRouter();
    const params = useParams();
    const noteId = params.id as string;
    const { user, loading: authLoading } = useAuth();
    const [note, setNote] = useState<NoteContent | null>(null);
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user && noteId) {
            fetchNote();
        }
    }, [user, noteId]);

    const fetchNote = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('contents')
                .select('id, title, raw_content, user_tags, type')
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

            const response = await fetch(`http://localhost:8000/api/v1/content/note/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: title.trim(),
                    content: htmlContent || content.trim(),
                    tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al guardar la nota');
            }

            router.push('/dashboard');

        } catch (err: any) {
            setError(err.message || 'Error al guardar la nota');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (error && !note) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                    >
                        Volver al dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                            ← Volver
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">Editar Nota</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-sm">
                    {error && (
                        <div className="mx-6 mt-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="p-6 border-b">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Titulo de la nota"
                            className="w-full text-3xl font-bold text-gray-900 placeholder-gray-400 focus:outline-none"
                            disabled={saving}
                        />
                    </div>

                    {/* Editor */}
                    <div className="border-b">
                        {note && (
                            <NoteEditor
                                initialContent={note.raw_content || ''}
                                placeholder="Escribe tu nota aqui... Usa la barra de herramientas para dar formato."
                                currentNoteId={noteId}
                                onChange={handleEditorChange}
                                disabled={saving}
                            />
                        )}
                    </div>

                    {/* Tags */}
                    <div className="p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tags (opcional, separados por coma)
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="personal, ideas, proyecto"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                            disabled={saving}
                        />
                    </div>

                    {/* Info box */}
                    <div className="px-6 pb-6">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                <strong>Re-procesamiento AI:</strong> Al guardar cambios en el titulo o contenido,
                                la nota sera re-clasificada, resumida y sus embeddings actualizados automaticamente.
                            </p>
                        </div>
                    </div>

                    {/* Keyboard shortcuts info */}
                    <div className="px-6 pb-6">
                        <details className="text-sm text-gray-600">
                            <summary className="cursor-pointer hover:text-gray-900 font-medium">
                                Atajos de teclado
                            </summary>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+B</kbd> Negrita</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+I</kbd> Cursiva</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+U</kbd> Subrayado</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Z</kbd> Deshacer</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Shift+7</kbd> Lista numerada</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Shift+8</kbd> Lista con viñetas</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Shift+9</kbd> Lista de tareas</div>
                                <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+`</kbd> Codigo</div>
                            </div>
                        </details>
                    </div>
                </div>
            </main>
        </div>
    );
}
