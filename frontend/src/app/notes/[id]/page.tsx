'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ContentDetail {
    id: string;
    title: string;
    raw_content: string;
    summary: string;
    type: string;
    source_type: string;
    source_url: string | null;
    user_tags: string[];
    concepts: string[];
    is_archived: boolean;
    category: {
        tier1: string;
        tier2: string;
        confidence: number;
    } | null;
    entities: {
        persons: Array<{ name: string; role?: string }>;
        organizations: Array<{ name: string; type?: string }>;
        products: Array<{ name: string; category?: string }>;
    } | null;
    sentiment: {
        label: string;
        score: number;
    } | null;
    created_at: string;
    updated_at: string;
}

const NODE_COLORS: Record<string, string> = {
    person: '#3B82F6',
    organization: '#10B981',
    product: '#F59E0B',
};

export default function ContentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const contentId = params.id as string;
    const { user, loading: authLoading } = useAuth();
    const [content, setContent] = useState<ContentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user && contentId) {
            fetchContent();
        }
    }, [user, contentId]);

    const fetchContent = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('contents')
                .select('*')
                .eq('id', contentId)
                .single();

            if (fetchError) throw fetchError;

            if (!data) {
                setError('Contenido no encontrado');
                return;
            }

            setContent(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar el contenido');
        } finally {
            setLoading(false);
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

    const getSentimentColor = (label: string | undefined | null) => {
        if (!label) return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-gray-700';
        switch (label.toLowerCase()) {
            case 'positive': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
            case 'negative': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
            default: return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-gray-700';
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'note': 'Nota',
            'url': 'URL',
            'file': 'Archivo',
            'apple_note': 'Apple Note'
        };
        return labels[type] || type;
    };

    const handleArchive = async () => {
        if (!content) return;
        const action = content.is_archived ? 'restaurar' : 'archivar';
        if (!confirm(`¿Estas seguro de ${action} este contenido?`)) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const endpoint = content.is_archived ? 'unarchive' : 'archive';
            const response = await fetch(`http://localhost:8000/api/v1/content/bulk/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    content_ids: [contentId],
                }),
            });

            if (!response.ok) {
                throw new Error(`Error al ${action}`);
            }

            router.push('/dashboard');
        } catch (error) {
            console.error('Error archiving content:', error);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estas seguro de ELIMINAR PERMANENTEMENTE este contenido? Esta accion no se puede deshacer.')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const response = await fetch(`http://localhost:8000/api/v1/content/bulk/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    content_ids: [contentId],
                }),
            });

            if (!response.ok) {
                throw new Error('Error al eliminar');
            }

            router.push('/dashboard');
        } catch (error) {
            console.error('Error deleting content:', error);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    if (error || !content) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Contenido no encontrado'}</p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                    >
                        Volver al dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        >
                            ← Volver
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-xl">
                            {content.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/knowledge-graph"
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Knowledge Graph
                        </Link>
                        {content.type === 'note' && (
                            <Link
                                href={`/notes/${contentId}/edit`}
                                className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                            >
                                Editar
                            </Link>
                        )}
                        <button
                            onClick={handleArchive}
                            className={`px-4 py-2 rounded-lg ${
                                content.is_archived
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                            }`}
                        >
                            {content.is_archived ? '↩️ Restaurar' : '📦 Archivar'}
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Content column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Summary card */}
                        {content.summary && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Resumen</h2>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{content.summary}</p>
                            </div>
                        )}

                        {/* Full content */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Contenido</h2>
                            <div
                                className="prose prose-gray dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: content.raw_content || '<p class="text-gray-500 dark:text-gray-400">Sin contenido</p>' }}
                            />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Metadata card */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informacion</h2>
                            <dl className="space-y-3">
                                <div>
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Tipo</dt>
                                    <dd className="text-gray-900 dark:text-white">{getTypeLabel(content.type)}</dd>
                                </div>
                                {content.source_url && (
                                    <div>
                                        <dt className="text-sm text-gray-500 dark:text-gray-400">URL Origen</dt>
                                        <dd>
                                            <a
                                                href={content.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                                            >
                                                {content.source_url}
                                            </a>
                                        </dd>
                                    </div>
                                )}
                                <div>
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Creado</dt>
                                    <dd className="text-gray-900 dark:text-white">{formatDate(content.created_at)}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-gray-500 dark:text-gray-400">Actualizado</dt>
                                    <dd className="text-gray-900 dark:text-white">{formatDate(content.updated_at)}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Category card */}
                        {content.category && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Categoria</h2>
                                <div className="space-y-2">
                                    <div className="text-gray-900 dark:text-white font-medium">{content.category.tier1}</div>
                                    {content.category.tier2 && (
                                        <div className="text-gray-600 dark:text-gray-300 text-sm">→ {content.category.tier2}</div>
                                    )}
                                    <div className="text-xs text-gray-400 dark:text-gray-500">
                                        Confianza: {Math.round(content.category.confidence * 100)}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sentiment card */}
                        {content.sentiment?.label && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentimiento</h2>
                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(content.sentiment.label)}`}>
                                    {content.sentiment.label}
                                    {content.sentiment.score != null && (
                                        <span className="ml-2 text-xs opacity-75">
                                            ({Math.round(content.sentiment.score * 100)}%)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tags card */}
                        {content.user_tags && content.user_tags.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
                                <div className="flex flex-wrap gap-2">
                                    {content.user_tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Concepts card */}
                        {content.concepts && content.concepts.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conceptos</h2>
                                <div className="flex flex-wrap gap-2">
                                    {content.concepts.map((concept, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm"
                                        >
                                            {concept}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Entities card */}
                        {content.entities && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Entidades</h2>
                                <div className="space-y-4">
                                    {/* Persons */}
                                    {content.entities.persons && content.entities.persons.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.person }}></span>
                                                Personas
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {content.entities.persons.map((person, i) => (
                                                    <Link
                                                        key={i}
                                                        href={`/knowledge-graph?entity=person:${encodeURIComponent(person.name)}`}
                                                        className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                    >
                                                        {person.name}
                                                        {person.role && <span className="text-blue-400 dark:text-blue-500 ml-1">({person.role})</span>}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Organizations */}
                                    {content.entities.organizations && content.entities.organizations.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.organization }}></span>
                                                Organizaciones
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {content.entities.organizations.map((org, i) => (
                                                    <Link
                                                        key={i}
                                                        href={`/knowledge-graph?entity=organization:${encodeURIComponent(org.name)}`}
                                                        className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm hover:bg-green-100 dark:hover:bg-green-900/50"
                                                    >
                                                        {org.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Products */}
                                    {content.entities.products && content.entities.products.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS.product }}></span>
                                                Productos
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {content.entities.products.map((product, i) => (
                                                    <Link
                                                        key={i}
                                                        href={`/knowledge-graph?entity=product:${encodeURIComponent(product.name)}`}
                                                        className="px-3 py-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                                                    >
                                                        {product.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
