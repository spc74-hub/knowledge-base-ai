'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import {
    useMentalModels,
    useMentalModelsCatalog,
    useMentalModelContents,
    useActivateMentalModel,
    useCreateMentalModel,
    useUpdateMentalModel,
    useDeactivateMentalModel,
    useToggleMentalModelFavorite,
    useMentalModelDetail,
    useCreateMentalModelAction,
    useUpdateMentalModelAction,
    useDeleteMentalModelAction,
    useLinkNotesToMentalModel,
    useUnlinkNoteFromMentalModel,
    MENTAL_MODELS_KEYS,
    type MentalModel,
    type CatalogModel,
    type ContentItem,
    type MentalModelAction,
    type MentalModelNote,
    type MentalModelDetail,
} from '@/hooks/use-mental-models';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

// Hardcoded API URL - always use HTTPS in production
const API_URL = 'https://knowledge-base-ai-production.up.railway.app';

interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    created_at: string;
}

export default function MentalModelsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { user, token, loading: authLoading } = useAuth();

    // React Query hooks
    const { data: myModels = [], isLoading: modelsLoading } = useMentalModels(true);
    const { data: catalog = [], isLoading: catalogLoading } = useMentalModelsCatalog();
    const activateMutation = useActivateMentalModel();
    const createMutation = useCreateMentalModel();
    const updateMutation = useUpdateMentalModel();
    const deactivateMutation = useDeactivateMentalModel();
    const toggleFavoriteMutation = useToggleMentalModelFavorite();

    // State
    const [error, setError] = useState<string | null>(null);

    // Detail view
    const [selectedModel, setSelectedModel] = useState<MentalModel | null>(null);
    const { data: modelContents = [], isLoading: loadingDetail } = useMentalModelContents(selectedModel?.id || null);
    const { data: modelDetail, refetch: refetchDetail } = useMentalModelDetail(selectedModel?.id || null);
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');

    // Actions state
    const [newActionTitle, setNewActionTitle] = useState('');
    const [editingActionId, setEditingActionId] = useState<string | null>(null);
    const [editingActionTitle, setEditingActionTitle] = useState('');
    const createActionMutation = useCreateMentalModelAction();
    const updateActionMutation = useUpdateMentalModelAction();
    const deleteActionMutation = useDeleteMentalModelAction();

    // Notes linking state
    const [showNotesSelector, setShowNotesSelector] = useState(false);
    const [availableNotes, setAvailableNotes] = useState<StandaloneNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const linkNotesMutation = useLinkNotesToMentalModel();
    const unlinkNoteMutation = useUnlinkNoteFromMentalModel();

    // Create/Edit model modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '🧠',
        color: '#8b5cf6',
    });

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

    const activateModel = async (model: CatalogModel) => {
        try {
            await activateMutation.mutateAsync(model);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const deactivateModel = async (modelId: string) => {
        if (!confirm('Desactivar este modelo mental?')) return;

        try {
            await deactivateMutation.mutateAsync(modelId);
            if (selectedModel?.id === modelId) {
                setSelectedModel(null);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const openModelDetail = (model: MentalModel) => {
        setSelectedModel(model);
        setNotesValue(model.notes || '');
    };

    const saveNotes = async () => {
        if (!selectedModel) return;

        try {
            const updated = await updateMutation.mutateAsync({
                id: selectedModel.id,
                notes: notesValue,
            });
            setSelectedModel({ ...selectedModel, notes: updated.notes });
            setEditingNotes(false);
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
        if (!selectedModel || toggleFavoriteMutation.isPending) return;

        try {
            const data = await toggleFavoriteMutation.mutateAsync(selectedModel.id);
            setSelectedModel({ ...selectedModel, is_favorite: data.is_favorite });
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleSaveModel = async () => {
        if (!formData.name.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        try {
            if (editingModel) {
                // Update existing model
                const updated = await updateMutation.mutateAsync({
                    id: editingModel.id,
                    name: formData.name,
                    description: formData.description || undefined,
                    icon: formData.icon,
                    color: formData.color,
                });
                if (selectedModel?.id === editingModel.id) {
                    setSelectedModel(updated);
                }
            } else {
                // Create new custom model
                await createMutation.mutateAsync({
                    name: formData.name,
                    description: formData.description,
                    icon: formData.icon,
                    color: formData.color,
                });
            }
            setShowCreateModal(false);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Actions handlers
    const handleCreateAction = async () => {
        if (!newActionTitle.trim() || !selectedModel) return;
        try {
            await createActionMutation.mutateAsync({ modelId: selectedModel.id, title: newActionTitle.trim() });
            setNewActionTitle('');
            refetchDetail();
        } catch (error) {
            console.error('Error creating action:', error);
        }
    };

    const handleToggleAction = async (action: MentalModelAction) => {
        if (!selectedModel) return;
        try {
            await updateActionMutation.mutateAsync({
                modelId: selectedModel.id,
                actionId: action.id,
                is_completed: !action.is_completed,
            });
            refetchDetail();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    const handleDeleteAction = async (actionId: string) => {
        if (!selectedModel) return;
        try {
            await deleteActionMutation.mutateAsync({ modelId: selectedModel.id, actionId });
            refetchDetail();
        } catch (error) {
            console.error('Error deleting action:', error);
        }
    };

    const handleStartEditAction = (actionId: string, currentTitle: string) => {
        setEditingActionId(actionId);
        setEditingActionTitle(currentTitle);
    };

    const handleSaveEditAction = async (actionId: string) => {
        if (!selectedModel || !editingActionTitle.trim()) return;
        try {
            await updateActionMutation.mutateAsync({
                modelId: selectedModel.id,
                actionId,
                title: editingActionTitle.trim(),
            });
            setEditingActionId(null);
            setEditingActionTitle('');
            refetchDetail();
        } catch (error) {
            console.error('Error editing action:', error);
        }
    };

    const handleCancelEditAction = () => {
        setEditingActionId(null);
        setEditingActionTitle('');
    };

    // Notes handlers
    const fetchAvailableNotes = async () => {
        setLoadingNotes(true);
        try {
            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Filter out notes already linked to this model
                const linkedNoteIds = new Set((modelDetail?.linked_notes || []).map(n => n.id));
                setAvailableNotes((data.notes || []).filter((n: StandaloneNote) => !linkedNoteIds.has(n.id)));
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleOpenNotesSelector = () => {
        fetchAvailableNotes();
        setShowNotesSelector(true);
    };

    const handleLinkNote = async (noteId: string) => {
        if (!selectedModel) return;
        try {
            await linkNotesMutation.mutateAsync({ modelId: selectedModel.id, noteIds: [noteId] });
            setShowNotesSelector(false);
            refetchDetail();
        } catch (error) {
            console.error('Error linking note:', error);
        }
    };

    const handleUnlinkNote = async (noteId: string) => {
        if (!selectedModel) return;
        try {
            await unlinkNoteMutation.mutateAsync({ modelId: selectedModel.id, noteId });
            refetchDetail();
        } catch (error) {
            console.error('Error unlinking note:', error);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    // Select model from URL ?id= param
    useEffect(() => {
        const idParam = searchParams.get('id');
        if (idParam && myModels.length > 0) {
            const model = myModels.find(m => m.id === idParam);
            if (model) {
                openModelDetail(model);
            }
        }
    }, [searchParams, myModels]);

    const loading = modelsLoading || catalogLoading;

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
                                            disabled={toggleFavoriteMutation.isPending}
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

                            {/* Actions Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones</h2>

                                {/* Add action input */}
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={newActionTitle}
                                        onChange={(e) => setNewActionTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateAction()}
                                        placeholder="Nueva accion..."
                                        className="flex-1 px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                    <button
                                        onClick={handleCreateAction}
                                        disabled={!newActionTitle.trim() || createActionMutation.isPending}
                                        className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Actions list */}
                                {(!modelDetail?.mental_model_actions || modelDetail.mental_model_actions.length === 0) ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No hay acciones pendientes
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {modelDetail.mental_model_actions.map((action) => (
                                            <div key={action.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group">
                                                <input
                                                    type="checkbox"
                                                    checked={action.is_completed}
                                                    onChange={() => handleToggleAction(action)}
                                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                {editingActionId === action.id ? (
                                                    <div className="flex-1 flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={editingActionTitle}
                                                            onChange={(e) => setEditingActionTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveEditAction(action.id);
                                                                if (e.key === 'Escape') handleCancelEditAction();
                                                            }}
                                                            className="flex-1 px-2 py-1 text-sm border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleSaveEditAction(action.id)}
                                                            className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEditAction}
                                                            className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={`flex-1 text-sm cursor-pointer ${action.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}
                                                        onDoubleClick={() => handleStartEditAction(action.id, action.title)}
                                                        title="Doble clic para editar"
                                                    >
                                                        {action.title}
                                                    </span>
                                                )}
                                                {editingActionId !== action.id && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEditAction(action.id, action.title)}
                                                            className="p-1 text-gray-400 hover:text-purple-600 opacity-0 group-hover:opacity-100"
                                                            title="Editar acción"
                                                        >
                                                            ✎
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAction(action.id)}
                                                            className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                            title="Eliminar acción"
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Linked Notes Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notas vinculadas</h2>
                                    <button
                                        onClick={handleOpenNotesSelector}
                                        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                                    >
                                        + Vincular
                                    </button>
                                </div>

                                {(!modelDetail?.linked_notes || modelDetail.linked_notes.length === 0) ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No hay notas vinculadas
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {modelDetail.linked_notes.map((note) => (
                                            <div key={note.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg group">
                                                <span className="text-lg">📝</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                        {note.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {note.note_type} {note.tags?.length > 0 && `• ${note.tags.slice(0, 2).join(', ')}`}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleUnlinkNote(note.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                    title="Desvincular"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Linked Entities Section */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                {/* Projects */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Proyectos vinculados</h3>
                                    {(!modelDetail?.projects || modelDetail.projects.length === 0) ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Sin proyectos</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {modelDetail.projects.map((proj) => (
                                                <Link
                                                    key={proj.id}
                                                    href={`/projects?id=${proj.id}`}
                                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                                                >
                                                    <span>{proj.icon}</span>
                                                    <span className="text-sm text-gray-900 dark:text-white truncate">{proj.name}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Objectives */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Objetivos vinculados</h3>
                                    {(!modelDetail?.objectives || modelDetail.objectives.length === 0) ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Sin objetivos</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {modelDetail.objectives.map((obj) => (
                                                <Link
                                                    key={obj.id}
                                                    href={`/objectives?id=${obj.id}`}
                                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                                                >
                                                    <span>{obj.icon}</span>
                                                    <span className="text-sm text-gray-900 dark:text-white truncate">{obj.title}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Areas */}
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Areas vinculadas</h3>
                                    {(!modelDetail?.areas || modelDetail.areas.length === 0) ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Sin areas</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {modelDetail.areas.map((area) => (
                                                <Link
                                                    key={area.id}
                                                    href={`/areas/${area.id}`}
                                                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                                                >
                                                    <span>{area.icon}</span>
                                                    <span className="text-sm text-gray-900 dark:text-white truncate">{area.name}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                                disabled={createMutation.isPending || updateMutation.isPending || !formData.name.trim()}
                                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : (editingModel ? 'Guardar cambios' : 'Crear modelo')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notes Selector Modal */}
            {showNotesSelector && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Vincular Nota</h3>
                            <button
                                onClick={() => setShowNotesSelector(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {loadingNotes ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                                </div>
                            ) : availableNotes.length === 0 ? (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                    No hay notas disponibles para vincular
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {availableNotes.map((note) => (
                                        <button
                                            key={note.id}
                                            onClick={() => handleLinkNote(note.id)}
                                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border dark:border-gray-600"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">📝</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                                        {note.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {note.note_type} {note.tags?.length > 0 && `• ${note.tags.slice(0, 2).join(', ')}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
