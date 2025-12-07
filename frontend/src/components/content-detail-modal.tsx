'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types for Projects and Mental Models
interface Project {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
}

interface MentalModel {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
}

interface StandaloneNote {
    id: string;
    title: string;
    content: string;
    note_type: string;
    tags: string[];
    source_content_id: string | null;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

export interface ContentDetail {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    iab_tier2: string | null;
    iab_tier3: string | null;
    concepts: string[];
    entities: {
        organizations?: Array<string | { name: string }>;
        products?: Array<string | { name: string }>;
        persons?: Array<string | { name: string }>;
    } | null;
    schema_type: string | null;
    content_format: string | null;
    technical_level: string | null;
    language: string | null;
    sentiment: string | null;
    reading_time_minutes: number | null;
    processing_status: string;
    maturity_level: string | null;
    is_favorite: boolean;
    is_archived: boolean;
    user_tags: string[];
    user_note: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    raw_content: string | null;
}

interface ContentDetailModalProps {
    content: ContentDetail | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: (content: ContentDetail) => void;
    onArchive?: (contentId: string) => void;
    onDelete?: (contentId: string) => void;
    onFilterClick?: (filterType: string, value: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
    youtube: '🎬',
    tiktok: '📱',
    twitter: 'X',
    web: '🌐',
    note: '📝',
    apple_notes: '🍎',
    article: '📰',
    video: '🎬',
    pdf: '📕',
    docx: '📘',
    email: '📧',
    default: '📄',
};

const NOTE_TYPE_ICONS: Record<string, string> = {
    reflection: '💭',
    idea: '💡',
    question: '❓',
    connection: '🔗',
    journal: '📓',
};

const MATURITY_LEVELS = [
    { value: 'captured', label: 'Capturado', icon: '📥', color: 'gray', description: 'Guardado, pendiente de revisar' },
    { value: 'processed', label: 'Procesado', icon: '👁️', color: 'blue', description: 'Revisado personalmente' },
    { value: 'connected', label: 'Conectado', icon: '🔗', color: 'purple', description: 'Vinculado a proyectos o modelos' },
    { value: 'integrated', label: 'Integrado', icon: '✅', color: 'green', description: 'Asimilado en tu conocimiento' },
];

export function ContentDetailModal({
    content,
    isOpen,
    onClose,
    onUpdate,
    onArchive,
    onDelete,
    onFilterClick,
}: ContentDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [editingTags, setEditingTags] = useState(false);
    const [editingNote, setEditingNote] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [userNote, setUserNote] = useState('');
    const [userTags, setUserTags] = useState<string[]>([]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [reprocessing, setReprocessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [savingNote, setSavingNote] = useState(false);
    const [maturityLevel, setMaturityLevel] = useState<string>('captured');
    const [updatingMaturity, setUpdatingMaturity] = useState(false);

    // Project linking modal state
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [linkingProject, setLinkingProject] = useState(false);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

    // Mental model linking modal state
    const [showModelModal, setShowModelModal] = useState(false);
    const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [linkingModel, setLinkingModel] = useState(false);
    const [linkedModelIds, setLinkedModelIds] = useState<Set<string>>(new Set());

    // Notes linked to this content (lazy loaded)
    const [contentNotes, setContentNotes] = useState<StandaloneNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [showNewNoteForm, setShowNewNoteForm] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [newNoteType, setNewNoteType] = useState<string>('reflection');
    const [savingNewNote, setSavingNewNote] = useState(false);

    useEffect(() => {
        if (content) {
            setUserTags(content.user_tags || []);
            setUserNote(content.user_note || '');
            setIsFavorite(content.is_favorite || false);
            setProcessingStatus(content.processing_status || 'pending');
            setMaturityLevel(content.maturity_level || 'captured');
        }
    }, [content]);

    const getAuthHeaders = useCallback(async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            ...(session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}),
        };
    }, []);

    const handleToggleFavorite = async () => {
        if (!content) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/favorite`, {
                method: 'POST',
                headers,
            });
            if (response.ok) {
                const newValue = !isFavorite;
                setIsFavorite(newValue);
                onUpdate?.({ ...content, is_favorite: newValue });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleArchive = async () => {
        if (!content) return;
        if (!confirm(`¿Estas seguro de ${content.is_archived ? 'restaurar' : 'archivar'} este contenido?`)) return;

        try {
            const headers = await getAuthHeaders();
            const endpoint = content.is_archived ? 'unarchive' : 'archive';
            const response = await fetch(`${API_URL}/api/v1/content/bulk/${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content_ids: [content.id] }),
            });
            if (response.ok) {
                onArchive?.(content.id);
                onClose();
            }
        } catch (error) {
            console.error('Error archiving:', error);
        }
    };

    const handleDelete = async () => {
        if (!content) return;
        if (!confirm('¿Estas seguro de ELIMINAR PERMANENTEMENTE este contenido? Esta accion no se puede deshacer.')) return;

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/bulk/delete`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content_ids: [content.id] }),
            });
            if (response.ok) {
                onDelete?.(content.id);
                onClose();
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const handleAddTag = async () => {
        if (!content || !newTag.trim()) return;
        const tag = newTag.trim().toLowerCase();
        if (userTags.includes(tag)) {
            setNewTag('');
            return;
        }

        const updatedTags = [...userTags, tag];
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_tags: updatedTags }),
            });
            if (response.ok) {
                setUserTags(updatedTags);
                setNewTag('');
                onUpdate?.({ ...content, user_tags: updatedTags });
            }
        } catch (error) {
            console.error('Error adding tag:', error);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!content) return;
        const updatedTags = userTags.filter(t => t !== tagToRemove);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_tags: updatedTags }),
            });
            if (response.ok) {
                setUserTags(updatedTags);
                onUpdate?.({ ...content, user_tags: updatedTags });
            }
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    };

    const handleSaveNote = async () => {
        if (!content) return;
        setSavingNote(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ user_note: userNote }),
            });
            if (response.ok) {
                setEditingNote(false);
                const updatedContent = { ...content, user_note: userNote };
                onUpdate?.(updatedContent);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error saving note:', response.status, errorData);
                alert(`Error al guardar: ${errorData.detail || response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Error de conexion al guardar la nota');
        } finally {
            setSavingNote(false);
        }
    };

    const handleReprocess = async () => {
        if (!content) return;
        setReprocessing(true);
        setProcessingStatus('processing');
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/reprocess`, {
                method: 'POST',
                headers,
            });
            if (response.ok) {
                const data = await response.json();
                // Processing was done immediately, update status to completed
                setProcessingStatus('completed');
                onUpdate?.({ ...content, processing_status: 'completed' });
                // Optionally refresh content to get new summary/data
                if (onUpdate) {
                    // Fetch updated content
                    const contentResponse = await fetch(`${API_URL}/api/v1/content/${content.id}`, {
                        headers,
                    });
                    if (contentResponse.ok) {
                        const updatedContent = await contentResponse.json();
                        onUpdate(updatedContent);
                    }
                }
            } else {
                const errorData = await response.json();
                console.error('Reprocess failed:', errorData);
                setProcessingStatus('failed');
            }
        } catch (error) {
            console.error('Error reprocessing:', error);
            setProcessingStatus('failed');
        } finally {
            setReprocessing(false);
        }
    };

    const handleMaturityChange = async (newLevel: string) => {
        if (!content || updatingMaturity) return;
        setUpdatingMaturity(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/maturity`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ maturity_level: newLevel }),
            });
            if (response.ok) {
                setMaturityLevel(newLevel);
                onUpdate?.({ ...content, maturity_level: newLevel });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error updating maturity:', response.status, errorData);
            }
        } catch (error) {
            console.error('Error updating maturity level:', error);
        } finally {
            setUpdatingMaturity(false);
        }
    };

    // Fetch projects for linking modal
    const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/projects/`, { headers });
            if (response.ok) {
                const data = await response.json();
                setProjects(data || []);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoadingProjects(false);
        }
    };

    // Fetch the current project for this content
    const fetchCurrentProject = async () => {
        if (!content) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/${content.id}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setCurrentProjectId(data.project_id || null);
            }
        } catch (error) {
            console.error('Error fetching content project:', error);
        }
    };

    // Handle opening project modal
    const handleOpenProjectModal = async () => {
        setShowProjectModal(true);
        await Promise.all([fetchProjects(), fetchCurrentProject()]);
    };

    // Link content to project
    const handleLinkToProject = async (projectId: string | null) => {
        if (!content) return;
        setLinkingProject(true);
        try {
            const headers = await getAuthHeaders();
            if (projectId) {
                // Link to project
                const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/link`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([content.id]),
                });
                if (response.ok) {
                    setCurrentProjectId(projectId);
                    // Auto-upgrade maturity to connected if below
                    if (maturityLevel === 'captured' || maturityLevel === 'processed') {
                        await handleMaturityChange('connected');
                    }
                }
            } else if (currentProjectId) {
                // Unlink from current project
                const response = await fetch(`${API_URL}/api/v1/projects/${currentProjectId}/unlink`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([content.id]),
                });
                if (response.ok) {
                    setCurrentProjectId(null);
                }
            }
            setShowProjectModal(false);
        } catch (error) {
            console.error('Error linking to project:', error);
        } finally {
            setLinkingProject(false);
        }
    };

    // Fetch mental models for linking modal
    const fetchMentalModels = async () => {
        setLoadingModels(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/`, { headers });
            if (response.ok) {
                const data = await response.json();
                setMentalModels(data.models || []);
            }
        } catch (error) {
            console.error('Error fetching mental models:', error);
        } finally {
            setLoadingModels(false);
        }
    };

    // Fetch linked mental models for this content
    const fetchLinkedModels = async () => {
        if (!content) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/mental-models/contents/${content.id}`, { headers });
            if (response.ok) {
                const data = await response.json();
                const ids = new Set<string>((data.models || []).map((m: MentalModel) => m.id));
                setLinkedModelIds(ids);
            }
        } catch (error) {
            console.error('Error fetching linked models:', error);
        }
    };

    // Handle opening mental model modal
    const handleOpenModelModal = async () => {
        setShowModelModal(true);
        await Promise.all([fetchMentalModels(), fetchLinkedModels()]);
    };

    // Toggle mental model link
    const handleToggleModelLink = async (modelId: string) => {
        if (!content) return;
        setLinkingModel(true);
        try {
            const headers = await getAuthHeaders();
            const isLinked = linkedModelIds.has(modelId);

            if (isLinked) {
                // Unlink
                const response = await fetch(`${API_URL}/api/v1/mental-models/contents/${content.id}/${modelId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (response.ok) {
                    setLinkedModelIds(prev => {
                        const next = new Set(prev);
                        next.delete(modelId);
                        return next;
                    });
                }
            } else {
                // Link
                const response = await fetch(`${API_URL}/api/v1/mental-models/contents/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        content_id: content.id,
                        mental_model_id: modelId,
                    }),
                });
                if (response.ok) {
                    setLinkedModelIds(prev => new Set(prev).add(modelId));
                    // Auto-upgrade maturity to connected if below
                    if (maturityLevel === 'captured' || maturityLevel === 'processed') {
                        await handleMaturityChange('connected');
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling model link:', error);
        } finally {
            setLinkingModel(false);
        }
    };

    // Fetch notes linked to this content
    const fetchContentNotes = useCallback(async () => {
        if (!content) return;
        setLoadingNotes(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/notes/?source_content_id=${content.id}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setContentNotes(data || []);
            }
        } catch (error) {
            console.error('Error fetching content notes:', error);
        } finally {
            setLoadingNotes(false);
        }
    }, [content, getAuthHeaders]);

    // Reset notes state when content changes (lazy loading)
    useEffect(() => {
        if (content) {
            setNotesExpanded(false);
            setNotesLoaded(false);
            setContentNotes([]);
        }
    }, [content?.id]);

    // Lazy load notes when section is expanded
    const handleExpandNotes = () => {
        setNotesExpanded(!notesExpanded);
        if (!notesLoaded && !notesExpanded) {
            fetchContentNotes();
            setNotesLoaded(true);
        }
    };

    // Create a new note linked to this content
    const handleCreateNote = async () => {
        if (!content || !newNoteTitle.trim() || !newNoteContent.trim()) return;
        setSavingNewNote(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/notes/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title: newNoteTitle.trim(),
                    content: newNoteContent.trim(),
                    note_type: newNoteType,
                    tags: [],
                    linked_content_ids: [content.id],
                    linked_note_ids: [],
                    source_content_id: content.id,
                }),
            });
            if (response.ok) {
                const newNote = await response.json();
                setContentNotes(prev => [newNote, ...prev]);
                setNewNoteTitle('');
                setNewNoteContent('');
                setNewNoteType('reflection');
                setShowNewNoteForm(false);
            } else {
                const error = await response.json().catch(() => ({}));
                console.error('Error creating note:', error);
                alert('Error al crear la nota');
            }
        } catch (error) {
            console.error('Error creating note:', error);
            alert('Error de conexión');
        } finally {
            setSavingNewNote(false);
        }
    };

    // Delete a note
    const handleDeleteNote = async (noteId: string) => {
        if (!confirm('¿Eliminar esta nota?')) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/notes/${noteId}`, {
                method: 'DELETE',
                headers,
            });
            if (response.ok) {
                setContentNotes(prev => prev.filter(n => n.id !== noteId));
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const getTypeIcon = (type: string) => TYPE_ICONS[type] || TYPE_ICONS.default;

    const getEntityName = (entity: string | { name: string }) => {
        return typeof entity === 'string' ? entity : entity.name;
    };

    if (!isOpen || !content) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-3xl">{getTypeIcon(content.type)}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    content.processing_status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                    content.processing_status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                }`}>
                                    {content.processing_status}
                                </span>
                                {content.sentiment && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        content.sentiment === 'positive' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                        content.sentiment === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {content.sentiment}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2 line-clamp-2">
                                {content.title || 'Sin titulo'}
                            </h2>
                            {content.url.startsWith('apple-notes://') ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400 truncate block mt-1">
                                    🍎 Importado desde Apple Notes · {content.metadata?.apple_notes_folder || 'Sin carpeta'}
                                </span>
                            ) : (
                                <a
                                    href={content.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block mt-1"
                                >
                                    {content.url}
                                </a>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 text-2xl ml-4"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tipo</p>
                            <p className="font-medium capitalize text-gray-900 dark:text-white">{content.type}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Categoria IAB</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.iab_tier1 || '-'}</p>
                            {content.iab_tier2 && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">{content.iab_tier2}</p>
                            )}
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Schema.org</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.schema_type || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Formato</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.content_format || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Nivel Tecnico</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.technical_level || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Idioma</p>
                            <p className="font-medium uppercase text-gray-900 dark:text-white">{content.language || '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tiempo Lectura</p>
                            <p className="font-medium text-gray-900 dark:text-white">{content.reading_time_minutes ? `${content.reading_time_minutes} min` : '-'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Fecha</p>
                            <p className="font-medium text-gray-900 dark:text-white">{new Date(content.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    {/* Maturity Level Selector */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                            Nivel de Madurez
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                            {MATURITY_LEVELS.map((level) => {
                                const isActive = maturityLevel === level.value;
                                const colorClasses = {
                                    gray: isActive ? 'bg-gray-200 dark:bg-gray-600 border-gray-400 dark:border-gray-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                                    blue: isActive ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30',
                                    purple: isActive ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-400 dark:border-purple-600' : 'hover:bg-purple-50 dark:hover:bg-purple-900/30',
                                    green: isActive ? 'bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-600' : 'hover:bg-green-50 dark:hover:bg-green-900/30',
                                };
                                return (
                                    <button
                                        key={level.value}
                                        onClick={() => handleMaturityChange(level.value)}
                                        disabled={updatingMaturity}
                                        className={`p-3 rounded-lg border-2 transition-all ${
                                            isActive ? colorClasses[level.color as keyof typeof colorClasses] : `border-gray-200 dark:border-gray-700 ${colorClasses[level.color as keyof typeof colorClasses]}`
                                        } ${updatingMaturity ? 'opacity-50 cursor-wait' : ''}`}
                                        title={level.description}
                                    >
                                        <div className="text-2xl mb-1">{level.icon}</div>
                                        <div className={`text-xs font-medium ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {level.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {MATURITY_LEVELS.find(l => l.value === maturityLevel)?.description}
                        </p>
                    </div>

                    {/* Summary */}
                    {content.summary && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Resumen</h3>
                            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                                <p className="text-gray-800 dark:text-gray-200">{content.summary}</p>
                            </div>
                        </div>
                    )}

                    {/* Original Content for Apple Notes */}
                    {content.raw_content && (content.type === 'note' || content.metadata?.source === 'apple_notes') && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Contenido Original {content.metadata?.source === 'apple_notes' && '(Apple Notes)'}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                                    dangerouslySetInnerHTML={{ __html: content.raw_content }}
                                />
                            </div>
                        </div>
                    )}

                    {/* User Tags */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Mis Tags</h3>
                            <button
                                onClick={() => setEditingTags(!editingTags)}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                {editingTags ? 'Listo' : 'Editar'}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {userTags.map(tag => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 rounded-full text-sm flex items-center gap-1"
                                >
                                    #{tag}
                                    {editingTags && (
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="ml-1 text-indigo-600 dark:text-indigo-400 hover:text-red-600 dark:hover:text-red-400"
                                        >
                                            ×
                                        </button>
                                    )}
                                </span>
                            ))}
                            {userTags.length === 0 && !editingTags && (
                                <span className="text-gray-400 text-sm">Sin tags</span>
                            )}
                        </div>
                        {editingTags && (
                            <div className="flex gap-2 mt-3">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                    placeholder="Nuevo tag..."
                                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <button
                                    onClick={handleAddTag}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                                >
                                    Anadir
                                </button>
                            </div>
                        )}
                    </div>

                    {/* User Note */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Mi Nota</h3>
                            {!editingNote && (
                                <button
                                    onClick={() => setEditingNote(true)}
                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {userNote ? 'Editar' : 'Anadir nota'}
                                </button>
                            )}
                        </div>
                        {editingNote ? (
                            <div className="space-y-2">
                                <textarea
                                    value={userNote}
                                    onChange={(e) => setUserNote(e.target.value)}
                                    rows={4}
                                    placeholder="Escribe tu nota sobre este contenido..."
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => {
                                            setEditingNote(false);
                                            setUserNote(content.user_note || '');
                                        }}
                                        className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveNote}
                                        disabled={savingNote}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {savingNote ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        ) : userNote ? (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{userNote}</p>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Sin nota adjunta</p>
                        )}
                    </div>

                    {/* Notes linked to this content (lazy loaded) */}
                    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                            onClick={handleExpandNotes}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
                                <span>{notesExpanded ? '▼' : '▶'}</span>
                                Mis Notas sobre este contenido
                                {notesLoaded && contentNotes.length > 0 && (
                                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                                        {contentNotes.length}
                                    </span>
                                )}
                            </h3>
                            {notesExpanded && (
                                <span
                                    onClick={(e) => { e.stopPropagation(); setShowNewNoteForm(!showNewNoteForm); }}
                                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    {showNewNoteForm ? 'Cancelar' : '+ Nueva nota'}
                                </span>
                            )}
                        </button>

                        {/* Expanded content */}
                        {notesExpanded && (
                            <div className="p-3">
                                {/* New note form */}
                                {showNewNoteForm && (
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                                        <div className="mb-3">
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo de nota</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {[
                                                    { value: 'reflection', label: 'Reflexión', icon: '💭' },
                                                    { value: 'idea', label: 'Idea', icon: '💡' },
                                                    { value: 'question', label: 'Pregunta', icon: '❓' },
                                                    { value: 'connection', label: 'Conexión', icon: '🔗' },
                                                ].map(type => (
                                                    <button
                                                        key={type.value}
                                                        onClick={() => setNewNoteType(type.value)}
                                                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                                            newNoteType === type.value
                                                                ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        {type.icon} {type.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={newNoteTitle}
                                            onChange={(e) => setNewNoteTitle(e.target.value)}
                                            placeholder="Título de la nota..."
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mb-2"
                                        />
                                        <textarea
                                            value={newNoteContent}
                                            onChange={(e) => setNewNoteContent(e.target.value)}
                                            rows={3}
                                            placeholder="Escribe tu reflexión, idea o pregunta..."
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mb-2"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setShowNewNoteForm(false);
                                                    setNewNoteTitle('');
                                                    setNewNoteContent('');
                                                    setNewNoteType('reflection');
                                                }}
                                                className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleCreateNote}
                                                disabled={savingNewNote || !newNoteTitle.trim() || !newNoteContent.trim()}
                                                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {savingNewNote ? 'Guardando...' : 'Guardar nota'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Notes list */}
                                {loadingNotes ? (
                                    <p className="text-gray-400 text-sm">Cargando notas...</p>
                                ) : contentNotes.length === 0 ? (
                                    <p className="text-gray-400 text-sm">
                                        Sin notas. Escribe reflexiones, ideas o preguntas mientras lees.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {contentNotes.map(note => (
                                            <div
                                                key={note.id}
                                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className="text-lg">{NOTE_TYPE_ICONS[note.note_type] || '📝'}</span>
                                                        <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                                            {note.title}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <a
                                                            href={`/journal?note=${note.id}`}
                                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                                        >
                                                            Editar
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteNote(note.id)}
                                                            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">
                                                    {note.content}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    {new Date(note.created_at).toLocaleDateString('es-ES', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Concepts */}
                    {content.concepts && content.concepts.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Conceptos</h3>
                            <div className="flex flex-wrap gap-2">
                                {content.concepts.map(concept => (
                                    <button
                                        key={concept}
                                        onClick={() => onFilterClick?.('concepts', concept)}
                                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-sm hover:bg-blue-200 dark:hover:bg-blue-800"
                                    >
                                        {concept}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Entities */}
                    {content.entities && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Entidades</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {content.entities.persons && content.entities.persons.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">👤 Personas</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.persons.map((person, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('persons', getEntityName(person))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-teal-50 dark:hover:bg-teal-900"
                                                >
                                                    {getEntityName(person)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {content.entities.organizations && content.entities.organizations.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">🏢 Organizaciones</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.organizations.map((org, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('organizations', getEntityName(org))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900"
                                                >
                                                    {getEntityName(org)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {content.entities.products && content.entities.products.length > 0 && (
                                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">📦 Productos</p>
                                        <div className="flex flex-wrap gap-1">
                                            {content.entities.products.map((product, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onFilterClick?.('products', getEntityName(product))}
                                                    className="px-2 py-1 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded text-sm text-gray-900 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900"
                                                >
                                                    {getEntityName(product)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Metadata (YouTube/TikTok) */}
                    {content.metadata && Object.keys(content.metadata).length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Metadata del {content.type}
                            </h3>
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <dl className="grid grid-cols-2 gap-2 text-sm">
                                    {content.metadata.channel_name && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Canal:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.channel_name}</dd>
                                        </>
                                    )}
                                    {content.metadata.view_count && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Vistas:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.view_count.toLocaleString()}</dd>
                                        </>
                                    )}
                                    {content.metadata.like_count && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Likes:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.like_count.toLocaleString()}</dd>
                                        </>
                                    )}
                                    {content.metadata.duration && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Duracion:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.duration}s</dd>
                                        </>
                                    )}
                                    {content.metadata.author && (
                                        <>
                                            <dt className="text-gray-500 dark:text-gray-400">Autor:</dt>
                                            <dd className="text-gray-900 dark:text-gray-200">{content.metadata.author}</dd>
                                        </>
                                    )}
                                </dl>
                            </div>
                        </div>
                    )}

                    {/* Maturation Actions */}
                    <div className="pt-4 border-t dark:border-gray-700">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Acciones de maduración
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                            <a
                                href={`/journal?new=true&type=reflection&content_id=${content.id}&content_title=${encodeURIComponent(content.title)}`}
                                className="px-3 py-2 text-sm rounded-lg border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-center"
                            >
                                💭 Reflexión
                            </a>
                            <a
                                href={`/journal?new=true&type=idea&content_id=${content.id}&content_title=${encodeURIComponent(content.title)}`}
                                className="px-3 py-2 text-sm rounded-lg border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-center"
                            >
                                💡 Idea
                            </a>
                            <a
                                href={`/journal?new=true&type=question&content_id=${content.id}&content_title=${encodeURIComponent(content.title)}`}
                                className="px-3 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-center"
                            >
                                ❓ Pregunta
                            </a>
                            <button
                                onClick={handleOpenProjectModal}
                                className={`px-3 py-2 text-sm rounded-lg border text-center ${
                                    currentProjectId
                                        ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                }`}
                            >
                                📁 Proyecto {currentProjectId && '✓'}
                            </button>
                            <button
                                onClick={handleOpenModelModal}
                                className={`px-3 py-2 text-sm rounded-lg border text-center ${
                                    linkedModelIds.size > 0
                                        ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                        : 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                }`}
                            >
                                🧠 Modelo Mental {linkedModelIds.size > 0 && `(${linkedModelIds.size})`}
                            </button>
                        </div>
                    </div>

                    {/* Project Selection Modal */}
                    {showProjectModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[70vh] overflow-hidden">
                                <div className="px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-medium text-gray-900 dark:text-white">Vincular a Proyecto</h3>
                                    <button
                                        onClick={() => setShowProjectModal(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="p-4 overflow-y-auto max-h-[50vh]">
                                    {loadingProjects ? (
                                        <p className="text-gray-500 text-center py-4">Cargando proyectos...</p>
                                    ) : projects.length === 0 ? (
                                        <div className="text-center py-4">
                                            <p className="text-gray-500 mb-2">No tienes proyectos creados</p>
                                            <a
                                                href="/projects"
                                                className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                                            >
                                                Crear primer proyecto →
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <a
                                                href="/projects?new=true"
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm"
                                            >
                                                + Crear nuevo proyecto
                                            </a>
                                            {currentProjectId && (
                                                <button
                                                    onClick={() => handleLinkToProject(null)}
                                                    disabled={linkingProject}
                                                    className="w-full text-left px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm"
                                                >
                                                    ✕ Desvincular del proyecto actual
                                                </button>
                                            )}
                                            {projects.map(project => (
                                                <button
                                                    key={project.id}
                                                    onClick={() => handleLinkToProject(project.id)}
                                                    disabled={linkingProject || currentProjectId === project.id}
                                                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                                                        currentProjectId === project.id
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-400 dark:border-indigo-600'
                                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    } disabled:opacity-50`}
                                                >
                                                    <span className="text-lg">{project.icon}</span>
                                                    <span className="flex-1 text-gray-900 dark:text-white">{project.name}</span>
                                                    {currentProjectId === project.id && (
                                                        <span className="text-indigo-600 dark:text-indigo-400 text-sm">✓ Actual</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mental Model Selection Modal */}
                    {showModelModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[70vh] overflow-hidden">
                                <div className="px-4 py-3 border-b dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-medium text-gray-900 dark:text-white">Vincular a Modelos Mentales</h3>
                                    <button
                                        onClick={() => setShowModelModal(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        ×
                                    </button>
                                </div>
                                <div className="p-4 overflow-y-auto max-h-[50vh]">
                                    {loadingModels ? (
                                        <p className="text-gray-500 text-center py-4">Cargando modelos mentales...</p>
                                    ) : mentalModels.length === 0 ? (
                                        <div className="text-center py-4">
                                            <p className="text-gray-500 mb-2">No tienes modelos mentales activos</p>
                                            <a
                                                href="/mental-models"
                                                className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm"
                                            >
                                                Activar modelos mentales →
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <a
                                                href="/mental-models"
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-sm"
                                            >
                                                + Activar más modelos mentales
                                            </a>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                Selecciona los modelos mentales aplicables a este contenido
                                            </p>
                                            {mentalModels.map(model => {
                                                const isLinked = linkedModelIds.has(model.id);
                                                return (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleToggleModelLink(model.id)}
                                                        disabled={linkingModel}
                                                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                                                            isLinked
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 dark:border-emerald-600'
                                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        } disabled:opacity-50`}
                                                    >
                                                        <span className="text-lg">{model.icon}</span>
                                                        <div className="flex-1">
                                                            <span className="text-gray-900 dark:text-white block">{model.name}</span>
                                                            {model.description && (
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{model.description}</span>
                                                            )}
                                                        </div>
                                                        {isLinked && (
                                                            <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="px-4 py-3 border-t dark:border-gray-700 flex justify-end">
                                    <button
                                        onClick={() => setShowModelModal(false)}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t dark:border-gray-700">
                        <button
                            onClick={handleReprocess}
                            disabled={reprocessing || processingStatus === 'processing'}
                            className={`px-4 py-2 rounded-lg border ${
                                processingStatus === 'processing'
                                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 cursor-not-allowed'
                                    : processingStatus === 'pending'
                                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                    : 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                            } disabled:opacity-50`}
                        >
                            {reprocessing || processingStatus === 'processing'
                                ? '⏳ Procesando...'
                                : processingStatus === 'pending'
                                ? '🔄 Procesar ahora (pendiente)'
                                : '🤖 Procesar con IA'}
                        </button>
                        <button
                            onClick={handleToggleFavorite}
                            className={`px-4 py-2 rounded-lg border ${
                                isFavorite
                                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            {isFavorite ? '★ Favorito' : '☆ Anadir a favoritos'}
                        </button>
                        {content.url.startsWith('apple-notes://') ? (
                            <span
                                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                title="Las notas de Apple Notes no se pueden abrir directamente desde el navegador. El contenido se muestra arriba."
                            >
                                🍎 Apple Notes (local)
                            </span>
                        ) : (
                            <a
                                href={content.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                🔗 Abrir original
                            </a>
                        )}
                        <button
                            onClick={handleArchive}
                            className={`px-4 py-2 rounded-lg border ${
                                content.is_archived
                                    ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30'
                                    : 'border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                            }`}
                        >
                            {content.is_archived ? '↩️ Restaurar' : '📦 Archivar'}
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
