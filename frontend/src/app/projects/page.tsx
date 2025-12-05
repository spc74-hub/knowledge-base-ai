'use client';

import { useEffect, useState } from 'react';
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
    content_count: number;
    created_at: string;
    updated_at: string;
}

interface Content {
    id: string;
    title: string;
    type: string;
    is_favorite: boolean;
    maturity_level: string;
    created_at: string;
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

export default function ProjectsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [projectContents, setProjectContents] = useState<Content[]>([]);
    const [loadingContents, setLoadingContents] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formDeadline, setFormDeadline] = useState('');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formIcon, setFormIcon] = useState('📁');
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) {
            fetchProjects();
        }
    }, [user]);

    // Open create modal if ?create=true
    useEffect(() => {
        if (searchParams.get('create') === 'true') {
            resetForm();
            setShowCreateModal(true);
        }
    }, [searchParams]);

    const fetchProjects = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProjects(data);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectContents = async (projectId: string) => {
        setLoadingContents(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setProjectContents(data.contents || []);
            }
        } catch (error) {
            console.error('Error fetching project contents:', error);
        } finally {
            setLoadingContents(false);
        }
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
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchProjects();
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
                fetchProjects();
                const updated = await response.json();
                setSelectedProject(updated);
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
                fetchProjects();
                const updated = await response.json();
                setSelectedProject(updated);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleDeleteProject = async () => {
        if (!selectedProject || !confirm('¿Eliminar este proyecto? Los contenidos vinculados se desasociarán.')) return;

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
                setShowDetailModal(false);
                setSelectedProject(null);
                fetchProjects();
            }
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormDeadline('');
        setFormColor('#6366f1');
        setFormIcon('📁');
        setEditMode(false);
    };

    const openProjectDetail = (project: Project) => {
        setSelectedProject(project);
        setFormName(project.name);
        setFormDescription(project.description || '');
        setFormDeadline(project.deadline ? project.deadline.split('T')[0] : '');
        setFormColor(project.color);
        setFormIcon(project.icon);
        setShowDetailModal(true);
        fetchProjectContents(project.id);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
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

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {projects.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📁</div>
                        <h2 className="text-xl font-semibold mb-2 dark:text-white">No tienes proyectos</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Crea un proyecto para organizar tu contenido por iniciativas o áreas.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear primer proyecto
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <div
                                key={project.id}
                                onClick={() => openProjectDetail(project)}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="text-3xl w-12 h-12 flex items-center justify-center rounded-lg"
                                            style={{ backgroundColor: project.color + '20' }}
                                        >
                                            {project.icon}
                                        </span>
                                        <div>
                                            <h3 className="font-semibold text-lg dark:text-white">{project.name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.active.color}`}>
                                                {STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.label || project.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {project.description && (
                                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                                        {project.description}
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                                    <span>{project.content_count} contenido{project.content_count !== 1 ? 's' : ''}</span>
                                    {project.deadline && (
                                        <span>
                                            Fecha límite: {new Date(project.deadline).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4 dark:text-white">Nuevo Proyecto</h2>
                        <form onSubmit={handleCreateProject}>
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
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
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

            {/* Detail Modal */}
            {showDetailModal && selectedProject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b dark:border-gray-700">
                            <div className="flex items-start justify-between">
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
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setSelectedProject(null);
                                        resetForm();
                                    }}
                                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {editMode ? (
                                <form onSubmit={handleUpdateProject}>
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
                                    <div className="flex gap-2 justify-end">
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
                                </form>
                            ) : (
                                <>
                                    {selectedProject.description && (
                                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                                            {selectedProject.description}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                        {selectedProject.deadline && (
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Fecha límite:</span>
                                                <span className="ml-2 dark:text-white">
                                                    {new Date(selectedProject.deadline).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Creado:</span>
                                            <span className="ml-2 dark:text-white">
                                                {new Date(selectedProject.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold mb-3 dark:text-white">
                                        Contenidos ({selectedProject.content_count})
                                    </h3>

                                    {loadingContents ? (
                                        <div className="text-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
                                        </div>
                                    ) : projectContents.length === 0 ? (
                                        <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
                                            No hay contenidos vinculados a este proyecto.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {projectContents.map(content => (
                                                <Link
                                                    key={content.id}
                                                    href={`/dashboard?content=${content.id}`}
                                                    className="block p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="dark:text-white">{content.title}</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">{content.type}</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!editMode && (
                            <div className="p-4 border-t dark:border-gray-700 flex justify-between">
                                <button
                                    onClick={handleDeleteProject}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                >
                                    Eliminar
                                </button>
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    Editar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
