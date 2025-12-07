'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MentalModel {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    notes: string;
    is_active: boolean;
    is_favorite: boolean;
    color: string;
    icon: string;
    content_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

interface CatalogModel {
    slug: string;
    name: string;
    description: string;
    icon: string;
}

interface ContentItem {
    id: string;
    title: string;
    url: string;
    type: string;
    summary: string;
    iab_tier1: string;
    created_at: string;
    application_notes?: string;
}

export default function MentalModelsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // State
    const [myModels, setMyModels] = useState<MentalModel[]>([]);
    const [catalog, setCatalog] = useState<CatalogModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Detail view
    const [selectedModel, setSelectedModel] = useState<MentalModel | null>(null);
    const [modelContents, setModelContents] = useState<ContentItem[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');

    // Create/Edit model modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '🧠',
        color: '#8b5cf6',
    });
    const [savingModel, setSavingModel] = useState(false);

    // Favorite toggling
    const [togglingFavorite, setTogglingFavorite] = useState(false);

    // Available icons for selection
    const availableIcons = ['🧠', '💡', '🎯', '🔬', '📊', '⚡', '🔄', '📈', '🎨', '🔍', '💭', '🌟', '🚀', '⭐', '✨', '🎲', '🧩', '🔮', '📐', '🧮'];

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
            throw new Error('No hay sesion activa');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    };

    const fetchMyModels = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/?include_inactive=true`, { headers });
            if (response.ok) {
                const data = await response.json();
                setMyModels(data.models || []);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const fetchCatalog = async () => {
        try {
            const response = await fetch(`${API_URL}/api/v1/mental-models/catalog`);
            if (response.ok) {
                const data = await response.json();
                setCatalog(data.models || []);
            }
        } catch (err) {
            console.error('Error fetching catalog:', err);
        }
    };

    const activateModel = async (model: CatalogModel) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    slug: model.slug,
                    name: model.name,
                    description: model.description,
                    icon: model.icon,
                }),
            });

            if (response.ok) {
                await fetchMyModels();
            } else {
                const data = await response.json();
                setError(data.detail || 'Error al activar modelo');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const deactivateModel = async (modelId: string) => {
        if (!confirm('Desactivar este modelo mental?')) return;

        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_URL}/api/v1/mental-models/${modelId}`, {
                method: 'DELETE',
                headers,
            });
            await fetchMyModels();
            if (selectedModel?.id === modelId) {
                setSelectedModel(null);
                setModelContents([]);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const openModelDetail = async (model: MentalModel) => {
        setSelectedModel(model);
        setNotesValue(model.notes || '');
        setLoadingDetail(true);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/${model.id}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setModelContents(data.contents || []);
            }
        } catch (err) {
            console.error('Error loading model detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const saveNotes = async () => {
        if (!selectedModel) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/${selectedModel.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ notes: notesValue }),
            });

            if (response.ok) {
                const updated = await response.json();
                setSelectedModel({ ...selectedModel, notes: updated.notes });
                setMyModels(myModels.map(m => m.id === selectedModel.id ? { ...m, notes: updated.notes } : m));
                setEditingNotes(false);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const openCreateModal = () => {
        setEditingModel(null);
        setFormData({
            name: '',
            description: '',
            icon: '🧠',
            color: '#8b5cf6',
        });
        setShowCreateModal(true);
    };

    const openEditModal = (model: MentalModel) => {
        setEditingModel(model);
        setFormData({
            name: model.name,
            description: model.description || '',
            icon: model.icon,
            color: model.color,
        });
        setShowCreateModal(true);
    };

    const handleToggleFavorite = async () => {
        if (!selectedModel || togglingFavorite) return;
        setTogglingFavorite(true);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/${selectedModel.id}/favorite`, {
                method: 'POST',
                headers,
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedModel({ ...selectedModel, is_favorite: data.is_favorite });
                setMyModels(myModels.map(m => m.id === selectedModel.id ? { ...m, is_favorite: data.is_favorite } : m));
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        } finally {
            setTogglingFavorite(false);
        }
    };

    const handleSaveModel = async () => {
        if (!formData.name.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        setSavingModel(true);
        try {
            const headers = await getAuthHeaders();

            if (editingModel) {
                // Update existing model
                const response = await fetch(`${API_URL}/api/v1/mental-models/${editingModel.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: formData.name,
                        description: formData.description || null,
                        icon: formData.icon,
                        color: formData.color,
                    }),
                });

                if (response.ok) {
                    const updated = await response.json();
                    setMyModels(myModels.map(m => m.id === editingModel.id ? updated : m));
                    if (selectedModel?.id === editingModel.id) {
                        setSelectedModel(updated);
                    }
                    setShowCreateModal(false);
                } else {
                    const data = await response.json();
                    setError(data.detail || 'Error al actualizar modelo');
                }
            } else {
                // Create new custom model
                const slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                const response = await fetch(`${API_URL}/api/v1/mental-models/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        slug: `custom-${slug}-${Date.now()}`,
                        name: formData.name,
                        description: formData.description || null,
                        icon: formData.icon,
                        color: formData.color,
                    }),
                });

                if (response.ok) {
                    await fetchMyModels();
                    setShowCreateModal(false);
                } else {
                    const data = await response.json();
                    setError(data.detail || 'Error al crear modelo');
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingModel(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            Promise.all([fetchMyModels(), fetchCatalog()]).finally(() => setLoading(false));
        }
    }, [user]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    const activeModelSlugs = new Set(myModels.filter(m => m.is_active).map(m => m.slug));
    const availableCatalogModels = catalog.filter(m => !activeModelSlugs.has(m.slug));

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
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Modelos Mentales</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openCreateModal}
                                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1"
                            >
                                <span>+</span> Nuevo Modelo
                            </button>
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

            <div className="flex">
                {/* Sidebar - List of models */}
                <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-56px)] overflow-y-auto">
                    {/* My active models */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Mis Modelos Activos ({myModels.filter(m => m.is_active).length})
                        </h2>
                        <div className="space-y-2">
                            {myModels.filter(m => m.is_active).map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => openModelDetail(model)}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                        selectedModel?.id === model.id
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{model.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white truncate">
                                                {model.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {model.content_count} contenido{model.content_count !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {myModels.filter(m => m.is_active).length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                    No tienes modelos activos
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Catalog - Available to add */}
                    <div className="p-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Modelos Disponibles ({availableCatalogModels.length})
                        </h2>
                        <div className="space-y-2">
                            {availableCatalogModels.map(model => (
                                <div
                                    key={model.slug}
                                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700"
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-xl">{model.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {model.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                {model.description}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => activateModel(model)}
                                            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                        >
                                            Activar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main content - Model detail */}
                <div className="flex-1 p-6">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                            <p className="text-red-800 dark:text-red-200">{error}</p>
                            <button onClick={() => setError(null)} className="text-sm text-red-600 dark:text-red-400 underline">
                                Cerrar
                            </button>
                        </div>
                    )}

                    {!selectedModel ? (
                        <div className="flex flex-col items-center justify-center h-96 text-center">
                            <div className="text-6xl mb-4">🧠</div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Modelos Mentales
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                Los modelos mentales son marcos de pensamiento que te ayudan a analizar
                                y conectar ideas. Selecciona uno de la lista para ver sus detalles y
                                contenidos asociados.
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Model header */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                                            style={{ backgroundColor: `${selectedModel.color}20` }}
                                        >
                                            {selectedModel.icon}
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {selectedModel.name}
                                            </h1>
                                            <p className="text-gray-500 dark:text-gray-400">
                                                {selectedModel.description}
                                            </p>
                                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                                {selectedModel.content_count} contenido{selectedModel.content_count !== 1 ? 's' : ''} asociado{selectedModel.content_count !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleToggleFavorite}
                                            disabled={togglingFavorite}
                                            className={`p-2 text-xl rounded-lg transition-colors ${
                                                selectedModel.is_favorite
                                                    ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                            title={selectedModel.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                                        >
                                            {selectedModel.is_favorite ? '⭐' : '☆'}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(selectedModel)}
                                            className="px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => deactivateModel(selectedModel.id)}
                                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                        >
                                            Desactivar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Notes section */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Notas sobre este modelo
                                    </h2>
                                    {!editingNotes ? (
                                        <button
                                            onClick={() => setEditingNotes(true)}
                                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                                        >
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingNotes(false);
                                                    setNotesValue(selectedModel.notes || '');
                                                }}
                                                className="text-sm text-gray-500 hover:text-gray-700"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={saveNotes}
                                                className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {editingNotes ? (
                                    <textarea
                                        value={notesValue}
                                        onChange={(e) => setNotesValue(e.target.value)}
                                        placeholder="Escribe tus notas sobre este modelo mental... Como aplicarlo, ejemplos, reflexiones..."
                                        className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                    />
                                ) : (
                                    <div className="prose dark:prose-invert max-w-none">
                                        {selectedModel.notes ? (
                                            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                                {selectedModel.notes}
                                            </p>
                                        ) : (
                                            <p className="text-gray-400 dark:text-gray-500 italic">
                                                Sin notas. Haz click en "Editar" para agregar tus reflexiones sobre este modelo.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Associated contents */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Contenidos asociados
                                </h2>
                                {loadingDetail ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                    </div>
                                ) : modelContents.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                                            No hay contenidos asociados a este modelo
                                        </p>
                                        <p className="text-sm text-gray-400 dark:text-gray-500">
                                            Puedes asociar contenidos desde la vista de detalle de cada contenido en el Explorer
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {modelContents.map(content => (
                                            <Link
                                                key={content.id}
                                                href={`/explore?content=${content.id}`}
                                                className="block p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 dark:text-white truncate">
                                                            {content.title}
                                                        </p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                                            {content.summary}
                                                        </p>
                                                        {content.application_notes && (
                                                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                                                                Nota: {content.application_notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-4 whitespace-nowrap">
                                                        {content.type}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingModel ? 'Editar Modelo Mental' : 'Crear Nuevo Modelo Mental'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Pensamiento Lateral"
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripcion
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe brevemente este modelo mental..."
                                    rows={3}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            {/* Icon selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Icono
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {availableIcons.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl transition-all ${
                                                formData.icon === icon
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                                    : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                                            }`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Color selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-12 h-10 rounded border dark:border-gray-600 cursor-pointer"
                                    />
                                    <div className="flex gap-2">
                                        {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color })}
                                                className={`w-8 h-8 rounded-full border-2 ${
                                                    formData.color === color ? 'border-gray-800 dark:border-white' : 'border-transparent'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="pt-4 border-t dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Vista previa</p>
                                <div className="flex items-center gap-3 p-3 rounded-lg border dark:border-gray-600">
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                        style={{ backgroundColor: `${formData.color}20` }}
                                    >
                                        {formData.icon}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {formData.name || 'Nombre del modelo'}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {formData.description || 'Descripcion del modelo'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveModel}
                                disabled={savingModel || !formData.name.trim()}
                                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {savingModel ? 'Guardando...' : (editingModel ? 'Guardar cambios' : 'Crear modelo')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
