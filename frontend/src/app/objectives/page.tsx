'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const HORIZONS = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' },
    { value: 'lifetime', label: 'Vida' },
];

const STATUSES = [
    { value: 'future', label: 'Futuro', color: 'bg-gray-400' },
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-400' },
    { value: 'active', label: 'Activo', color: 'bg-green-500' },
    { value: 'completed', label: 'Completado', color: 'bg-blue-500' },
];

const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
];

const ICONS = ['🎯', '🚀', '💡', '📈', '🏆', '⭐', '🔥', '💪', '🎓', '💰'];

interface Action {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
}

interface Objective {
    id: string;
    title: string;
    description: string;
    horizon: string;
    target_date: string | null;
    status: string;
    progress: number;
    color: string;
    icon: string;
    parent_id: string | null;
    objective_actions: Action[];
    mental_models?: any[];
    projects?: any[];
    children?: Objective[];
    contents_count?: number;
}

export default function ObjectivesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newHorizon, setNewHorizon] = useState('yearly');
    const [newTargetDate, setNewTargetDate] = useState('');
    const [newStatus, setNewStatus] = useState('pending');
    const [newColor, setNewColor] = useState('#6366f1');
    const [newIcon, setNewIcon] = useState('🎯');
    const [newActionTitle, setNewActionTitle] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchObjectives = useCallback(async () => {
        if (!user) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const url = filterStatus === 'all'
                ? `${API_URL}/api/v1/objectives/`
                : `${API_URL}/api/v1/objectives/?status=${filterStatus}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setObjectives(data.objectives || []);
            }
        } catch (error) {
            console.error('Error fetching objectives:', error);
        } finally {
            setLoading(false);
        }
    }, [user, filterStatus]);

    const fetchObjectiveDetail = async (id: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/objectives/${id}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setSelectedObjective(data);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching objective detail:', error);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim()) return;

        setCreating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_URL}/api/v1/objectives/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDescription,
                    horizon: newHorizon,
                    target_date: newTargetDate || null,
                    status: newStatus,
                    color: newColor,
                    icon: newIcon,
                }),
            });

            if (res.ok) {
                setShowCreateModal(false);
                setNewTitle('');
                setNewDescription('');
                setNewHorizon('yearly');
                setNewTargetDate('');
                setNewStatus('pending');
                setNewColor('#6366f1');
                setNewIcon('🎯');
                fetchObjectives();
            }
        } catch (error) {
            console.error('Error creating objective:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });
            fetchObjectives();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleToggleAction = async (objectiveId: string, actionId: string, currentState: boolean) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions/${actionId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_completed: !currentState }),
            });

            if (selectedObjective) {
                fetchObjectiveDetail(selectedObjective.id);
            }
            fetchObjectives();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    const handleAddAction = async () => {
        if (!selectedObjective || !newActionTitle.trim()) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}/actions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: newActionTitle }),
            });

            setNewActionTitle('');
            fetchObjectiveDetail(selectedObjective.id);
            fetchObjectives();
        } catch (error) {
            console.error('Error adding action:', error);
        }
    };

    const handleDeleteAction = async (objectiveId: string, actionId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${objectiveId}/actions/${actionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (selectedObjective) {
                fetchObjectiveDetail(selectedObjective.id);
            }
            fetchObjectives();
        } catch (error) {
            console.error('Error deleting action:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este objetivo?')) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await fetch(`${API_URL}/api/v1/objectives/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            setShowModal(false);
            setSelectedObjective(null);
            fetchObjectives();
        } catch (error) {
            console.error('Error deleting objective:', error);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        } else if (user) {
            fetchObjectives();
        }
    }, [user, authLoading, router, fetchObjectives]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                ← Dashboard
                            </Link>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎯 Objetivos</h1>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            + Nuevo Objetivo
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm ${filterStatus === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                        >
                            Todos
                        </button>
                        {STATUSES.map(s => (
                            <button
                                key={s.value}
                                onClick={() => setFilterStatus(s.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${filterStatus === s.value ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${s.color}`}></span>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {objectives.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-xl text-gray-500 dark:text-gray-400 mb-4">No hay objetivos</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear tu primer objetivo
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {objectives.filter(o => !o.parent_id).map(obj => (
                            <div
                                key={obj.id}
                                onClick={() => fetchObjectiveDetail(obj.id)}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{obj.icon}</span>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{obj.title}</h3>
                                            <span className="text-xs text-gray-500">{HORIZONS.find(h => h.value === obj.horizon)?.label}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs text-white ${STATUSES.find(s => s.value === obj.status)?.color}`}>
                                        {STATUSES.find(s => s.value === obj.status)?.label}
                                    </span>
                                </div>

                                {obj.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{obj.description}</p>
                                )}

                                {/* Progress */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-500">Progreso</span>
                                        <span className="font-medium" style={{ color: obj.color }}>{obj.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="h-2 rounded-full transition-all"
                                            style={{ width: `${obj.progress}%`, backgroundColor: obj.color }}
                                        />
                                    </div>
                                </div>

                                {/* Actions preview */}
                                {obj.objective_actions && obj.objective_actions.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                        {obj.objective_actions.filter(a => a.is_completed).length}/{obj.objective_actions.length} acciones completadas
                                    </div>
                                )}

                                {obj.target_date && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        📅 {new Date(obj.target_date).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Nuevo Objetivo</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titulo *</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Ej: Aprender Machine Learning"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
                                    <textarea
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horizonte</label>
                                        <select
                                            value={newHorizon}
                                            onChange={(e) => setNewHorizon(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            {HORIZONS.map(h => (
                                                <option key={h.value} value={h.value}>{h.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                                        <select
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            {STATUSES.map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline (opcional)</label>
                                    <input
                                        type="date"
                                        value={newTargetDate}
                                        onChange={(e) => setNewTargetDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icono</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ICONS.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setNewIcon(icon)}
                                                className={`text-2xl p-2 rounded ${newIcon === icon ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setNewColor(color)}
                                                className={`w-8 h-8 rounded-full ${newColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !newTitle.trim()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {creating ? 'Creando...' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showModal && selectedObjective && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl">{selectedObjective.icon}</span>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedObjective.title}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded text-xs text-white ${STATUSES.find(s => s.value === selectedObjective.status)?.color}`}>
                                                {STATUSES.find(s => s.value === selectedObjective.status)?.label}
                                            </span>
                                            <span className="text-sm text-gray-500">{HORIZONS.find(h => h.value === selectedObjective.horizon)?.label}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            </div>

                            {selectedObjective.description && (
                                <p className="text-gray-600 dark:text-gray-400 mb-6">{selectedObjective.description}</p>
                            )}

                            {/* Progress */}
                            <div className="mb-6">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-500">Progreso</span>
                                    <span className="font-bold text-xl" style={{ color: selectedObjective.color }}>{selectedObjective.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div
                                        className="h-3 rounded-full transition-all"
                                        style={{ width: `${selectedObjective.progress}%`, backgroundColor: selectedObjective.color }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Acciones</h3>
                                <div className="space-y-2">
                                    {selectedObjective.objective_actions?.map(action => (
                                        <div key={action.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={action.is_completed}
                                                onChange={() => handleToggleAction(selectedObjective.id, action.id, action.is_completed)}
                                                className="rounded border-gray-300 text-indigo-600"
                                            />
                                            <span className={`flex-1 ${action.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                {action.title}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteAction(selectedObjective.id, action.id)}
                                                className="text-red-500 hover:text-red-700 text-sm"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add action */}
                                <div className="mt-3 flex gap-2">
                                    <input
                                        type="text"
                                        value={newActionTitle}
                                        onChange={(e) => setNewActionTitle(e.target.value)}
                                        placeholder="Nueva accion..."
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                                    />
                                    <button
                                        onClick={handleAddAction}
                                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                                    >
                                        Añadir
                                    </button>
                                </div>
                            </div>

                            {/* Linked items */}
                            {selectedObjective.mental_models && selectedObjective.mental_models.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modelos Mentales</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedObjective.mental_models.map((mm: any) => (
                                            <span key={mm.id} className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-sm">
                                                {mm.icon} {mm.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedObjective.projects && selectedObjective.projects.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proyectos</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedObjective.projects.map((p: any) => (
                                            <span key={p.id} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                                                {p.icon} {p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedObjective.contents_count !== undefined && selectedObjective.contents_count > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        📚 {selectedObjective.contents_count} contenidos asociados
                                    </h4>
                                </div>
                            )}

                            {/* Status change */}
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cambiar estado</h4>
                                <div className="flex gap-2">
                                    {STATUSES.map(s => (
                                        <button
                                            key={s.value}
                                            onClick={() => handleUpdateStatus(selectedObjective.id, s.value)}
                                            className={`px-3 py-1.5 rounded text-sm ${selectedObjective.status === s.value ? `${s.color} text-white` : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Delete */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => handleDelete(selectedObjective.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                >
                                    Eliminar objetivo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
