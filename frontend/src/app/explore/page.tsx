'use client';

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { TagFilter } from '@/components/tag-filter';
import { ContentDetailModal, ContentDetail } from '@/components/content-detail-modal';
import { useQueryClient } from '@tanstack/react-query';
import {
    useExplorerFacets,
    useUserExperts,
    useAvailableTags,
    useContentsSearch,
    useNotesSearch,
    useToggleNotePin,
    useBulkDeleteNotes,
    useBulkArchiveContents,
    useBulkDeleteContents,
    EXPLORER_KEYS,
    type Facets,
    type Content,
    type StandaloneNote,
    type NotesFacets,
    type ContentsFilters,
    type NotesFilters,
} from '@/hooks/use-explorer';

// Local Facet interface for facet sections
interface Facet {
    value: string;
    count: number;
}

// NoteTypeFacet for local UI display
interface NoteTypeFacet {
    value: string;
    label: string;
    icon: string;
    count: number;
}

// LinkageFacet for local UI display
interface LinkageFacet {
    value: string;
    label: string;
    icon: string;
    count: number;
}

type ExplorerTab = 'contents' | 'notes';

// Local Filters interface (extends imported ContentsFilters)
interface Filters extends ContentsFilters {}

function ExplorePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    // Local UI state
    const [searchQuery, setSearchQuery] = useState('');
    const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
    const [filters, setFilters] = useState<Filters>({
        types: [],
        types_exclude: [],
        categories: [],
        concepts: [],
        organizations: [],
        products: [],
        persons: [],
        experts: [],
        user_tags: [],
        inherited_tags: [],
        processing_status: [],
        maturity_level: [],
        maturity_level_exclude: [],
        has_comment: null,
        is_favorite: null,
        date_from: null,
        date_to: null,
        min_views: null,
        max_views: null
    });
    const [expandedSections, setExpandedSections] = useState({
        types: false,
        categories: true,
        concepts: false,
        organizations: false,
        products: false,
        persons: false,
        experts: false,
        date_views: false,
        processing_status: false,
        maturity_level: false,
        has_comment: false
    });
    const [facetSearch, setFacetSearch] = useState({
        categories: '',
        concepts: '',
        organizations: '',
        products: '',
        persons: ''
    });
    const [sortBy, setSortBy] = useState<'created_at' | 'view_count' | 'title'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedContent, setSelectedContent] = useState<ContentDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());

    // Tab state
    const [activeTab, setActiveTab] = useState<ExplorerTab>('contents');

    // Notes UI state
    const [notesFilters, setNotesFilters] = useState<NotesFilters>({
        note_types: [],
        has_source_content: null,
        linkage_type: null,
        is_pinned: null
    });
    const [notesSearchQuery, setNotesSearchQuery] = useState('');
    const [appliedNotesSearchQuery, setAppliedNotesSearchQuery] = useState('');
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

    // React Query hooks for data fetching with caching
    const { data: facets } = useExplorerFacets();
    const { data: userExperts = [] } = useUserExperts();
    const { data: availableTags = { user_tags: [], inherited_tags: [] } } = useAvailableTags();

    // Determine if using global search (query + no filters)
    const hasFilters = useMemo(() => Object.entries(filters).some(([key, val]) => {
        if (key === 'has_comment' || key === 'is_favorite') return val !== null;
        if (key === 'date_from' || key === 'date_to') return val !== null;
        if (key === 'min_views' || key === 'max_views') return val !== null;
        return Array.isArray(val) && val.length > 0;
    }), [filters]);
    const isGlobalSearch = !!appliedSearchQuery && !hasFilters;

    // Contents search with React Query (infinite query for pagination)
    const contentsSearchParams = useMemo(() => ({
        query: appliedSearchQuery,
        filters,
        sortBy,
        sortOrder,
    }), [appliedSearchQuery, filters, sortBy, sortOrder]);

    const {
        data: contentsData,
        isLoading: searching,
        isFetchingNextPage: loadingMore,
        hasNextPage: hasMore,
        fetchNextPage: loadMoreResults,
    } = useContentsSearch(contentsSearchParams);

    // Flatten paginated results
    const results = useMemo(() => {
        if (!contentsData?.pages) return [];
        return contentsData.pages.flatMap(page => page.data);
    }, [contentsData]);

    const totalResults = contentsData?.pages[0]?.meta?.total_results || results.length;

    // Notes search with React Query (infinite query for pagination)
    const notesSearchParams = useMemo(() => ({
        query: appliedNotesSearchQuery,
        filters: notesFilters,
    }), [appliedNotesSearchQuery, notesFilters]);

    const {
        data: notesData,
        isLoading: searchingNotes,
        isFetchingNextPage: loadingMoreNotes,
        hasNextPage: hasMoreNotes,
        fetchNextPage: loadMoreNotes,
    } = useNotesSearch(notesSearchParams);

    // Flatten paginated notes results
    const notes = useMemo(() => {
        if (!notesData?.pages) return [];
        return notesData.pages.flatMap(page => page.data);
    }, [notesData]);

    const notesFacets = notesData?.pages[0]?.facets || null;
    const totalNotes = notesFacets?.total_notes || notes.length;

    // Mutation hooks
    const toggleNotePinMutation = useToggleNotePin();
    const bulkDeleteNotesMutation = useBulkDeleteNotes();
    const bulkArchiveContentsMutation = useBulkArchiveContents();
    const bulkDeleteContentsMutation = useBulkDeleteContents();

    // Derive loading state
    const loading = searching && results.length === 0;

    // Hardcoded API URL - always use HTTPS in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const API_BASE = `${API_URL}/api/v1`;

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const getAuthHeader = async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
        };
    };

    // Helper to invalidate queries
    const invalidateContents = () => queryClient.invalidateQueries({ queryKey: EXPLORER_KEYS.all });

    // Apply search with debounce
    useEffect(() => {
        const debounce = setTimeout(() => {
            setAppliedSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // Apply notes search with debounce
    useEffect(() => {
        const debounce = setTimeout(() => {
            setAppliedNotesSearchQuery(notesSearchQuery);
        }, 500);
        return () => clearTimeout(debounce);
    }, [notesSearchQuery]);

    const toggleNoteTypeFilter = (noteType: string) => {
        setNotesFilters(prev => {
            if (prev.note_types.includes(noteType)) {
                return { ...prev, note_types: prev.note_types.filter(t => t !== noteType) };
            } else {
                return { ...prev, note_types: [...prev.note_types, noteType] };
            }
        });
    };

    const toggleNoteLinkageFilter = (value: string) => {
        setNotesFilters(prev => {
            // Toggle: if already selected, deselect (null), otherwise select
            if (prev.linkage_type === value) {
                return { ...prev, linkage_type: null };
            }
            return { ...prev, linkage_type: value };
        });
    };

    const clearNotesFilters = () => {
        setNotesFilters({
            note_types: [],
            has_source_content: null,
            linkage_type: null,
            is_pinned: null
        });
        setNotesSearchQuery('');
    };

    const hasActiveNotesFilters = notesFilters.note_types.length > 0 ||
        notesFilters.has_source_content !== null ||
        notesFilters.linkage_type !== null ||
        notesFilters.is_pinned !== null ||
        notesSearchQuery !== '';

    const handleBulkDeleteNotes = async () => {
        if (selectedNoteIds.size === 0) return;
        if (!confirm(`¿Eliminar ${selectedNoteIds.size} nota(s)?`)) return;

        bulkDeleteNotesMutation.mutate(Array.from(selectedNoteIds), {
            onSuccess: () => setSelectedNoteIds(new Set()),
        });
    };

    const toggleNotePin = (noteId: string) => {
        toggleNotePinMutation.mutate(noteId);
    };

    // Handle ?content=ID query parameter to open content detail from chat links
    useEffect(() => {
        const contentId = searchParams.get('content');
        if (contentId && user) {
            // Fetch and open the content detail
            const openContentFromParam = async () => {
                setLoadingDetail(true);
                setShowDetailModal(true);
                try {
                    const { data, error } = await supabase
                        .from('contents')
                        .select('*')
                        .eq('id', contentId)
                        .single();

                    if (!error && data) {
                        setSelectedContent(data);
                    } else {
                        console.error('Content not found:', contentId);
                        setShowDetailModal(false);
                    }
                } catch (error) {
                    console.error('Error fetching content:', error);
                    setShowDetailModal(false);
                } finally {
                    setLoadingDetail(false);
                }
            };
            openContentFromParam();
            // Clear the query param from URL without navigation
            router.replace('/explore', { scroll: false });
        }
    }, [searchParams, user, router]);

    // Handle ?person=NAME query parameter to filter by person (from Experts page)
    useEffect(() => {
        const personParam = searchParams.get('person');
        if (personParam && user) {
            // Set the person filter and expand the persons section
            setFilters(prev => ({
                ...prev,
                persons: [personParam]
            }));
            setExpandedSections(prev => ({
                ...prev,
                persons: true
            }));
            // Clear the query param from URL without navigation
            router.replace('/explore', { scroll: false });
        }
    }, [searchParams, user, router]);

    // Handle sort changes - trigger search immediately when sort changes
    const handleSortChange = (newSortBy: 'created_at' | 'view_count' | 'title') => {
        if (newSortBy === sortBy) {
            // Toggle sort order if clicking same column
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(newSortBy);
            // Set default order based on column type
            setSortOrder(newSortBy === 'title' ? 'asc' : 'desc');
        }
    };

    const toggleFilter = (category: keyof Omit<Filters, 'has_comment'>, value: string) => {
        setFilters(prev => {
            const current = prev[category] as string[];
            if (current.includes(value)) {
                return { ...prev, [category]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [category]: [...current, value] };
            }
        });
    };

    const clearFilters = () => {
        setFilters({
            types: [],
            types_exclude: [],
            categories: [],
            concepts: [],
            organizations: [],
            products: [],
            persons: [],
            experts: [],
            user_tags: [],
            inherited_tags: [],
            processing_status: [],
            maturity_level: [],
            maturity_level_exclude: [],
            has_comment: null,
            is_favorite: null,
            date_from: null,
            date_to: null,
            min_views: null,
            max_views: null
        });
        setSearchQuery('');
    };

    const hasActiveFilters = Object.entries(filters).some(([key, val]) => {
        if (key === 'has_comment' || key === 'is_favorite') return val !== null;
        if (key === 'date_from' || key === 'date_to' || key === 'min_views' || key === 'max_views') return val !== null;
        return Array.isArray(val) && val.length > 0;
    }) || searchQuery;

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'youtube': return '▶';
            case 'article': return '📄';
            case 'pdf': return '📕';
            case 'docx': return '📘';
            case 'email': return '📧';
            case 'web': return '🌐';
            case 'tiktok': return '🎵';
            case 'note': return '📝';
            case 'apple_notes': return '🍎';
            default: return '📎';
        }
    };

    const openDetail = async (content: Content) => {
        setSelectedContent(content);
        setShowDetailModal(true);
        setLoadingDetail(true);

        try {
            const { data, error } = await supabase
                .from('contents')
                .select('*')
                .eq('id', content.id)
                .single();

            if (!error && data) {
                setSelectedContent(data);
            }
        } catch (error) {
            console.error('Error fetching content detail:', error);
        } finally {
            setLoadingDetail(false);
        }
    };

    const toggleFavorite = async (contentId: string) => {
        if (!selectedContent) return;

        try {
            const newFavoriteStatus = !selectedContent.is_favorite;
            const { error } = await supabase
                .from('contents')
                .update({ is_favorite: newFavoriteStatus })
                .eq('id', contentId);

            if (!error) {
                setSelectedContent({ ...selectedContent, is_favorite: newFavoriteStatus });
                invalidateContents();
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
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

    const handleBulkArchive = async () => {
        if (selectedContentIds.size === 0) return;
        if (!confirm(`¿Estas seguro de archivar ${selectedContentIds.size} elemento(s)?`)) return;

        bulkArchiveContentsMutation.mutate(Array.from(selectedContentIds), {
            onSuccess: () => setSelectedContentIds(new Set()),
        });
    };

    const handleBulkDelete = async () => {
        if (selectedContentIds.size === 0) return;
        if (!confirm(`¿Estas seguro de ELIMINAR PERMANENTEMENTE ${selectedContentIds.size} elemento(s)? Esta accion no se puede deshacer.`)) return;

        bulkDeleteContentsMutation.mutate(Array.from(selectedContentIds), {
            onSuccess: () => setSelectedContentIds(new Set()),
        });
    };

    // Derive mutation loading states
    const archivingContents = bulkArchiveContentsMutation.isPending;
    const deletingContents = bulkDeleteContentsMutation.isPending;
    const deletingNotes = bulkDeleteNotesMutation.isPending;

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                            ← Dashboard
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Explorar Knowledge Base</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/chat"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                            Chat RAG
                        </Link>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{user.email}</span>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('contents')}
                            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'contents'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span>📚</span>
                                <span>Contenidos</span>
                                {facets && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{facets.total_contents}</span>}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('notes')}
                            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === 'notes'
                                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span>💭</span>
                                <span>Mis Reflexiones</span>
                                {notesFacets && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{notesFacets.total_notes}</span>}
                            </span>
                        </button>
                    </nav>
                </div>

                {/* Contents Tab */}
                {activeTab === 'contents' && (
                    <>
                {/* Search Bar */}
                <div className="mb-6">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar en titulo, contenido, conceptos, entidades, categorias..."
                                className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                            <span className="absolute left-3 top-3.5 text-gray-400 dark:text-gray-500">🔍</span>
                        </div>
                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Ordenar:</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleSortChange('created_at')}
                                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                        sortBy === 'created_at'
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                    title={sortBy === 'created_at' ? `Fecha (${sortOrder === 'desc' ? 'reciente primero' : 'antiguo primero'})` : 'Ordenar por fecha'}
                                >
                                    Fecha {sortBy === 'created_at' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </button>
                                <button
                                    onClick={() => handleSortChange('view_count')}
                                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                        sortBy === 'view_count'
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                    title={sortBy === 'view_count' ? `Visitas (${sortOrder === 'desc' ? 'mas vistas primero' : 'menos vistas primero'})` : 'Ordenar por visitas'}
                                >
                                    Visitas {sortBy === 'view_count' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </button>
                                <button
                                    onClick={() => handleSortChange('title')}
                                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                        sortBy === 'title'
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                    title={sortBy === 'title' ? `Titulo (${sortOrder === 'asc' ? 'A-Z' : 'Z-A'})` : 'Ordenar por titulo'}
                                >
                                    Titulo {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </button>
                            </div>
                        </div>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                    {searchQuery && isGlobalSearch && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Buscando en: titulo, resumen, conceptos, categorias, personas, organizaciones, productos y tags
                        </p>
                    )}
                </div>

                <div className="flex gap-6">
                    {/* Sidebar with Facets */}
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Filtros</h2>

                            {facets && (
                                <div className="space-y-4">
                                    {/* Favorites Filter - Quick Access */}
                                    <div>
                                        <span className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Favoritos</span>
                                        <div className="space-y-1 ml-1">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.is_favorite === true}
                                                    onChange={() => setFilters(prev => ({ ...prev, is_favorite: prev.is_favorite === true ? null : true }))}
                                                    className="rounded"
                                                />
                                                <span className="flex-1">Solo favoritos</span>
                                            </label>
                                        </div>
                                    </div>


                                    {/* Types with Include/Exclude toggle */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('types')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Tipo ({facets.types.length})</span>
                                            <span>{expandedSections.types ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.types && (
                                            <div className="space-y-1 ml-1">
                                                {facets.types.map(facet => {
                                                    const isIncluded = filters.types.includes(facet.value);
                                                    const isExcluded = filters.types_exclude.includes(facet.value);
                                                    return (
                                                        <div key={facet.value} className="flex items-center gap-1 text-sm p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <button
                                                                onClick={() => {
                                                                    if (isIncluded) {
                                                                        // Was included -> go to excluded
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            types: prev.types.filter(t => t !== facet.value),
                                                                            types_exclude: [...prev.types_exclude, facet.value]
                                                                        }));
                                                                    } else if (isExcluded) {
                                                                        // Was excluded -> go to neutral
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            types_exclude: prev.types_exclude.filter(t => t !== facet.value)
                                                                        }));
                                                                    } else {
                                                                        // Was neutral -> go to included
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            types: [...prev.types, facet.value]
                                                                        }));
                                                                    }
                                                                }}
                                                                className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                                                                    isIncluded
                                                                        ? 'bg-green-500 border-green-500 text-white'
                                                                        : isExcluded
                                                                            ? 'bg-red-500 border-red-500 text-white'
                                                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                                                }`}
                                                                title={isIncluded ? 'Incluido (click para excluir)' : isExcluded ? 'Excluido (click para quitar filtro)' : 'Sin filtro (click para incluir)'}
                                                            >
                                                                {isIncluded ? '✓' : isExcluded ? '−' : ''}
                                                            </button>
                                                            <span className="flex-1">{getTypeIcon(facet.value)} {facet.value}</span>
                                                            <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Categories */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('categories')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Categoria ({facets.categories.length})</span>
                                            <span>{expandedSections.categories ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.categories && (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={facetSearch.categories}
                                                    onChange={(e) => setFacetSearch(prev => ({ ...prev, categories: e.target.value }))}
                                                    placeholder="Buscar categoria..."
                                                    className="w-full px-2 py-1 mb-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                                                />
                                                <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                    {facets.categories
                                                        .filter(f => !facetSearch.categories || f.value.toLowerCase().includes(facetSearch.categories.toLowerCase()))
                                                        .map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters.categories.includes(facet.value)}
                                                                onChange={() => toggleFilter('categories', facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1 truncate">{facet.value}</span>
                                                            <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Concepts */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('concepts')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Conceptos ({facets.concepts.length})</span>
                                            <span>{expandedSections.concepts ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.concepts && (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={facetSearch.concepts}
                                                    onChange={(e) => setFacetSearch(prev => ({ ...prev, concepts: e.target.value }))}
                                                    placeholder="Buscar concepto..."
                                                    className="w-full px-2 py-1 mb-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                                                />
                                                <div className="space-y-1 ml-1 max-h-64 overflow-y-auto">
                                                    {facets.concepts
                                                        .filter(f => !facetSearch.concepts || f.value.toLowerCase().includes(facetSearch.concepts.toLowerCase()))
                                                        .map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters.concepts.includes(facet.value)}
                                                                onChange={() => toggleFilter('concepts', facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1 truncate">{facet.value}</span>
                                                            <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Organizations */}
                                    {facets.organizations.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('organizations')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                <span>Organizaciones ({facets.organizations.length})</span>
                                                <span>{expandedSections.organizations ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.organizations && (
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={facetSearch.organizations}
                                                        onChange={(e) => setFacetSearch(prev => ({ ...prev, organizations: e.target.value }))}
                                                        placeholder="Buscar organizacion..."
                                                        className="w-full px-2 py-1 mb-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                                                    />
                                                    <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                        {facets.organizations
                                                            .filter(f => !facetSearch.organizations || f.value.toLowerCase().includes(facetSearch.organizations.toLowerCase()))
                                                            .map(facet => (
                                                            <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.organizations.includes(facet.value)}
                                                                    onChange={() => toggleFilter('organizations', facet.value)}
                                                                    className="rounded"
                                                                />
                                                                <span className="flex-1 truncate">{facet.value}</span>
                                                                <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Products */}
                                    {facets.products.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('products')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                <span>Productos ({facets.products.length})</span>
                                                <span>{expandedSections.products ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.products && (
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={facetSearch.products}
                                                        onChange={(e) => setFacetSearch(prev => ({ ...prev, products: e.target.value }))}
                                                        placeholder="Buscar producto..."
                                                        className="w-full px-2 py-1 mb-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                                                    />
                                                    <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                        {facets.products
                                                            .filter(f => !facetSearch.products || f.value.toLowerCase().includes(facetSearch.products.toLowerCase()))
                                                            .map(facet => (
                                                            <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.products.includes(facet.value)}
                                                                    onChange={() => toggleFilter('products', facet.value)}
                                                                    className="rounded"
                                                                />
                                                                <span className="flex-1 truncate">{facet.value}</span>
                                                                <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Persons */}
                                    {facets.persons && facets.persons.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('persons')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                <span>Personas ({facets.persons.length})</span>
                                                <span>{expandedSections.persons ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.persons && (
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={facetSearch.persons}
                                                        onChange={(e) => setFacetSearch(prev => ({ ...prev, persons: e.target.value }))}
                                                        placeholder="Buscar persona..."
                                                        className="w-full px-2 py-1 mb-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400"
                                                    />
                                                    <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                        {facets.persons
                                                            .filter(f => !facetSearch.persons || f.value.toLowerCase().includes(facetSearch.persons.toLowerCase()))
                                                            .map(facet => (
                                                            <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.persons.includes(facet.value)}
                                                                    onChange={() => toggleFilter('persons', facet.value)}
                                                                    className="rounded"
                                                                />
                                                                <span className="flex-1 truncate">{facet.value}</span>
                                                                <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Experts (Gurus) Filter */}
                                    {userExperts.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('experts')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                <span>Mis Expertos ({userExperts.length})</span>
                                                <span>{expandedSections.experts ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.experts && (
                                                <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                    {userExperts.map(expert => (
                                                        <label key={expert.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters.experts.includes(expert.person_name)}
                                                                onChange={() => {
                                                                    setFilters(prev => {
                                                                        const current = prev.experts;
                                                                        if (current.includes(expert.person_name)) {
                                                                            return { ...prev, experts: current.filter(e => e !== expert.person_name) };
                                                                        } else {
                                                                            return { ...prev, experts: [...current, expert.person_name] };
                                                                        }
                                                                    });
                                                                }}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1 truncate" title={expert.expertise_area || undefined}>
                                                                {expert.person_name}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Date & Views Filter (Collapsible) */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('date_views')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Fecha y Visitas</span>
                                            <span>{expandedSections.date_views ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.date_views && (
                                            <div className="space-y-4 ml-1">
                                                {/* Date Range */}
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Fecha</span>
                                                    <div className="space-y-2">
                                                        {/* Quick date presets */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                { label: 'Hoy', days: 0 },
                                                                { label: '7d', days: 7 },
                                                                { label: '30d', days: 30 },
                                                                { label: '90d', days: 90 },
                                                            ].map(preset => {
                                                                const today = new Date();
                                                                const fromDate = new Date(today);
                                                                fromDate.setDate(today.getDate() - preset.days);
                                                                const fromStr = fromDate.toISOString().split('T')[0];
                                                                const isActive = filters.date_from === fromStr && filters.date_to === null;
                                                                return (
                                                                    <button
                                                                        key={preset.label}
                                                                        onClick={() => {
                                                                            if (isActive) {
                                                                                setFilters(prev => ({ ...prev, date_from: null, date_to: null }));
                                                                            } else {
                                                                                setFilters(prev => ({ ...prev, date_from: fromStr, date_to: null }));
                                                                            }
                                                                        }}
                                                                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                                                                            isActive
                                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                                        }`}
                                                                    >
                                                                        {preset.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {/* Custom date inputs */}
                                                        <div className="flex gap-1 items-center text-xs">
                                                            <input
                                                                type="date"
                                                                value={filters.date_from || ''}
                                                                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value || null }))}
                                                                className="flex-1 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                title="Desde"
                                                            />
                                                            <span className="text-gray-400">-</span>
                                                            <input
                                                                type="date"
                                                                value={filters.date_to || ''}
                                                                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value || null }))}
                                                                className="flex-1 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                title="Hasta"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* View Count */}
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Visitas</span>
                                                    <div className="space-y-2">
                                                        {/* Quick view count presets */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {[
                                                                { label: '1K+', min: 1000 },
                                                                { label: '10K+', min: 10000 },
                                                                { label: '100K+', min: 100000 },
                                                                { label: '1M+', min: 1000000 },
                                                            ].map(preset => {
                                                                const isActive = filters.min_views === preset.min && filters.max_views === null;
                                                                return (
                                                                    <button
                                                                        key={preset.label}
                                                                        onClick={() => {
                                                                            if (isActive) {
                                                                                setFilters(prev => ({ ...prev, min_views: null, max_views: null }));
                                                                            } else {
                                                                                setFilters(prev => ({ ...prev, min_views: preset.min, max_views: null }));
                                                                            }
                                                                        }}
                                                                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                                                                            isActive
                                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                                        }`}
                                                                    >
                                                                        {preset.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {/* Custom range inputs */}
                                                        <div className="flex gap-1 items-center text-xs">
                                                            <input
                                                                type="number"
                                                                value={filters.min_views ?? ''}
                                                                onChange={(e) => setFilters(prev => ({ ...prev, min_views: e.target.value ? parseInt(e.target.value) : null }))}
                                                                placeholder="Min"
                                                                className="flex-1 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16"
                                                                min="0"
                                                            />
                                                            <span className="text-gray-400">-</span>
                                                            <input
                                                                type="number"
                                                                value={filters.max_views ?? ''}
                                                                onChange={(e) => setFilters(prev => ({ ...prev, max_views: e.target.value ? parseInt(e.target.value) : null }))}
                                                                placeholder="Max"
                                                                className="flex-1 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-16"
                                                                min="0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Maturity Level with Include/Exclude toggle */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('maturity_level')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Nivel de Madurez</span>
                                            <span>{expandedSections.maturity_level ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.maturity_level && (
                                            <div className="space-y-1 ml-1">
                                                {[
                                                    { value: 'captured', label: 'Capturado', icon: '📥' },
                                                    { value: 'processed', label: 'Procesado', icon: '⚙️' },
                                                    { value: 'connected', label: 'Conectado', icon: '🔗' },
                                                    { value: 'integrated', label: 'Integrado', icon: '✅' }
                                                ].map(level => {
                                                    const isIncluded = filters.maturity_level.includes(level.value);
                                                    const isExcluded = filters.maturity_level_exclude.includes(level.value);
                                                    return (
                                                        <div key={level.value} className="flex items-center gap-1 text-sm p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <button
                                                                onClick={() => {
                                                                    if (isIncluded) {
                                                                        // Was included -> go to excluded
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            maturity_level: prev.maturity_level.filter(t => t !== level.value),
                                                                            maturity_level_exclude: [...prev.maturity_level_exclude, level.value]
                                                                        }));
                                                                    } else if (isExcluded) {
                                                                        // Was excluded -> go to neutral
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            maturity_level_exclude: prev.maturity_level_exclude.filter(t => t !== level.value)
                                                                        }));
                                                                    } else {
                                                                        // Was neutral -> go to included
                                                                        setFilters(prev => ({
                                                                            ...prev,
                                                                            maturity_level: [...prev.maturity_level, level.value]
                                                                        }));
                                                                    }
                                                                }}
                                                                className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                                                                    isIncluded
                                                                        ? 'bg-green-500 border-green-500 text-white'
                                                                        : isExcluded
                                                                            ? 'bg-red-500 border-red-500 text-white'
                                                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                                                }`}
                                                                title={isIncluded ? 'Incluido (click para excluir)' : isExcluded ? 'Excluido (click para quitar filtro)' : 'Sin filtro (click para incluir)'}
                                                            >
                                                                {isIncluded ? '✓' : isExcluded ? '−' : ''}
                                                            </button>
                                                            <span className="flex-1">{level.icon} {level.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Anotaciones Filter */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('has_comment')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Anotaciones</span>
                                            <span>{expandedSections.has_comment ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.has_comment && (
                                            <div className="space-y-1 ml-1">
                                                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.has_comment === true}
                                                        onChange={() => setFilters(prev => ({ ...prev, has_comment: prev.has_comment === true ? null : true }))}
                                                        className="rounded"
                                                    />
                                                    <span className="flex-1">💬 Con anotaciones</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.has_comment === false}
                                                        onChange={() => setFilters(prev => ({ ...prev, has_comment: prev.has_comment === false ? null : false }))}
                                                        className="rounded"
                                                    />
                                                    <span className="flex-1">Sin anotaciones</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>

                                    {/* Processing Status */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('processing_status')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 dark:text-gray-300 mb-2"
                                        >
                                            <span>Estado</span>
                                            <span>{expandedSections.processing_status ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.processing_status && (
                                            <div className="space-y-1 ml-1">
                                                {[
                                                    { value: 'completed', label: 'Procesado', icon: '✅' },
                                                    { value: 'pending', label: 'Pendiente', icon: '⏳' },
                                                    { value: 'error', label: 'Error', icon: '❌' }
                                                ].map(status => (
                                                    <label key={status.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.processing_status.includes(status.value)}
                                                            onChange={() => toggleFilter('processing_status', status.value)}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1">{status.icon} {status.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tags Section */}
                                    {(availableTags.user_tags.length > 0 || availableTags.inherited_tags.length > 0) && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <TagFilter
                                                userTags={availableTags.user_tags}
                                                inheritedTags={availableTags.inherited_tags}
                                                selectedUserTags={filters.user_tags}
                                                selectedInheritedTags={filters.inherited_tags}
                                                onUserTagsChange={(tags) => setFilters(prev => ({ ...prev, user_tags: tags }))}
                                                onInheritedTagsChange={(tags) => setFilters(prev => ({ ...prev, inherited_tags: tags }))}
                                                compact
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results */}
                    <div className="flex-1">
                        {/* Active Filters */}
                        {hasActiveFilters && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {filters.types.map(t => (
                                    <span key={t} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                                        ✓ {t}
                                        <button onClick={() => setFilters(prev => ({ ...prev, types: prev.types.filter(x => x !== t) }))} className="hover:text-blue-600 dark:hover:text-blue-400">×</button>
                                    </span>
                                ))}
                                {filters.types_exclude.map(t => (
                                    <span key={`ex-${t}`} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-full text-sm">
                                        − {t}
                                        <button onClick={() => setFilters(prev => ({ ...prev, types_exclude: prev.types_exclude.filter(x => x !== t) }))} className="hover:text-red-600 dark:hover:text-red-400">×</button>
                                    </span>
                                ))}
                                {filters.categories.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-full text-sm">
                                        {c}
                                        <button onClick={() => toggleFilter('categories', c)} className="hover:text-green-600 dark:hover:text-green-400">×</button>
                                    </span>
                                ))}
                                {filters.concepts.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 rounded-full text-sm">
                                        {c}
                                        <button onClick={() => toggleFilter('concepts', c)} className="hover:text-purple-600 dark:hover:text-purple-400">×</button>
                                    </span>
                                ))}
                                {filters.organizations.map(o => (
                                    <span key={o} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 rounded-full text-sm">
                                        {o}
                                        <button onClick={() => toggleFilter('organizations', o)} className="hover:text-orange-600 dark:hover:text-orange-400">×</button>
                                    </span>
                                ))}
                                {filters.products.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-300 rounded-full text-sm">
                                        {p}
                                        <button onClick={() => toggleFilter('products', p)} className="hover:text-pink-600 dark:hover:text-pink-400">×</button>
                                    </span>
                                ))}
                                {filters.persons.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 rounded-full text-sm">
                                        {p}
                                        <button onClick={() => toggleFilter('persons', p)} className="hover:text-teal-600 dark:hover:text-teal-400">×</button>
                                    </span>
                                ))}
                                {filters.maturity_level.map(m => (
                                    <span key={m} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 rounded-full text-sm">
                                        ✓ {m}
                                        <button onClick={() => setFilters(prev => ({ ...prev, maturity_level: prev.maturity_level.filter(x => x !== m) }))} className="hover:text-amber-600 dark:hover:text-amber-400">×</button>
                                    </span>
                                ))}
                                {filters.maturity_level_exclude.map(m => (
                                    <span key={`ex-ml-${m}`} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-full text-sm">
                                        − {m}
                                        <button onClick={() => setFilters(prev => ({ ...prev, maturity_level_exclude: prev.maturity_level_exclude.filter(x => x !== m) }))} className="hover:text-red-600 dark:hover:text-red-400">×</button>
                                    </span>
                                ))}
                                {filters.user_tags.map(t => (
                                    <span key={`ut-${t}`} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 rounded-full text-sm">
                                        {t}
                                        <button onClick={() => setFilters(prev => ({ ...prev, user_tags: prev.user_tags.filter(x => x !== t) }))} className="hover:text-indigo-600 dark:hover:text-indigo-400">×</button>
                                    </span>
                                ))}
                                {filters.inherited_tags.map(t => (
                                    <span key={`it-${t}`} className="inline-flex items-center gap-1 px-3 py-1 bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-300 rounded-full text-sm">
                                        {t}
                                        <button onClick={() => setFilters(prev => ({ ...prev, inherited_tags: prev.inherited_tags.filter(x => x !== t) }))} className="hover:text-violet-600 dark:hover:text-violet-400">×</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Results Count and Bulk Actions */}
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {searching ? (
                                    <span>Buscando...</span>
                                ) : (
                                    <span>{results.length} resultados {facets && `de ${facets.total_contents} totales`}</span>
                                )}
                            </div>
                            {selectedContentIds.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {selectedContentIds.size} seleccionado(s)
                                    </span>
                                    <button
                                        onClick={handleBulkArchive}
                                        disabled={archivingContents}
                                        className="inline-flex items-center px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm"
                                    >
                                        {archivingContents ? '...' : '📦 Archivar'}
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={deletingContents}
                                        className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                                    >
                                        {deletingContents ? '...' : '🗑️ Eliminar'}
                                    </button>
                                    <button
                                        onClick={() => setSelectedContentIds(new Set())}
                                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                    >
                                        Limpiar seleccion
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Results Grid */}
                        <div className="grid gap-4">
                            {/* Loading Skeletons */}
                            {searching && results.length === 0 && (
                                <>
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={`skeleton-${i}`} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
                                            <div className="flex items-start gap-3">
                                                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                <div className="flex-1">
                                                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1"></div>
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3"></div>
                                                    <div className="flex gap-2">
                                                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-14"></div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {results.map(content => (
                                <div
                                    key={content.id}
                                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedContentIds.has(content.id)}
                                            onChange={() => toggleContentSelection(content.id)}
                                            className="mt-1 rounded border-gray-300 dark:border-gray-600"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span
                                            className="text-2xl cursor-pointer"
                                            onClick={() => openDetail(content)}
                                        >
                                            {getTypeIcon(content.type)}
                                        </span>
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => openDetail(content)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-medium text-gray-900 dark:text-white line-clamp-1">
                                                    {content.title}
                                                </span>
                                                {content.is_favorite && <span className="text-yellow-500">★</span>}
                                                {content.user_note && <span className="text-blue-500" title="Tiene anotación">💬</span>}
                                            </div>
                                            {content.summary && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                                    {content.summary}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {/* Show match fields when using global search */}
                                                {content.match_fields && content.match_fields.length > 0 && (
                                                    <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded">
                                                        Encontrado en: {content.match_fields.map(f => {
                                                            if (f === 'title') return 'titulo';
                                                            if (f === 'summary') return 'resumen';
                                                            if (f.startsWith('concept:')) return f.replace('concept:', '');
                                                            if (f.startsWith('category:')) return f.replace('category:', '');
                                                            if (f.startsWith('person:')) return f.replace('person:', '');
                                                            if (f.startsWith('organization:')) return f.replace('organization:', '');
                                                            if (f.startsWith('product:')) return f.replace('product:', '');
                                                            if (f.startsWith('tag:')) return f.replace('tag:', '');
                                                            return f;
                                                        }).join(', ')}
                                                    </span>
                                                )}
                                                {content.iab_tier1 && (
                                                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                        {content.iab_tier1}
                                                    </span>
                                                )}
                                                {content.concepts?.slice(0, 3).map(concept => (
                                                    <button
                                                        key={concept}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleFilter('concepts', concept);
                                                        }}
                                                        className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800"
                                                    >
                                                        {concept}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {new Date(content.created_at).toLocaleDateString()}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                content.processing_status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                content.processing_status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                            }`}>
                                                {content.processing_status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {results.length === 0 && !searching && (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <p className="text-lg mb-2">No se encontraron resultados</p>
                                    <p className="text-sm">Prueba a cambiar los filtros o la busqueda</p>
                                </div>
                            )}

                            {/* Load more button */}
                            {hasMore && results.length > 0 && (
                                <div className="py-6 text-center">
                                    <button
                                        onClick={() => loadMoreResults()}
                                        disabled={loadingMore}
                                        className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                                    >
                                        {loadingMore ? (
                                            <span className="flex items-center gap-2">
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Cargando...
                                            </span>
                                        ) : (
                                            `Cargar mas (${results.length} de ${totalResults || facets?.total_contents || '?'})`
                                        )}
                                    </button>
                                </div>
                            )}
                            {!hasMore && results.length > 0 && (
                                <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    Mostrando todos los {results.length} resultados
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                    <>
                        {/* Notes Search Bar */}
                        <div className="mb-6">
                            <div className="flex gap-4">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={notesSearchQuery}
                                        onChange={(e) => setNotesSearchQuery(e.target.value)}
                                        placeholder="Buscar en tus reflexiones, ideas, preguntas..."
                                        className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <span className="absolute left-3 top-3.5 text-gray-400 dark:text-gray-500">🔍</span>
                                </div>
                                {hasActiveNotesFilters && (
                                    <button
                                        onClick={clearNotesFilters}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-6">
                            {/* Notes Sidebar with Facets */}
                            <div className="w-64 flex-shrink-0">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                                    <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Filtros</h2>

                                    {notesFacets && (
                                        <div className="space-y-4">
                                            {/* Note Types */}
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Tipo de Nota</span>
                                                <div className="space-y-1 ml-1">
                                                    {notesFacets.note_types.map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={notesFilters.note_types.includes(facet.value)}
                                                                onChange={() => toggleNoteTypeFilter(facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1">{facet.icon} {facet.label}</span>
                                                            <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Linkage */}
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Vinculacion</span>
                                                <div className="space-y-1 ml-1">
                                                    {notesFacets.linkage.map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={notesFilters.linkage_type === facet.value}
                                                                onChange={() => toggleNoteLinkageFilter(facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1">{facet.icon} {facet.label}</span>
                                                            <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Pinned filter */}
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300 mb-2 block">Fijadas</span>
                                                <div className="space-y-1 ml-1">
                                                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                        <input
                                                            type="checkbox"
                                                            checked={notesFilters.is_pinned === true}
                                                            onChange={() => setNotesFilters(prev => ({ ...prev, is_pinned: prev.is_pinned === true ? null : true }))}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1">📌 Solo fijadas</span>
                                                        <span className="text-gray-400 dark:text-gray-500">({notesFacets.pinned_count})</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes Results */}
                            <div className="flex-1">
                                {/* Notes Bulk Actions Bar */}
                                {selectedNoteIds.size > 0 && (
                                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-between">
                                        <span className="text-sm text-purple-700 dark:text-purple-300">
                                            {selectedNoteIds.size} nota(s) seleccionada(s)
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSelectedNoteIds(new Set())}
                                                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleBulkDeleteNotes}
                                                disabled={deletingNotes}
                                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {deletingNotes ? 'Eliminando...' : 'Eliminar'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Notes Count */}
                                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                                    {searchingNotes ? (
                                        'Buscando...'
                                    ) : (
                                        `${notes.length} reflexion(es) de ${totalNotes} totales`
                                    )}
                                </div>

                                {/* Notes Grid */}
                                <div className="space-y-3">
                                    {searchingNotes && notes.length === 0 && (
                                        <>
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                                        <div className="flex-1">
                                                            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1"></div>
                                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {notes.map(note => (
                                        <div
                                            key={note.id}
                                            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow ${
                                                note.is_pinned ? 'border-l-4 border-purple-500' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNoteIds.has(note.id)}
                                                    onChange={() => {
                                                        setSelectedNoteIds(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(note.id)) {
                                                                next.delete(note.id);
                                                            } else {
                                                                next.add(note.id);
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className="mt-1 rounded border-gray-300 dark:border-gray-600"
                                                />
                                                <span className="text-2xl">
                                                    {note.note_type === 'reflection' ? '💭' :
                                                     note.note_type === 'idea' ? '💡' :
                                                     note.note_type === 'question' ? '❓' :
                                                     note.note_type === 'connection' ? '🔗' :
                                                     note.note_type === 'journal' ? '📓' :
                                                     note.note_type === 'full_note' ? '📄' : '📝'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-medium text-gray-900 dark:text-white line-clamp-1">
                                                            {note.title}
                                                        </span>
                                                        {note.is_pinned && <span className="text-purple-500">📌</span>}
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                                        {note.content}
                                                    </p>
                                                    {/* Links section */}
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {/* Source content link */}
                                                        {note.source_content && (
                                                            <button
                                                                onClick={() => {
                                                                    setActiveTab('contents');
                                                                    const fetchAndOpenContent = async () => {
                                                                        setLoadingDetail(true);
                                                                        setShowDetailModal(true);
                                                                        try {
                                                                            const { data, error } = await supabase
                                                                                .from('contents')
                                                                                .select('*')
                                                                                .eq('id', note.source_content!.id)
                                                                                .single();
                                                                            if (!error && data) {
                                                                                setSelectedContent(data);
                                                                            }
                                                                        } catch (err) {
                                                                            console.error('Error fetching content:', err);
                                                                            setShowDetailModal(false);
                                                                        } finally {
                                                                            setLoadingDetail(false);
                                                                        }
                                                                    };
                                                                    fetchAndOpenContent();
                                                                }}
                                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                            >
                                                                <span>📄</span>
                                                                <span className="font-medium truncate max-w-[150px]">
                                                                    {note.source_content.title}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {/* Project link */}
                                                        {note.linked_project && (
                                                            <Link
                                                                href={`/projects/${note.linked_project.id}`}
                                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/50"
                                                            >
                                                                <span>{note.linked_project.icon || '📁'}</span>
                                                                <span className="font-medium truncate max-w-[150px]">
                                                                    {note.linked_project.name}
                                                                </span>
                                                            </Link>
                                                        )}
                                                        {/* Mental model link */}
                                                        {note.linked_model && (
                                                            <Link
                                                                href={`/mental-models/${note.linked_model.id}`}
                                                                className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50"
                                                            >
                                                                <span>🧠</span>
                                                                <span className="font-medium truncate max-w-[150px]">
                                                                    {note.linked_model.taxonomy_value}
                                                                </span>
                                                            </Link>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                                            {note.note_type === 'reflection' ? 'Reflexion' :
                                                             note.note_type === 'idea' ? 'Idea' :
                                                             note.note_type === 'question' ? 'Pregunta' :
                                                             note.note_type === 'connection' ? 'Conexion' :
                                                             note.note_type === 'journal' ? 'Diario' :
                                                             note.note_type === 'full_note' ? 'Nota completa' : note.note_type}
                                                        </span>
                                                        {note.tags?.map(tag => (
                                                            <span key={tag} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        {new Date(note.created_at).toLocaleDateString()}
                                                    </span>
                                                    <button
                                                        onClick={() => toggleNotePin(note.id)}
                                                        className="text-xs px-2 py-1 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400"
                                                        title={note.is_pinned ? 'Desanclar' : 'Fijar'}
                                                    >
                                                        {note.is_pinned ? '📌 Fijada' : 'Fijar'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {notes.length === 0 && !searchingNotes && (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            <p className="text-lg mb-2">No hay reflexiones</p>
                                            <p className="text-sm">Las reflexiones, ideas y preguntas que crees al leer contenidos apareceran aqui</p>
                                        </div>
                                    )}

                                    {/* Load more notes button */}
                                    {hasMoreNotes && notes.length > 0 && (
                                        <div className="py-6 text-center">
                                            <button
                                                onClick={() => loadMoreNotes()}
                                                disabled={loadingMoreNotes}
                                                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                                            >
                                                {loadingMoreNotes ? (
                                                    <span className="flex items-center gap-2">
                                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Cargando...
                                                    </span>
                                                ) : (
                                                    `Cargar mas (${notes.length} de ${totalNotes})`
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {!hasMoreNotes && notes.length > 0 && (
                                        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Mostrando todas las {notes.length} reflexiones
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Detail Modal */}
            <ContentDetailModal
                content={selectedContent}
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                onUpdate={(updated) => {
                    setSelectedContent(updated);
                    invalidateContents();
                }}
                onArchive={() => {
                    invalidateContents();
                }}
                onDelete={() => {
                    invalidateContents();
                }}
                onFilterClick={(filterType, value) => {
                    if (filterType === 'concepts') toggleFilter('concepts', value);
                    else if (filterType === 'organizations') toggleFilter('organizations', value);
                    else if (filterType === 'products') toggleFilter('products', value);
                    else if (filterType === 'persons') toggleFilter('persons', value);
                    setShowDetailModal(false);
                }}
            />
        </div>
    );
}

export default function ExplorePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        }>
            <ExplorePageContent />
        </Suspense>
    );
}
