'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ContentDetail {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    iab_tier2: string | null;
    iab_tier3: string | null;
    concepts: string[];
    entities: {
        organizations?: Array<string | { name: string }>;
        products?: Array<string | { name: string }>;
        persons?: Array<string | { name: string }>;
    } | null;
    schema_type: string | null;
    content_format: string | null;
    technical_level: string | null;
    language: string | null;
    sentiment: string | null;
    reading_time_minutes: number | null;
    processing_status: string;
    is_favorite: boolean;
    is_archived: boolean;
    user_tags: string[];
    user_note: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
}

interface ContentDetailModalProps {
    content: ContentDetail | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: (content: ContentDetail) => void;
    onArchive?: (contentId: string) => void;
    onDelete?: (contentId: string) => void;
    onFilterClick?: (filterType: string, value: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
    youtube: '🎬',
    tiktok: '📱',
    twitter: 'X',
    web: '🌐',
    note: '📝',
    apple_notes: '🍎',
    article: '📰',
    video: '🎬',
    default: '📄',
};

export function ContentDetailModal({
    content,
    isOpen,
    onClose,
    onUpdate,
    onArchive,
    onDelete,
    onFilterClick,
}: ContentDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [editingTags, setEditingTags] = useState(false);
    const [editingNote, setEditingNote] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [userNote, setUserNote] = useState('');
    const [userTags, setUserTags] = useState<string[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [reprocessing, setReprocessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        if (content) {
            setUserTags(content.user_tags || []);
            setUserNote(content.user_note || '');
            setIsFavorite(content.is_favorite || false);
            setProcessingStatus(content.processing_status || 'pending');
        }
    }, [content]);

    const getAuthHeaders = useCallback(async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            ...(session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}),
        };
    }, []);

    const handleToggleFavorite = async () => {
        if (!content) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/favorite`, {
                method: 'POST',
                headers,
            });
            if (response.ok) {
                const newValue = !isFavorite;
                setIsFavorite(newValue);
                onUpdate?.({ ...content, is_favorite: newValue });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleArchive = async () => {
        if (!content) return;
        if (!confirm(`¿Estas seguro de ${content.is_archived ? 'restaurar' : 'archivar'} este contenido?`)) return;

        try {
            const headers = await getAuthHeaders();
            const endpoint = content.is_archived ? 'unarchive' : 'archive';
            const response = await fetch(`${API_URL}/api/v1/content/bulk/${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content_ids: [content.id] }),
            });
            if (response.ok) {
                onArchive?.(content.id);
                onClose();
            }
        } catch (error) {
            console.error('Error archiving:', error);
        }
    };

    const handleDelete = async () => {
        if (!content) return;
        if (!confirm('¿Estas seguro de ELIMINAR PERMANENTEMENTE este contenido? Esta accion no se puede deshacer.')) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/bulk/delete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content_ids: [content.id] }),
            });
            if (response.ok) {
                onDelete?.(content.id);
                onClose();
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const handleAddTag = async () => {
        if (!content || !newTag.trim()) return;
        const tag = newTag.trim().toLowerCase();
        if (userTags.includes(tag)) {
            setNewTag('');
            return;
        }

        const updatedTags = [...userTags, tag];
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_tags: updatedTags }),
            });
            if (response.ok) {
                setUserTags(updatedTags);
                setNewTag('');
                onUpdate?.({ ...content, user_tags: updatedTags });
            }
        } catch (error) {
            console.error('Error adding tag:', error);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!content) return;
        const updatedTags = userTags.filter(t => t !== tagToRemove);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_tags: updatedTags }),
            });
            if (response.ok) {
                setUserTags(updatedTags);
                onUpdate?.({ ...content, user_tags: updatedTags });
            }
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    };

    const handleSaveNote = async () => {
        if (!content) return;
        setSavingNote(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_note: userNote }),
            });
            if (response.ok) {
                setEditingNote(false);
                onUpdate?.({ ...content, user_note: userNote });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error saving note:', response.status, errorData);
                alert(`Error al guardar: ${errorData.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Error de conexion al guardar la nota');
        } finally {
            setSavingNote(false);
        }
    };

    const handleReprocess = async () => {
        if (!content) return;
        setReprocessing(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/reprocess`, {
                method: 'POST',
                headers,
            });
            if (response.ok) {
                setProcessingStatus('pending');
                onUpdate?.({ ...content, processing_status: 'pending' });
            }
        } catch (error) {
            console.error('Error reprocessing:', error);
        } finally {
            setReprocessing(false);
        }
    };

    const getTypeIcon = (type: string) => TYPE_ICONS[type] || TYPE_ICONS.default;

    const getEntityName = (entity: string | { name: string }) => {
        return typeof entity === 'string' ? entity : entity.name;
    };

    if (!isOpen || !content) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-3xl">{getTypeIcon(content.type)}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    content.processing_status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                    content.processing_status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                }`}>
                                    {content.processing_status}
                                </span>
                                {content.sentiment && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        content.sentiment === 'positive' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                        content.sentiment === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {content.sentiment}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2 line-clamp-2">
                                {content.title || 'Sin titulo'}
                            </h2>
                            <a
                                href={content.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block mt-1"
                            >
                                {content.url}
                            </a>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-2xl ml-4"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tipo</p>
                            <p className="font-medium capitalize text-gray-900 dark:text-white">{content.type}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Categoria IAB</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.iab_tier1 || '-'}</p>
                            {content.iab_tier2 && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">{content.iab_tier2}</p>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Schema.org</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.schema_type || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Formato</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.content_format || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Nivel Tecnico</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.technical_level || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Idioma</p>
                            <p className="font-medium uppercase text-gray-900 dark:text-white">{content.language || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tiempo Lectura</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.reading_time_minutes ? `${content.reading_time_minutes} min` : '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Fecha</p>
                            <p className="font-medium text-gray-900 dark:text-white">{new Date(content.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Summary */}
                    {content.summary && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Resumen</h3>
                            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                                <p className="text-gray-800 dark:text-gray-200">{content.summary}</p>
                            </div>
                        </div>
                    )}

                    {/* User Tags */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Mis Tags</h3>
                            <button
                                onClick={() => setEditingTags(!editingTags)}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {editingTags ? 'Listo' : 'Editar'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {userTags.map(tag => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 rounded-full text-sm flex items-center gap-1"
                                >
                                    #{tag}
                                    {editingTags && (
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="ml-1 text-indigo-600 dark:text-indigo-400 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            ×
                                        </button>
                                    )}
                                </span>
                            ))}
                            {userTags.length === 0 && !editingTags && (
                                <span className="text-gray-400 text-sm">Sin tags</span>
                            )}
                        </div>
                        {editingTags && (
                            <div className="flex gap-2 mt-3">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                    placeholder="Nuevo tag..."
                                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <button
                                    onClick={handleAddTag}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                                >
                                    Anadir
                                </button>
                            </div>
                        )}
                    </div>

                    {/* User Note */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Mi Nota</h3>
                            {!editingNote && (
                                <button
                                    onClick={() => setEditingNote(true)}
                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {userNote ? 'Editar' : 'Anadir nota'}
                                </button>
                            )}
                        </div>
                        {editingNote ? (
                            <div className="space-y-2">
                                <textarea
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                    rows={4}
                                    placeholder="Escribe tu nota sobre este contenido..."
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => {
                                            setEditingNote(false);
                                            setUserNote(content.user_note || '');
                                        }}
                                        className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveNote}
                                        disabled={savingNote}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {savingNote ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        ) : userNote ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{userNote}</p>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Sin nota adjunta</p>
                        )}
                    </div>

                    {/* Concepts */}
                    {content.concepts && content.concepts.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Conceptos</h3>
                            <div className="flex flex-wrap gap-2">
                                {content.concepts.map(concept => (
                                    <button
                                        key={concept}
                                        onClick={() => onFilterClick?.('concepts', concept)}
                                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
                                    >
                                        {concept}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Entities */}
                    {content.entities && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Entidades</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {content.entities.persons && content.entities.persons.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">👤 Personas</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.persons.map((person, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('persons', getEntityName(person))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900"
                                                >
                                                    {getEntityName(person)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {content.entities.organizations && content.entities.organizations.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🏢 Organizaciones</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.organizations.map((org, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('organizations', getEntityName(org))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900"
                                                >
                                                    {getEntityName(org)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {content.entities.products && content.entities.products.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">📦 Productos</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.products.map((product, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('products', getEntityName(product))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900"
                                                >
                                                    {getEntityName(product)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Metadata (YouTube/TikTok) */}
                    {content.metadata && Object.keys(content.metadata).length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Metadata del {content.type}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <dl className="grid grid-cols-2 gap-2 text-sm">
                                    {content.metadata.channel_name && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Canal:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.channel_name}</dd>
                                        </>
                                    )}
                                    {content.metadata.view_count && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Vistas:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.view_count.toLocaleString()}</dd>
                                        </>
                                    )}
                                    {content.metadata.like_count && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Likes:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.like_count.toLocaleString()}</dd>
                                        </>
                                    )}
                                    {content.metadata.duration && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Duracion:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.duration}s</dd>
                                        </>
                                    )}
                                    {content.metadata.author && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Autor:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.author}</dd>
                                        </>
                                    )}
                                </dl>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t dark:border-gray-700">
                        <button
                            onClick={handleReprocess}
                            disabled={reprocessing || processingStatus === 'pending'}
                            className={`px-4 py-2 rounded-lg border ${
                                processingStatus === 'pending'
                                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 cursor-not-allowed'
                                    : 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                            } disabled:opacity-50`}
                        >
                            {reprocessing ? '⏳ Procesando...' : processingStatus === 'pending' ? '⏳ En cola' : '🤖 Procesar con IA'}
                        </button>
                        <button
                            onClick={handleToggleFavorite}
                            className={`px-4 py-2 rounded-lg border ${
                                isFavorite
                                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {isFavorite ? '★ Favorito' : '☆ Anadir a favoritos'}
                        </button>
                        <a
                            href={content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            🔗 Abrir original
                        </a>
                        <button
                            onClick={handleArchive}
                            className={`px-4 py-2 rounded-lg border ${
                                content.is_archived
                                    ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30'
                                    : 'border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                            }`}
                        >
                            {content.is_archived ? '↩️ Restaurar' : '📦 Archivar'}
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
