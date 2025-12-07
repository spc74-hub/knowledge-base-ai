'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    deadline: string | null;
    completed_at: string | null;
    color: string;
    icon: string;
    position: number;
    parent_project_id: string | null;
    content_count: number;
    children_count: number;
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
}

interface ProjectTree {
    id: string;
    name: string;
    icon: string;
    color: string;
    status: string;
    parent_project_id: string | null;
    children: ProjectTree[];
    content_count: number;
}

interface Content {
    id: string;
    title: string;
    type: string;
    is_favorite: boolean;
    maturity_level: string;
    created_at: string;
    project_id?: string | null;
}

interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    is_pinned: boolean;
    linked_project_id?: string | null;
    created_at: string;
    updated_at: string;
}

interface ProjectDetail extends Project {
    contents: Content[];
    children: Project[];
    notes?: StandaloneNote[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const STATUS_CONFIG = {
    active: { label: 'Activo', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    on_hold: { label: 'En espera', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    completed: { label: 'Completado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    archived: { label: 'Archivado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
} as const;

const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

const ICONS = ['📁', '🎯', '🚀', '💡', '📚', '🔬', '🎨', '💻', '📊', '🏠'];

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
    node: ProjectTree;
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
                    {node.name}
                </span>
                {node.content_count > 0 && (
                    <span className="text-xs text-gray-400">{node.content_count}</span>
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

export default function ProjectsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const [projectTree, setProjectTree] = useState<ProjectTree[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Drag & Drop state
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createParentId, setCreateParentId] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);

    // Content/Notes linking modals
    const [showContentSelector, setShowContentSelector] = useState(false);
    const [showNoteSelector, setShowNoteSelector] = useState(false);
    const [availableContents, setAvailableContents] = useState<Content[]>([]);
    const [availableNotes, setAvailableNotes] = useState<StandaloneNote[]>([]);
    const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [loadingContents, setLoadingContents] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [linkingContents, setLinkingContents] = useState(false);
    const [linkingNotes, setLinkingNotes] = useState(false);

    // Favorite toggling
    const [togglingFavorite, setTogglingFavorite] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formDeadline, setFormDeadline] = useState('');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formIcon, setFormIcon] = useState('📁');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchProjectTree();
        }
    }, [user]);

    // Open create modal if ?create=true
    useEffect(() => {
        if (searchParams.get('create') === 'true') {
            resetForm();
            setShowCreateModal(true);
        }
    }, [searchParams]);

    const fetchProjectTree = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/tree`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProjectTree(data);
                // Auto-expand all by default
                const allIds = new Set<string>();
                const collectIds = (nodes: ProjectTree[]) => {
                    nodes.forEach(n => {
                        allIds.add(n.id);
                        if (n.children) collectIds(n.children);
                    });
                };
                collectIds(data);
                setExpandedIds(allIds);
            }
        } catch (error) {
            console.error('Error fetching project tree:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectDetail = async (projectId: string) => {
        setLoadingDetail(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            // Fetch project and linked notes in parallel
            const [projectResponse, notesResponse] = await Promise.all([
                fetch(`${API_URL}/api/v1/projects/${projectId}`, {
                    headers: {
                        'Authorization': `Bearer ${session.data.session.access_token}`,
                    },
                }),
                fetch(`${API_URL}/api/v1/projects/${projectId}/notes`, {
                    headers: {
                        'Authorization': `Bearer ${session.data.session.access_token}`,
                    },
                })
            ]);

            if (projectResponse.ok) {
                const data = await projectResponse.json();
                // Add notes to project data
                if (notesResponse.ok) {
                    data.notes = await notesResponse.json();
                } else {
                    data.notes = [];
                }
                setSelectedProject(data);
                // Set form values for editing
                setFormName(data.name);
                setFormDescription(data.description || '');
                setFormDeadline(data.deadline ? data.deadline.split('T')[0] : '');
                setFormColor(data.color);
                setFormIcon(data.icon);
            }
        } catch (error) {
            console.error('Error fetching project detail:', error);
        } finally {
            setLoadingDetail(false);
        }
    };

    const fetchAvailableContents = async () => {
        setLoadingContents(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/contents/?limit=200`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Filter out contents already in this project
                const filtered = data.data.filter((c: Content) => c.project_id !== selectedProjectId);
                setAvailableContents(filtered);
            }
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoadingContents(false);
        }
    };

    const fetchAvailableNotes = async () => {
        setLoadingNotes(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/notes/?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // Filter out notes already linked to this project
                const filtered = data.filter((n: StandaloneNote) => n.linked_project_id !== selectedProjectId);
                setAvailableNotes(filtered);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleLinkContents = async () => {
        if (!selectedProjectId || selectedContentIds.length === 0) return;
        setLinkingContents(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedContentIds),
            });

            if (response.ok) {
                setShowContentSelector(false);
                setSelectedContentIds([]);
                fetchProjectTree();
                fetchProjectDetail(selectedProjectId);
            }
        } catch (error) {
            console.error('Error linking contents:', error);
        } finally {
            setLinkingContents(false);
        }
    };

    const handleLinkNotes = async () => {
        if (!selectedProjectId || selectedNoteIds.length === 0) return;
        setLinkingNotes(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/link-notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(selectedNoteIds),
            });

            if (response.ok) {
                setShowNoteSelector(false);
                setSelectedNoteIds([]);
                fetchProjectDetail(selectedProjectId);
            }
        } catch (error) {
            console.error('Error linking notes:', error);
        } finally {
            setLinkingNotes(false);
        }
    };

    const handleUnlinkNote = async (noteId: string) => {
        if (!selectedProjectId) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/unlink-notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([noteId]),
            });

            if (response.ok) {
                fetchProjectDetail(selectedProjectId);
            }
        } catch (error) {
            console.error('Error unlinking note:', error);
        }
    };

    const handleUnlinkContent = async (contentId: string) => {
        if (!selectedProjectId) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProjectId}/unlink`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify([contentId]),
            });

            if (response.ok) {
                fetchProjectTree();
                fetchProjectDetail(selectedProjectId);
            }
        } catch (error) {
            console.error('Error unlinking content:', error);
        }
    };

    const openContentSelector = () => {
        setSelectedContentIds([]);
        fetchAvailableContents();
        setShowContentSelector(true);
    };

    const openNoteSelector = () => {
        setSelectedNoteIds([]);
        fetchAvailableNotes();
        setShowNoteSelector(true);
    };

    const handleSelectProject = (id: string) => {
        setSelectedProjectId(id);
        setEditMode(false);
        fetchProjectDetail(id);
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

            const response = await fetch(`${API_URL}/api/v1/projects/reorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    project_id: draggedId,
                    new_parent_id: targetId,
                    new_position: 0,
                }),
            });

            if (response.ok) {
                fetchProjectTree();
                if (selectedProjectId) {
                    fetchProjectDetail(selectedProjectId);
                }
            }
        } catch (error) {
            console.error('Error reordering project:', error);
        } finally {
            setDraggedId(null);
            setDragOverId(null);
        }
    };

    const handleDropToRoot = (e: React.DragEvent) => {
        handleDrop(e, null);
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: formName,
                    description: formDescription || null,
                    deadline: formDeadline || null,
                    color: formColor,
                    icon: formIcon,
                    parent_project_id: createParentId,
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchProjectTree();
            }
        } catch (error) {
            console.error('Error creating project:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject) return;
        setSaving(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: formName,
                    description: formDescription || null,
                    deadline: formDeadline || null,
                    color: formColor,
                    icon: formIcon,
                }),
            });

            if (response.ok) {
                setEditMode(false);
                fetchProjectTree();
                fetchProjectDetail(selectedProject.id);
            }
        } catch (error) {
            console.error('Error updating project:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedProject) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ status }),
            });

            if (response.ok) {
                fetchProjectTree();
                fetchProjectDetail(selectedProject.id);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleDeleteProject = async () => {
        if (!selectedProject || !confirm('¿Eliminar este proyecto? Los subproyectos se convertirán en proyectos raíz.')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setSelectedProjectId(null);
                setSelectedProject(null);
                fetchProjectTree();
            }
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const handleToggleFavorite = async () => {
        if (!selectedProject || togglingFavorite) return;
        setTogglingFavorite(true);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${selectedProject.id}/favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedProject({ ...selectedProject, is_favorite: data.is_favorite });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        } finally {
            setTogglingFavorite(false);
        }
    };

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormDeadline('');
        setFormColor('#6366f1');
        setFormIcon('📁');
        setCreateParentId(null);
        setEditMode(false);
    };

    const openCreateSubproject = (parentId: string) => {
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
                        <h1 className="text-2xl font-bold dark:text-white">Proyectos</h1>
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
                            + Nuevo Proyecto
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content - Sidebar + Detail */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Project Tree */}
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
                            Árbol de Proyectos
                        </h2>
                    </div>
                    <div
                        className={`flex-1 overflow-y-auto p-2 ${dragOverId === 'root' ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                    >
                        {projectTree.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                                <p>No hay proyectos</p>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    Crear primer proyecto
                                </button>
                            </div>
                        ) : (
                            projectTree.map(node => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    selectedId={selectedProjectId}
                                    onSelect={handleSelectProject}
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
                            Suelta aquí para mover a raíz
                        </div>
                    )}
                </aside>

                {/* Detail Panel */}
                <main className="flex-1 overflow-y-auto">
                    {!selectedProject ? (
                        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <div className="text-center">
                                <div className="text-6xl mb-4">📁</div>
                                <p>Selecciona un proyecto del árbol</p>
                            </div>
                        </div>
                    ) : loadingDetail ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="p-6 max-w-4xl">
                            {/* Project Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <span
                                        className="text-4xl w-16 h-16 flex items-center justify-center rounded-lg"
                                        style={{ backgroundColor: selectedProject.color + '20' }}
                                    >
                                        {selectedProject.icon}
                                    </span>
                                    <div>
                                        <h2 className="text-2xl font-bold dark:text-white">{selectedProject.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <select
                                                value={selectedProject.status}
                                                onChange={(e) => handleUpdateStatus(e.target.value)}
                                                className={`text-sm px-2 py-1 rounded-full border-0 ${STATUS_CONFIG[selectedProject.status as keyof typeof STATUS_CONFIG]?.color}`}
                                            >
                                                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                                                    <option key={value} value={value}>{config.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap items-center">
                                    <button
                                        onClick={handleToggleFavorite}
                                        disabled={togglingFavorite}
                                        className={`p-2 text-xl rounded-lg transition-colors ${
                                            selectedProject.is_favorite
                                                ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}
                                        title={selectedProject.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                                    >
                                        {selectedProject.is_favorite ? '⭐' : '☆'}
                                    </button>
                                    <button
                                        onClick={openContentSelector}
                                        className="px-3 py-2 text-sm border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                        title="Asociar contenidos existentes"
                                    >
                                        + Contenido
                                    </button>
                                    <button
                                        onClick={openNoteSelector}
                                        className="px-3 py-2 text-sm border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                        title="Asociar notas existentes"
                                    >
                                        + Nota
                                    </button>
                                    <button
                                        onClick={() => openCreateSubproject(selectedProject.id)}
                                        className="px-3 py-2 text-sm border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        + Subproyecto
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
                                <form onSubmit={handleUpdateProject} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Nombre</label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Descripción</label>
                                        <textarea
                                            value={formDescription}
                                            onChange={(e) => setFormDescription(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha límite</label>
                                        <input
                                            type="date"
                                            value={formDeadline}
                                            onChange={(e) => setFormDeadline(e.target.value)}
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
                                    <div className="flex gap-2 justify-between">
                                        <button
                                            type="button"
                                            onClick={handleDeleteProject}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                        >
                                            Eliminar proyecto
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
                                    {selectedProject.description && (
                                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                                            {selectedProject.description}
                                        </p>
                                    )}

                                    {/* Metadata */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                                        {selectedProject.deadline && (
                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                                <span className="text-gray-500 dark:text-gray-400 block">Fecha límite</span>
                                                <span className="font-medium dark:text-white">
                                                    {new Date(selectedProject.deadline).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Creado</span>
                                            <span className="font-medium dark:text-white">
                                                {new Date(selectedProject.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Contenidos</span>
                                            <span className="font-medium dark:text-white">{selectedProject.content_count}</span>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                            <span className="text-gray-500 dark:text-gray-400 block">Subproyectos</span>
                                            <span className="font-medium dark:text-white">{selectedProject.children?.length || 0}</span>
                                        </div>
                                    </div>

                                    {/* Subprojects */}
                                    {selectedProject.children && selectedProject.children.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="font-semibold mb-3 dark:text-white">
                                                Subproyectos ({selectedProject.children.length})
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {selectedProject.children.map(child => (
                                                    <div
                                                        key={child.id}
                                                        onClick={() => handleSelectProject(child.id)}
                                                        className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className="text-xl w-8 h-8 flex items-center justify-center rounded"
                                                                style={{ backgroundColor: child.color + '20' }}
                                                            >
                                                                {child.icon}
                                                            </span>
                                                            <div>
                                                                <span className="font-medium dark:text-white">{child.name}</span>
                                                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[child.status as keyof typeof STATUS_CONFIG]?.color}`}>
                                                                    {STATUS_CONFIG[child.status as keyof typeof STATUS_CONFIG]?.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Standalone Notes */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Notas ({selectedProject.notes?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openNoteSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Añadir
                                            </button>
                                        </div>
                                        {!selectedProject.notes || selectedProject.notes.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
                                                No hay notas vinculadas a este proyecto.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedProject.notes.map(note => (
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
                                                                title="Desvincular nota"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Contents */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold dark:text-white">
                                                Contenidos ({selectedProject.contents?.length || 0})
                                            </h3>
                                            <button
                                                onClick={openContentSelector}
                                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                + Añadir
                                            </button>
                                        </div>
                                        {!selectedProject.contents || selectedProject.contents.length === 0 ? (
                                            <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
                                                No hay contenidos vinculados a este proyecto.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedProject.contents.map(content => (
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
                                                                    {content.type}
                                                                </span>
                                                                {content.is_favorite && <span>⭐</span>}
                                                                <button
                                                                    onClick={() => handleUnlinkContent(content.id)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                                                    title="Desvincular contenido"
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">
                            {createParentId ? 'Nuevo Subproyecto' : 'Nuevo Proyecto'}
                        </h2>
                        <form onSubmit={handleCreateProject}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Nombre</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Descripción</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                                    rows={3}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha límite</label>
                                <input
                                    type="date"
                                    value={formDeadline}
                                    onChange={(e) => setFormDeadline(e.target.value)}
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
                                    disabled={saving || !formName}
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
                            Asociar contenidos a {selectedProject?.name}
                        </h2>

                        {loadingContents ? (
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
                                    Selecciona los contenidos que quieres vincular ({selectedContentIds.length} seleccionados)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableContents.map(content => (
                                        <label
                                            key={content.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedContentIds.includes(content.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedContentIds.includes(content.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedContentIds([...selectedContentIds, content.id]);
                                                    } else {
                                                        setSelectedContentIds(selectedContentIds.filter(id => id !== content.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-indigo-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium dark:text-white block truncate">{content.title}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{content.type}</span>
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
                                    setSelectedContentIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkContents}
                                disabled={linkingContents || selectedContentIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linkingContents ? 'Vinculando...' : `Vincular (${selectedContentIds.length})`}
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
                            Asociar notas a {selectedProject?.name}
                        </h2>

                        {loadingNotes ? (
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
                                    Selecciona las notas que quieres vincular ({selectedNoteIds.length} seleccionadas)
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                    {availableNotes.map(note => (
                                        <label
                                            key={note.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                                                ${selectedNoteIds.includes(note.id)
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedNoteIds.includes(note.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedNoteIds([...selectedNoteIds, note.id]);
                                                    } else {
                                                        setSelectedNoteIds(selectedNoteIds.filter(id => id !== note.id));
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
                                    setSelectedNoteIds([]);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleLinkNotes}
                                disabled={linkingNotes || selectedNoteIds.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {linkingNotes ? 'Vinculando...' : `Vincular (${selectedNoteIds.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
