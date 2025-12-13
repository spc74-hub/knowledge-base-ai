'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

interface TaxonomyTag {
    id: string;
    taxonomy_type: string;
    taxonomy_value: string;
    tag: string;
    color: string;
    created_at: string;
}

const TAXONOMY_TYPES = [
    { value: 'category', label: 'Categoria', icon: '📂' },
    { value: 'person', label: 'Persona', icon: '👤' },
    { value: 'organization', label: 'Organizacion', icon: '🏢' },
    { value: 'product', label: 'Producto', icon: '📦' },
    { value: 'concept', label: 'Concepto', icon: '💡' },
];

const TAG_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#0ea5e9', // sky
    '#6b7280', // gray
];

export default function TagsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [taxonomyTags, setTaxonomyTags] = useState<TaxonomyTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New tag form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTagType, setNewTagType] = useState('category');
    const [newTagValue, setNewTagValue] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [creating, setCreating] = useState(false);

    // Autocomplete values
    const [taxonomyValues, setTaxonomyValues] = useState<string[]>([]);
    const [loadingValues, setLoadingValues] = useState(false);

    // Filter
    const [filterType, setFilterType] = useState<string>('all');

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
            throw new Error('No hay sesión activa');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    };

    const fetchTaxonomyTags = async () => {
        try {
            const headers = await getAuthHeaders();
            const url = filterType === 'all'
                ? `${API_URL}/api/v1/tags/`
                : `${API_URL}/api/v1/tags/?taxonomy_type=${filterType}`;

            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error('Error al cargar tags');

            const data = await response.json();
            setTaxonomyTags(data.tags);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTaxonomyValues = async (type: string) => {
        setLoadingValues(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `${API_URL}/api/v1/tags/values/${type}`,
                { headers }
            );
            if (!response.ok) throw new Error('Error al cargar valores');

            const data = await response.json();
            setTaxonomyValues(data.values);
        } catch (err) {
            console.error('Error fetching values:', err);
            setTaxonomyValues([]);
        } finally {
            setLoadingValues(false);
        }
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagValue.trim() || !newTagName.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/tags/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    taxonomy_type: newTagType,
                    taxonomy_value: newTagValue.trim(),
                    tag: newTagName.trim(),
                    color: newTagColor,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Error al crear tag');
            }

            setNewTagValue('');
            setNewTagName('');
            setShowAddForm(false);
            fetchTaxonomyTags();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteTag = async (tagId: string) => {
        if (!confirm('¿Eliminar esta regla de tag?')) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/tags/${tagId}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) throw new Error('Error al eliminar');
            fetchTaxonomyTags();
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchTaxonomyTags();
        }
    }, [user, filterType]);

    useEffect(() => {
        if (showAddForm) {
            fetchTaxonomyValues(newTagType);
        }
    }, [showAddForm, newTagType]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    const getTypeInfo = (type: string) => {
        return TAXONOMY_TYPES.find(t => t.value === type) || { label: type, icon: '🏷️' };
    };

    // Group tags by type for display
    const groupedTags = taxonomyTags.reduce((acc, tag) => {
        if (!acc[tag.taxonomy_type]) {
            acc[tag.taxonomy_type] = [];
        }
        acc[tag.taxonomy_type].push(tag);
        return acc;
    }, {} as Record<string, TaxonomyTag[]>);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">K</span>
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white">KBase</span>
                            </Link>
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Reglas de Tags</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <Link
                                href="/dashboard"
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Volver
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Explanation */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                    <h2 className="font-medium text-blue-900 dark:text-blue-200 mb-2">¿Qué son las reglas de tags?</h2>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        Las reglas de tags te permiten asignar tags automáticamente a todos los contenidos que coincidan
                        con una categoría, persona, organización, producto o concepto específico.
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
                        Por ejemplo: Si creas una regla "Gurú" para la persona "Elon Musk", todos los contenidos
                        que mencionen a Elon Musk heredarán automáticamente el tag "Gurú".
                    </p>
                </div>

                {/* Link to Mental Models */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🧠</span>
                            <div>
                                <h2 className="font-medium text-purple-900 dark:text-purple-200">Modelos Mentales</h2>
                                <p className="text-sm text-purple-800 dark:text-purple-300">
                                    Gestiona tus modelos mentales en su propia seccion
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/mental-models"
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            Ir a Modelos Mentales
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {/* Actions bar */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                        >
                            <option value="all">Todos los tipos</option>
                            {TAXONOMY_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.icon} {type.label}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {taxonomyTags.length} regla{taxonomyTags.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <span>+</span>
                        Nueva regla
                    </button>
                </div>

                {/* Add form */}
                {showAddForm && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-4">Nueva regla de tag</h3>
                        <form onSubmit={handleCreateTag}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {/* Type selector */}
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Tipo de taxonomía
                                    </label>
                                    <select
                                        value={newTagType}
                                        onChange={(e) => {
                                            setNewTagType(e.target.value);
                                            setNewTagValue('');
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    >
                                        {TAXONOMY_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.icon} {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Value selector/input */}
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Valor (ej: "Elon Musk", "Technology")
                                    </label>
                                    <input
                                        type="text"
                                        value={newTagValue}
                                        onChange={(e) => setNewTagValue(e.target.value)}
                                        list="taxonomy-values"
                                        placeholder={loadingValues ? 'Cargando...' : 'Escribe o selecciona...'}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        required
                                    />
                                    <datalist id="taxonomy-values">
                                        {taxonomyValues.map(val => (
                                            <option key={val} value={val} />
                                        ))}
                                    </datalist>
                                </div>

                                {/* Tag name */}
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Nombre del tag
                                    </label>
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        placeholder="ej: Gurú, Importante, Seguir"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                        required
                                    />
                                </div>

                                {/* Color picker */}
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Color
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {TAG_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setNewTagColor(color)}
                                                className={`w-8 h-8 rounded-full border-2 ${
                                                    newTagColor === color
                                                        ? 'border-gray-900 dark:border-white scale-110'
                                                        : 'border-transparent'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            {newTagValue && newTagName && (
                                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Vista previa:</p>
                                    <p className="text-sm dark:text-gray-200">
                                        Todos los contenidos con {getTypeInfo(newTagType).label.toLowerCase()}{' '}
                                        <strong>"{newTagValue}"</strong> tendrán el tag{' '}
                                        <span
                                            className="px-2 py-0.5 rounded-full text-white text-xs"
                                            style={{ backgroundColor: newTagColor }}
                                        >
                                            {newTagName}
                                        </span>
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setNewTagValue('');
                                        setNewTagName('');
                                    }}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {creating ? 'Creando...' : 'Crear regla'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tags list */}
                {taxonomyTags.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            No tienes reglas de tags todavía
                        </p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear primera regla
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filterType === 'all' ? (
                            // Grouped view
                            Object.entries(groupedTags).map(([type, tags]) => (
                                <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                                    <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-2">
                                        <span>{getTypeInfo(type).icon}</span>
                                        <span className="font-medium dark:text-white">{getTypeInfo(type).label}</span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            ({tags.length})
                                        </span>
                                    </div>
                                    <div className="divide-y dark:divide-gray-700">
                                        {tags.map(tag => (
                                            <div
                                                key={tag.id}
                                                className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                        {tag.taxonomy_value}
                                                    </span>
                                                    <span className="text-gray-400">→</span>
                                                    <span
                                                        className="px-2 py-0.5 rounded-full text-white text-sm"
                                                        style={{ backgroundColor: tag.color }}
                                                    >
                                                        {tag.tag}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteTag(tag.id)}
                                                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                    title="Eliminar regla"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            // Flat view when filtered
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                                <div className="divide-y dark:divide-gray-700">
                                    {taxonomyTags.map(tag => (
                                        <div
                                            key={tag.id}
                                            className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span>{getTypeInfo(tag.taxonomy_type).icon}</span>
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    {tag.taxonomy_value}
                                                </span>
                                                <span className="text-gray-400">→</span>
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-white text-sm"
                                                    style={{ backgroundColor: tag.color }}
                                                >
                                                    {tag.tag}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteTag(tag.id)}
                                                className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                title="Eliminar regla"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
