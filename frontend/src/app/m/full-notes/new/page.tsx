'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { NoteEditor } from '@/components/editor';

// Hardcoded API URL - always use HTTPS in production
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

export default function MobileNewNotePage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [saving, setSaving] = useState(false);
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

            const response = await fetch(`${API_URL}/api/v1/content/note`, {
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

            router.push('/m/full-notes');

        } catch (err: any) {
            setError(err.message || 'Error al guardar la nota');
        } finally {
            setSaving(false);
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

    return (
        <div className={`min-h-screen ${bgClass}`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 ${cardClass} border-b ${borderClass} px-4 py-3`}>
                <div className="flex items-center justify-between">
                    <Link href="/m/full-notes" className={`${mutedTextClass} text-lg`}>
                        ←
                    </Link>
                    <h1 className={`text-base font-semibold ${textClass}`}>
                        Nueva Nota
                    </h1>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
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
                        autoFocus
                    />
                </div>

                {/* Editor */}
                <div className={`${cardClass} rounded-xl border ${borderClass} overflow-hidden`}>
                    <NoteEditor
                        placeholder="Escribe tu nota aqui..."
                        onChange={handleEditorChange}
                        disabled={saving}
                    />
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

                {/* Info */}
                <div className={`${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4`}>
                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                        Al guardar, la nota sera clasificada y preparada para busqueda automaticamente.
                    </p>
                </div>
            </div>
        </div>
    );
}
