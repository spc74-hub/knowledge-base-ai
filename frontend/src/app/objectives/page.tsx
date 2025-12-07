'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const HORIZONS = [
    { value: 'daily', label: 'Diario', icon: '📅' },
    { value: 'weekly', label: 'Semanal', icon: '📆' },
    { value: 'monthly', label: 'Mensual', icon: '🗓️' },
    { value: 'quarterly', label: 'Trimestral', icon: '📊' },
    { value: 'yearly', label: 'Anual', icon: '🎯' },
    { value: 'lifetime', label: 'Vida', icon: '⭐' },
];

const STATUSES = [
    { value: 'future', label: 'Futuro', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { value: 'active', label: 'Activo', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    { value: 'completed', label: 'Completado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
];

const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

const ICONS = ['🎯', '🚀', '💡', '📈', '🏆', '⭐', '🔥', '💪', '🎓', '💰'];

interface ObjectiveTree {
    id: string;
    title: string;
    icon: string;
    color: string;
    status: string;
    progress: number;
    parent_id: string | null;
    horizon: string;
    children: ObjectiveTree[];
}

interface Action {
    id: string;
    title: string;
    is_completed: boolean;
    position: number;
}

interface Content {
    id: string;
    title: string;
    content_type: string;
    is_favorite: boolean;
    created_at: string;
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

interface Project {
    id: string;
    name: string;
    status: string;
    color: string;
    icon: string;
}

interface MentalModel {
    id: string;
    name: string;
    slug: string;
    icon: string;
    color: string;
}

interface ObjectiveDetail {
    id: string;
    title: string;
    description: string | null;
    horizon: string;
    target_date: string | null;
    status: string;
    progress: number;
    color: string;
    icon: string;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
    objective_actions: Action[];
    contents: Content[];
    contents_count: number;
    notes: StandaloneNote[];
    projects: Project[];
    mental_models: MentalModel[];
    children: ObjectiveTree[];
}

// Tree Node Component
function TreeNode({
    node,
    selectedId,
    onSelect,
    expandedIds,
    onToggleExpand,
    onDragStart,
    onDragOver,
    onDrop,
    dragOverId,
    level = 0
}: {
    node: ObjectiveTree;
    selectedId: string | null;
    onSelect: (id: string) => void;
    expandedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent, id: string | null) => void;
    onDrop: (e: React.DragEvent, targetId: string | null) => void;
    dragOverId: string | null;
    level?: number;
}) {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isDragOver = dragOverId === node.id;

    return (
        <div>
            <div
                draggable
                onDragStart={(e) => onDragStart(e, node.id)}
                onDragOver={(e) => onDragOver(e, node.id)}
                onDrop={(e) => onDrop(e, node.id)}
                onClick={() => onSelect(node.id)}
                className={`
                    flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                    ${isDragOver ? 'ring-2 ring-indigo-500' : ''}
                `}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(node.id);
                        }}
                        className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>
                ) : (
                    <span className="w-4" />
                )}
                <span
                    className="w-6 h-6 flex items-center justify-center rounded text-sm"
                    style={{ backgroundColor: node.color + '30' }}
                >
                    {node.icon}
                </span>
                <span className={`flex-1 truncate text-sm ${isSelected ? 'font-medium' : ''} dark:text-white`}>
                    {node.title}
                </span>
                {node.progress > 0 && (
                    <span className="text-xs text-gray-400">{node.progress}%</span>
                )}
            </div>
            {hasChildren && isExpanded && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            expandedIds={expandedIds}
                            onToggleExpand={onToggleExpand}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            dragOverId={dragOverId}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ObjectivesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const [objectiveTree, setObjectiveTree] = useState<ObjectiveTree[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
    const [selectedObjective, setSelectedObjective] = useState<ObjectiveDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Drag & Drop state
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);

    // Selector modals
    const [showContentSelector, setShowContentSelector] = useState(false);
    const [showNoteSelector, setShowNoteSelector] = useState(false);
    const [showProjectSelector, setShowProjectSelector] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [availableContents, setAvailableContents] = useState<Content[]>([]);
    const [availableNotes, setAvailableNotes] = useState<StandaloneNote[]>([]);
    const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
    const [availableModels, setAvailableModels] = useState<MentalModel[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loadingSelector, setLoadingSelector] = useState(false);
    const [linking, setLinking] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formHorizon, setFormHorizon] = useState('yearly');
    const [formTargetDate, setFormTargetDate] = useState('');
    const [formStatus, setFormStatus] = useState('pending');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formIcon, setFormIcon] = useState('🎯');
    const [saving, setSaving] = useState(false);

    // Action form
    const [newActionTitle, setNewActionTitle] = useState('');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchObjectiveTree();
        }
    }, [user]);

    // Open create modal if ?create=true
    useEffect(() => {
        if (searchParams.get('create') === 'true') {
            resetForm();
            setShowCreateModal(true);
        }
    }, [searchParams]);

    const fetchObjectiveTree = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/tree`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setObjectiveTree(data);
                // Auto-expand all by default
                const allIds = new Set<string>();
                const collectIds = (nodes: ObjectiveTree[]) => {
                    nodes.forEach(n => {
                        allIds.add(n.id);
                        if (n.children) collectIds(n.children);
                    });
                };
                collectIds(data);
                setExpandedIds(allIds);
            }
        } catch (error) {
            console.error('Error fetching objective tree:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchObjectiveDetail = async (objectiveId: string) => {
        setLoadingDetail(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/${objectiveId}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedObjective(data);
                // Set form values for editing
                setFormTitle(data.title);
                setFormDescription(data.description || '');
                setFormHorizon(data.horizon);
                setFormTargetDate(data.target_date ? data.target_date.split('T')[0] : '');
                setFormStatus(data.status);
                setFormColor(data.color);
                setFormIcon(data.icon);
            }
        } catch (error) {
            console.error('Error fetching objective detail:', error);
        } finally {
            setLoadingDetail(false);
        }
    };

    // Fetch available items for selectors
    const fetchAvailableContents = async () => {
        setLoadingSelector(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/contents/?limit=200`, {
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                // Filter out contents already linked
                const linkedIds = new Set(selectedObjective?.contents?.map(c => c.id) || []);
                const filtered = data.data.filter((c: Content) => !linkedIds.has(c.id));
                setAvailableContents(filtered);
            }
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoadingSelector(false);
        }
    };

    const fetchAvailableNotes = async () => {
        setLoadingSelector(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/?limit=100`, {
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const linkedIds = new Set(selectedObjective?.notes?.map(n => n.id) || []);
                const filtered = data.filter((n: StandaloneNote) => !linkedIds.has(n.id));
                setAvailableNotes(filtered);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoadingSelector(false);
        }
    };

    const fetchAvailableProjects = async () => {
        setLoadingSelector(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/`, {
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const linkedIds = new Set(selectedObjective?.projects?.map(p => p.id) || []);
                const filtered = data.filter((p: Project) => !linkedIds.has(p.id));
                setAvailableProjects(filtered);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoadingSelector(false);
        }
    };

    const fetchAvailableModels = async () => {
        setLoadingSelector(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/mental-models/`, {
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const linkedIds = new Set(selectedObjective?.mental_models?.map(m => m.id) || []);
                const filtered = data.filter((m: MentalModel) => !linkedIds.has(m.id));
                setAvailableModels(filtered);
            }
        } catch (error) {
            console.error('Error fetching mental models:', error);
        } finally {
            setLoadingSelector(false);
        }
    };

    // Linking handlers
    const handleLinkContents = async () => {
        if (!selectedObjectiveId || selectedIds.length === 0) return;
        setLinking(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/link-contents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedIds),
            });

            setShowContentSelector(false);
            setSelectedIds([]);
            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error linking contents:', error);
        } finally {
            setLinking(false);
        }
    };

    const handleLinkNotes = async () => {
        if (!selectedObjectiveId || selectedIds.length === 0) return;
        setLinking(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/link-notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedIds),
            });

            setShowNoteSelector(false);
            setSelectedIds([]);
            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error linking notes:', error);
        } finally {
            setLinking(false);
        }
    };

    const handleLinkProjects = async () => {
        if (!selectedObjectiveId || selectedIds.length === 0) return;
        setLinking(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/link-projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedIds),
            });

            setShowProjectSelector(false);
            setSelectedIds([]);
            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error linking projects:', error);
        } finally {
            setLinking(false);
        }
    };

    const handleLinkModels = async () => {
        if (!selectedObjectiveId || selectedIds.length === 0) return;
        setLinking(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/link-mental-models`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedIds),
            });

            setShowModelSelector(false);
            setSelectedIds([]);
            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error linking mental models:', error);
        } finally {
            setLinking(false);
        }
    };

    // Unlinking handlers
    const handleUnlinkContent = async (contentId: string) => {
        if (!selectedObjectiveId) return;
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/unlink-contents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([contentId]),
            });

            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error unlinking content:', error);
        }
    };

    const handleUnlinkNote = async (noteId: string) => {
        if (!selectedObjectiveId) return;
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/unlink-notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([noteId]),
            });

            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error unlinking note:', error);
        }
    };

    const handleUnlinkProject = async (projectId: string) => {
        if (!selectedObjectiveId) return;
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/unlink-projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([projectId]),
            });

            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error unlinking project:', error);
        }
    };

    const handleUnlinkModel = async (modelId: string) => {
        if (!selectedObjectiveId) return;
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjectiveId}/unlink-mental-models`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([modelId]),
            });

            fetchObjectiveDetail(selectedObjectiveId);
        } catch (error) {
            console.error('Error unlinking mental model:', error);
        }
    };

    // Open selector modals
    const openContentSelector = () => {
        setSelectedIds([]);
        fetchAvailableContents();
        setShowContentSelector(true);
    };

    const openNoteSelector = () => {
        setSelectedIds([]);
        fetchAvailableNotes();
        setShowNoteSelector(true);
    };

    const openProjectSelector = () => {
        setSelectedIds([]);
        fetchAvailableProjects();
        setShowProjectSelector(true);
    };

    const openModelSelector = () => {
        setSelectedIds([]);
        fetchAvailableModels();
        setShowModelSelector(true);
    };

    const handleSelectObjective = (id: string) => {
        setSelectedObjectiveId(id);
        setEditMode(false);
        fetchObjectiveDetail(id);
    };

    const handleToggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Drag & Drop handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
        e.preventDefault();
        if (draggedId && draggedId !== targetId) {
            setDragOverId(targetId);
        }
    };

    const handleDrop = async (e: React.DragEvent, targetId: string | null) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            setDragOverId(null);
            return;
        }

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    objective_id: draggedId,
                    new_parent_id: targetId,
                    new_position: 0,
                }),
            });

            if (response.ok) {
                fetchObjectiveTree();
                if (selectedObjectiveId) {
                    fetchObjectiveDetail(selectedObjectiveId);
                }
            }
        } catch (error) {
            console.error('Error reordering objective:', error);
        } finally {
            setDraggedId(null);
            setDragOverId(null);
        }
    };

    const handleDropToRoot = (e: React.DragEvent) => {
        handleDrop(e, null);
    };

    const handleCreateObjective = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: formTitle,
                    description: formDescription || null,
                    horizon: formHorizon,
                    target_date: formTargetDate || null,
                    status: formStatus,
                    color: formColor,
                    icon: formIcon,
                    parent_id: createParentId,
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchObjectiveTree();
            }
        } catch (error) {
            console.error('Error creating objective:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateObjective = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedObjective) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    title: formTitle,
                    description: formDescription || null,
                    horizon: formHorizon,
                    target_date: formTargetDate || null,
                    status: formStatus,
                    color: formColor,
                    icon: formIcon,
                }),
            });

            if (response.ok) {
                setEditMode(false);
                fetchObjectiveTree();
                fetchObjectiveDetail(selectedObjective.id);
            }
        } catch (error) {
            console.error('Error updating objective:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedObjective) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ status }),
            });

            if (response.ok) {
                fetchObjectiveTree();
                fetchObjectiveDetail(selectedObjective.id);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleDeleteObjective = async () => {
        if (!selectedObjective || !confirm('¿Eliminar este objetivo? Los subobjetivos se convertirán en objetivos raíz.')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setSelectedObjectiveId(null);
                setSelectedObjective(null);
                fetchObjectiveTree();
            }
        } catch (error) {
            console.error('Error deleting objective:', error);
        }
    };

    // Action handlers
    const handleAddAction = async () => {
        if (!selectedObjective || !newActionTitle.trim()) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}/actions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ title: newActionTitle }),
            });

            setNewActionTitle('');
            fetchObjectiveDetail(selectedObjective.id);
            fetchObjectiveTree();
        } catch (error) {
            console.error('Error adding action:', error);
        }
    };

    const handleToggleAction = async (actionId: string, currentState: boolean) => {
        if (!selectedObjective) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}/actions/${actionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ is_completed: !currentState }),
            });

            fetchObjectiveDetail(selectedObjective.id);
            fetchObjectiveTree();
        } catch (error) {
            console.error('Error toggling action:', error);
        }
    };

    const handleDeleteAction = async (actionId: string) => {
        if (!selectedObjective) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            await fetch(`${API_URL}/api/v1/objectives/${selectedObjective.id}/actions/${actionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.data.session.access_token}` },
            });

            fetchObjectiveDetail(selectedObjective.id);
            fetchObjectiveTree();
        } catch (error) {
            console.error('Error deleting action:', error);
        }
    };

    const resetForm = () => {
        setFormTitle('');
        setFormDescription('');
        setFormHorizon('yearly');
        setFormTargetDate('');
        setFormStatus('pending');
        setFormColor('#6366f1');
        setFormIcon('🎯');
        setCreateParentId(null);
        setEditMode(false);
    };

    const openCreateSubobjective = (parentId: string) => {
        resetForm();
        setCreateParentId(parentId);
        setShowCreateModal(true);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex-shrink-0">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            ← Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold dark:text-white">🎯 Objetivos</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            + Nuevo Objetivo
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content - Sidebar + Detail */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Objective Tree */}
                <aside
                    className="w-72 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col overflow-hidden"
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedId) setDragOverId('root');
                    }}
                    onDrop={handleDropToRoot}
                >
                    <div className="p-3 border-b dark:border-gray-700">
                        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Arbol de Objetivos
                        </h2>
                    </div>
                    <div
                        className={`flex-1 overflow-y-auto p-2 ${dragOverId === 'root' ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                    >
                        {objectiveTree.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                <p>No hay objetivos</p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    Crear primer objetivo
                                </button>
                            </div>
                        ) : (
                            objectiveTree.map(node => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    selectedId={selectedObjectiveId}
                                    onSelect={handleSelectObjective}
                                    expandedIds={expandedIds}
                                    onToggleExpand={handleToggleExpand}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    dragOverId={dragOverId}
                                />
                            ))
                        )}
                    </div>
                    {draggedId && (
                        <div className="p-2 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
                            Suelta aqui para mover a raiz
                        </div>
                    )}
                </aside>

                {/* Detail Panel */}
                <main className="flex-1 overflow-y-auto">
                    {!selectedObjective ? (
                        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🎯</div>
                                <p>Selecciona un objetivo del arbol</p>
                            </div>
                        </div>
                    ) : loadingDetail ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="p-6 max-w-4xl">
                            {/* Objective Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <span
                                        className="text-4xl w-16 h-16 flex items-center justify-center rounded-lg"
                                        style={{ backgroundColor: selectedObjective.color + '20' }}
                                    >
                                        {selectedObjective.icon}
                                    </span>
                                    <div>
                                        <h2 className="text-2xl font-bold dark:text-white">{selectedObjective.title}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <select
                                                value={selectedObjective.status}
                                                onChange={(e) => handleUpdateStatus(e.target.value)}
                                                className={`text-sm px-2 py-1 rounded-full border-0 ${STATUSES.find(s => s.value === selectedObjective.status)?.color}`}
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                {HORIZONS.find(h => h.value === selectedObjective.horizon)?.icon} {HORIZONS.find(h => h.value === selectedObjective.horizon)?.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => openCreateSubobjective(selectedObjective.id)}
                                        className="px-3 py-2 text-sm border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        + Subobjetivo
                                    </button>
                                    <button
                                        onClick={() => setEditMode(true)}
                                        className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        Editar
                                    </button>
                                </div>
                            </div>

                            {editMode ? (
                                <form onSubmit={handleUpdateObjective} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Titulo</label>
                                        <input
                                            type="text"
                                            value={formTitle}
                                            onChange={(e) => setFormTitle(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Descripcion</label>
                                        <textarea
                                            value={formDescription}
                                            onChange={(e) => setFormDescription(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Horizonte</label>
                                            <select
                                                value={formHorizon}
                                                onChange={(e) => setFormHorizon(e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            >
                                                {HORIZONS.map(h => (
                                                    <option key={h.value} value={h.value}>{h.icon} {h.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha objetivo</label>
                                            <input
                                                type="date"
                                                value={formTargetDate}
                                                onChange={(e) => setFormTargetDate(e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Icono</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    type="button"
                                                    onClick={() => setFormIcon(icon)}
                                                    className={`text-2xl p-2 rounded-lg ${formIcon === icon ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setFormColor(color)}
                                                    className={`w-8 h-8 rounded-full ${formColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-between">
                                        <button
                                            type="button"
                                            onClick={handleDeleteObjective}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                        >
                                            Eliminar objetivo
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditMode(false)}
                                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {saving ? 'Guardando...' : 'Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    {/* Description */}
                                    {selectedObjective.description && (
                                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                                            {selectedObjective.description}
                                        </p>
                                    )}

                                    {/* Progress */}
                                    <div className="mb-6">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-500 dark:text-gray-400">Progreso</span>
                                            <span className="font-bold text-lg" style={{ color: selectedObjective.color }}>{selectedObjective.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                            <div
                                                className="h-3 rounded-full transition-all"
                                                style={{ width: `${selectedObjective.progress}%`, backgroundColor: selectedObjective.color }}
                                            />
                                        </div>
                                    </div>

                                    {/* Metadata */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                                        {selectedObjective.target_date && (
                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                                <span className="text-gray-500 dark:text-gray-400 block">Fecha objetivo</span>
                                                <span className="font-medium dark:text-white">
                                                    {new Date(selectedObjective.target_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Creado</span>
                                            <span className="font-medium dark:text-white">
                                                {new Date(selectedObjective.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Subobjetivos</span>
                                            <span className="font-medium dark:text-white">{selectedObjective.children?.length || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Acciones</span>
                                            <span className="font-medium dark:text-white">
                                                {selectedObjective.objective_actions?.filter(a => a.is_completed).length || 0}/{selectedObjective.objective_actions?.length || 0}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions (checklist) */}
                                    <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                                        <h3 className="font-semibold mb-3 dark:text-white">Acciones</h3>
                                        <div className="space-y-2">
                                            {selectedObjective.objective_actions?.map(action => (
                                                <div key={action.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={action.is_completed}
                                                        onChange={() => handleToggleAction(action.id, action.is_completed)}
                                                        className="rounded border-gray-300 text-indigo-600"
                                                    />
                                                    <span className={`flex-1 ${action.is_completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                        {action.title}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteAction(action.id)}
                                                        className="text-red-500 hover:text-red-700 text-sm opacity-0 hover:opacity-100"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <input
                                                type="text"
                                                value={newActionTitle}
                                                onChange={(e) => setNewActionTitle(e.target.value)}
                                                placeholder="Nueva accion..."
                                                className="flex-1 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                                            />
                                            <button
                                                onClick={handleAddAction}
                                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                                            >
                                                Anadir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Subobjetivos */}
                                    {selectedObjective.children && selectedObjective.children.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="font-semibold mb-3 dark:text-white">
                                                Subobjetivos ({selectedObjective.children.length})
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {selectedObjective.children.map(child => (
                                                    <div
                                                        key={child.id}
                                                        onClick={() => handleSelectObjective(child.id)}
                                                        className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className="text-xl w-8 h-8 flex items-center justify-center rounded"
                                                                style={{ backgroundColor: child.color + '20' }}
                                                            >
                                                                {child.icon}
                                                            </span>
                                                            <div className="flex-1">
                                                                <span className="font-medium dark:text-white">{child.title}</span>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUSES.find(s => s.value === child.status)?.color}`}>
                                                                        {STATUSES.find(s => s.value === child.status)?.label}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">{child.progress}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Linked Projects */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Proyectos ({selectedObjective.projects?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openProjectSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Anadir
                                            </button>
                                        </div>
                                        {!selectedObjective.projects || selectedObjective.projects.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-2">
                                                No hay proyectos vinculados.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedObjective.projects.map(project => (
                                                    <div
                                                        key={project.id}
                                                        className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg group"
                                                    >
                                                        <span>{project.icon}</span>
                                                        <span>{project.name}</span>
                                                        <button
                                                            onClick={() => handleUnlinkProject(project.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-red-500"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Linked Mental Models */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Modelos Mentales ({selectedObjective.mental_models?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openModelSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Anadir
                                            </button>
                                        </div>
                                        {!selectedObjective.mental_models || selectedObjective.mental_models.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-2">
                                                No hay modelos mentales vinculados.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedObjective.mental_models.map(model => (
                                                    <div
                                                        key={model.id}
                                                        className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-lg group"
                                                    >
                                                        <span>{model.icon}</span>
                                                        <span>{model.name}</span>
                                                        <button
                                                            onClick={() => handleUnlinkModel(model.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-purple-600 hover:text-red-500"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Linked Notes */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Notas ({selectedObjective.notes?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openNoteSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Anadir
                                            </button>
                                        </div>
                                        {!selectedObjective.notes || selectedObjective.notes.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-2">
                                                No hay notas vinculadas.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedObjective.notes.map(note => (
                                                    <div
                                                        key={note.id}
                                                        className="p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg group"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm">
                                                                        {note.note_type === 'reflection' && '💭'}
                                                                        {note.note_type === 'idea' && '💡'}
                                                                        {note.note_type === 'question' && '❓'}
                                                                        {note.note_type === 'connection' && '🔗'}
                                                                        {note.note_type === 'journal' && '📓'}
                                                                    </span>
                                                                    <span className="font-medium dark:text-white truncate">
                                                                        {note.title}
                                                                    </span>
                                                                    {note.is_pinned && <span className="text-xs">📌</span>}
                                                                </div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                                                    {note.content.substring(0, 100)}...
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleUnlinkNote(note.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Linked Contents */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Contenidos ({selectedObjective.contents?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openContentSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Anadir
                                            </button>
                                        </div>
                                        {!selectedObjective.contents || selectedObjective.contents.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-2">
                                                No hay contenidos vinculados.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedObjective.contents.map(content => (
                                                    <div
                                                        key={content.id}
                                                        className="p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg group"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <Link
                                                                href={`/dashboard?content=${content.id}`}
                                                                className="flex-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                            >
                                                                <span className="dark:text-white">{content.title}</span>
                                                            </Link>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                                    {content.content_type}
                                                                </span>
                                                                {content.is_favorite && <span>⭐</span>}
                                                                <button
                                                                    onClick={() => handleUnlinkContent(content.id)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            {createParentId ? 'Nuevo Subobjetivo' : 'Nuevo Objetivo'}
                        </h2>
                        <form onSubmit={handleCreateObjective}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Titulo</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Descripcion</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Horizonte</label>
                                    <select
                                        value={formHorizon}
                                        onChange={(e) => setFormHorizon(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    >
                                        {HORIZONS.map(h => (
                                            <option key={h.value} value={h.value}>{h.icon} {h.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-300">Estado</label>
                                    <select
                                        value={formStatus}
                                        onChange={(e) => setFormStatus(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    >
                                        {STATUSES.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha objetivo</label>
                                <input
                                    type="date"
                                    value={formTargetDate}
                                    onChange={(e) => setFormTargetDate(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Icono</label>
                                <div className="flex gap-2 flex-wrap">
                                    {ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormIcon(icon)}
                                            className={`text-2xl p-2 rounded-lg ${formIcon === icon ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormColor(color)}
                                            className={`w-8 h-8 rounded-full ${formColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !formTitle}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {saving ? 'Creando...' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Content Selector Modal */}
            {showContentSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            Asociar contenidos a {selectedObjective?.title}
                        </h2>

                        {loadingSelector ? (
                            <div className="flex-1 flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : availableContents.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
                                No hay contenidos disponibles para asociar.
                            </p>
                        ) : (
                            <>
                                <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                                    Selecciona los contenidos que quieres vincular ({selectedIds.length} seleccionados)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableContents.map(content => (
                                        <label
                                            key={content.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedIds.includes(content.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(content.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds([...selectedIds, content.id]);
                                                    } else {
                                                        setSelectedIds(selectedIds.filter(id => id !== content.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium dark:text-white block truncate">{content.title}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{content.content_type}</span>
                                            </div>
                                            {content.is_favorite && <span>⭐</span>}
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowContentSelector(false);
                                    setSelectedIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkContents}
                                disabled={linking || selectedIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linking ? 'Vinculando...' : `Vincular (${selectedIds.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Selector Modal */}
            {showNoteSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            Asociar notas a {selectedObjective?.title}
                        </h2>

                        {loadingSelector ? (
                            <div className="flex-1 flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : availableNotes.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
                                No hay notas disponibles para asociar.
                            </p>
                        ) : (
                            <>
                                <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                                    Selecciona las notas que quieres vincular ({selectedIds.length} seleccionadas)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableNotes.map(note => (
                                        <label
                                            key={note.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedIds.includes(note.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(note.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds([...selectedIds, note.id]);
                                                    } else {
                                                        setSelectedIds(selectedIds.filter(id => id !== note.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600 mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">
                                                        {note.note_type === 'reflection' && '💭'}
                                                        {note.note_type === 'idea' && '💡'}
                                                        {note.note_type === 'question' && '❓'}
                                                        {note.note_type === 'connection' && '🔗'}
                                                        {note.note_type === 'journal' && '📓'}
                                                    </span>
                                                    <span className="font-medium dark:text-white truncate">{note.title}</span>
                                                    {note.is_pinned && <span className="text-xs">📌</span>}
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                                    {note.content.substring(0, 80)}...
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNoteSelector(false);
                                    setSelectedIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkNotes}
                                disabled={linking || selectedIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linking ? 'Vinculando...' : `Vincular (${selectedIds.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Selector Modal */}
            {showProjectSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            Asociar proyectos a {selectedObjective?.title}
                        </h2>

                        {loadingSelector ? (
                            <div className="flex-1 flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : availableProjects.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
                                No hay proyectos disponibles para asociar.
                            </p>
                        ) : (
                            <>
                                <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                                    Selecciona los proyectos que quieres vincular ({selectedIds.length} seleccionados)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableProjects.map(project => (
                                        <label
                                            key={project.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedIds.includes(project.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(project.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds([...selectedIds, project.id]);
                                                    } else {
                                                        setSelectedIds(selectedIds.filter(id => id !== project.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600"
                                            />
                                            <span
                                                className="w-8 h-8 flex items-center justify-center rounded text-lg"
                                                style={{ backgroundColor: project.color + '30' }}
                                            >
                                                {project.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium dark:text-white block truncate">{project.name}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{project.status}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowProjectSelector(false);
                                    setSelectedIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkProjects}
                                disabled={linking || selectedIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linking ? 'Vinculando...' : `Vincular (${selectedIds.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mental Model Selector Modal */}
            {showModelSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            Asociar modelos mentales a {selectedObjective?.title}
                        </h2>

                        {loadingSelector ? (
                            <div className="flex-1 flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : availableModels.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
                                No hay modelos mentales disponibles para asociar.
                            </p>
                        ) : (
                            <>
                                <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                                    Selecciona los modelos mentales que quieres vincular ({selectedIds.length} seleccionados)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableModels.map(model => (
                                        <label
                                            key={model.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedIds.includes(model.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(model.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds([...selectedIds, model.id]);
                                                    } else {
                                                        setSelectedIds(selectedIds.filter(id => id !== model.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600"
                                            />
                                            <span
                                                className="w-8 h-8 flex items-center justify-center rounded text-lg"
                                                style={{ backgroundColor: model.color + '30' }}
                                            >
                                                {model.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium dark:text-white block truncate">{model.name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowModelSelector(false);
                                    setSelectedIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkModels}
                                disabled={linking || selectedIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linking ? 'Vinculando...' : `Vincular (${selectedIds.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
