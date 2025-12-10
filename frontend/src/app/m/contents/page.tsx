'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Content {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    is_favorite: boolean;
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

export default function MobileContentsPage() {
    const [contents, setContents] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [availableTypes, setAvailableTypes] = useState<Facet[]>([]);
    const [availableCategories, setAvailableCategories] = useState<Facet[]>([]);

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

    const fetchContents = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                console.log('No session found');
                setLoading(false);
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            // Use global search if there's a query, otherwise faceted search
            if (searchQuery.trim()) {
                const response = await fetch(`${API_URL}/api/v1/search/global`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: searchQuery,
                        limit: 30,
                        offset: 0,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    let results = data.contents || [];

                    // Apply filters client-side for global search
                    if (selectedType !== 'all') {
                        results = results.filter((c: Content) => c.type === selectedType);
                    }
                    if (selectedCategory !== 'all') {
                        results = results.filter((c: Content) => c.iab_tier1 === selectedCategory);
                    }
                    if (showFavoritesOnly) {
                        results = results.filter((c: Content) => c.is_favorite);
                    }

                    setContents(results);
                } else {
                    console.error('Global search failed:', response.status);
                }
            } else {
                // Faceted search for browsing
                const requestBody: Record<string, unknown> = {
                    limit: 30,
                    offset: 0,
                    sort_by: 'created_at',
                    sort_order: 'desc',
                };

                if (selectedType !== 'all') {
                    requestBody.types = [selectedType];
                }
                if (selectedCategory !== 'all') {
                    requestBody.categories = [selectedCategory];
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
                    setContents(Array.isArray(contentsData) ? contentsData : []);
                } else {
                    console.error('Faceted search failed:', response.status, await response.text());
                }
            }
        } catch (error) {
            console.error('Error fetching contents:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedType, selectedCategory, showFavoritesOnly]);

    useEffect(() => {
        fetchContents();
    }, [fetchContents]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchContents();
    };

    // Get the best URL for the content (handle TikTok special case)
    const getContentUrl = (content: Content): string => {
        // For TikTok, try to get the original URL from metadata or construct it
        if (content.type === 'tiktok' && content.metadata) {
            // If we have the original TikTok URL in metadata, use it
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

        // For apple_notes, show a message instead of opening
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

            const response = await fetch(`${API_URL}/api/v1/contents/${content.id}/favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
            });

            if (response.ok) {
                setContents(prev => prev.map(c =>
                    c.id === content.id ? { ...c, is_favorite: !c.is_favorite } : c
                ));
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    const getTypeConfig = (type: string) => {
        return CONTENT_TYPES[type] || { icon: '📎', label: type };
    };

    const clearFilters = () => {
        setSelectedType('all');
        setSelectedCategory('all');
        setShowFavoritesOnly(false);
    };

    const hasActiveFilters = selectedType !== 'all' || selectedCategory !== 'all' || showFavoritesOnly;

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
                <div className={`rounded-xl p-4 border ${cardClass} space-y-4 max-h-[60vh] overflow-y-auto`}>
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

                    {/* Type filter */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Tipo</h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedType('all')}
                                className={`px-3 py-1.5 rounded-full text-sm ${
                                    selectedType === 'all'
                                        ? 'bg-amber-500 text-white'
                                        : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                Todos
                            </button>
                            {availableTypes.slice(0, 12).map((facet) => {
                                const config = getTypeConfig(facet.value);
                                return (
                                    <button
                                        key={facet.value}
                                        onClick={() => setSelectedType(facet.value)}
                                        className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                                            selectedType === facet.value
                                                ? 'bg-amber-500 text-white'
                                                : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <span>{config.icon}</span>
                                        <span>{config.label}</span>
                                        <span className="opacity-60">({facet.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Category filter */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 ${mutedTextClass}`}>Categoria</h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-3 py-1.5 rounded-full text-sm ${
                                    selectedCategory === 'all'
                                        ? 'bg-amber-500 text-white'
                                        : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                Todas
                            </button>
                            {availableCategories.slice(0, 10).map((facet) => (
                                <button
                                    key={facet.value}
                                    onClick={() => setSelectedCategory(facet.value)}
                                    className={`px-3 py-1.5 rounded-full text-sm ${
                                        selectedCategory === facet.value
                                            ? 'bg-amber-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    {facet.value} ({facet.count})
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
                    {selectedType !== 'all' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                            {getTypeConfig(selectedType).icon} {getTypeConfig(selectedType).label}
                        </span>
                    )}
                    {selectedCategory !== 'all' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                            📁 {selectedCategory}
                        </span>
                    )}
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
                <div className="space-y-3">
                    {contents.map((content) => {
                        const typeConfig = getTypeConfig(content.type);
                        const isAppleNotes = content.type === 'apple_notes';

                        return (
                            <div
                                key={content.id}
                                className={`rounded-xl p-4 shadow-sm border ${cardClass}`}
                            >
                                {/* Header with type and favorite */}
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {typeConfig.icon} {typeConfig.label}
                                    </span>
                                    <button
                                        onClick={(e) => toggleFavorite(content, e)}
                                        className={`text-lg ${content.is_favorite ? 'text-amber-500' : mutedTextClass}`}
                                    >
                                        {content.is_favorite ? '★' : '☆'}
                                    </button>
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
                                            ? 'bg-gray-400 text-white cursor-not-allowed'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
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
            )}
        </div>
    );
}
