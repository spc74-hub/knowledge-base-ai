'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Content {
    id: string;
    url: string;
    title: string;
    summary: string | null;
    raw_content: string | null;
    type: string;
    schema_type: string | null;
    schema_subtype: string | null;
    iab_tier1: string | null;
    iab_tier2: string | null;
    concepts: string[];
    entities: {
        persons?: Array<{ name: string; role?: string; organization?: string }>;
        organizations?: Array<{ name: string; type?: string }>;
        places?: Array<{ name: string; type?: string; country?: string }>;
        products?: Array<{ name: string; type?: string; company?: string }>;
    } | null;
    language: string | null;
    sentiment: string | null;
    technical_level: string | null;
    content_format: string | null;
    reading_time_minutes: number | null;
    metadata: Record<string, any> | null;
    is_favorite: boolean;
    is_archived: boolean;
    processing_status: string;
    created_at: string;
    folder_id: string | null;
}

interface Folder {
    id: string;
    name: string;
    parent_id: string | null;
    color: string;
    icon: string;
    position: number;
    children: Folder[];
    content_count: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const [contents, setContents] = useState<Content[]>([]);
    const [filteredContents, setFilteredContents] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedContent, setSelectedContent] = useState<Content | null>(null);
    const [newUrl, setNewUrl] = useState('');
    const [addingUrl, setAddingUrl] = useState(false);
    const [addError, setAddError] = useState('');

    // Folders
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
    const [movingContents, setMovingContents] = useState(false);

    // Filters
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchContents = async () => {
        try {
            const { data, error } = await supabase
                .from('contents')
                .select('*')
                .eq('is_archived', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContents(data || []);
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFolders = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch('http://localhost:8000/api/v1/folders/tree', {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setFolders(data);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchContents();
            fetchFolders();
        }
    }, [user]);

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        setCreatingFolder(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const response = await fetch('http://localhost:8000/api/v1/folders/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    name: newFolderName.trim(),
                    parent_id: newFolderParentId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error creating folder');
            }

            setNewFolderName('');
            setNewFolderParentId(null);
            setShowFolderModal(false);
            fetchFolders();
        } catch (error: any) {
            console.error('Error creating folder:', error);
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!confirm('¿Estas seguro de eliminar esta carpeta? El contenido se movera a la raiz.')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`http://localhost:8000/api/v1/folders/${folderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                if (selectedFolderId === folderId) {
                    setSelectedFolderId(null);
                }
                fetchFolders();
                fetchContents();
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    };

    const handleMoveContents = async (targetFolderId: string | null) => {
        if (selectedContentIds.size === 0) return;

        setMovingContents(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const response = await fetch('http://localhost:8000/api/v1/folders/move-contents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    content_ids: Array.from(selectedContentIds),
                    folder_id: targetFolderId,
                }),
            });

            if (!response.ok) {
                throw new Error('Error moving contents');
            }

            setSelectedContentIds(new Set());
            setShowMoveModal(false);
            fetchContents();
            fetchFolders();
        } catch (error) {
            console.error('Error moving contents:', error);
        } finally {
            setMovingContents(false);
        }
    };

    const toggleFolderExpand = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const toggleContentSelection = (contentId: string) => {
        setSelectedContentIds(prev => {
            const next = new Set(prev);
            if (next.has(contentId)) {
                next.delete(contentId);
            } else {
                next.add(contentId);
            }
            return next;
        });
    };

    // Apply filters
    useEffect(() => {
        let result = contents;

        // Filter by folder
        if (selectedFolderId === 'root') {
            result = result.filter(c => c.folder_id === null);
        } else if (selectedFolderId) {
            result = result.filter(c => c.folder_id === selectedFolderId);
        }

        if (filterType !== 'all') {
            result = result.filter(c => c.type === filterType);
        }

        if (filterCategory !== 'all') {
            result = result.filter(c => c.iab_tier1 === filterCategory);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.title?.toLowerCase().includes(query) ||
                c.summary?.toLowerCase().includes(query) ||
                c.concepts?.some(concept => concept.toLowerCase().includes(query))
            );
        }

        setFilteredContents(result);
    }, [contents, filterType, filterCategory, searchQuery, selectedFolderId]);

    // Helper to render folder tree recursively
    const renderFolderTree = (folderList: Folder[], depth = 0) => {
        return folderList.map(folder => (
            <div key={folder.id}>
                <div
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-lg group ${
                        selectedFolderId === folder.id ? 'bg-gray-100' : ''
                    }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                    {folder.children.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderExpand(folder.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 w-4"
                        >
                            {expandedFolders.has(folder.id) ? '▼' : '▶'}
                        </button>
                    )}
                    {folder.children.length === 0 && <span className="w-4" />}
                    <span
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="flex-1 flex items-center gap-2"
                    >
                        <span>{folder.icon}</span>
                        <span className="truncate">{folder.name}</span>
                        <span className="text-xs text-gray-400">({folder.content_count})</span>
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setNewFolderParentId(folder.id);
                            setShowFolderModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                        title="Crear subcarpeta"
                    >
                        +
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                        title="Eliminar carpeta"
                    >
                        ×
                    </button>
                </div>
                {expandedFolders.has(folder.id) && folder.children.length > 0 && (
                    <div>{renderFolderTree(folder.children, depth + 1)}</div>
                )}
            </div>
        ));
    };

    // Count contents without folder
    const rootContentCount = contents.filter(c => c.folder_id === null).length;

    const handleAddUrl = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        setAddingUrl(true);

        try {
            const response = await fetch('http://localhost:8000/api/v1/content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({ url: newUrl }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error adding URL');
            }

            setNewUrl('');
            setShowAddModal(false);
            fetchContents();
        } catch (error: any) {
            setAddError(error.message || 'Error adding URL');
        } finally {
            setAddingUrl(false);
        }
    };

    const handleToggleFavorite = async (content: Content) => {
        try {
            const { error } = await supabase
                .from('contents')
                .update({ is_favorite: !content.is_favorite })
                .eq('id', content.id);

            if (error) throw error;
            fetchContents();
            if (selectedContent?.id === content.id) {
                setSelectedContent({ ...content, is_favorite: !content.is_favorite });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const handleDelete = async (contentId: string) => {
        if (!confirm('¿Estas seguro de eliminar este contenido?')) return;

        try {
            const { error } = await supabase
                .from('contents')
                .delete()
                .eq('id', contentId);

            if (error) throw error;
            setShowDetailModal(false);
            setSelectedContent(null);
            fetchContents();
        } catch (error) {
            console.error('Error deleting content:', error);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    const openDetail = (content: Content) => {
        setSelectedContent(content);
        setShowDetailModal(true);
    };

    const getTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            web: '🌐',
            youtube: '📺',
            tiktok: '🎵',
            twitter: '🐦',
            pdf: '📄',
            note: '📝',
        };
        return icons[type] || '📄';
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800',
            processing: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    const getSentimentBadge = (sentiment: string | null) => {
        if (!sentiment) return null;
        const styles: Record<string, string> = {
            positive: 'bg-green-100 text-green-800',
            negative: 'bg-red-100 text-red-800',
            neutral: 'bg-gray-100 text-gray-800',
            mixed: 'bg-purple-100 text-purple-800',
        };
        return styles[sentiment] || 'bg-gray-100 text-gray-800';
    };

    // Get unique categories for filter
    const categories = [...new Set(contents.map(c => c.iab_tier1).filter(Boolean))] as string[];
    const types = [...new Set(contents.map(c => c.type))];

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Knowledge Base AI</h1>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/notes/new"
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            📝 Nueva Nota
                        </Link>
                        <Link
                            href="/import"
                            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            📥 Importar URLs
                        </Link>
                        <Link
                            href="/explore"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            🔍 Explorar
                        </Link>
                        <Link
                            href="/chat"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            💬 Chat RAG
                        </Link>
                        <Link
                            href="/usage"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            📊 API Usage
                        </Link>
                        <span className="text-sm text-gray-600">{user.email}</span>
                        <button
                            onClick={handleSignOut}
                            className="text-sm text-gray-600 hover:text-gray-900"
                        >
                            Cerrar sesion
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content with sidebar */}
            <div className="flex">
                {/* Sidebar - Folders */}
                <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-64px)] p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-700">Carpetas</h2>
                        <button
                            onClick={() => {
                                setNewFolderParentId(null);
                                setShowFolderModal(true);
                            }}
                            className="text-gray-500 hover:text-gray-700 text-xl"
                            title="Nueva carpeta"
                        >
                            +
                        </button>
                    </div>

                    {/* All content */}
                    <div
                        onClick={() => setSelectedFolderId(null)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-lg mb-1 ${
                            selectedFolderId === null ? 'bg-gray-100' : ''
                        }`}
                    >
                        <span>📚</span>
                        <span>Todo el contenido</span>
                        <span className="text-xs text-gray-400">({contents.length})</span>
                    </div>

                    {/* Root content (no folder) */}
                    <div
                        onClick={() => setSelectedFolderId('root')}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-lg mb-2 ${
                            selectedFolderId === 'root' ? 'bg-gray-100' : ''
                        }`}
                    >
                        <span>📄</span>
                        <span>Sin carpeta</span>
                        <span className="text-xs text-gray-400">({rootContentCount})</span>
                    </div>

                    <div className="border-t my-2"></div>

                    {/* Folder tree */}
                    <div className="space-y-1">
                        {renderFolderTree(folders)}
                    </div>

                    {folders.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                            No hay carpetas. Crea una!
                        </p>
                    )}
                </aside>

                {/* Main content area */}
                <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600">Total contenidos</p>
                            <p className="text-3xl font-bold">{contents.length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600">Web</p>
                            <p className="text-3xl font-bold">{contents.filter(c => c.type === 'web').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600">Videos</p>
                            <p className="text-3xl font-bold">{contents.filter(c => ['youtube', 'tiktok'].includes(c.type)).length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600">Favoritos</p>
                            <p className="text-3xl font-bold">{contents.filter(c => c.is_favorite).length}</p>
                        </div>
                    </div>

                    {/* Filters and Actions */}
                    <div className="flex flex-wrap gap-4 mb-6 items-center">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                    >
                        <span className="mr-2">+</span>
                        Anadir URL
                    </button>

                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />

                    {/* Type filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                        <option value="all">Todos los tipos</option>
                        {types.map(type => (
                            <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                        ))}
                    </select>

                    {/* Category filter */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                        <option value="all">Todas las categorias</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {(filterType !== 'all' || filterCategory !== 'all' || searchQuery) && (
                        <button
                            onClick={() => {
                                setFilterType('all');
                                setFilterCategory('all');
                                setSearchQuery('');
                            }}
                            className="text-sm text-gray-600 hover:text-gray-900"
                        >
                            Limpiar filtros
                        </button>
                    )}

                    {/* Move selected button */}
                    {selectedContentIds.size > 0 && (
                        <button
                            onClick={() => setShowMoveModal(true)}
                            className="ml-auto inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Mover {selectedContentIds.size} elemento(s)
                        </button>
                    )}
                </div>

                {/* Content list */}
                {filteredContents.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <p className="text-gray-500 mb-4">
                            {contents.length === 0
                                ? 'No tienes contenido guardado todavia'
                                : 'No hay contenido que coincida con los filtros'
                            }
                        </p>
                        {contents.length === 0 && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                            >
                                Anadir tu primera URL
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                        <input
                                            type="checkbox"
                                            checked={filteredContents.length > 0 && selectedContentIds.size === filteredContents.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedContentIds(new Set(filteredContents.map(c => c.id)));
                                                } else {
                                                    setSelectedContentIds(new Set());
                                                }
                                            }}
                                            className="rounded border-gray-300"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contenido
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Categoria
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fecha
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredContents.map((content) => (
                                    <tr
                                        key={content.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => openDetail(content)}
                                    >
                                        <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedContentIds.has(content.id)}
                                                onChange={() => toggleContentSelection(content.id)}
                                                className="rounded border-gray-300"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-start">
                                                <span className="text-2xl mr-3">{getTypeIcon(content.type)}</span>
                                                <div>
                                                    <p className="font-medium text-gray-900 line-clamp-1">
                                                        {content.title || 'Sin titulo'}
                                                    </p>
                                                    <p className="text-sm text-gray-500 line-clamp-1">
                                                        {content.summary || content.url}
                                                    </p>
                                                    {content.concepts && content.concepts.length > 0 && (
                                                        <div className="flex gap-1 mt-1">
                                                            {content.concepts.slice(0, 3).map((concept, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                                                                >
                                                                    {concept}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600 capitalize">{content.type}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600">
                                                {content.iab_tier1 || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(content.processing_status)}`}>
                                                {content.processing_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(content.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleToggleFavorite(content)}
                                                className="text-xl hover:scale-110 transition-transform"
                                                title={content.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                            >
                                                {content.is_favorite ? '⭐' : '☆'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                </main>
            </div>

            {/* Add URL Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Anadir URL</h2>
                        <form onSubmit={handleAddUrl}>
                            {addError && (
                                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    {addError}
                                </div>
                            )}
                            <input
                                type="url"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                placeholder="https://example.com/article"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setAddError('');
                                        setNewUrl('');
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingUrl}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {addingUrl ? 'Procesando...' : 'Anadir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedContent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-start">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">{getTypeIcon(selectedContent.type)}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(selectedContent.processing_status)}`}>
                                        {selectedContent.processing_status}
                                    </span>
                                    {selectedContent.sentiment && (
                                        <span className={`text-xs px-2 py-1 rounded-full ${getSentimentBadge(selectedContent.sentiment)}`}>
                                            {selectedContent.sentiment}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedContent.title}</h2>
                                <a
                                    href={selectedContent.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline break-all"
                                >
                                    {selectedContent.url}
                                </a>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Classification */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Tipo</p>
                                    <p className="font-medium capitalize">{selectedContent.type}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Categoria IAB</p>
                                    <p className="font-medium">{selectedContent.iab_tier1 || '-'}</p>
                                    {selectedContent.iab_tier2 && (
                                        <p className="text-xs text-gray-500">{selectedContent.iab_tier2}</p>
                                    )}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Schema.org</p>
                                    <p className="font-medium">{selectedContent.schema_type || '-'}</p>
                                    {selectedContent.schema_subtype && (
                                        <p className="text-xs text-gray-500">{selectedContent.schema_subtype}</p>
                                    )}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Formato</p>
                                    <p className="font-medium capitalize">{selectedContent.content_format || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Nivel tecnico</p>
                                    <p className="font-medium capitalize">{selectedContent.technical_level || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Idioma</p>
                                    <p className="font-medium uppercase">{selectedContent.language || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Tiempo de lectura</p>
                                    <p className="font-medium">{selectedContent.reading_time_minutes ? `${selectedContent.reading_time_minutes} min` : '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Fecha</p>
                                    <p className="font-medium">{new Date(selectedContent.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Summary */}
                            {selectedContent.summary && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Resumen</h3>
                                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedContent.summary}</p>
                                </div>
                            )}

                            {/* Concepts */}
                            {selectedContent.concepts && selectedContent.concepts.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Conceptos</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedContent.concepts.map((concept, i) => (
                                            <span
                                                key={i}
                                                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                                            >
                                                {concept}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Entities */}
                            {selectedContent.entities && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Entidades</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedContent.entities.persons && selectedContent.entities.persons.length > 0 && (
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">👤 Personas</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedContent.entities.persons.map((p, i) => (
                                                        <span key={i} className="text-sm bg-white px-2 py-0.5 rounded border">
                                                            {p.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedContent.entities.organizations && selectedContent.entities.organizations.length > 0 && (
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">🏢 Organizaciones</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedContent.entities.organizations.map((o, i) => (
                                                        <span key={i} className="text-sm bg-white px-2 py-0.5 rounded border">
                                                            {o.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedContent.entities.places && selectedContent.entities.places.length > 0 && (
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">📍 Lugares</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedContent.entities.places.map((pl, i) => (
                                                        <span key={i} className="text-sm bg-white px-2 py-0.5 rounded border">
                                                            {pl.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedContent.entities.products && selectedContent.entities.products.length > 0 && (
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">📦 Productos</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedContent.entities.products.map((pr, i) => (
                                                        <span key={i} className="text-sm bg-white px-2 py-0.5 rounded border">
                                                            {pr.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metadata (for YouTube videos) */}
                            {selectedContent.metadata && selectedContent.type === 'youtube' && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Metadata del video</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-2 text-sm">
                                        {selectedContent.metadata.channel && (
                                            <div><span className="text-gray-500">Canal:</span> {selectedContent.metadata.channel}</div>
                                        )}
                                        {selectedContent.metadata.duration_formatted && (
                                            <div><span className="text-gray-500">Duracion:</span> {selectedContent.metadata.duration_formatted}</div>
                                        )}
                                        {selectedContent.metadata.view_count && (
                                            <div><span className="text-gray-500">Vistas:</span> {selectedContent.metadata.view_count.toLocaleString()}</div>
                                        )}
                                        {selectedContent.metadata.has_transcript !== undefined && (
                                            <div><span className="text-gray-500">Transcript:</span> {selectedContent.metadata.has_transcript ? 'Si' : 'No'}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metadata (for TikTok videos) */}
                            {selectedContent.metadata && selectedContent.type === 'tiktok' && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Metadata del TikTok</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-2 text-sm">
                                        {selectedContent.metadata.creator && (
                                            <div><span className="text-gray-500">Creador:</span> @{selectedContent.metadata.creator}</div>
                                        )}
                                        {selectedContent.metadata.duration_formatted && (
                                            <div><span className="text-gray-500">Duracion:</span> {selectedContent.metadata.duration_formatted}</div>
                                        )}
                                        {selectedContent.metadata.view_count !== undefined && (
                                            <div><span className="text-gray-500">Vistas:</span> {selectedContent.metadata.view_count.toLocaleString()}</div>
                                        )}
                                        {selectedContent.metadata.like_count !== undefined && (
                                            <div><span className="text-gray-500">Likes:</span> {selectedContent.metadata.like_count.toLocaleString()}</div>
                                        )}
                                        {selectedContent.metadata.comment_count !== undefined && (
                                            <div><span className="text-gray-500">Comentarios:</span> {selectedContent.metadata.comment_count.toLocaleString()}</div>
                                        )}
                                        {selectedContent.metadata.upload_date && (
                                            <div><span className="text-gray-500">Fecha:</span> {selectedContent.metadata.upload_date}</div>
                                        )}
                                        {selectedContent.metadata.hashtags && selectedContent.metadata.hashtags.length > 0 && (
                                            <div className="col-span-2">
                                                <span className="text-gray-500">Hashtags:</span>{' '}
                                                {selectedContent.metadata.hashtags.join(' ')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t bg-gray-50 flex justify-between">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleToggleFavorite(selectedContent)}
                                    className={`px-4 py-2 rounded-lg border ${selectedContent.is_favorite ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}
                                >
                                    {selectedContent.is_favorite ? '⭐ Favorito' : '☆ Añadir a favoritos'}
                                </button>
                                {selectedContent.type === 'note' ? (
                                    <Link
                                        href={`/notes/${selectedContent.id}/edit`}
                                        className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                                    >
                                        ✏️ Editar nota
                                    </Link>
                                ) : (
                                    <a
                                        href={selectedContent.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
                                    >
                                        🔗 Abrir original
                                    </a>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(selectedContent.id)}
                                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            >
                                🗑 Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {newFolderParentId ? 'Nueva subcarpeta' : 'Nueva carpeta'}
                        </h2>
                        <form onSubmit={handleCreateFolder}>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Nombre de la carpeta"
                                required
                                autoFocus
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFolderModal(false);
                                        setNewFolderName('');
                                        setNewFolderParentId(null);
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingFolder}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {creatingFolder ? 'Creando...' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move Content Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            Mover {selectedContentIds.size} elemento(s)
                        </h2>
                        <p className="text-gray-600 mb-4">Selecciona la carpeta destino:</p>

                        <div className="max-h-64 overflow-y-auto border rounded-lg mb-4">
                            {/* Root option */}
                            <button
                                onClick={() => handleMoveContents(null)}
                                disabled={movingContents}
                                className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b flex items-center gap-2"
                            >
                                <span>📄</span>
                                <span>Sin carpeta (raiz)</span>
                            </button>

                            {/* Folder options */}
                            {folders.map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => handleMoveContents(folder.id)}
                                    disabled={movingContents}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-b-0 flex items-center gap-2"
                                >
                                    <span>{folder.icon}</span>
                                    <span>{folder.name}</span>
                                </button>
                            ))}

                            {folders.length === 0 && (
                                <p className="px-4 py-3 text-gray-500">
                                    No hay carpetas. Crea una primero.
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    setShowMoveModal(false);
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-900"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
