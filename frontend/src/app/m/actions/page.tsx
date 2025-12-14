'use client';

import { useState, useEffect } from 'react';
import { useUnifiedActions, useToggleAction, useCreateAction, useUpdateAction, useDeleteAction, GroupedActions, UnifiedAction } from '@/hooks/use-actions';

const PARENT_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
    area: { label: 'Áreas', icon: '📋' },
    objective: { label: 'Objetivos', icon: '🎯' },
    project: { label: 'Proyectos', icon: '📁' },
    mental_model: { label: 'Modelos Mentales', icon: '🧠' },
};

const PARENT_TYPE_ORDER = ['area', 'objective', 'project', 'mental_model'];

export default function MobileActionsPage() {
    const [includeCompleted, setIncludeCompleted] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [isDark, setIsDark] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Create action state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForGroup, setCreateForGroup] = useState<GroupedActions | null>(null);
    const [newActionTitle, setNewActionTitle] = useState('');

    // Edit action state
    const [editingAction, setEditingAction] = useState<UnifiedAction | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const { data, isLoading, refetch } = useUnifiedActions({
        include_completed: includeCompleted,
        parent_type: filterType !== 'all' ? filterType as 'area' | 'objective' | 'project' | 'mental_model' : undefined,
    });

    const toggleMutation = useToggleAction();
    const createMutation = useCreateAction();
    const updateMutation = useUpdateAction();
    const deleteMutation = useDeleteAction();

    // Check dark mode
    useEffect(() => {
        const checkDark = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDark();
        const observer = new MutationObserver(checkDark);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Expand all groups by default
    useEffect(() => {
        if (data?.groups) {
            setExpandedGroups(new Set(data.groups.map(g => `${g.parent_type}:${g.parent_id}`)));
        }
    }, [data?.groups]);

    const handleToggle = async (action: UnifiedAction) => {
        try {
            await toggleMutation.mutateAsync({
                parentType: action.parent_type,
                parentId: action.parent_id,
                actionId: action.id,
                currentStatus: action.is_completed,
            });
            refetch();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    const handleCreate = async () => {
        if (!createForGroup || !newActionTitle.trim()) return;

        try {
            await createMutation.mutateAsync({
                parentType: createForGroup.parent_type as 'area' | 'objective' | 'project' | 'mental_model',
                parentId: createForGroup.parent_id,
                title: newActionTitle.trim(),
            });
            setShowCreateModal(false);
            setCreateForGroup(null);
            setNewActionTitle('');
            refetch();
        } catch (error) {
            console.error('Error creating action:', error);
        }
    };

    const handleUpdate = async () => {
        if (!editingAction || !editTitle.trim()) return;

        try {
            await updateMutation.mutateAsync({
                parentType: editingAction.parent_type,
                parentId: editingAction.parent_id,
                actionId: editingAction.id,
                title: editTitle.trim(),
            });
            setEditingAction(null);
            setEditTitle('');
            refetch();
        } catch (error) {
            console.error('Error updating action:', error);
        }
    };

    const handleDelete = async (action: UnifiedAction) => {
        if (!confirm('¿Eliminar esta acción?')) return;

        try {
            await deleteMutation.mutateAsync({
                parentType: action.parent_type,
                parentId: action.parent_id,
                actionId: action.id,
            });
            refetch();
        } catch (error) {
            console.error('Error deleting action:', error);
        }
    };

    const toggleGroup = (key: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedGroups(newExpanded);
    };

    const openCreateModal = (group: GroupedActions) => {
        setCreateForGroup(group);
        setNewActionTitle('');
        setShowCreateModal(true);
    };

    const startEdit = (action: UnifiedAction) => {
        setEditingAction(action);
        setEditTitle(action.title);
    };

    // Group by parent type for section headers
    const groupedByType = PARENT_TYPE_ORDER.reduce((acc, type) => {
        const groups = data?.groups.filter(g => g.parent_type === type) || [];
        if (groups.length > 0) {
            acc[type] = groups;
        }
        return acc;
    }, {} as Record<string, GroupedActions[]>);

    const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with stats */}
            <div className={`rounded-xl p-4 shadow-sm border ${cardClass}`}>
                <div className="flex items-center justify-between mb-3">
                    <h1 className={`text-xl font-bold ${textClass}`}>Acciones</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold text-lg">{data?.total_pending || 0}</span>
                        <span className={mutedTextClass}>pendientes</span>
                    </div>
                </div>
                <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                        className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                        style={{
                            width: `${
                                (data?.total_pending || 0) + (data?.total_completed || 0) > 0
                                    ? ((data?.total_completed || 0) / ((data?.total_pending || 0) + (data?.total_completed || 0))) * 100
                                    : 0
                            }%`,
                        }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className={`text-xs ${mutedTextClass}`}>
                        {data?.total_completed || 0} completadas
                    </span>
                    <span className={`text-xs ${mutedTextClass}`}>
                        {((data?.total_pending || 0) + (data?.total_completed || 0))} total
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <button
                    onClick={() => setFilterType('all')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        filterType === 'all'
                            ? 'bg-amber-500 text-white'
                            : isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-200 text-gray-700'
                    }`}
                >
                    Todos
                </button>
                {PARENT_TYPE_ORDER.map((type) => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filterType === type
                                ? 'bg-amber-500 text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-gray-200 text-gray-700'
                        }`}
                    >
                        {PARENT_TYPE_LABELS[type].icon} {PARENT_TYPE_LABELS[type].label}
                    </button>
                ))}
            </div>

            {/* Toggle completed */}
            <div className="flex items-center justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                    <span className={`text-sm ${mutedTextClass}`}>Mostrar completadas</span>
                    <button
                        onClick={() => setIncludeCompleted(!includeCompleted)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                            includeCompleted ? 'bg-amber-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                        }`}
                    >
                        <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                                includeCompleted ? 'translate-x-5' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </label>
            </div>

            {/* Actions grouped by type then by parent */}
            {Object.keys(groupedByType).length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">✓</div>
                    <p className={mutedTextClass}>No hay acciones</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedByType).map(([type, groups]) => (
                        <div key={type} className="space-y-3">
                            {/* Type header */}
                            <h2 className={`text-sm font-semibold flex items-center gap-2 ${mutedTextClass}`}>
                                <span>{PARENT_TYPE_LABELS[type].icon}</span>
                                <span>{PARENT_TYPE_LABELS[type].label}</span>
                            </h2>

                            {/* Groups within type */}
                            {groups.map((group) => {
                                const groupKey = `${group.parent_type}:${group.parent_id}`;
                                const isExpanded = expandedGroups.has(groupKey);

                                return (
                                    <div
                                        key={groupKey}
                                        className={`rounded-xl shadow-sm border overflow-hidden ${cardClass}`}
                                    >
                                        {/* Group header */}
                                        <button
                                            onClick={() => toggleGroup(groupKey)}
                                            className={`w-full p-3 flex items-center gap-3 ${
                                                isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <span
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                                style={{ backgroundColor: group.parent_color + '20' }}
                                            >
                                                {group.parent_icon}
                                            </span>
                                            <div className="flex-1 text-left min-w-0">
                                                <h3 className={`font-medium truncate ${textClass}`}>
                                                    {group.parent_name}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={mutedTextClass}>
                                                        {group.pending_count} pendientes
                                                    </span>
                                                    {group.completed_count > 0 && (
                                                        <>
                                                            <span className={mutedTextClass}>·</span>
                                                            <span className="text-green-500">
                                                                {group.completed_count} completadas
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''} ${mutedTextClass}`}>
                                                ▼
                                            </span>
                                        </button>

                                        {/* Actions list */}
                                        {isExpanded && (
                                            <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                                {group.actions.map((action) => (
                                                    <div
                                                        key={action.id}
                                                        className={`flex items-center gap-3 p-3 ${
                                                            isDark ? 'border-b border-gray-700 last:border-0' : 'border-b border-gray-100 last:border-0'
                                                        }`}
                                                    >
                                                        {/* Checkbox */}
                                                        <button
                                                            onClick={() => handleToggle(action)}
                                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                                action.is_completed
                                                                    ? 'bg-green-500 border-green-500 text-white'
                                                                    : isDark
                                                                        ? 'border-gray-500 hover:border-amber-500'
                                                                        : 'border-gray-300 hover:border-amber-500'
                                                            }`}
                                                        >
                                                            {action.is_completed && '✓'}
                                                        </button>

                                                        {/* Title */}
                                                        <span
                                                            className={`flex-1 ${
                                                                action.is_completed
                                                                    ? `line-through ${mutedTextClass}`
                                                                    : textClass
                                                            }`}
                                                        >
                                                            {action.title}
                                                        </span>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => startEdit(action)}
                                                                className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                                            >
                                                                <span className="text-xs">✏️</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(action)}
                                                                className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                                            >
                                                                <span className="text-xs">🗑️</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Add action button */}
                                                <button
                                                    onClick={() => openCreateModal(group)}
                                                    className={`w-full p-3 flex items-center gap-3 text-amber-500 ${
                                                        isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="w-6 h-6 rounded-full border-2 border-dashed border-amber-500 flex items-center justify-center text-sm">
                                                        +
                                                    </span>
                                                    <span className="text-sm font-medium">Añadir acción</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* Create action modal */}
            {showCreateModal && createForGroup && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: createForGroup.parent_color + '20' }}
                                >
                                    {createForGroup.parent_icon}
                                </span>
                                <h3 className={`font-semibold ${textClass}`}>
                                    Nueva acción
                                </h3>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setCreateForGroup(null);
                                }}
                                className={mutedTextClass}
                            >
                                ✕
                            </button>
                        </div>

                        <p className={`text-sm mb-3 ${mutedTextClass}`}>
                            Para: {createForGroup.parent_name}
                        </p>

                        <input
                            type="text"
                            value={newActionTitle}
                            onChange={(e) => setNewActionTitle(e.target.value)}
                            placeholder="Título de la acción"
                            className={`w-full px-3 py-2 rounded-lg border mb-4 ${inputClass}`}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newActionTitle.trim()) {
                                    handleCreate();
                                }
                            }}
                        />

                        <button
                            onClick={handleCreate}
                            disabled={!newActionTitle.trim() || createMutation.isPending}
                            className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium disabled:opacity-50"
                        >
                            {createMutation.isPending ? 'Creando...' : 'Crear acción'}
                        </button>
                    </div>
                </div>
            )}

            {/* Edit action modal */}
            {editingAction && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold ${textClass}`}>Editar acción</h3>
                            <button
                                onClick={() => {
                                    setEditingAction(null);
                                    setEditTitle('');
                                }}
                                className={mutedTextClass}
                            >
                                ✕
                            </button>
                        </div>

                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título de la acción"
                            className={`w-full px-3 py-2 rounded-lg border mb-4 ${inputClass}`}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && editTitle.trim()) {
                                    handleUpdate();
                                }
                            }}
                        />

                        <button
                            onClick={handleUpdate}
                            disabled={!editTitle.trim() || updateMutation.isPending}
                            className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium disabled:opacity-50"
                        >
                            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
