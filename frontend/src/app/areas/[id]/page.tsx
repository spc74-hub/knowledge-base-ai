'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
    useAreaDetail,
    useCreateAreaAction,
    useUpdateAreaAction,
    useDeleteAreaAction,
    useLinkNotesToArea,
    useUnlinkNoteFromArea,
    type AreaAction,
    type AreaNote,
} from '@/hooks/use-areas';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SubArea {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    display_order: number;
}

interface AreaDetailData {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    status: string;
    created_at: string;
    sub_areas: SubArea[];
    objectives: any[];
    projects: any[];
    habits: any[];
    mental_models: any[];
    recent_contents: any[];
    area_actions?: AreaAction[];
    notes?: AreaNote[];
}

interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    created_at: string;
}

const STATUS_CONFIG = {
    active: { label: 'Activa', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    archived: { label: 'Archivada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

export default function AreaDetailPage() {
    const router = useRouter();
    const params = useParams();
    const areaId = params.id as string;
    const { user, token, loading: authLoading } = useAuth();
    const [area, setArea] = useState<AreaDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'sub-areas' | 'objectives' | 'projects' | 'habits'>('overview');

    // Sub-area form
    const [showSubAreaForm, setShowSubAreaForm] = useState(false);
    const [subAreaName, setSubAreaName] = useState('');
    const [subAreaDescription, setSubAreaDescription] = useState('');
    const [savingSubArea, setSavingSubArea] = useState(false);

    // Actions state
    const [newActionTitle, setNewActionTitle] = useState('');
    const createActionMutation = useCreateAreaAction();
    const updateActionMutation = useUpdateAreaAction();
    const deleteActionMutation = useDeleteAreaAction();

    // Notes state
    const [showNotesSelector, setShowNotesSelector] = useState(false);
    const [availableNotes, setAvailableNotes] = useState<StandaloneNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const linkNotesMutation = useLinkNotesToArea();
    const unlinkNoteMutation = useUnlinkNoteFromArea();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const fetchArea = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setArea(data);
            } else if (response.status === 404) {
                router.push('/areas');
            }
        } catch (error) {
            console.error('Error fetching area:', error);
        } finally {
            setLoading(false);
        }
    }, [areaId, router]);

    useEffect(() => {
        if (user && areaId) {
            fetchArea();
        }
    }, [user, areaId, fetchArea]);

    const handleCreateSubArea = async () => {
        if (!subAreaName.trim()) return;

        setSavingSubArea(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/areas/${areaId}/sub-areas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: subAreaName.trim(),
                    description: subAreaDescription.trim() || null,
                }),
            });

            if (response.ok) {
                setShowSubAreaForm(false);
                setSubAreaName('');
                setSubAreaDescription('');
                fetchArea();
            }
        } catch (error) {
            console.error('Error creating sub-area:', error);
        } finally {
            setSavingSubArea(false);
        }
    };

    const handleDeleteSubArea = async (subAreaId: string) => {
        if (!confirm('¿Eliminar esta sub-area?')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/areas/${areaId}/sub-areas/${subAreaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            fetchArea();
        } catch (error) {
            console.error('Error deleting sub-area:', error);
        }
    };

    // Actions handlers
    const handleCreateAction = async () => {
        if (!newActionTitle.trim() || !areaId) return;
        try {
            await createActionMutation.mutateAsync({ areaId, title: newActionTitle.trim() });
            setNewActionTitle('');
            fetchArea();
        } catch (error) {
            console.error('Error creating action:', error);
        }
    };

    const handleToggleAction = async (action: AreaAction) => {
        try {
            await updateActionMutation.mutateAsync({
                areaId,
                actionId: action.id,
                is_completed: !action.is_completed,
            });
            fetchArea();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    const handleDeleteAction = async (actionId: string) => {
        try {
            await deleteActionMutation.mutateAsync({ areaId, actionId });
            fetchArea();
        } catch (error) {
            console.error('Error deleting action:', error);
        }
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
                // Filter out notes already linked to this area
                const linkedNoteIds = new Set((area?.notes || []).map(n => n.id));
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
        try {
            await linkNotesMutation.mutateAsync({ areaId, noteIds: [noteId] });
            setShowNotesSelector(false);
            fetchArea();
        } catch (error) {
            console.error('Error linking note:', error);
        }
    };

    const handleUnlinkNote = async (noteId: string) => {
        try {
            await unlinkNoteMutation.mutateAsync({ areaId, noteId });
            fetchArea();
        } catch (error) {
            console.error('Error unlinking note:', error);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user || !area) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header with color bar */}
            <div className="h-2" style={{ backgroundColor: area.color }}></div>
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/areas" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                ← Areas
                            </Link>
                            <span className="text-4xl">{area.icon}</span>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{area.name}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[area.status as keyof typeof STATUS_CONFIG]?.color}`}>
                                        {STATUS_CONFIG[area.status as keyof typeof STATUS_CONFIG]?.label}
                                    </span>
                                    {area.description && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {area.description}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Link
                            href="/areas"
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            ✕
                        </Link>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 border-b dark:border-gray-700">
                        {[
                            { key: 'overview', label: 'General', count: null },
                            { key: 'sub-areas', label: 'Sub-areas', count: area.sub_areas.length },
                            { key: 'objectives', label: 'Objetivos', count: area.objectives.length },
                            { key: 'projects', label: 'Proyectos', count: area.projects.length },
                            { key: 'habits', label: 'Habitos', count: area.habits.length },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                                    activeTab === tab.key
                                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {tab.label}
                                {tab.count !== null && (
                                    <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Stats */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div className="text-2xl font-bold text-indigo-600">{area.objectives.length}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Objetivos</div>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div className="text-2xl font-bold text-green-600">{area.projects.length}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Proyectos</div>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div className="text-2xl font-bold text-purple-600">{area.habits.length}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Habitos</div>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div className="text-2xl font-bold text-orange-600">{area.sub_areas.length}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Sub-areas</div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Acciones</h3>

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
                                        className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Actions list */}
                                {(!area.area_actions || area.area_actions.length === 0) ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No hay acciones pendientes
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {area.area_actions.map((action) => (
                                            <div key={action.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group">
                                                <input
                                                    type="checkbox"
                                                    checked={action.is_completed}
                                                    onChange={() => handleToggleAction(action)}
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className={`flex-1 text-sm ${action.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {action.title}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteAction(action.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Notes Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Notas vinculadas</h3>
                                    <button
                                        onClick={handleOpenNotesSelector}
                                        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                                    >
                                        + Vincular
                                    </button>
                                </div>

                                {(!area.notes || area.notes.length === 0) ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No hay notas vinculadas
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {area.notes.map((note) => (
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

                            {/* Recent contents */}
                            {area.recent_contents.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contenidos recientes</h3>
                                    <div className="space-y-2">
                                        {area.recent_contents.map((content: any) => (
                                            <Link
                                                key={content.id}
                                                href={`/explore?id=${content.id}`}
                                                className="block p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">
                                                        {content.type === 'article' ? '📄' : content.type === 'video' ? '🎬' : '📝'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                            {content.title}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{content.schema_type}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mental models sidebar */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Modelos Mentales</h3>
                                {area.mental_models.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        No hay modelos mentales vinculados
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {area.mental_models.map((mm: any) => (
                                            <div key={mm.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <span>{mm.icon || '🧠'}</span>
                                                <span className="text-sm text-gray-900 dark:text-white">{mm.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-areas Tab */}
                {activeTab === 'sub-areas' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Sub-areas</h3>
                            <button
                                onClick={() => setShowSubAreaForm(true)}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                            >
                                + Agregar
                            </button>
                        </div>

                        {showSubAreaForm && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={subAreaName}
                                        onChange={(e) => setSubAreaName(e.target.value)}
                                        placeholder="Nombre de la sub-area"
                                        className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                                    />
                                    <button
                                        onClick={handleCreateSubArea}
                                        disabled={savingSubArea || !subAreaName.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {savingSubArea ? '...' : 'Crear'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSubAreaForm(false);
                                            setSubAreaName('');
                                        }}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="divide-y dark:divide-gray-700">
                            {area.sub_areas.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay sub-areas. Las sub-areas te ayudan a organizar temas dentro de un area.
                                </div>
                            ) : (
                                area.sub_areas.map((subArea) => (
                                    <div key={subArea.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{subArea.icon}</span>
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{subArea.name}</p>
                                                {subArea.description && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{subArea.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteSubArea(subArea.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Objectives Tab */}
                {activeTab === 'objectives' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <div className="p-6 border-b dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Objetivos vinculados</h3>
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {area.objectives.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay objetivos vinculados a esta area.
                                </div>
                            ) : (
                                area.objectives.map((obj: any) => (
                                    <div key={obj.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">🎯</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-white">{obj.title}</p>
                                                {obj.description && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{obj.description}</p>
                                                )}
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                obj.status === 'active' ? 'bg-green-100 text-green-800' :
                                                obj.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {obj.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Projects Tab */}
                {activeTab === 'projects' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <div className="p-6 border-b dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Proyectos vinculados</h3>
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {area.projects.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay proyectos vinculados a esta area.
                                </div>
                            ) : (
                                area.projects.map((proj: any) => (
                                    <Link key={proj.id} href={`/projects/${proj.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">📁</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-white">{proj.name}</p>
                                                {proj.description && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{proj.description}</p>
                                                )}
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                proj.status === 'active' ? 'bg-green-100 text-green-800' :
                                                proj.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {proj.status}
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Habits Tab */}
                {activeTab === 'habits' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Habitos vinculados</h3>
                            <Link
                                href="/habits"
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Gestionar habitos →
                            </Link>
                        </div>
                        <div className="divide-y dark:divide-gray-700">
                            {area.habits.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay habitos vinculados a esta area.
                                </div>
                            ) : (
                                area.habits.map((habit: any) => (
                                    <div key={habit.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{habit.icon || '✅'}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-white">{habit.name}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                habit.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {habit.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

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
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
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
