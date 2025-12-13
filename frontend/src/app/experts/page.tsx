'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { ContentDetailModal } from '@/components/content-detail-modal';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

interface Expert {
    id: string;
    person_name: string;
    expert_categories: string[];
    description: string | null;
    notes: string | null;
    is_active: boolean;
    is_favorite: boolean;
    content_count: number;
    created_at: string;
    updated_at: string;
}

interface Content {
    id: string;
    title: string;
    url: string;
    type: string;
    summary: string | null;
    iab_tier1: string | null;
    user_category: string | null;
    created_at: string;
}

// Full content for modal
interface FullContent {
    id: string;
    title: string;
    url: string;
    type: string;
    summary: string | null;
    full_text: string | null;
    iab_tier1: string | null;
    iab_tier2: string | null;
    user_category: string | null;
    concepts: string[];
    entities: {
        persons?: string[];
        organizations?: string[];
        products?: string[];
    } | null;
    user_entities: {
        persons?: string[];
        organizations?: string[];
        products?: string[];
    } | null;
    user_concepts: string[] | null;
    user_tags: string[];
    user_note: string | null;
    is_favorite: boolean;
    maturity_level: string | null;
    processing_status: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

interface ExpertDetailResponse {
    expert: Expert;
    contents: Content[];
    content_count: number;
    has_more: boolean;
    preview_limit: number;
}

export default function ExpertsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [experts, setExperts] = useState<Expert[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
    const [expertContents, setExpertContents] = useState<Content[]>([]);
    const [loadingContents, setLoadingContents] = useState(false);
    const [hasMoreContents, setHasMoreContents] = useState(false);

    // Content detail modal - use any to match ContentDetailModal's expected type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedContent, setSelectedContent] = useState<any>(null);
    const [loadingContent, setLoadingContent] = useState(false);

    // Available persons for autocomplete
    const [availablePersons, setAvailablePersons] = useState<string[]>([]);
    const [personSearch, setPersonSearch] = useState('');

    // Categories from existing experts
    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<string>('');

    // Create/Edit modal
    const [showModal, setShowModal] = useState(false);
    const [editingExpert, setEditingExpert] = useState<Expert | null>(null);
    const [formName, setFormName] = useState('');
    const [formCategories, setFormCategories] = useState<string[]>([]);
    const [formDescription, setFormDescription] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const getAuthHeaders = useCallback(async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            ...(session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}),
        };
    }, []);

    const fetchExperts = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (categoryFilter) params.append('category', categoryFilter);

            const response = await fetch(`${API_URL}/api/v1/experts/?${params}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setExperts(data.experts || []);
            }
        } catch (error) {
            console.error('Error fetching experts:', error);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, categoryFilter]);

    const fetchCategories = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/experts/categories`, { headers });
            if (response.ok) {
                const data = await response.json();
                setAllCategories(data.categories || []);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }, [getAuthHeaders]);

    const fetchAvailablePersons = useCallback(async (query?: string) => {
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            params.append('limit', '30');

            const response = await fetch(`${API_URL}/api/v1/experts/persons?${params}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setAvailablePersons(data.persons || []);
            }
        } catch (error) {
            console.error('Error fetching persons:', error);
        }
    }, [getAuthHeaders]);

    const fetchExpertDetail = useCallback(async (expertId: string) => {
        setLoadingContents(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/experts/${expertId}`, { headers });
            if (response.ok) {
                const data: ExpertDetailResponse = await response.json();
                setSelectedExpert(data.expert);
                setExpertContents(data.contents || []);
                setHasMoreContents(data.has_more || false);
            }
        } catch (error) {
            console.error('Error fetching expert detail:', error);
        } finally {
            setLoadingContents(false);
        }
    }, [getAuthHeaders]);

    const fetchContentDetail = useCallback(async (contentId: string) => {
        setLoadingContent(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${contentId}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setSelectedContent(data);
            }
        } catch (error) {
            console.error('Error fetching content detail:', error);
        } finally {
            setLoadingContent(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (user) {
            fetchExperts();
            fetchCategories();
            fetchAvailablePersons();
        }
    }, [user, fetchExperts, fetchCategories, fetchAvailablePersons]);

    // Search persons as user types
    useEffect(() => {
        if (personSearch.length >= 2) {
            const timeout = setTimeout(() => {
                fetchAvailablePersons(personSearch);
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [personSearch, fetchAvailablePersons]);

    const openCreateModal = () => {
        setEditingExpert(null);
        setFormName('');
        setFormCategories([]);
        setFormDescription('');
        setShowModal(true);
    };

    const openEditModal = (expert: Expert) => {
        setEditingExpert(expert);
        setFormName(expert.person_name);
        setFormCategories(expert.expert_categories || []);
        setFormDescription(expert.description || '');
        setShowModal(true);
    };

    const handleSaveExpert = async () => {
        if (!formName.trim()) return;
        setSaving(true);

        try {
            const headers = await getAuthHeaders();
            const body = {
                person_name: formName.trim(),
                expert_categories: formCategories,
                description: formDescription || null,
            };

            let response;
            if (editingExpert) {
                response = await fetch(`${API_URL}/api/v1/experts/${editingExpert.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
            } else {
                response = await fetch(`${API_URL}/api/v1/experts/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
            }

            if (response.ok) {
                setShowModal(false);
                fetchExperts();
                fetchCategories();
            } else {
                const error = await response.json();
                alert(error.detail || 'Error al guardar');
            }
        } catch (error) {
            console.error('Error saving expert:', error);
            alert('Error de conexion');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExpert = async (expertId: string) => {
        if (!confirm('¿Eliminar este experto?')) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/experts/${expertId}`, {
                method: 'DELETE',
                headers,
            });

            if (response.ok) {
                if (selectedExpert?.id === expertId) {
                    setSelectedExpert(null);
                }
                fetchExperts();
            }
        } catch (error) {
            console.error('Error deleting expert:', error);
        }
    };

    const handleToggleFavorite = async (expert: Expert) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/experts/${expert.id}/favorite`, {
                method: 'POST',
                headers,
            });

            if (response.ok) {
                fetchExperts();
                if (selectedExpert?.id === expert.id) {
                    setSelectedExpert({ ...selectedExpert, is_favorite: !expert.is_favorite });
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const addCategory = () => {
        if (newCategory.trim() && !formCategories.includes(newCategory.trim())) {
            setFormCategories([...formCategories, newCategory.trim()]);
            setNewCategory('');
        }
    };

    const removeCategory = (cat: string) => {
        setFormCategories(formCategories.filter(c => c !== cat));
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Top Navigation */}
            <nav className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-6">
                            <Link href="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                                KB
                            </Link>
                            <div className="hidden md:flex items-center gap-4">
                                <Link href="/explore" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    Explorar
                                </Link>
                                <Link href="/taxonomy" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    Taxonomia
                                </Link>
                                <Link href="/experts" className="text-indigo-600 dark:text-indigo-400 font-medium">
                                    Expertos
                                </Link>
                                <Link href="/mental-models" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    M. Mentales
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </nav>

            <main className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Mis Expertos / Gurus
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                Personas que consideras referentes en categorias especificas
                            </p>
                        </div>
                        <button
                            onClick={openCreateModal}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <span className="text-xl">+</span>
                            Nuevo Experto
                        </button>
                    </div>

                    {/* Category Filter */}
                    {allCategories.length > 0 && (
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setCategoryFilter('')}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                        !categoryFilter
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    Todas
                                </button>
                                {allCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                            categoryFilter === cat
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Experts List */}
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                                <div className="p-4 border-b dark:border-gray-700">
                                    <h2 className="font-semibold text-gray-900 dark:text-white">
                                        Expertos ({experts.length})
                                    </h2>
                                </div>
                                <div className="divide-y dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
                                    {loading ? (
                                        <div className="p-8 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                                        </div>
                                    ) : experts.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                            <p className="text-4xl mb-2">👤</p>
                                            <p>No tienes expertos todavia</p>
                                            <button
                                                onClick={openCreateModal}
                                                className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                Anadir tu primer experto
                                            </button>
                                        </div>
                                    ) : (
                                        experts.map(expert => (
                                            <div
                                                key={expert.id}
                                                onClick={() => fetchExpertDetail(expert.id)}
                                                className={`p-4 cursor-pointer transition-colors ${
                                                    selectedExpert?.id === expert.id
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">👤</span>
                                                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                                                {expert.person_name}
                                                            </h3>
                                                            {expert.is_favorite && <span className="text-yellow-500">★</span>}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {expert.expert_categories.slice(0, 3).map(cat => (
                                                                <span
                                                                    key={cat}
                                                                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
                                                                >
                                                                    {cat}
                                                                </span>
                                                            ))}
                                                            {expert.expert_categories.length > 3 && (
                                                                <span className="text-xs text-gray-400">
                                                                    +{expert.expert_categories.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {expert.content_count} contenido{expert.content_count !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Expert Detail */}
                        <div className="lg:col-span-2">
                            {selectedExpert ? (
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                                    {/* Header */}
                                    <div className="p-6 border-b dark:border-gray-700">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl">
                                                    {selectedExpert.person_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                        {selectedExpert.person_name}
                                                    </h2>
                                                    <p className="text-gray-500 dark:text-gray-400">
                                                        {selectedExpert.content_count} contenido{selectedExpert.content_count !== 1 ? 's' : ''} relacionado{selectedExpert.content_count !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleFavorite(selectedExpert)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        selectedExpert.is_favorite
                                                            ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                            : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {selectedExpert.is_favorite ? '★' : '☆'}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(selectedExpert)}
                                                    className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExpert(selectedExpert.id)}
                                                    className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>

                                        {/* Categories */}
                                        <div className="mt-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Experto en:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedExpert.expert_categories.map(cat => (
                                                    <span
                                                        key={cat}
                                                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                                                    >
                                                        {cat}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {selectedExpert.description && (
                                            <p className="mt-4 text-gray-600 dark:text-gray-300">
                                                {selectedExpert.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Contents */}
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                Contenidos relacionados {expertContents.length > 0 && `(${expertContents.length}${hasMoreContents ? '+' : ''})`}
                                            </h3>
                                            {expertContents.length > 0 && (
                                                <Link
                                                    href={`/explore?person=${encodeURIComponent(selectedExpert.person_name)}`}
                                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                                >
                                                    Ver todos en Explorer →
                                                </Link>
                                            )}
                                        </div>
                                        {loadingContents ? (
                                            <div className="text-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
                                            </div>
                                        ) : expertContents.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                                                No hay contenidos donde aparezca esta persona
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {expertContents.map(content => {
                                                    // Effective category: user > AI
                                                    const effectiveCategory = content.user_category || content.iab_tier1;
                                                    return (
                                                        <div
                                                            key={content.id}
                                                            onClick={() => fetchContentDetail(content.id)}
                                                            className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">
                                                                        {content.title}
                                                                    </h4>
                                                                    {content.summary && (
                                                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                                                            {content.summary}
                                                                        </p>
                                                                    )}
                                                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                                        <span className="uppercase">{content.type}</span>
                                                                        {effectiveCategory && (
                                                                            <>
                                                                                <span>·</span>
                                                                                <span className={content.user_category ? 'text-indigo-600 dark:text-indigo-400' : ''}>
                                                                                    {effectiveCategory}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                        <span>·</span>
                                                                        <span>{new Date(content.created_at).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                                <a
                                                                    href={content.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm shrink-0"
                                                                >
                                                                    Abrir link
                                                                </a>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {hasMoreContents && (
                                                    <div className="text-center pt-2">
                                                        <Link
                                                            href={`/explore?person=${encodeURIComponent(selectedExpert.person_name)}`}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                                        >
                                                            Ver todos los contenidos en Explorer →
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                                    <p className="text-6xl mb-4">👤</p>
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                        Selecciona un experto
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Elige un experto de la lista para ver sus contenidos relacionados
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
                        <div className="p-4 border-b dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingExpert ? 'Editar Experto' : 'Nuevo Experto'}
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Person Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre de la persona
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => {
                                        setFormName(e.target.value);
                                        setPersonSearch(e.target.value);
                                    }}
                                    placeholder="Ej: Naval Ravikant"
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    list="persons-list"
                                />
                                <datalist id="persons-list">
                                    {availablePersons.map(person => (
                                        <option key={person} value={person} />
                                    ))}
                                </datalist>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Puedes elegir una persona que ya aparezca en tus contenidos
                                </p>
                            </div>

                            {/* Categories */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Categorias de experiencia
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formCategories.map(cat => (
                                        <span
                                            key={cat}
                                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm flex items-center gap-1"
                                        >
                                            {cat}
                                            <button
                                                onClick={() => removeCategory(cat)}
                                                className="text-blue-500 hover:text-red-500"
                                            >
                                                x
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                                        placeholder="Ej: Startups, Filosofia..."
                                        className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        list="categories-list"
                                    />
                                    <datalist id="categories-list">
                                        {allCategories.filter(c => !formCategories.includes(c)).map(cat => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                    <button
                                        onClick={addCategory}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripcion (opcional)
                                </label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Por que es un experto/guru para ti..."
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveExpert}
                                disabled={saving || !formName.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Detail Modal */}
            <ContentDetailModal
                content={selectedContent}
                isOpen={!!selectedContent}
                onClose={() => setSelectedContent(null)}
                onUpdate={() => {
                    // Refresh the expert contents after update
                    if (selectedExpert) {
                        fetchExpertDetail(selectedExpert.id);
                    }
                }}
            />
        </div>
    );
}
