'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
    total_contents: number;
}

interface Content {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    type: string;
    iab_tier1: string | null;
    concepts: string[];
    entities: {
        organizations?: string[];
        products?: string[];
    } | null;
    created_at: string;
}

interface Filters {
    types: string[];
    categories: string[];
    concepts: string[];
    organizations: string[];
    products: string[];
}

export default function ExplorePage() {
    const router = useRouter();
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
        products: []
    });
    const [expandedSections, setExpandedSections] = useState({
        types: true,
        categories: true,
        concepts: false,
        organizations: false,
        products: false
    });

    const API_URL = 'http://localhost:8000/api/v1';

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

    const fetchFacets = async () => {
        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/search/facets`, { headers });
            if (response.ok) {
                const data = await response.json();
                setFacets(data);
            }
        } catch (error) {
            console.error('Error fetching facets:', error);
        }
    };

    const searchWithFilters = useCallback(async () => {
        setSearching(true);
        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/search/faceted`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: searchQuery || null,
                    types: filters.types.length > 0 ? filters.types : null,
                    categories: filters.categories.length > 0 ? filters.categories : null,
                    concepts: filters.concepts.length > 0 ? filters.concepts : null,
                    organizations: filters.organizations.length > 0 ? filters.organizations : null,
                    products: filters.products.length > 0 ? filters.products : null,
                    limit: 50
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data.data);
            }
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setSearching(false);
        }
    }, [searchQuery, filters]);

    useEffect(() => {
        if (user) {
            fetchFacets();
            searchWithFilters();
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            const debounce = setTimeout(() => {
                searchWithFilters();
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
            products: []
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
            default: return '📎';
        }
    };

    if (authLoading || loading) {
        fetchFacets().then(() => setLoading(false));
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                            ← Dashboard
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Explorar Knowledge Base</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/chat"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                            Chat RAG
                        </Link>
                        <span className="text-sm text-gray-600">{user.email}</span>
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
                                placeholder="Buscar en tu knowledge base..."
                                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                        </div>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-6">
                    {/* Sidebar with Facets */}
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow p-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                            <h2 className="font-semibold text-gray-900 mb-4">Filtros</h2>

                            {facets && (
                                <div className="space-y-4">
                                    {/* Types */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('types')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
                                        >
                                            <span>Tipo ({facets.types.length})</span>
                                            <span>{expandedSections.types ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.types && (
                                            <div className="space-y-1 ml-1">
                                                {facets.types.map(facet => (
                                                    <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.types.includes(facet.value)}
                                                            onChange={() => toggleFilter('types', facet.value)}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1">{getTypeIcon(facet.value)} {facet.value}</span>
                                                        <span className="text-gray-400">({facet.count})</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Categories */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('categories')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
                                        >
                                            <span>Categoria ({facets.categories.length})</span>
                                            <span>{expandedSections.categories ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.categories && (
                                            <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                {facets.categories.map(facet => (
                                                    <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.categories.includes(facet.value)}
                                                            onChange={() => toggleFilter('categories', facet.value)}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1 truncate">{facet.value}</span>
                                                        <span className="text-gray-400">({facet.count})</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Concepts */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('concepts')}
                                            className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
                                        >
                                            <span>Conceptos ({facets.concepts.length})</span>
                                            <span>{expandedSections.concepts ? '−' : '+'}</span>
                                        </button>
                                        {expandedSections.concepts && (
                                            <div className="space-y-1 ml-1 max-h-64 overflow-y-auto">
                                                {facets.concepts.slice(0, 30).map(facet => (
                                                    <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.concepts.includes(facet.value)}
                                                            onChange={() => toggleFilter('concepts', facet.value)}
                                                            className="rounded"
                                                        />
                                                        <span className="flex-1 truncate">{facet.value}</span>
                                                        <span className="text-gray-400">({facet.count})</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Organizations */}
                                    {facets.organizations.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('organizations')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
                                            >
                                                <span>Organizaciones ({facets.organizations.length})</span>
                                                <span>{expandedSections.organizations ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.organizations && (
                                                <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                    {facets.organizations.map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters.organizations.includes(facet.value)}
                                                                onChange={() => toggleFilter('organizations', facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1 truncate">{facet.value}</span>
                                                            <span className="text-gray-400">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Products */}
                                    {facets.products.length > 0 && (
                                        <div>
                                            <button
                                                onClick={() => toggleSection('products')}
                                                className="flex items-center justify-between w-full text-left font-medium text-gray-700 mb-2"
                                            >
                                                <span>Productos ({facets.products.length})</span>
                                                <span>{expandedSections.products ? '−' : '+'}</span>
                                            </button>
                                            {expandedSections.products && (
                                                <div className="space-y-1 ml-1 max-h-48 overflow-y-auto">
                                                    {facets.products.map(facet => (
                                                        <label key={facet.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={filters.products.includes(facet.value)}
                                                                onChange={() => toggleFilter('products', facet.value)}
                                                                className="rounded"
                                                            />
                                                            <span className="flex-1 truncate">{facet.value}</span>
                                                            <span className="text-gray-400">({facet.count})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
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
                                    <span key={t} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                        {t}
                                        <button onClick={() => toggleFilter('types', t)} className="hover:text-blue-600">×</button>
                                    </span>
                                ))}
                                {filters.categories.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                                        {c}
                                        <button onClick={() => toggleFilter('categories', c)} className="hover:text-green-600">×</button>
                                    </span>
                                ))}
                                {filters.concepts.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                                        {c}
                                        <button onClick={() => toggleFilter('concepts', c)} className="hover:text-purple-600">×</button>
                                    </span>
                                ))}
                                {filters.organizations.map(o => (
                                    <span key={o} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                                        {o}
                                        <button onClick={() => toggleFilter('organizations', o)} className="hover:text-orange-600">×</button>
                                    </span>
                                ))}
                                {filters.products.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm">
                                        {p}
                                        <button onClick={() => toggleFilter('products', p)} className="hover:text-pink-600">×</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Results Count */}
                        <div className="mb-4 text-sm text-gray-600">
                            {searching ? (
                                <span>Buscando...</span>
                            ) : (
                                <span>{results.length} resultados {facets && `de ${facets.total_contents} totales`}</span>
                            )}
                        </div>

                        {/* Results Grid */}
                        <div className="grid gap-4">
                            {results.map(content => (
                                <div key={content.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{getTypeIcon(content.type)}</span>
                                        <div className="flex-1 min-w-0">
                                            <a
                                                href={content.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-lg font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                                            >
                                                {content.title}
                                            </a>
                                            {content.summary && (
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                    {content.summary}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {content.iab_tier1 && (
                                                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                                        {content.iab_tier1}
                                                    </span>
                                                )}
                                                {content.concepts?.slice(0, 3).map(concept => (
                                                    <button
                                                        key={concept}
                                                        onClick={() => toggleFilter('concepts', concept)}
                                                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                                    >
                                                        {concept}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(content.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {results.length === 0 && !searching && (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg mb-2">No se encontraron resultados</p>
                                    <p className="text-sm">Prueba a cambiar los filtros o la busqueda</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
