'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { TagFilter } from '@/components/tag-filter';
import { ContentDetailModal, ContentDetail } from '@/components/content-detail-modal';

interface Facet {
    value: string;
    count: number;
}

interface Facets {
    types: Facet[];
    categories: Facet[];
    concepts: Facet[];
    organizations: Facet[];
    products: Facet[];
    persons: Facet[];
    user_tags: Facet[];
    total_contents: number;
}

interface Content {
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
    is_favorite: boolean;
    is_archived: boolean;
    user_tags: string[];
    user_note: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    // Fields from global search
    relevance_score?: number;
    match_fields?: string[];
}

interface Filters {
    types: string[];
    categories: string[];
    concepts: string[];
    organizations: string[];
    products: string[];
    persons: string[];
    user_tags: string[];
    inherited_tags: string[];
    processing_status: string[];
}

function ExplorePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const [facets, setFacets] = useState<Facets | null>(null);
    const [results, setResults] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<Filters>({
        types: [],
        categories: [],
        concepts: [],
        organizations: [],
        products: [],
        persons: [],
        user_tags: [],
        inherited_tags: [],
        processing_status: []
    });
    const [availableTags, setAvailableTags] = useState<{ user_tags: string[]; inherited_tags: { tag: string; color: string }[] }>({ user_tags: [], inherited_tags: [] });
    const [expandedSections, setExpandedSections] = useState({
        types: true,
        categories: true,
        concepts: false,
        organizations: false,
        products: false,
        persons: false,
        processing_status: true
    });
    // Search within facets
    const [facetSearch, setFacetSearch] = useState({
        categories: '',
        concepts: '',
        organizations: '',
        products: '',
        persons: ''
    });
    // Track if using global search
    const [isGlobalSearch, setIsGlobalSearch] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedContent, setSelectedContent] = useState<ContentDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());
    const [archivingContents, setArchivingContents] = useState(false);
    const [deletingContents, setDeletingContents] = useState(false);

    // Pagination state
    const PAGE_SIZE = 100;
    const [totalResults, setTotalResults] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

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

    const fetchFacets = async (currentFilters?: Filters) => {
        try {
            const headers = await getAuthHeader();
            const filtersToUse = currentFilters || filters;
            const hasFilters = Object.values(filtersToUse).some(arr => arr.length > 0);

            if (hasFilters) {
                // Use dynamic facets when filters are active
                const response = await fetch(`${API_BASE}/search/facets/dynamic`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        types: filtersToUse.types.length > 0 ? filtersToUse.types : null,
                        categories: filtersToUse.categories.length > 0 ? filtersToUse.categories : null,
                        concepts: filtersToUse.concepts.length > 0 ? filtersToUse.concepts : null,
                        organizations: filtersToUse.organizations.length > 0 ? filtersToUse.organizations : null,
                        products: filtersToUse.products.length > 0 ? filtersToUse.products : null,
                        persons: filtersToUse.persons.length > 0 ? filtersToUse.persons : null,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    setFacets(data);
                }
            } else {
                // Use regular facets when no filters
                const response = await fetch(`${API_BASE}/search/facets`, { headers });
                if (response.ok) {
                    const data = await response.json();
                    setFacets(data);
                }
            }
        } catch (error) {
            console.error('Error fetching facets:', error);
        }
    };

    const searchWithFilters = useCallback(async (reset: boolean = true) => {
        if (reset) {
            setSearching(true);
            setResults([]);
        }
        try {
            const headers = await getAuthHeader();
            const hasFilters = Object.values(filters).some(arr => arr.length > 0);

            // Use global search when there's a query and no filters
            // This searches across title, summary, concepts, entities, etc.
            if (searchQuery && !hasFilters) {
                setIsGlobalSearch(true);
                const response = await fetch(`${API_BASE}/search/global`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery,
                        limit: PAGE_SIZE,
                        offset: 0
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(data.data);
                    setTotalResults(data.meta?.total_results || data.data.length);
                    setHasMore(data.data.length === PAGE_SIZE);
                }
            } else {
                // Use faceted search when filters are applied
                setIsGlobalSearch(false);
                const response = await fetch(`${API_BASE}/search/faceted`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery || null,
                        types: filters.types.length > 0 ? filters.types : null,
                        categories: filters.categories.length > 0 ? filters.categories : null,
                        concepts: filters.concepts.length > 0 ? filters.concepts : null,
                        organizations: filters.organizations.length > 0 ? filters.organizations : null,
                        products: filters.products.length > 0 ? filters.products : null,
                        persons: filters.persons.length > 0 ? filters.persons : null,
                        user_tags: filters.user_tags.length > 0 ? filters.user_tags : null,
                        inherited_tags: filters.inherited_tags.length > 0 ? filters.inherited_tags : null,
                        processing_status: filters.processing_status.length > 0 ? filters.processing_status : null,
                        limit: PAGE_SIZE,
                        offset: 0
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(data.data);
                    setTotalResults(data.meta?.total_results || data.data.length);
                    setHasMore(data.data.length === PAGE_SIZE);
                }
            }
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setSearching(false);
        }
    }, [searchQuery, filters]);

    const loadMoreResults = async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const headers = await getAuthHeader();

            // Use the same search type as the initial search
            if (isGlobalSearch) {
                const response = await fetch(`${API_BASE}/search/global`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery,
                        limit: PAGE_SIZE,
                        offset: results.length
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(prev => [...prev, ...data.data]);
                    setHasMore(data.data.length === PAGE_SIZE);
                }
            } else {
                const response = await fetch(`${API_BASE}/search/faceted`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery || null,
                        types: filters.types.length > 0 ? filters.types : null,
                        categories: filters.categories.length > 0 ? filters.categories : null,
                        concepts: filters.concepts.length > 0 ? filters.concepts : null,
                        organizations: filters.organizations.length > 0 ? filters.organizations : null,
                        products: filters.products.length > 0 ? filters.products : null,
                        persons: filters.persons.length > 0 ? filters.persons : null,
                        user_tags: filters.user_tags.length > 0 ? filters.user_tags : null,
                        inherited_tags: filters.inherited_tags.length > 0 ? filters.inherited_tags : null,
                        processing_status: filters.processing_status.length > 0 ? filters.processing_status : null,
                        limit: PAGE_SIZE,
                        offset: results.length
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(prev => [...prev, ...data.data]);
                    setHasMore(data.data.length === PAGE_SIZE);
                }
            }
        } catch (error) {
            console.error('Error loading more:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const fetchAvailableTags = async () => {
        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_BASE}/tags/available`, { headers });
            if (response.ok) {
                const data = await response.json();
                setAvailableTags(data);
            }
        } catch (error) {
            console.error('Error fetching available tags:', error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchFacets();
            searchWithFilters();
            fetchAvailableTags();
        }
    }, [user]);

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

    useEffect(() => {
        if (user) {
            const debounce = setTimeout(() => {
                searchWithFilters();
                fetchFacets(filters);
            }, 300);
            return () => clearTimeout(debounce);
        }
    }, [filters, searchQuery, searchWithFilters, user]);

    const toggleFilter = (category: keyof Filters, value: string) => {
        setFilters(prev => {
            const current = prev[category];
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
            categories: [],
            concepts: [],
            organizations: [],
            products: [],
            persons: [],
            user_tags: [],
            inherited_tags: [],
            processing_status: []
        });
        setSearchQuery('');
    };

    const hasActiveFilters = Object.values(filters).some(arr => arr.length > 0) || searchQuery;

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'youtube': return '▶';
            case 'article': return '📄';
            case 'pdf': return '📑';
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
                setResults(results.map(c =>
                    c.id === contentId ? { ...c, is_favorite: newFavoriteStatus } : c
                ));
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

        setArchivingContents(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const response = await fetch(`${API_BASE}/content/bulk/archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    content_ids: Array.from(selectedContentIds),
                }),
            });

            if (!response.ok) {
                throw new Error('Error al archivar');
            }

            setSelectedContentIds(new Set());
            searchWithFilters();
            fetchFacets();
        } catch (error) {
            console.error('Error archiving contents:', error);
        } finally {
            setArchivingContents(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedContentIds.size === 0) return;

        if (!confirm(`¿Estas seguro de ELIMINAR PERMANENTEMENTE ${selectedContentIds.size} elemento(s)? Esta accion no se puede deshacer.`)) return;

        setDeletingContents(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) throw new Error('No session');

            const response = await fetch(`${API_BASE}/content/bulk/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    content_ids: Array.from(selectedContentIds),
                }),
            });

            if (!response.ok) {
                throw new Error('Error al eliminar');
            }

            setSelectedContentIds(new Set());
            searchWithFilters();
            fetchFacets();
        } catch (error) {
            console.error('Error deleting contents:', error);
        } finally {
            setDeletingContents(false);
        }
    };

    if (authLoading || loading) {
        fetchFacets().then(() => setLoading(false));
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
                                    {/* Types */}
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
                                                {facets.types.map(facet => (
                                                    <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded text-gray-900 dark:text-gray-200">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.types.includes(facet.value)}
                                                            onChange={() => toggleFilter('types', facet.value)}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1">{getTypeIcon(facet.value)} {facet.value}</span>
                                                        <span className="text-gray-400 dark:text-gray-500">({facet.count})</span>
                                                    </label>
                                                ))}
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
                                        {t}
                                        <button onClick={() => toggleFilter('types', t)} className="hover:text-blue-600 dark:hover:text-blue-400">×</button>
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
                                        onClick={loadMoreResults}
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
            </div>

            {/* Detail Modal */}
            <ContentDetailModal
                content={selectedContent}
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                onUpdate={(updated) => {
                    setSelectedContent(updated);
                    setResults(results.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                }}
                onArchive={(contentId) => {
                    setResults(results.filter(c => c.id !== contentId));
                    fetchFacets();
                }}
                onDelete={(contentId) => {
                    setResults(results.filter(c => c.id !== contentId));
                    fetchFacets();
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
