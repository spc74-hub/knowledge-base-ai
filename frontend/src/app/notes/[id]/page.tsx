'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    linked_contents?: Array<{ id: string; title: string; type: string; url?: string }>;
    linked_notes?: Array<{ id: string; title: string; note_type: string }>;
}

const NOTE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
    reflection: { label: 'Reflexion', icon: '💭' },
    idea: { label: 'Idea', icon: '💡' },
    question: { label: 'Pregunta', icon: '❓' },
    connection: { label: 'Conexion', icon: '🔗' },
};

export default function NoteDetailPage() {
    const router = useRouter();
    const params = useParams();
    const noteId = params.id as string;
    const { user, loading: authLoading, token } = useAuth();
    const [note, setNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getAuthHeaders = useCallback(() => {
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, [token]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user && noteId && token) {
            fetchNote();
        }
    }, [user, noteId, token]);

    const fetchNote = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/v1/notes/${noteId}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    setError('Nota no encontrada');
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || 'Error al cargar la nota');
                }
                return;
            }

            const data = await response.json();
            setNote(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar la nota');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePin = async () => {
        if (!note) return;
        try {
            const response = await fetch(`${API_URL}/api/v1/notes/${noteId}/pin`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (response.ok) {
                const data = await response.json();
                setNote({ ...note, is_pinned: data.is_pinned });
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estas seguro de ELIMINAR esta nota? Esta accion no se puede deshacer.')) return;

        try {
            const response = await fetch(`${API_URL}/api/v1/notes/${noteId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (response.ok) {
                router.push('/notes');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-gray-400">Cargando...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (error || !note) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error || 'Nota no encontrada'}</p>
                    <Link
                        href="/notes"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        Volver a Notas
                    </Link>
                </div>
            </div>
        );
    }

    const noteType = NOTE_TYPE_LABELS[note.note_type] || NOTE_TYPE_LABELS.reflection;

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/notes" className="text-gray-400 hover:text-white">
                            ← Notas
                        </Link>
                        <div className="flex items-center gap-2">
                            <span>{noteType.icon}</span>
                            <span className="text-sm text-gray-500">{noteType.label}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTogglePin}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                note.is_pinned
                                    ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            {note.is_pinned ? '📌 Fijada' : '📌 Fijar'}
                        </button>
                        <Link
                            href={`/notes/${noteId}/edit`}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm"
                        >
                            Editar
                        </Link>
                        <button
                            onClick={handleDelete}
                            className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-1.5 rounded-lg text-sm"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-4">{note.title}</h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8">
                    <span>Creada: {formatDate(note.created_at)}</span>
                    {note.updated_at !== note.created_at && (
                        <span>Actualizada: {formatDate(note.updated_at)}</span>
                    )}
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8">
                        {note.tags.map((tag, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
                    <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: note.content || '<p class="text-gray-500">Sin contenido</p>' }}
                    />
                </div>

                {/* Linked Contents */}
                {note.linked_contents && note.linked_contents.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Contenidos vinculados</h2>
                        <div className="space-y-2">
                            {note.linked_contents.map((content) => (
                                <Link
                                    key={content.id}
                                    href={`/explore?content=${content.id}`}
                                    className="block bg-gray-900/50 border border-gray-800 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="text-white">{content.title}</div>
                                    <div className="text-sm text-gray-500">{content.type}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Linked Notes */}
                {note.linked_notes && note.linked_notes.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-white mb-4">Notas vinculadas</h2>
                        <div className="space-y-2">
                            {note.linked_notes.map((linkedNote) => (
                                <Link
                                    key={linkedNote.id}
                                    href={`/notes/${linkedNote.id}`}
                                    className="block bg-gray-900/50 border border-gray-800 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{NOTE_TYPE_LABELS[linkedNote.note_type]?.icon || '📝'}</span>
                                        <span className="text-white">{linkedNote.title}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
