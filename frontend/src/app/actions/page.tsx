'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    useUnifiedActions,
    useToggleAction,
    useCreateAction,
    useUpdateAction,
    useDeleteAction,
    GroupedActions,
    UnifiedAction,
} from '@/hooks/use-actions';

const PARENT_TYPE_LABELS: Record<string, { label: string; labelSingular: string; icon: string; href: string }> = {
    area: { label: 'Áreas', labelSingular: 'Área', icon: '📋', href: '/areas' },
    objective: { label: 'Objetivos', labelSingular: 'Objetivo', icon: '🎯', href: '/objectives' },
    project: { label: 'Proyectos', labelSingular: 'Proyecto', icon: '📁', href: '/projects' },
    mental_model: { label: 'Modelos Mentales', labelSingular: 'Modelo Mental', icon: '🧠', href: '/mental-models' },
};

const PARENT_TYPE_ORDER = ['area', 'objective', 'project', 'mental_model'];

export default function ActionsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [includeCompleted, setIncludeCompleted] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());

    // Create action state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForGroup, setCreateForGroup] = useState<GroupedActions | null>(null);
    const [newActionTitle, setNewActionTitle] = useState('');

    // Edit action state
    const [editingAction, setEditingAction] = useState<UnifiedAction | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const { data, isLoading, refetch } = useUnifiedActions({
        include_completed: includeCompleted,
        parent_type: filterType !== 'all' ? (filterType as 'area' | 'objective' | 'project' | 'mental_model') : undefined,
    });

    const toggleMutation = useToggleAction();
    const createMutation = useCreateAction();
    const updateMutation = useUpdateAction();
    const deleteMutation = useDeleteAction();

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Only expand groups that have actions (pending or completed)
    useEffect(() => {
        if (data?.groups) {
            const groupsWithActions = data.groups
                .filter((g) => g.actions.length > 0)
                .map((g) => `${g.parent_type}:${g.parent_id}`);
            setExpandedGroups(new Set(groupsWithActions));
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

    const toggleTypeSection = (type: string) => {
        const newCollapsed = new Set(collapsedTypes);
        if (newCollapsed.has(type)) {
            newCollapsed.delete(type);
        } else {
            newCollapsed.add(type);
        }
        setCollapsedTypes(newCollapsed);
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

    // Filter actions by search query
    const filterBySearch = (groups: GroupedActions[]) => {
        if (!searchQuery.trim()) return groups;
        const query = searchQuery.toLowerCase();
        return groups
            .map((group) => ({
                ...group,
                actions: group.actions.filter(
                    (a) =>
                        a.title.toLowerCase().includes(query) ||
                        group.parent_name.toLowerCase().includes(query)
                ),
            }))
            .filter((g) => g.actions.length > 0 || g.parent_name.toLowerCase().includes(query));
    };

    // Sort groups: those with actions first, then alphabetically
    const sortGroups = (groups: GroupedActions[]) => {
        return [...groups].sort((a, b) => {
            // First by whether they have actions (more actions first)
            const aHasActions = a.actions.length > 0;
            const bHasActions = b.actions.length > 0;
            if (aHasActions && !bHasActions) return -1;
            if (!aHasActions && bHasActions) return 1;
            // Then by pending count (more pending first)
            if (a.pending_count !== b.pending_count) return b.pending_count - a.pending_count;
            // Then alphabetically
            return a.parent_name.localeCompare(b.parent_name);
        });
    };

    // Group by parent type for section headers
    const filteredGroups = filterBySearch(data?.groups || []);
    const groupedByType = PARENT_TYPE_ORDER.reduce((acc, type) => {
        const groups = sortGroups(filteredGroups.filter((g) => g.parent_type === type));
        if (groups.length > 0) {
            acc[type] = groups;
        }
        return acc;
    }, {} as Record<string, GroupedActions[]>);

    // Calculate stats
    const totalPending = filteredGroups.reduce((sum, g) => sum + g.pending_count, 0);
    const totalCompleted = filteredGroups.reduce((sum, g) => sum + g.completed_count, 0);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ← Dashboard
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>⚡</span>
                                Acciones
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-8">
                            <div>
                                <div className="text-3xl font-bold text-amber-500">{totalPending}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Pendientes</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-green-500">{totalCompleted}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Completadas</div>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-gray-400">{totalPending + totalCompleted}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                            </div>
                        </div>
                        <div className="flex-1 max-w-md">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-300"
                                    style={{
                                        width: `${
                                            totalPending + totalCompleted > 0
                                                ? (totalCompleted / (totalPending + totalCompleted)) * 100
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar acciones..."
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                        </div>

                        {/* Type filter */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    filterType === 'all'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                Todos
                            </button>
                            {PARENT_TYPE_ORDER.map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        filterType === type
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {PARENT_TYPE_LABELS[type].icon} {PARENT_TYPE_LABELS[type].label}
                                </button>
                            ))}
                        </div>

                        {/* Toggle completed */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Mostrar completadas</span>
                            <button
                                onClick={() => setIncludeCompleted(!includeCompleted)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${
                                    includeCompleted ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                                        includeCompleted ? 'translate-x-6' : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                        </label>
                    </div>
                </div>

                {/* Loading state */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && Object.keys(groupedByType).length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">✓</div>
                        <p className="text-gray-500 dark:text-gray-400 text-lg">
                            {searchQuery ? 'No se encontraron acciones' : 'No hay acciones'}
                        </p>
                    </div>
                )}

                {/* Actions grouped by type */}
                {!isLoading && Object.keys(groupedByType).length > 0 && (
                    <div className="space-y-6">
                        {Object.entries(groupedByType).map(([type, groups]) => {
                            const isTypeCollapsed = collapsedTypes.has(type);
                            const typePendingCount = groups.reduce((sum, g) => sum + g.pending_count, 0);
                            const groupsWithActions = groups.filter((g) => g.actions.length > 0).length;

                            return (
                                <div key={type} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    {/* Type header - collapsible */}
                                    <button
                                        onClick={() => toggleTypeSection(type)}
                                        className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    >
                                        <span className="text-2xl">{PARENT_TYPE_LABELS[type].icon}</span>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {PARENT_TYPE_LABELS[type].label}
                                        </h2>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            ({typePendingCount} pendientes)
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            · {groupsWithActions}/{groups.length} con acciones
                                        </span>
                                        <span className="ml-auto text-gray-400">
                                            {isTypeCollapsed ? '▶' : '▼'}
                                        </span>
                                    </button>

                                    {/* Groups grid */}
                                    {!isTypeCollapsed && (
                                        <div className="p-4 pt-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {groups.map((group) => {
                                                    const groupKey = `${group.parent_type}:${group.parent_id}`;
                                                    const isExpanded = expandedGroups.has(groupKey);
                                                    const parentInfo = PARENT_TYPE_LABELS[group.parent_type];
                                                    const hasActions = group.actions.length > 0;

                                                    return (
                                                        <div
                                                            key={groupKey}
                                                            className={`rounded-xl border overflow-hidden ${
                                                                hasActions
                                                                    ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                                                                    : 'border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 opacity-75'
                                                            }`}
                                                        >
                                                            {/* Group header */}
                                                            <div
                                                                className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                                onClick={() => toggleGroup(groupKey)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span
                                                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                                                        style={{ backgroundColor: group.parent_color + '20' }}
                                                                    >
                                                                        {group.parent_icon}
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                                                                            {group.parent_name}
                                                                        </h3>
                                                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                                            {hasActions ? (
                                                                                <>
                                                                                    <span>{group.pending_count} pendientes</span>
                                                                                    {group.completed_count > 0 && (
                                                                                        <>
                                                                                            <span>·</span>
                                                                                            <span className="text-green-500">
                                                                                                {group.completed_count} completadas
                                                                                            </span>
                                                                                        </>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-gray-400">Sin acciones</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Link
                                                                            href={`${parentInfo.href}/${group.parent_id}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 text-xs"
                                                                            title={`Ir a ${parentInfo.labelSingular}`}
                                                                        >
                                                                            ↗
                                                                        </Link>
                                                                        <span
                                                                            className={`transition-transform text-xs ${
                                                                                isExpanded ? 'rotate-180' : ''
                                                                            } text-gray-400`}
                                                                        >
                                                                            ▼
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Actions list */}
                                                            {isExpanded && (
                                                                <div className="border-t border-gray-200 dark:border-gray-600">
                                                                    {group.actions.length === 0 ? (
                                                                        <div className="p-3 text-center text-gray-400 dark:text-gray-500 text-xs">
                                                                            No hay acciones
                                                                        </div>
                                                                    ) : (
                                                                        <ul className="divide-y divide-gray-100 dark:divide-gray-600">
                                                                            {group.actions.map((action) => (
                                                                                <li
                                                                                    key={action.id}
                                                                                    className="group flex items-center gap-2 p-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-600/50"
                                                                                >
                                                                                    {/* Checkbox */}
                                                                                    <button
                                                                                        onClick={() => handleToggle(action)}
                                                                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                                                            action.is_completed
                                                                                                ? 'bg-green-500 border-green-500 text-white'
                                                                                                : 'border-gray-300 dark:border-gray-500 hover:border-amber-500'
                                                                                        }`}
                                                                                    >
                                                                                        {action.is_completed && (
                                                                                            <span className="text-[10px]">✓</span>
                                                                                        )}
                                                                                    </button>

                                                                                    {/* Title */}
                                                                                    <span
                                                                                        className={`flex-1 text-xs ${
                                                                                            action.is_completed
                                                                                                ? 'line-through text-gray-400 dark:text-gray-500'
                                                                                                : 'text-gray-900 dark:text-white'
                                                                                        }`}
                                                                                    >
                                                                                        {action.title}
                                                                                    </span>

                                                                                    {/* Actions - always visible */}
                                                                                    <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                startEdit(action);
                                                                                            }}
                                                                                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-400"
                                                                                            title="Editar"
                                                                                        >
                                                                                            <span className="text-xs">✏️</span>
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleDelete(action);
                                                                                            }}
                                                                                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-400"
                                                                                            title="Eliminar"
                                                                                        >
                                                                                            <span className="text-xs">🗑️</span>
                                                                                        </button>
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}

                                                                    {/* Add action button */}
                                                                    <button
                                                                        onClick={() => openCreateModal(group)}
                                                                        className="w-full p-2 flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border-t border-gray-100 dark:border-gray-600"
                                                                    >
                                                                        <span className="w-4 h-4 rounded-full border border-dashed border-amber-500 flex items-center justify-center text-xs">
                                                                            +
                                                                        </span>
                                                                        <span className="text-xs font-medium">Añadir acción</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Create action modal */}
            {showCreateModal && createForGroup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                    style={{ backgroundColor: createForGroup.parent_color + '20' }}
                                >
                                    {createForGroup.parent_icon}
                                </span>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Nueva acción</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {createForGroup.parent_name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setCreateForGroup(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>

                        <input
                            type="text"
                            value={newActionTitle}
                            onChange={(e) => setNewActionTitle(e.target.value)}
                            placeholder="Título de la acción"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newActionTitle.trim()) {
                                    handleCreate();
                                }
                            }}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setCreateForGroup(null);
                                }}
                                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newActionTitle.trim() || createMutation.isPending}
                                className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creando...' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit action modal */}
            {editingAction && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Editar acción</h3>
                            <button
                                onClick={() => {
                                    setEditingAction(null);
                                    setEditTitle('');
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>

                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Título de la acción"
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && editTitle.trim()) {
                                    handleUpdate();
                                }
                            }}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setEditingAction(null);
                                    setEditTitle('');
                                }}
                                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={!editTitle.trim() || updateMutation.isPending}
                                className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
                            >
                                {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
