'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamic import for react-force-graph-2d (SSR issues)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div></div>
});

interface GraphNode {
    id: string;
    label: string;
    type: 'person' | 'organization' | 'product' | 'concept';
    count: number;
    contents: string[];
}

interface GraphEdge {
    source: string;
    target: string;
    weight: number;
    contents: string[];
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    content_titles: Record<string, string>;
    stats: {
        total_nodes: number;
        total_edges: number;
        node_types: {
            persons: number;
            organizations: number;
            products: number;
            concepts: number;
        };
    };
}

interface GraphFilters {
    include_persons: boolean;
    include_organizations: boolean;
    include_products: boolean;
    include_concepts: boolean;
    min_connections: number;
}

const NODE_COLORS: Record<string, string> = {
    person: '#3B82F6',      // blue
    organization: '#10B981', // green
    product: '#F59E0B',     // yellow
    concept: '#8B5CF6',     // purple
};

const NODE_TYPE_LABELS: Record<string, string> = {
    person: 'Persona',
    organization: 'Organizacion',
    product: 'Producto',
    concept: 'Concepto',
};

export default function KnowledgeGraphPage() {
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [egoMode, setEgoMode] = useState(false);
    const [filteredNodeIds, setFilteredNodeIds] = useState<string[]>([]);
    const graphRef = useRef<any>(null);

    const [filters, setFilters] = useState<GraphFilters>({
        include_persons: true,
        include_organizations: true,
        include_products: true,
        include_concepts: false,
        min_connections: 1,
    });

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
        };
    };

    const fetchGraphData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch('http://localhost:8000/api/v1/search/graph', {
                method: 'POST',
                headers,
                body: JSON.stringify(filters),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Error al cargar el grafo');
            }

            const data = await response.json();
            setGraphData(data);
            setSelectedNode(null);
            setSelectedEdge(null);
            setEgoMode(false);
            setFilteredNodeIds([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [user, filters]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchGraphData();
        }
    }, [user, fetchGraphData]);

    // Filter nodes by search query
    const filteredNodes = useMemo(() => {
        if (!graphData || !searchQuery.trim()) return null;
        const query = searchQuery.toLowerCase();
        return graphData.nodes.filter(n => n.label.toLowerCase().includes(query));
    }, [graphData, searchQuery]);

    // Get connected entities for selected node
    const connectedEntities = useMemo(() => {
        if (!selectedNode || !graphData) return [];
        const connected: GraphNode[] = [];
        graphData.edges.forEach(edge => {
            const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
            const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

            if (sourceId === selectedNode.id) {
                const node = graphData.nodes.find(n => n.id === targetId);
                if (node) connected.push(node);
            } else if (targetId === selectedNode.id) {
                const node = graphData.nodes.find(n => n.id === sourceId);
                if (node) connected.push(node);
            }
        });
        return connected.sort((a, b) => b.count - a.count);
    }, [selectedNode, graphData]);

    // Build ego network for a node
    const buildEgoNetwork = useCallback((nodeId: string): string[] => {
        if (!graphData) return [nodeId];

        const nodeSet = new Set<string>([nodeId]);
        graphData.edges.forEach(edge => {
            const sourceId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
            const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

            if (sourceId === nodeId || targetId === nodeId) {
                nodeSet.add(sourceId);
                nodeSet.add(targetId);
            }
        });
        return Array.from(nodeSet);
    }, [graphData]);

    // Handle node click
    const handleNodeClick = useCallback((node: any) => {
        setSelectedNode(node as GraphNode);
        setSelectedEdge(null);

        if (egoMode) {
            const egoNodes = buildEgoNetwork(node.id);
            setFilteredNodeIds(egoNodes);
        }
    }, [egoMode, buildEgoNetwork]);

    // Handle link click
    const handleLinkClick = useCallback((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        // Find the edge in graphData
        if (graphData) {
            const edge = graphData.edges.find(e => {
                const eSourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
                const eTargetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
                return (eSourceId === sourceId && eTargetId === targetId) ||
                       (eSourceId === targetId && eTargetId === sourceId);
            });
            if (edge) {
                setSelectedEdge(edge);
                setSelectedNode(null);
            }
        }
    }, [graphData]);

    // Handle search result click - activates ego-network mode automatically
    const handleSearchResultClick = useCallback((searchNode: GraphNode) => {
        setSearchQuery('');
        setSelectedEdge(null);

        if (graphData) {
            // Build the ego-network for the selected node
            const egoNodes = buildEgoNetwork(searchNode.id);

            // Activate ego mode and set filtered nodes
            setEgoMode(true);
            setFilteredNodeIds(egoNodes);

            // Find the node in the original data to get contents info
            const originalNode = graphData.nodes.find(n => n.id === searchNode.id);
            setSelectedNode(originalNode || searchNode);
        }
    }, [graphData, buildEgoNetwork]);

    // Toggle ego mode
    const toggleEgoMode = useCallback(() => {
        if (egoMode) {
            // Deactivate ego mode - show all nodes
            setFilteredNodeIds([]);
            setEgoMode(false);
        } else {
            // Activate ego mode
            if (selectedNode) {
                const egoNodes = buildEgoNetwork(selectedNode.id);
                setFilteredNodeIds(egoNodes);
            }
            setEgoMode(true);
        }
    }, [egoMode, selectedNode, buildEgoNetwork]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedNode(null);
        setSelectedEdge(null);
        setFilteredNodeIds([]);
        setEgoMode(false);
    }, []);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    const handleFilterChange = (key: keyof GraphFilters, value: boolean | number) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Convert data for force-graph with ego mode filtering
    const forceGraphData = useMemo(() => {
        if (!graphData) return { nodes: [], links: [] };

        let nodes = graphData.nodes;
        let edges = graphData.edges;

        // If ego mode is active and we have filtered nodes, filter the graph
        if (egoMode && filteredNodeIds.length > 0) {
            const filteredSet = new Set(filteredNodeIds);
            nodes = nodes.filter(n => filteredSet.has(n.id));
            edges = edges.filter(e => {
                const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
                const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
                return filteredSet.has(sourceId) && filteredSet.has(targetId);
            });
        }

        return {
            nodes: nodes.map(n => ({
                ...n,
                val: Math.max(5, n.count * 3),
            })),
            links: edges.map(e => ({
                source: typeof e.source === 'object' ? (e.source as any).id : e.source,
                target: typeof e.target === 'object' ? (e.target as any).id : e.target,
                value: e.weight,
                contents: e.contents,
            })),
        };
    }, [graphData, egoMode, filteredNodeIds]);

    // Custom node rendering to highlight selected node
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = node.label;
        const fontSize = 12 / globalScale;
        const nodeSize = Math.sqrt(node.val) * 2;
        const isSelected = selectedNode?.id === node.id;

        // Draw selection ring if selected
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#1D4ED8';
            ctx.lineWidth = 3 / globalScale;
            ctx.stroke();
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
        ctx.fillStyle = NODE_COLORS[node.type] || '#666';
        ctx.fill();

        // Draw label only when zoomed in enough
        if (globalScale > 0.7) {
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#333';
            ctx.fillText(label, node.x, node.y + nodeSize + 2);
        }
    }, [selectedNode]);

    // Link color - highlight links connected to selected node
    const linkColor = useCallback((link: any) => {
        if (!selectedNode) return 'rgba(150,150,150,0.6)';

        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (sourceId === selectedNode.id || targetId === selectedNode.id) {
            return 'rgba(59, 130, 246, 0.8)'; // blue for connected links
        }
        return 'rgba(150,150,150,0.4)';
    }, [selectedNode]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Graph</h1>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/explore"
                            className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Explorar
                        </Link>
                        <Link
                            href="/chat"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
                        >
                            Chat RAG
                        </Link>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
                        <button
                            onClick={handleSignOut}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            Cerrar sesion
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex">
                {/* Sidebar - Filters and Search */}
                <aside className="w-80 bg-white dark:bg-gray-800 shadow-sm p-4 flex-shrink-0 overflow-y-auto">
                    {/* Search */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Buscar entidad
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Nombre de entidad..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    x
                                </button>
                            )}
                        </div>
                        {/* Search results dropdown */}
                        {filteredNodes && filteredNodes.length > 0 && (
                            <div className="mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredNodes.slice(0, 10).map(node => (
                                    <button
                                        key={node.id}
                                        onClick={() => handleSearchResultClick(node)}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: NODE_COLORS[node.type] }}
                                        />
                                        <span className="text-sm text-gray-900 dark:text-white truncate">{node.label}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">({node.count})</span>
                                    </button>
                                ))}
                                {filteredNodes.length > 10 && (
                                    <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 text-center">
                                        +{filteredNodes.length - 10} mas resultados
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Active filter indicator */}
                    {egoMode && selectedNode && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
                                    />
                                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                        {selectedNode.label}
                                    </span>
                                </div>
                                <button
                                    onClick={clearSelection}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                                >
                                    Quitar filtro
                                </button>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Mostrando ego-network ({filteredNodeIds.length} nodos)
                            </p>
                        </div>
                    )}

                    {/* Ego Mode Toggle */}
                    <div className="mb-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={egoMode}
                                onChange={toggleEgoMode}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Modo ego-network</span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Muestra solo las conexiones del nodo seleccionado
                        </p>
                    </div>

                    <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Filtros por tipo</h2>

                    {/* Entity type filters */}
                    <div className="space-y-3 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.include_persons}
                                onChange={(e) => handleFilterChange('include_persons', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.person }}></span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">Personas</span>
                            {graphData && <span className="text-xs text-gray-400 dark:text-gray-500">({graphData.stats.node_types.persons})</span>}
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.include_organizations}
                                onChange={(e) => handleFilterChange('include_organizations', e.target.checked)}
                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.organization }}></span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">Organizaciones</span>
                            {graphData && <span className="text-xs text-gray-400 dark:text-gray-500">({graphData.stats.node_types.organizations})</span>}
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.include_products}
                                onChange={(e) => handleFilterChange('include_products', e.target.checked)}
                                className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                            />
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.product }}></span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">Productos</span>
                            {graphData && <span className="text-xs text-gray-400 dark:text-gray-500">({graphData.stats.node_types.products})</span>}
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.include_concepts}
                                onChange={(e) => handleFilterChange('include_concepts', e.target.checked)}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.concept }}></span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">Conceptos</span>
                            {graphData && <span className="text-xs text-gray-400 dark:text-gray-500">({graphData.stats.node_types.concepts})</span>}
                        </label>
                    </div>

                    {/* Min connections filter */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Conexiones minimas: {filters.min_connections}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={filters.min_connections}
                            onChange={(e) => handleFilterChange('min_connections', parseInt(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                            <span>1</span>
                            <span>10</span>
                        </div>
                    </div>

                    {/* Stats */}
                    {graphData && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Estadisticas</h3>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                <p>Nodos: {graphData.stats.total_nodes}</p>
                                <p>Conexiones: {graphData.stats.total_edges}</p>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Interacciones</h3>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                            <p>- Click en nodo: ver detalles</p>
                            <p>- Click en linea: ver contenidos compartidos</p>
                            <p>- Arrastra para mover nodos</p>
                            <p>- Scroll para zoom</p>
                        </div>
                    </div>
                </aside>

                {/* Graph container */}
                <main className="flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 z-10">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
                                <p className="text-gray-600 dark:text-gray-400">Cargando grafo...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                                <button
                                    onClick={fetchGraphData}
                                    className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && !error && graphData && graphData.nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-gray-600 dark:text-gray-400 mb-2">No hay entidades para mostrar</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500">Ajusta los filtros o importa mas contenido</p>
                            </div>
                        </div>
                    )}

                    {!loading && !error && forceGraphData.nodes.length > 0 && (
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={forceGraphData}
                            nodeLabel={(node: any) => `${node.label} (${node.count})`}
                            nodeCanvasObject={nodeCanvasObject}
                            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                                const nodeSize = Math.sqrt(node.val) * 2;
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI);
                                ctx.fillStyle = color;
                                ctx.fill();
                            }}
                            linkWidth={(link: any) => Math.min(5, link.value)}
                            linkColor={linkColor}
                            onNodeClick={handleNodeClick}
                            onLinkClick={handleLinkClick}
                            cooldownTicks={100}
                            onEngineStop={() => graphRef.current?.zoomToFit(400)}
                            width={typeof window !== 'undefined' ? window.innerWidth - 320 - (selectedNode || selectedEdge ? 320 : 0) : 800}
                            height={typeof window !== 'undefined' ? window.innerHeight - 64 : 600}
                        />
                    )}
                </main>

                {/* Right panel - Selection details */}
                {(selectedNode || selectedEdge) && graphData && (
                    <aside className="w-80 bg-white dark:bg-gray-800 shadow-sm p-4 flex-shrink-0 overflow-y-auto border-l border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-semibold text-gray-700 dark:text-gray-300">
                                {selectedNode ? 'Entidad seleccionada' : 'Conexion seleccionada'}
                            </h2>
                            <button
                                onClick={clearSelection}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                x
                            </button>
                        </div>

                        {/* Node details */}
                        {selectedNode && (
                            <>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
                                        />
                                        <span className="font-medium text-gray-800 dark:text-white text-lg">{selectedNode.label}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{NODE_TYPE_LABELS[selectedNode.type]}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Apariciones: {selectedNode.count}</p>
                                </div>

                                {/* Contents where this entity appears */}
                                <div className="mb-4">
                                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Contenidos ({selectedNode.contents?.length || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {(selectedNode.contents || []).map((contentId) => (
                                            <Link
                                                key={contentId}
                                                href={`/notes/${contentId}`}
                                                className="block p-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                <p className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                                                    {graphData.content_titles[contentId] || contentId}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Connected entities */}
                                {connectedEntities.length > 0 && (
                                    <div>
                                        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Entidades relacionadas ({connectedEntities.length})
                                        </h3>
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {connectedEntities.slice(0, 20).map((entity) => (
                                                <button
                                                    key={entity.id}
                                                    onClick={() => handleNodeClick(entity)}
                                                    className="w-full text-left p-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: NODE_COLORS[entity.type] }}
                                                    />
                                                    <span className="text-sm text-gray-900 dark:text-white truncate">{entity.label}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">({entity.count})</span>
                                                </button>
                                            ))}
                                            {connectedEntities.length > 20 && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                                                    +{connectedEntities.length - 20} mas
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Edge details */}
                        {selectedEdge && (
                            <>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-gray-600 dark:text-gray-400">Conexion entre:</span>
                                    </div>
                                    <div className="space-y-2">
                                        {(() => {
                                            const sourceId = typeof selectedEdge.source === 'object'
                                                ? (selectedEdge.source as any).id
                                                : selectedEdge.source;
                                            const targetId = typeof selectedEdge.target === 'object'
                                                ? (selectedEdge.target as any).id
                                                : selectedEdge.target;
                                            const sourceNode = graphData.nodes.find(n => n.id === sourceId);
                                            const targetNode = graphData.nodes.find(n => n.id === targetId);

                                            return (
                                                <>
                                                    {sourceNode && (
                                                        <button
                                                            onClick={() => handleNodeClick(sourceNode)}
                                                            className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                                        >
                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: NODE_COLORS[sourceNode.type] }}
                                                            />
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{sourceNode.label}</span>
                                                        </button>
                                                    )}
                                                    {targetNode && (
                                                        <button
                                                            onClick={() => handleNodeClick(targetNode)}
                                                            className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                                        >
                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: NODE_COLORS[targetNode.type] }}
                                                            />
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{targetNode.label}</span>
                                                        </button>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                        Co-apariciones: {selectedEdge.weight}
                                    </p>
                                </div>

                                {/* Shared contents */}
                                <div>
                                    <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Contenidos compartidos ({selectedEdge.contents?.length || 0})
                                    </h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {(selectedEdge.contents || []).map((contentId) => (
                                            <Link
                                                key={contentId}
                                                href={`/notes/${contentId}`}
                                                className="block p-2 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                <p className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                                                    {graphData.content_titles[contentId] || contentId}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </aside>
                )}
            </div>
        </div>
    );
}
