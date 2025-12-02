'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { NoteEditor } from '@/components/editor';

export default function NewNotePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

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

            const response = await fetch('http://localhost:8000/api/v1/content/note', {
                method: 'POST',
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

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                            ← Volver
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Nota</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : 'Guardar Nota'}
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    {error && (
                        <div className="mx-6 mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="p-6 border-b dark:border-gray-600">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Titulo de la nota"
                            className="w-full text-3xl font-bold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none bg-transparent"
                            disabled={saving}
                        />
                    </div>

                    {/* Editor */}
                    <div className="border-b dark:border-gray-600">
                        <NoteEditor
                            placeholder="Escribe tu nota aqui... Usa la barra de herramientas para dar formato."
                            onChange={handleEditorChange}
                            disabled={saving}
                        />
                    </div>

                    {/* Tags */}
                    <div className="p-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tags (opcional, separados por coma)
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="personal, ideas, proyecto"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            disabled={saving}
                        />
                    </div>

                    {/* Info box */}
                    <div className="px-6 pb-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>AI Processing:</strong> Al guardar, la nota sera automaticamente clasificada,
                                resumida y preparada para busqueda semantica, igual que el resto de tu contenido.
                            </p>
                        </div>
                    </div>

                    {/* Keyboard shortcuts info */}
                    <div className="px-6 pb-6">
                        <details className="text-sm text-gray-600 dark:text-gray-400">
                            <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-white font-medium">
                                Atajos de teclado
                            </summary>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+B</kbd> Negrita</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+I</kbd> Cursiva</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+U</kbd> Subrayado</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Z</kbd> Deshacer</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Shift+7</kbd> Lista numerada</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Shift+8</kbd> Lista con viñetas</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Shift+9</kbd> Lista de tareas</div>
                                <div><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+`</kbd> Codigo</div>
                            </div>
                        </details>
                    </div>
                </div>
            </main>
        </div>
    );
}
