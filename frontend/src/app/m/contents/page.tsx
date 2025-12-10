'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PAGE_SIZE = 20;

interface Content {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    is_favorite: boolean;
    maturity_level: string | null;
    created_at: string;
    metadata?: Record<string, unknown> | null;
}

interface Facet {
    value: string;
    count: number;
}

// Real content types from the database
const CONTENT_TYPES: Record<string, { icon: string; label: string }> = {
    tiktok: { icon: '🎵', label: 'TikTok' },
    apple_notes: { icon: '🍎', label: 'Apple Notes' },
    youtube: { icon: '▶️', label: 'YouTube' },
    web: { icon: '🌐', label: 'Web' },
    note: { icon: '📝', label: 'Nota' },
    twitter: { icon: '🐦', label: 'Twitter' },
    pdf: { icon: '📕', label: 'PDF' },
    docx: { icon: '📘', label: 'Word' },
    audio: { icon: '🎧', label: 'Audio' },
    email: { icon: '📧', label: 'Email' },
    podcast: { icon: '🎙️', label: 'Podcast' },
    video: { icon: '🎬', label: 'Video' },
};

// Maturity levels
const MATURITY_LEVELS: Record<string, { icon: string; label: string; color: string }> = {
    captured: { icon: '📥', label: 'Capturado', color: 'bg-gray-500' },
    processed: { icon: '⚙️', label: 'Procesado', color: 'bg-blue-500' },
    connected: { icon: '🔗', label: 'Conectado', color: 'bg-purple-500' },
    integrated: { icon: '✅', label: 'Integrado', color: 'bg-green-500' },
};

export default function MobileContentsPage() {
    const [contents, setContents] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedMaturity, setSelectedMaturity] = useState<string[]>([]);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [availableTypes, setAvailableTypes] = useState<Facet[]>([]);
    const [availableCategories, setAvailableCategories] = useState<Facet[]>([]);

    // Action modal state
    const [actionContent, setActionContent] = useState<Content | null>(null);
    const [showActionModal, setShowActionModal] = useState(false);
    const [updatingMaturity, setUpdatingMaturity] = useState(false);

    // Create linked note modal state
    const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [noteType, setNoteType] = useState<'reflection' | 'idea' | 'question' | 'connection' | 'action'>('reflection');
    const [savingNote, setSavingNote] = useState(false);

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

    // Fetch facets for filter options
    const fetchFacets = useCallback(async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/search/facets`, {
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setAvailableTypes(data.types || []);
                setAvailableCategories(data.categories || []);
            }
        } catch (error) {
            console.error('Error fetching facets:', error);
        }
    }, []);

    useEffect(() => {
        fetchFacets();
    }, [fetchFacets]);

    const fetchContents = useCallback(async (reset: boolean = true) => {
        if (reset) {
            setLoading(true);
            setOffset(0);
        } else {
            setLoadingMore(true);
        }

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                setLoading(false);
                setLoadingMore(false);
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            const currentOffset = reset ? 0 : offset;

            // Use global search if there's a query, otherwise faceted search
            if (searchQuery.trim()) {
                const response = await fetch(`${API_URL}/api/v1/search/global`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery,
                        limit: PAGE_SIZE,
                        offset: currentOffset,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    let results = data.contents || [];

                    // Apply filters client-side for global search
                    if (selectedTypes.length > 0) {
                        results = results.filter((c: Content) => selectedTypes.includes(c.type));
                    }
                    if (selectedCategories.length > 0) {
                        results = results.filter((c: Content) => c.iab_tier1 && selectedCategories.includes(c.iab_tier1));
                    }
                    if (selectedMaturity.length > 0) {
                        results = results.filter((c: Content) => {
                            // "captured" includes both null and literal "captured" string
                            if (selectedMaturity.includes('captured') && (!c.maturity_level || c.maturity_level === 'captured')) {
                                return true;
                            }
                            return c.maturity_level && selectedMaturity.includes(c.maturity_level);
                        });
                    }
                    if (showFavoritesOnly) {
                        results = results.filter((c: Content) => c.is_favorite);
                    }

                    if (reset) {
                        setContents(results);
                    } else {
                        setContents(prev => [...prev, ...results]);
                    }
                    setHasMore(results.length === PAGE_SIZE);
                    setOffset(currentOffset + PAGE_SIZE);
                }
            } else {
                // Faceted search for browsing
                const requestBody: Record<string, unknown> = {
                    limit: PAGE_SIZE,
                    offset: currentOffset,
                    sort_by: 'created_at',
                    sort_order: 'desc',
                };

                if (selectedTypes.length > 0) {
                    requestBody.types = selectedTypes;
                }
                if (selectedCategories.length > 0) {
                    requestBody.categories = selectedCategories;
                }
                if (selectedMaturity.length > 0) {
                    requestBody.maturity_level = selectedMaturity;
                }
                if (showFavoritesOnly) {
                    requestBody.is_favorite = true;
                }

                const response = await fetch(`${API_URL}/api/v1/search/faceted`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody),
                });

                if (response.ok) {
                    const data = await response.json();
                    const contentsData = data.contents || data.data || data.results || [];
                    const resultsArray = Array.isArray(contentsData) ? contentsData : [];

                    if (reset) {
                        setContents(resultsArray);
                    } else {
                        setContents(prev => [...prev, ...resultsArray]);
                    }
                    setHasMore(resultsArray.length === PAGE_SIZE);
                    setOffset(currentOffset + PAGE_SIZE);
                }
            }
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [searchQuery, selectedTypes, selectedCategories, selectedMaturity, showFavoritesOnly, offset]);

    // Initial fetch and when filters change
    useEffect(() => {
        fetchContents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, selectedTypes, selectedCategories, selectedMaturity, showFavoritesOnly]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchContents(true);
    };

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchContents(false);
        }
    };

    // Get the best URL for the content (handle TikTok special case)
    const getContentUrl = (content: Content): string => {
        if (content.type === 'tiktok' && content.metadata) {
            const meta = content.metadata as Record<string, unknown>;
            if (meta.original_url && typeof meta.original_url === 'string') {
                return meta.original_url;
            }
            if (meta.webpage_url && typeof meta.webpage_url === 'string') {
                return meta.webpage_url;
            }
        }
        return content.url;
    };

    const openUrl = (content: Content) => {
        const url = getContentUrl(content);

        if (content.type === 'apple_notes') {
            alert('Este contenido es de Apple Notes y solo esta disponible localmente en tu Mac.');
            return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const toggleFavorite = async (content: Content, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setContents(prev => prev.map(c =>
                    c.id === content.id ? { ...c, is_favorite: !c.is_favorite } : c
                ));
                if (actionContent?.id === content.id) {
                    setActionContent({ ...content, is_favorite: !content.is_favorite });
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const updateMaturityLevel = async (content: Content, level: string) => {
        setUpdatingMaturity(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/maturity`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({ maturity_level: level }),
            });

            if (response.ok) {
                setContents(prev => prev.map(c =>
                    c.id === content.id ? { ...c, maturity_level: level } : c
                ));
                setActionContent({ ...content, maturity_level: level });
            }
        } catch (error) {
            console.error('Error updating maturity:', error);
        } finally {
            setUpdatingMaturity(false);
        }
    };

    const archiveContent = async (content: Content) => {
        if (!confirm('¿Archivar este contenido?')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const response = await fetch(`${API_URL}/api/v1/content/${content.id}/archive`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setContents(prev => prev.filter(c => c.id !== content.id));
                setShowActionModal(false);
                setActionContent(null);
            }
        } catch (error) {
            console.error('Error archiving content:', error);
        }
    };

    const openActionModal = (content: Content) => {
        setActionContent(content);
        setShowActionModal(true);
    };

    const openCreateNoteModal = () => {
        setShowActionModal(false);
        setNoteContent('');
        setNoteType('reflection');
        setShowCreateNoteModal(true);
    };

    const createLinkedNote = async () => {
        if (!actionContent || !noteContent.trim()) return;

        setSavingNote(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const body = {
                title: noteContent.trim().substring(0, 50) + (noteContent.length > 50 ? '...' : ''),
                content: noteContent.trim(),
                note_type: noteType,
                tags: [],
                linked_content_ids: [actionContent.id],
                linked_note_ids: [],
            };

            const response = await fetch(`${API_URL}/api/v1/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                setShowCreateNoteModal(false);
                setActionContent(null);
                setNoteContent('');
                alert('Nota creada y vinculada al contenido');
            } else {
                const error = await response.json();
                console.error('Error creating note:', error);
                alert('Error al crear la nota');
            }
        } catch (error) {
            console.error('Error creating linked note:', error);
            alert('Error al crear la nota');
        } finally {
            setSavingNote(false);
        }
    };

    const getTypeConfig = (type: string) => {
        return CONTENT_TYPES[type] || { icon: '📎', label: type };
    };

    const getMaturityConfig = (level: string | null) => {
        // If no level or null, treat as "captured" (default state)
        if (!level) return MATURITY_LEVELS.captured;
        return MATURITY_LEVELS[level] || MATURITY_LEVELS.captured;
    };

    const clearFilters = () => {
        setSelectedTypes([]);
        setSelectedCategories([]);
        setSelectedMaturity([]);
        setShowFavoritesOnly(false);
    };

    const hasActiveFilters = selectedTypes.length > 0 || selectedCategories.length > 0 || selectedMaturity.length > 0 || showFavoritesOnly;

    // Toggle functions for multiselect
    const toggleType = (type: string) => {
        setSelectedTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleCategory = (category: string) => {
        setSelectedCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const toggleMaturity = (level: string) => {
        setSelectedMaturity(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        );
    };

    const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

    return (
        <div className="space-y-4">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar contenidos..."
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${inputClass}`}
                    />
                    <svg
                        className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${mutedTextClass}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
                <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2.5 rounded-xl border ${
                        showFilters || hasActiveFilters
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                </button>
            </form>

            {/* Filter panel */}
            {showFilters && (
                <div className={`rounded-xl p-4 border ${cardClass} space-y-4 max-h-[70vh] overflow-y-auto`}>
                    {/* Favorites toggle */}
                    <button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg ${
                            showFavoritesOnly
                                ? 'bg-amber-500 text-white'
                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <span>⭐</span>
                            <span>Solo favoritos</span>
                        </span>
                        {showFavoritesOnly && <span>✓</span>}
                    </button>

                    {/* Maturity Level filter - Multiselect */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Nivel de Madurez</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(MATURITY_LEVELS).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => toggleMaturity(key)}
                                    className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                                        selectedMaturity.includes(key)
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    <span>{config.icon}</span>
                                    <span>{config.label}</span>
                                    {selectedMaturity.includes(key) && <span>✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Type filter - Multiselect */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Tipo</h3>
                        <div className="flex flex-wrap gap-2">
                            {availableTypes.slice(0, 12).map((facet) => {
                                const config = getTypeConfig(facet.value);
                                return (
                                    <button
                                        key={facet.value}
                                        onClick={() => toggleType(facet.value)}
                                        className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                                            selectedTypes.includes(facet.value)
                                                ? 'bg-amber-500 text-white'
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <span>{config.icon}</span>
                                        <span>{config.label}</span>
                                        <span className="opacity-60">({facet.count})</span>
                                        {selectedTypes.includes(facet.value) && <span>✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Category filter - Multiselect */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Categoria</h3>
                        <div className="flex flex-wrap gap-2">
                            {availableCategories.slice(0, 10).map((facet) => (
                                <button
                                    key={facet.value}
                                    onClick={() => toggleCategory(facet.value)}
                                    className={`px-3 py-1.5 rounded-full text-sm ${
                                        selectedCategories.includes(facet.value)
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    {facet.value} ({facet.count})
                                    {selectedCategories.includes(facet.value) && ' ✓'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className={`w-full py-2 rounded-lg text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Active filters display */}
            {!showFilters && hasActiveFilters && (
                <div className="flex gap-2 flex-wrap">
                    {showFavoritesOnly && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                            ⭐ Favoritos
                        </span>
                    )}
                    {selectedMaturity.map(level => (
                        <span key={level} className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                            {MATURITY_LEVELS[level]?.icon} {MATURITY_LEVELS[level]?.label}
                        </span>
                    ))}
                    {selectedTypes.map(type => (
                        <span key={type} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                            {getTypeConfig(type).icon} {getTypeConfig(type).label}
                        </span>
                    ))}
                    {selectedCategories.map(category => (
                        <span key={category} className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                            📁 {category}
                        </span>
                    ))}
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
                </div>
            ) : contents.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">📚</div>
                    <p className={mutedTextClass}>
                        {searchQuery ? 'No se encontraron resultados' : 'No hay contenidos'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {contents.map((content) => {
                            const typeConfig = getTypeConfig(content.type);
                            const maturityConfig = getMaturityConfig(content.maturity_level);
                            const isAppleNotes = content.type === 'apple_notes';

                            return (
                                <div
                                    key={content.id}
                                    className={`rounded-xl p-4 shadow-sm border ${cardClass}`}
                                >
                                    {/* Header with type, maturity, and favorite */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {typeConfig.icon} {typeConfig.label}
                                            </span>
                                            {maturityConfig && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${maturityConfig.color}`}>
                                                    {maturityConfig.icon}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => toggleFavorite(content, e)}
                                                className={`text-lg ${content.is_favorite ? 'text-amber-500' : mutedTextClass}`}
                                            >
                                                {content.is_favorite ? '★' : '☆'}
                                            </button>
                                            <button
                                                onClick={() => openActionModal(content)}
                                                className={`p-1 ${mutedTextClass}`}
                                            >
                                                ⋮
                                            </button>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h3 className={`font-medium mb-1 line-clamp-2 ${textClass}`}>
                                        {content.title}
                                    </h3>

                                    {/* Summary preview */}
                                    {content.summary && (
                                        <p className={`text-sm line-clamp-2 mb-3 ${mutedTextClass}`}>
                                            {content.summary}
                                        </p>
                                    )}

                                    {/* Category */}
                                    {content.iab_tier1 && (
                                        <p className={`text-xs mb-3 ${mutedTextClass}`}>
                                            📁 {content.iab_tier1}
                                        </p>
                                    )}

                                    {/* Open URL button */}
                                    <button
                                        onClick={() => openUrl(content)}
                                        className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                                            isAppleNotes
                                                ? 'bg-gray-400/50 text-gray-600 cursor-not-allowed'
                                                : 'bg-amber-500/70 text-white hover:bg-amber-500/90'
                                        }`}
                                    >
                                        {isAppleNotes ? (
                                            <>
                                                <span>🍎</span>
                                                Solo en Mac
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                Abrir contenido
                                            </>
                                        )}
                                    </button>

                                    {/* Date */}
                                    <p className={`text-xs mt-2 text-center ${mutedTextClass}`}>
                                        {new Date(content.created_at).toLocaleDateString('es-ES', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Load More button */}
                    {hasMore && (
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className={`w-full py-3 rounded-xl border ${
                                isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'
                            } font-medium flex items-center justify-center gap-2`}
                        >
                            {loadingMore ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-amber-500"></div>
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <span>📥</span>
                                    Cargar mas contenidos
                                </>
                            )}
                        </button>
                    )}
                </>
            )}

            {/* Action Modal */}
            {showActionModal && actionContent && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold ${textClass}`}>
                                {actionContent.title?.substring(0, 40)}...
                            </h3>
                            <button
                                onClick={() => {
                                    setShowActionModal(false);
                                    setActionContent(null);
                                }}
                                className={mutedTextClass}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Maturity Level selector */}
                        <div className="mb-4">
                            <h4 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Nivel de Madurez</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(MATURITY_LEVELS).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => updateMaturityLevel(actionContent, key)}
                                        disabled={updatingMaturity}
                                        className={`p-3 rounded-lg flex items-center gap-2 ${
                                            actionContent.maturity_level === key
                                                ? `${config.color} text-white`
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <span className="text-lg">{config.icon}</span>
                                        <span className="text-sm">{config.label}</span>
                                        {actionContent.maturity_level === key && <span className="ml-auto">✓</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="space-y-2">
                            <button
                                onClick={openCreateNoteModal}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 ${
                                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                <span className="text-lg">📝</span>
                                <span>Crear nota vinculada</span>
                            </button>

                            <button
                                onClick={(e) => toggleFavorite(actionContent, e as unknown as React.MouseEvent)}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 ${
                                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                <span className="text-lg">{actionContent.is_favorite ? '★' : '☆'}</span>
                                <span>{actionContent.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}</span>
                            </button>

                            <button
                                onClick={() => archiveContent(actionContent)}
                                className={`w-full p-3 rounded-lg flex items-center gap-3 text-red-500 ${
                                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                                }`}
                            >
                                <span className="text-lg">📦</span>
                                <span>Archivar contenido</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Linked Note Modal */}
            {showCreateNoteModal && actionContent && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-20">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold ${textClass}`}>
                                Crear nota para: {actionContent.title?.substring(0, 30)}...
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCreateNoteModal(false);
                                    setActionContent(null);
                                    setNoteContent('');
                                }}
                                className={mutedTextClass}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Note type selector */}
                        <div className="mb-4">
                            <h4 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Tipo de nota</h4>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { type: 'reflection' as const, icon: '🪞', label: 'Reflexión' },
                                    { type: 'idea' as const, icon: '💡', label: 'Idea' },
                                    { type: 'question' as const, icon: '❓', label: 'Pregunta' },
                                    { type: 'connection' as const, icon: '🔗', label: 'Conexión' },
                                    { type: 'action' as const, icon: '⚡', label: 'Acción' },
                                ].map(({ type, icon, label }) => (
                                    <button
                                        key={type}
                                        onClick={() => setNoteType(type)}
                                        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
                                            noteType === type
                                                ? 'bg-amber-500 text-white'
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Note content */}
                        <div className="mb-4">
                            <textarea
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                placeholder="Escribe tu nota aquí..."
                                rows={6}
                                className={`w-full p-3 rounded-lg border resize-none ${
                                    isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                }`}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCreateNoteModal(false);
                                    setActionContent(null);
                                    setNoteContent('');
                                }}
                                className={`flex-1 p-3 rounded-lg font-medium ${
                                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={createLinkedNote}
                                disabled={savingNote || !noteContent.trim()}
                                className={`flex-1 p-3 rounded-lg font-medium text-white ${
                                    savingNote || !noteContent.trim()
                                        ? 'bg-amber-400 cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-600'
                                }`}
                            >
                                {savingNote ? 'Guardando...' : 'Crear nota'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
