'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { TagFilter } from '@/components/tag-filter';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface TaxonomyNode {
    id: string;
    label: string;
    count: number;
    type: string;
}

interface ContentItem {
    id: string;
    title: string;
    type: string;
    url: string;
    iab_tier1: string;
    summary: string;
    created_at: string;
    metadata: any;
}

interface BreadcrumbItem {
    type: string;
    value: string;
    label: string;
}

type RootType = 'category' | 'person' | 'organization' | 'product' | 'concept';

const ROOT_TYPE_LABELS: Record<RootType, string> = {
    category: 'Categorias',
    person: 'Personas',
    organization: 'Organizaciones',
    product: 'Productos',
    concept: 'Conceptos',
};

const ROOT_TYPE_ICONS: Record<RootType, string> = {
    category: '📁',
    person: '👤',
    organization: '🏢',
    product: '📦',
    concept: '💡',
};

export default function TaxonomyExplorerPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // State
    const [rootType, setRootType] = useState<RootType>('category');
    const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
    const [availableTypes, setAvailableTypes] = useState<{ value: string; label: string; count: number }[]>([]);
    const [nodes, setNodes] = useState<TaxonomyNode[]>([]);
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
    const [contents, setContents] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showContents, setShowContents] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [nodeChildren, setNodeChildren] = useState<Record<string, TaxonomyNode[]>>({});
    const [totalContents, setTotalContents] = useState(0);

    // Enabled drill-down levels (all enabled by default)
    const [enabledLevels, setEnabledLevels] = useState<Set<RootType>>(
        new Set(['category', 'person', 'organization', 'product', 'concept'])
    );

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
            throw new Error('No hay sesion activa');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    };

    // Fetch available content types
    const fetchTypes = useCallback(async () => {
        if (!user) return;
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/taxonomy/types`, { headers });
            if (response.ok) {
                const data = await response.json();
                setAvailableTypes(data.types || []);
            }
        } catch (err) {
            console.error('Error fetching types:', err);
        }
    }, [user]);

    // Fetch taxonomy nodes
    const fetchNodes = useCallback(async (
        rootTypeParam: RootType,
        parentType?: string,
        parentValue?: string
    ) => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/taxonomy/nodes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    root_type: rootTypeParam,
                    type_filters: typeFilters.size > 0 ? Array.from(typeFilters) : null,
                    parent_type: parentType,
                    parent_value: parentValue,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Error al cargar datos');
            }

            const data = await response.json();
            setTotalContents(data.total_contents);

            if (parentType && parentValue) {
                // Store as children of the parent node
                const parentId = `${parentType}:${parentValue}`;
                setNodeChildren(prev => ({
                    ...prev,
                    [parentId]: data.nodes
                }));
            } else {
                setNodes(data.nodes);
            }
        } catch (err) {
            console.error('Taxonomy fetch error:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [user, typeFilters]);

    // Fetch contents for current filters
    const fetchContents = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            const headers = await getAuthHeaders();

            // Build filters from breadcrumb
            const filters: Record<string, string> = {};
            breadcrumb.forEach(item => {
                filters[item.type] = item.value;
            });

            const response = await fetch(`${API_URL}/api/v1/taxonomy/contents`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    filters,
                    type_filters: typeFilters.size > 0 ? Array.from(typeFilters) : null,
                    limit: 50,
                    offset: 0,
                }),
            });

            if (!response.ok) {
                throw new Error('Error al cargar contenidos');
            }

            const data = await response.json();
            setContents(data.contents || []);
            setShowContents(true);
        } catch (err) {
            console.error('Contents fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user, breadcrumb, typeFilters]);

    // Initial load
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchTypes();
            fetchNodes(rootType);
        }
    }, [user, fetchTypes, fetchNodes, rootType]);

    // Handle root type change
    const handleRootTypeChange = (newType: RootType) => {
        setRootType(newType);
        setBreadcrumb([]);
        setShowContents(false);
        setExpandedNodes(new Set());
        setNodeChildren({});
        // Ensure the new root type is always enabled
        setEnabledLevels(prev => {
            const next = new Set(prev);
            next.add(newType);
            return next;
        });
        fetchNodes(newType);
    };

    // Toggle a type filter
    const toggleTypeFilter = (typeValue: string) => {
        setTypeFilters(prev => {
            const next = new Set(prev);
            if (next.has(typeValue)) {
                next.delete(typeValue);
            } else {
                next.add(typeValue);
            }
            return next;
        });
        setBreadcrumb([]);
        setShowContents(false);
        setExpandedNodes(new Set());
        setNodeChildren({});
    };

    // Clear all type filters
    const clearTypeFilters = () => {
        setTypeFilters(new Set());
        setBreadcrumb([]);
        setShowContents(false);
        setExpandedNodes(new Set());
        setNodeChildren({});
    };

    useEffect(() => {
        if (user) {
            fetchNodes(rootType);
        }
    }, [typeFilters]);

    // Handle node click - toggle expand/collapse
    const handleNodeClick = async (node: TaxonomyNode) => {
        const nodeId = node.id;

        if (expandedNodes.has(nodeId)) {
            // Collapse
            setExpandedNodes(prev => {
                const next = new Set(prev);
                next.delete(nodeId);
                return next;
            });
        } else {
            // Expand - fetch children
            setExpandedNodes(prev => new Set(prev).add(nodeId));

            // Determine next level type
            const nextType = getNextLevelType(node.type as RootType);
            if (nextType) {
                await fetchNodes(nextType, node.type, node.label);
            }
        }
    };

    // Get next level type for drill-down (only enabled levels)
    const getNextLevelType = (currentType: RootType): RootType | null => {
        // Define drill-down order based on starting point
        const drillDownOrder: Record<RootType, RootType[]> = {
            category: ['concept', 'person', 'organization', 'product'],
            person: ['category', 'concept', 'organization', 'product'],
            organization: ['category', 'concept', 'person', 'product'],
            product: ['category', 'concept', 'person', 'organization'],
            concept: ['category', 'person', 'organization', 'product'],
        };

        // Filter to only include enabled levels
        const order = drillDownOrder[rootType].filter(level => enabledLevels.has(level));
        const currentIndex = order.indexOf(currentType);

        if (currentIndex === -1) {
            return order.length > 0 ? order[0] : null;
        }

        return currentIndex < order.length - 1 ? order[currentIndex + 1] : null;
    };

    // Toggle a drill-down level
    const toggleLevel = (level: RootType) => {
        // Don't allow disabling the root type
        if (level === rootType) return;

        setEnabledLevels(prev => {
            const next = new Set(prev);
            if (next.has(level)) {
                next.delete(level);
            } else {
                next.add(level);
            }
            return next;
        });
        // Reset expanded nodes when levels change
        setExpandedNodes(new Set());
        setNodeChildren({});
    };

    // View contents for a node
    const handleViewContents = (node: TaxonomyNode) => {
        const newBreadcrumb: BreadcrumbItem[] = [{
            type: node.type,
            value: node.label,
            label: node.label,
        }];
        setBreadcrumb(newBreadcrumb);
        setShowContents(true);
    };

    // Fetch contents when breadcrumb changes and showContents is true
    useEffect(() => {
        if (showContents && breadcrumb.length > 0) {
            fetchContents();
        }
    }, [showContents, breadcrumb, fetchContents]);

    // Render a tree node
    const renderNode = (node: TaxonomyNode, depth: number = 0) => {
        const nodeId = node.id;
        const isExpanded = expandedNodes.has(nodeId);
        const children = nodeChildren[nodeId] || [];
        const hasChildren = node.count > 0;
        const nextType = getNextLevelType(node.type as RootType);

        return (
            <div key={nodeId} className="select-none">
                <div
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors`}
                    style={{ marginLeft: depth * 20 }}
                >
                    {/* Expand/Collapse button */}
                    {nextType && hasChildren ? (
                        <button
                            onClick={() => handleNodeClick(node)}
                            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}

                    {/* Node icon */}
                    <span className="text-lg">
                        {ROOT_TYPE_ICONS[node.type as RootType] || '📄'}
                    </span>

                    {/* Node label and count */}
                    <div className="flex-1 flex items-center justify-between">
                        <span className="text-gray-900 dark:text-white font-medium">
                            {node.label}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {node.count}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewContents(node);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Ver
                            </button>
                        </div>
                    </div>
                </div>

                {/* Children */}
                {isExpanded && children.length > 0 && (
                    <div className="border-l border-gray-200 dark:border-gray-700 ml-5">
                        {children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}

                {/* Loading indicator for children */}
                {isExpanded && children.length === 0 && loading && (
                    <div className="py-2 px-3 text-gray-500 dark:text-gray-400 text-sm" style={{ marginLeft: (depth + 1) * 20 }}>
                        Cargando...
                    </div>
                )}
            </div>
        );
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
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
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                ← Volver
                            </Link>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Explorador de Taxonomia
                            </h1>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {totalContents} contenidos
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex gap-6">
                    {/* Sidebar - Filters */}
                    <div className="w-64 flex-shrink-0">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sticky top-6">
                            {/* Root Type Selector */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    Explorar por
                                </h3>
                                <div className="space-y-1">
                                    {(Object.keys(ROOT_TYPE_LABELS) as RootType[]).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => handleRootTypeChange(type)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                                rootType === type
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span>{ROOT_TYPE_ICONS[type]}</span>
                                            <span>{ROOT_TYPE_LABELS[type]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Drill-down Levels */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    Niveles de drill-down
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    Selecciona qué niveles mostrar al expandir
                                </p>
                                <div className="space-y-1">
                                    {(Object.keys(ROOT_TYPE_LABELS) as RootType[]).map((type) => {
                                        const isRootType = type === rootType;
                                        const isEnabled = enabledLevels.has(type);
                                        return (
                                            <label
                                                key={type}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                                    isRootType
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 cursor-not-allowed'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isEnabled}
                                                    disabled={isRootType}
                                                    onChange={() => toggleLevel(type)}
                                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                                />
                                                <span className="text-sm">{ROOT_TYPE_ICONS[type]}</span>
                                                <span className={`text-sm ${
                                                    isRootType
                                                        ? 'text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                }`}>
                                                    {ROOT_TYPE_LABELS[type]}
                                                    {isRootType && <span className="text-xs ml-1">(raíz)</span>}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Type Filter */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Filtrar por tipo
                                    </h3>
                                    {typeFilters.size > 0 && (
                                        <button
                                            onClick={clearTypeFilters}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    {typeFilters.size === 0 ? 'Todos los tipos' : `${typeFilters.size} seleccionado${typeFilters.size > 1 ? 's' : ''}`}
                                </p>
                                <div className="space-y-1">
                                    {availableTypes.map((t) => (
                                        <label
                                            key={t.value}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={typeFilters.has(t.value)}
                                                onChange={() => toggleTypeFilter(t.value)}
                                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className={`flex-1 text-sm ${
                                                typeFilters.has(t.value)
                                                    ? 'text-gray-900 dark:text-white font-medium'
                                                    : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                                {t.label}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {t.count}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                        {error && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        {!showContents ? (
                            /* Tree View */
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                    <h2 className="font-semibold text-gray-900 dark:text-white">
                                        {ROOT_TYPE_ICONS[rootType]} {ROOT_TYPE_LABELS[rootType]}
                                    </h2>
                                </div>
                                <div className="p-2">
                                    {loading && nodes.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                                        </div>
                                    ) : nodes.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            No hay datos para mostrar
                                        </div>
                                    ) : (
                                        nodes.map(node => renderNode(node))
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Contents View */
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setShowContents(false);
                                                setBreadcrumb([]);
                                            }}
                                            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <h2 className="font-semibold text-gray-900 dark:text-white">
                                            Contenidos: {breadcrumb.map(b => b.label).join(' > ')}
                                        </h2>
                                    </div>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {contents.length} resultados
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {loading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
                                        </div>
                                    ) : contents.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            No hay contenidos
                                        </div>
                                    ) : (
                                        contents.map((content) => (
                                            <Link
                                                key={content.id}
                                                href={`/notes/${content.id}`}
                                                className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="text-lg">
                                                        {content.type === 'video' ? '🎬' :
                                                         content.type === 'note' ? '📝' :
                                                         content.type === 'article' ? '📄' : '🔗'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                                            {content.title}
                                                        </h3>
                                                        {content.summary && (
                                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                                {content.summary}
                                                            </p>
                                                        )}
                                                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                                            <span>{content.iab_tier1 || 'Sin categoria'}</span>
                                                            <span>•</span>
                                                            <span>{new Date(content.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
