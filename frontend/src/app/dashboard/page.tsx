'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ContentDetailModal, ContentDetail } from '@/components/content-detail-modal';
import { QuickViewPopup } from '@/components/quick-view-popup';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Local storage keys
const KPI_ORDER_KEY = 'dashboard_kpi_order';
const OVERVIEW_ORDER_KEY = 'dashboard_overview_order';

// Default KPI keys order
const DEFAULT_KPI_ORDER = ['contents', 'objectives', 'projects', 'mental_models', 'notes', 'areas', 'habits'];

// Default overview sections order
const DEFAULT_OVERVIEW_ORDER = ['objectives', 'projects', 'mental_models', 'contents', 'notes', 'habits', 'areas'];

// Types
interface DashboardSummary {
  kpis: {
    contents: { total: number; pending: number; failed: number };
    objectives: { active: number; total: number };
    projects: { active: number; total: number };
    mental_models: { active: number };
    notes: { total: number };
    full_notes: { total: number };
    tags: { total: number };
    folders: { total: number };
    usage: { cost_30d: number };
    areas: { active: number };
    habits: { active: number };
  };
  recent: {
    contents: any[];
    objectives: any[];
    projects: any[];
    mental_models: any[];
    notes: any[];
    simple_notes: any[];
    full_notes: any[];
    areas: any[];
    habits: any[];
  };
  habits_today: {
    logs: any[];
    total: number;
    completed: number;
  };
}

interface ObjectSummary {
  type: string;
  recent?: any[];
  active?: any[];
  favorites?: any[];
  pinned?: any[];
  items?: any[];
}

type SidebarCategory = 'overview' | 'contents' | 'objectives' | 'projects' | 'mental_models' | 'notes' | 'tags' | 'areas' | 'habits' | 'daily-journal';

interface SidebarItem {
  key: string;
  label: string;
  icon: string;
  href?: string;
  selectable?: boolean;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export default function DashboardPage() {
  const { user, loading: authLoading, token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [objectSummary, setObjectSummary] = useState<ObjectSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SidebarCategory>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingObject, setLoadingObject] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // URL Modal state
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  // Content Detail Modal state
  const [selectedContent, setSelectedContent] = useState<ContentDetail | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  // Quick actions dropdown
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Drag & Drop state for KPIs
  const [kpiOrder, setKpiOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(KPI_ORDER_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch { return DEFAULT_KPI_ORDER; }
      }
    }
    return DEFAULT_KPI_ORDER;
  });
  const [draggedKpi, setDraggedKpi] = useState<string | null>(null);
  const [dragOverKpi, setDragOverKpi] = useState<string | null>(null);

  // Drag & Drop state for Overview boxes
  const [overviewOrder, setOverviewOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(OVERVIEW_ORDER_KEY);
      if (saved) {
        try { return JSON.parse(saved); } catch { return DEFAULT_OVERVIEW_ORDER; }
      }
    }
    return DEFAULT_OVERVIEW_ORDER;
  });
  const [draggedBox, setDraggedBox] = useState<string | null>(null);
  const [dragOverBox, setDragOverBox] = useState<string | null>(null);

  // Quick View Popup state
  const [quickViewItem, setQuickViewItem] = useState<any>(null);
  const [quickViewType, setQuickViewType] = useState<'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag' | 'habit' | 'area' | 'quick_note' | 'full_note'>('content');
  const [quickViewPosition, setQuickViewPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  // Daily Journal insights state
  const [journalInsights, setJournalInsights] = useState<any>(null);
  const [loadingJournalInsights, setLoadingJournalInsights] = useState(false);
  const [journalHistory, setJournalHistory] = useState<any[]>([]);

  // Handle quick view on item click
  const handleQuickView = (item: any, type: 'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag' | 'habit' | 'area' | 'quick_note' | 'full_note', event?: React.MouseEvent) => {
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setQuickViewPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      });
    }
    setQuickViewItem(item);
    setQuickViewType(type);
  };

  const closeQuickView = () => {
    setQuickViewItem(null);
  };

  // KPI Drag & Drop handlers
  const handleKpiDragStart = (key: string) => {
    setDraggedKpi(key);
  };

  const handleKpiDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedKpi && draggedKpi !== key) {
      setDragOverKpi(key);
    }
  };

  const handleKpiDrop = (key: string) => {
    if (draggedKpi && draggedKpi !== key) {
      const newOrder = [...kpiOrder];
      const draggedIndex = newOrder.indexOf(draggedKpi);
      const targetIndex = newOrder.indexOf(key);
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedKpi);
      setKpiOrder(newOrder);
      localStorage.setItem(KPI_ORDER_KEY, JSON.stringify(newOrder));
    }
    setDraggedKpi(null);
    setDragOverKpi(null);
  };

  const handleKpiDragEnd = () => {
    setDraggedKpi(null);
    setDragOverKpi(null);
  };

  // Overview Box Drag & Drop handlers
  const handleBoxDragStart = (key: string) => {
    setDraggedBox(key);
  };

  const handleBoxDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedBox && draggedBox !== key) {
      setDragOverBox(key);
    }
  };

  const handleBoxDrop = (key: string) => {
    if (draggedBox && draggedBox !== key) {
      const newOrder = [...overviewOrder];
      const draggedIndex = newOrder.indexOf(draggedBox);
      const targetIndex = newOrder.indexOf(key);
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedBox);
      setOverviewOrder(newOrder);
      localStorage.setItem(OVERVIEW_ORDER_KEY, JSON.stringify(newOrder));
    }
    setDraggedBox(null);
    setDragOverBox(null);
  };

  const handleBoxDragEnd = () => {
    setDraggedBox(null);
    setDragOverBox(null);
  };

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  // Fetch main dashboard summary
  const fetchSummary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/dashboard/summary`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        setLastRefresh(new Date());
      } else {
        setError(`Error ${response.status}: ${response.statusText}`);
        console.error('Dashboard API error:', response.status, response.statusText);
      }
    } catch (err) {
      setError('Error de conexion con el servidor');
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  // Fetch object-specific summary
  const fetchObjectSummary = useCallback(async (objectType: string) => {
    if (!user || objectType === 'overview' || objectType === 'daily-journal') {
      setObjectSummary(null);
      return;
    }
    setLoadingObject(true);
    try {
      const url = `${API_URL}/api/v1/dashboard/objects/${objectType}`;
      console.log('Fetching object summary:', url);
      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Object summary data:', data);
        setObjectSummary(data);
      } else {
        console.error('Object summary error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching object summary:', error);
    } finally {
      setLoadingObject(false);
    }
  }, [user, getAuthHeaders]);

  // Fetch journal insights when daily-journal is selected
  const fetchJournalInsights = useCallback(async () => {
    if (!user) return;
    setLoadingJournalInsights(true);
    try {
      const [insightsRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/daily-journal/stats/insights?days=30`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_URL}/api/v1/daily-journal/?limit=7`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setJournalInsights(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setJournalHistory(data);
      }
    } catch (error) {
      console.error('Error fetching journal insights:', error);
    } finally {
      setLoadingJournalInsights(false);
    }
  }, [user, getAuthHeaders]);

  // Safety timeout - if auth takes too long, stop showing loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.warn('Auth loading timeout - forcing state');
        setLoading(false);
      }
    }, 5000); // 5 second timeout
    return () => clearTimeout(timeout);
  }, [authLoading]);

  useEffect(() => {
    if (user && !authLoading && !hasFetched) {
      fetchSummary();
      setHasFetched(true);
    }
    // If no user and auth is done, stop loading
    if (!user && !authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, hasFetched, fetchSummary]);

  useEffect(() => {
    fetchObjectSummary(selectedCategory);
  }, [selectedCategory, fetchObjectSummary]);

  // Fetch journal insights when selecting daily-journal
  useEffect(() => {
    if (selectedCategory === 'daily-journal') {
      fetchJournalInsights();
    }
  }, [selectedCategory, fetchJournalInsights]);

  // Save URL
  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    setSavingUrl(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/content/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (response.ok) {
        setUrlInput('');
        setShowUrlModal(false);
        fetchSummary(); // Refresh
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error saving URL:', response.status, errorData);
        alert(errorData.detail || 'Error al guardar la URL');
      }
    } catch (error) {
      console.error('Error saving URL:', error);
      alert('Error de conexión');
    } finally {
      setSavingUrl(false);
    }
  };

  // Fetch content detail for modal
  const handleContentClick = async (contentId: string) => {
    setLoadingContent(true);
    setShowContentModal(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/content/${contentId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedContent(data);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-white mb-4">Inicia sesion para acceder</h2>
          <Link href="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
            Iniciar Sesion
          </Link>
        </div>
      </div>
    );
  }

  const kpis = summary?.kpis;

  // KPI Cards data - professional blue gradient
  const kpiCards = [
    { key: 'contents', label: 'Contenidos', value: kpis?.contents.total || 0, icon: '📄', href: '/explore', color: 'bg-blue-900' },
    { key: 'objectives', label: 'Objetivos', value: kpis?.objectives.active || 0, icon: '🎯', href: '/objectives', color: 'bg-blue-800' },
    { key: 'projects', label: 'Proyectos', value: kpis?.projects.active || 0, icon: '📁', href: '/projects', color: 'bg-blue-700' },
    { key: 'mental_models', label: 'M. Mentales', value: kpis?.mental_models.active || 0, icon: '🧠', href: '/mental-models', color: 'bg-blue-600' },
    { key: 'notes', label: 'Notas', value: (kpis?.notes.total || 0) + (kpis?.full_notes?.total || 0), icon: '📝', href: '/notes', color: 'bg-blue-500' },
    { key: 'areas', label: 'Areas', value: kpis?.areas?.active || 0, icon: '📋', href: '/areas', color: 'bg-blue-400' },
    { key: 'habits', label: 'Habitos', value: kpis?.habits?.active || 0, icon: '✅', href: '/habits', color: 'bg-blue-300' },
  ];

  // Sidebar navigation
  const sidebarSections: SidebarSection[] = [
    {
      title: 'NAVEGAR',
      items: [
        { key: 'explore', label: 'Explorar', icon: '🔍', href: '/explore' },
        { key: 'taxonomy', label: 'Taxonomia', icon: '🌿', href: '/taxonomy' },
        { key: 'experts', label: 'Mis Gurus', icon: '👤', href: '/experts' },
        { key: 'knowledge-graph', label: 'Knowledge Graph', icon: '🕸️', href: '/knowledge-graph' },
        { key: 'chat', label: 'Chat IA', icon: '💬', href: '/chat' },
      ],
    },
    {
      title: 'VIDA',
      items: [
        { key: 'daily-journal', label: 'Mi Diario', icon: '📓', selectable: true },
        { key: 'areas', label: 'Areas de Responsabilidad', icon: '📋', selectable: true },
        { key: 'habits', label: 'Habitos', icon: '✅', selectable: true },
      ],
    },
    {
      title: 'OBJETOS',
      items: [
        { key: 'contents', label: 'Contenidos', icon: '📄', selectable: true },
        { key: 'objectives', label: 'Objetivos', icon: '🎯', selectable: true },
        { key: 'projects', label: 'Proyectos', icon: '📁', selectable: true },
        { key: 'mental_models', label: 'Modelos Mentales', icon: '🧠', selectable: true },
        { key: 'notes', label: 'Notas', icon: '📝', selectable: true },
      ],
    },
    {
      title: 'ADMINISTRACION',
      items: [
        { key: 'import', label: 'Importar URLs', icon: '📥', href: '/import' },
        { key: 'apple-notes', label: 'Apple Notes', icon: '🍎', href: '/import-apple-notes' },
        { key: 'quick-save', label: 'Quick Save', icon: '⚡', href: '/quick-save' },
        { key: 'tags', label: 'Tags', icon: '🏷️', selectable: true },
        {
          key: 'processing',
          label: `Cola (${kpis?.contents.pending || 0} pend, ${kpis?.contents.failed || 0} fall)`,
          icon: '⚙️',
          href: '/processing'
        },
        { key: 'usage', label: `Uso API ($${kpis?.usage.cost_30d || 0})`, icon: '📊', href: '/usage' },
        { key: 'guide', label: 'Guía de Uso', icon: '📖', href: '/guide' },
      ],
    },
  ];

  // Render overview panel (default) with draggable boxes
  const renderOverviewPanel = () => {
    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={fetchSummary}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Reintentar
          </button>
        </div>
      );
    }

    if (!summary) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400">Cargando resumen...</p>
          <button
            onClick={fetchSummary}
            className="mt-4 text-indigo-400 hover:text-indigo-300"
          >
            Reintentar
          </button>
        </div>
      );
    }

    // Define box renderers
    const boxRenderers: Record<string, () => React.ReactNode> = {
      objectives: () => (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 🎯 Objetivos Activos
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/objectives?create=true" target="_blank" className="text-lg text-gray-400 hover:text-indigo-400" title="Crear objetivo">+</Link>
              <Link href="/objectives" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.recent.objectives.length > 0 ? (
            <div className="space-y-2">
              {summary.recent.objectives.filter(o => o.status === 'active').slice(0, 3).map((obj) => (
                <button
                  key={obj.id}
                  onClick={(e) => handleQuickView(obj, 'objective', e)}
                  className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left"
                >
                  <span className="text-lg">{obj.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{obj.title}</p>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${obj.progress}%`, backgroundColor: obj.color }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{obj.progress}%</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay objetivos activos</p>
          )}
        </div>
      ),
      projects: () => (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 📁 Proyectos Activos
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/projects?create=true" target="_blank" className="text-lg text-gray-400 hover:text-indigo-400" title="Crear proyecto">+</Link>
              <Link href="/projects" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.recent.projects.filter(p => p.status === 'active').length > 0 ? (
            <div className="space-y-2">
              {summary.recent.projects.filter(p => p.status === 'active').slice(0, 3).map((proj) => (
                <button
                  key={proj.id}
                  onClick={(e) => handleQuickView(proj, 'project', e)}
                  className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left"
                >
                  <span className="text-lg">{proj.icon || '📁'}</span>
                  <p className="text-white text-sm flex-1 truncate">{proj.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
                    activo
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay proyectos activos</p>
          )}
        </div>
      ),
      mental_models: () => (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 🧠 Modelos Mentales
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/mental-models?create=true" target="_blank" className="text-lg text-gray-400 hover:text-indigo-400" title="Crear modelo mental">+</Link>
              <Link href="/mental-models" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.recent.mental_models.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.recent.mental_models.slice(0, 5).map((mm) => (
                <button
                  key={mm.id}
                  onClick={(e) => handleQuickView(mm, 'mental_model', e)}
                  className="px-2 py-1 rounded-lg text-sm text-white hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ backgroundColor: mm.color || '#8b5cf6' }}
                >
                  {mm.icon} {mm.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay modelos mentales activos</p>
          )}
        </div>
      ),
      contents: () => (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 📄 Contenidos Recientes
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowUrlModal(true)} className="text-lg text-gray-400 hover:text-indigo-400" title="Guardar URL">+</button>
              <Link href="/explore" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.recent.contents.length > 0 ? (
            <div className="space-y-2">
              {summary.recent.contents.slice(0, 5).map((content) => (
                <button
                  key={content.id}
                  onClick={(e) => handleQuickView(content, 'content', e)}
                  className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left"
                >
                  <span className="text-lg">
                    {content.type === 'youtube' || content.type === 'video' ? '🎬' :
                     content.type === 'tiktok' ? '📱' : content.type === 'twitter' ? '🐦' : '📄'}
                  </span>
                  <p className="text-white text-sm flex-1 truncate">{content.title || 'Sin titulo'}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay contenidos</p>
          )}
        </div>
      ),
      notes: () => (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 📝 Notas Recientes
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/notes?new=true" target="_blank" className="text-lg text-gray-400 hover:text-indigo-400" title="Nueva nota">+</Link>
              <Link href="/notes" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Simple Notes - Left Column */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-sm font-medium">📝 Quick Notes</span>
                  <Link href="/notes?new=true" target="_blank" className="text-xs text-gray-400 hover:text-amber-400">+</Link>
                </div>
                <Link href="/notes" target="_blank" className="text-xs text-amber-400 hover:text-amber-300">ver →</Link>
              </div>
              {(summary.recent.simple_notes || []).length > 0 ? (
                <div className="space-y-1.5">
                  {(summary.recent.simple_notes || []).slice(0, 4).map((note: any) => (
                    <button
                      key={note.id}
                      onClick={(e) => handleQuickView({...note, is_standalone: true}, 'quick_note', e)}
                      className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left group"
                    >
                      <span className="text-sm">{note.is_pinned ? '📌' : '📝'}</span>
                      <p className="text-white text-xs flex-1 truncate group-hover:text-amber-300">{note.title}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">No hay quick notes</p>
              )}
            </div>
            {/* Full Notes - Right Column */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400 text-sm font-medium">📄 Full Notes</span>
                  <Link href="/notes/new" target="_blank" className="text-xs text-gray-400 hover:text-indigo-400">+</Link>
                </div>
                <Link href="/full-notes" target="_blank" className="text-xs text-indigo-400 hover:text-indigo-300">ver →</Link>
              </div>
              {(summary.recent.full_notes || []).length > 0 ? (
                <div className="space-y-1.5">
                  {(summary.recent.full_notes || []).slice(0, 4).map((note: any) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}/edit`}
                      target="_blank"
                      className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left group"
                    >
                      <span className="text-sm">{note.is_pinned ? '📌' : '📄'}</span>
                      <p className="text-white text-xs flex-1 truncate group-hover:text-indigo-300">{note.title}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">No hay full notes</p>
              )}
            </div>
          </div>
        </div>
      ),
      habits: () => (
        <div className="bg-gradient-to-br from-emerald-900/50 to-green-900/30 rounded-xl p-4 border border-emerald-800/30">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> ✅ Habitos de Hoy
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/habits?create=true" target="_blank" className="text-lg text-gray-400 hover:text-emerald-400" title="Crear habito">+</Link>
              <Link href="/habits" target="_blank" className="text-sm text-emerald-400 hover:text-emerald-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.habits_today && summary.habits_today.total > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-gray-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all"
                    style={{ width: `${Math.round((summary.habits_today.completed / summary.habits_today.total) * 100)}%` }}
                  />
                </div>
                <span className="text-emerald-400 font-bold text-sm">
                  {summary.habits_today.completed}/{summary.habits_today.total}
                </span>
              </div>
              {summary.recent.habits.length > 0 && (
                <div className="space-y-2">
                  {summary.recent.habits.slice(0, 3).map((habit) => {
                    const isCompleted = summary.habits_today.logs.some(
                      (l: any) => l.habit_id === habit.id && l.status === 'completed'
                    );
                    return (
                      <button
                        key={habit.id}
                        onClick={(e) => handleQuickView({...habit, completed_today: isCompleted}, 'habit', e)}
                        className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left"
                      >
                        <span className={`text-lg ${isCompleted ? 'opacity-50' : ''}`}>
                          {isCompleted ? '✅' : habit.icon || '⭕'}
                        </span>
                        <p className={`text-sm flex-1 truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>
                          {habit.name}
                        </p>
                        {isCompleted && (
                          <span className="text-xs text-emerald-400">Completado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 text-sm">No hay habitos activos</p>
          )}
        </div>
      ),
      areas: () => (
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/30 rounded-xl p-4 border border-indigo-800/30">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <span className="cursor-grab">⋮⋮</span> 📋 Areas de Responsabilidad
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/areas?create=true" target="_blank" className="text-lg text-gray-400 hover:text-indigo-400" title="Crear area">+</Link>
              <Link href="/areas" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
                Ver todo →
              </Link>
            </div>
          </div>
          {summary.recent.areas && summary.recent.areas.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {summary.recent.areas.slice(0, 6).map((area) => (
                <button
                  key={area.id}
                  onClick={(e) => handleQuickView(area, 'area', e)}
                  className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
                  style={{ borderLeft: `3px solid ${area.color || '#6366f1'}` }}
                >
                  <span className="text-lg">{area.icon || '📋'}</span>
                  <p className="text-white text-sm truncate">{area.name}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-2">No hay areas definidas</p>
              <Link
                href="/areas"
                target="_blank"
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                + Crear primera area
              </Link>
            </div>
          )}
        </div>
      ),
    };

    return (
      <div className="space-y-4">
        {overviewOrder.map((boxKey) => {
          const renderer = boxRenderers[boxKey];
          if (!renderer) return null;
          return (
            <div
              key={boxKey}
              draggable
              onDragStart={() => handleBoxDragStart(boxKey)}
              onDragOver={(e) => handleBoxDragOver(e, boxKey)}
              onDrop={() => handleBoxDrop(boxKey)}
              onDragEnd={handleBoxDragEnd}
              className={`transition-all ${draggedBox === boxKey ? 'opacity-50 scale-[0.98]' : ''} ${dragOverBox === boxKey ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-950' : ''}`}
            >
              {renderer()}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to get item URL
  const getItemUrl = (type: string, item: any): string => {
    switch (type) {
      case 'contents': return `/content/${item.id}`;
      case 'objectives': return `/objectives?id=${item.id}`;
      case 'projects': return `/projects?id=${item.id}`;
      case 'mental_models': return `/mental-models?id=${item.id}`;
      case 'notes': return `/notes/${item.id}`;
      case 'tags': return `/tags?tag=${item.tag}`;
      case 'areas': return `/areas/${item.id}`;
      case 'habits': return `/habits/${item.id}`;
      default: return '#';
    }
  };

  // Render notes panel with stats by type
  const renderNotesPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    const notesSummary = objectSummary as any;
    const stats = notesSummary.stats || { total: 0, by_type: {} };
    const noteTypes = notesSummary.note_types || [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Notas</h2>
          <Link
            href="/notes"
            target="_blank"
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Ver todo →
          </Link>
        </div>

        {/* Stats by type */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">📊 Resumen</h3>
            <span className="text-2xl font-bold text-white">{stats.total} notas</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {noteTypes.map((noteType: any) => {
              const count = stats.by_type?.[noteType.value] || 0;
              // Each type opens /notes with filter param
              const href = `/notes?type=${noteType.value}`;
              return (
                <Link
                  key={noteType.value}
                  href={href}
                  target="_blank"
                  className="bg-gray-900/50 hover:bg-gray-800 rounded-lg p-3 transition-colors cursor-pointer text-center"
                >
                  <div className="text-2xl mb-1">{noteType.icon}</div>
                  <div className="text-xl font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-400">{noteType.label}</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Pinned */}
        {notesSummary.pinned && notesSummary.pinned.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">📌 Fijadas</h3>
            <div className="space-y-2">
              {notesSummary.pinned.slice(0, 5).map((note: any) => {
                const noteTypeInfo = noteTypes.find((t: any) => t.value === note.note_type) || { icon: '📝', label: 'Nota' };
                return (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <span className="text-lg">{noteTypeInfo.icon}</span>
                    <p className="text-white text-sm flex-1 truncate">{note.title}</p>
                    <span className="text-xs text-gray-500">{noteTypeInfo.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent */}
        {notesSummary.recent && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">🕐 Recientes</h3>
            <div className="space-y-2">
              {notesSummary.recent.length > 0 ? (
                notesSummary.recent.slice(0, 8).map((note: any) => {
                  const noteTypeInfo = noteTypes.find((t: any) => t.value === note.note_type) || { icon: '📝', label: 'Nota' };
                  const isFullNote = note.is_full_note || note.note_type === 'full_note';
                  const href = isFullNote ? `/dashboard?content=${note.id}` : `/notes/${note.id}`;
                  return (
                    <Link
                      key={note.id}
                      href={href}
                      className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-lg">{noteTypeInfo.icon}</span>
                      <p className="text-white text-sm flex-1 truncate">{note.title}</p>
                      <span className="text-xs text-gray-500">{noteTypeInfo.label}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="text-gray-500 text-sm">No hay notas recientes</p>
              )}
            </div>
          </div>
        )}

        {/* Quick create */}
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/notes?new=true"
            target="_blank"
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium shadow-md"
          >
            📝 Quick Note
          </Link>
          <Link
            href="/notes/new"
            target="_blank"
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium shadow-md"
          >
            📄 Full Note
          </Link>
          <Link
            href="/full-notes"
            target="_blank"
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium shadow-md"
          >
            📄 Ver Full Notes
          </Link>
        </div>
      </div>
    );
  };

  // Helper to get type icon for content
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': case 'video': return '🎬';
      case 'tiktok': return '📱';
      case 'twitter': return '🐦';
      case 'note': case 'apple_notes': return '📝';
      default: return '📄';
    }
  };

  // Render objectives panel with cards similar to areas
  const renderObjectivesPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    // Separate favorites from active
    const favorites = (objectSummary.favorites ?? []).filter((o: any) => o.status === 'active');
    const favoriteIds = new Set(favorites.map((o: any) => o.id));
    const nonFavoriteActive = (objectSummary.active ?? []).filter((o: any) => !favoriteIds.has(o.id));

    const renderObjectiveCard = (obj: any, isFavorite: boolean = false) => (
      <Link
        key={obj.id}
        href={`/objectives?id=${obj.id}`}
        target="_blank"
        className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-700/50 transition-colors"
        style={{ borderLeft: `4px solid ${obj.color || '#6366f1'}` }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{obj.icon || '🎯'}</span>
          <div className="flex-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              {obj.title}
              {isFavorite && <span className="text-yellow-400">⭐</span>}
            </h3>
            {obj.description && (
              <p className="text-gray-400 text-xs line-clamp-1">{obj.description}</p>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Progreso</span>
            <span className="text-xs font-bold" style={{ color: obj.color || '#6366f1' }}>
              {obj.progress || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${obj.progress || 0}%`,
                backgroundColor: obj.color || '#6366f1'
              }}
            />
          </div>
          {obj.target_date && (
            <div className="text-xs text-gray-500 mt-2">
              Meta: {new Date(obj.target_date).toLocaleDateString()}
            </div>
          )}
        </div>
      </Link>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Objetivos</h2>
          <Link href="/objectives" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Favoritos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((obj: any) => renderObjectiveCard(obj, true))}
            </div>
          </div>
        )}

        {/* Active objectives (non-favorites) */}
        {nonFavoriteActive.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">🎯 Activos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nonFavoriteActive.map((obj: any) => renderObjectiveCard(obj, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && nonFavoriteActive.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay objetivos activos</p>
            <Link
              href="/objectives?create=true"
              target="_blank"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              + Crear Objetivo
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render projects panel with linked contents
  const renderProjectsPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    // Separate favorites from active
    const favorites = (objectSummary.favorites ?? []).filter((p: any) => p.status === 'active');
    const favoriteIds = new Set(favorites.map((p: any) => p.id));
    const nonFavoriteActive = (objectSummary.active ?? []).filter((p: any) => !favoriteIds.has(p.id));

    const renderProjectCard = (project: any, isFavorite: boolean = false) => (
      <Link
        key={project.id}
        href={`/projects?id=${project.id}`}
        target="_blank"
        className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-700/50 transition-colors"
        style={{ borderLeft: `4px solid ${project.color || '#3b82f6'}` }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{project.icon || '📁'}</span>
          <div className="flex-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              {project.name}
              {isFavorite && <span className="text-yellow-400">⭐</span>}
            </h3>
            {project.description && (
              <p className="text-gray-400 text-xs line-clamp-1">{project.description}</p>
            )}
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
            activo
          </span>
        </div>

        {/* Footer with stats */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          {project.linked_contents && project.linked_contents.length > 0 ? (
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>📄 {project.linked_contents.length} contenido{project.linked_contents.length !== 1 ? 's' : ''}</span>
              {project.area_name && (
                <span>📋 {project.area_name}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>📄 Sin contenidos</span>
              {project.area_name && (
                <span>📋 {project.area_name}</span>
              )}
            </div>
          )}
        </div>
      </Link>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Proyectos</h2>
          <Link href="/projects" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Favoritos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((project: any) => renderProjectCard(project, true))}
            </div>
          </div>
        )}

        {/* Active projects (non-favorites) */}
        {nonFavoriteActive.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">📁 Activos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nonFavoriteActive.map((project: any) => renderProjectCard(project, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && nonFavoriteActive.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay proyectos activos</p>
            <Link
              href="/projects?create=true"
              target="_blank"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              + Crear Proyecto
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render mental models panel with linked contents
  const renderMentalModelsPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    // Separate favorites from active
    const favorites = objectSummary.favorites ?? [];
    const favoriteIds = new Set(favorites.map((m: any) => m.id));
    const nonFavoriteActive = (objectSummary.active ?? []).filter((m: any) => !favoriteIds.has(m.id));

    const renderModelCard = (model: any, isFavorite: boolean = false) => (
      <div key={model.id} className="bg-gray-800/50 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{model.icon || '🧠'}</span>
          <div className="flex-1">
            <Link
              href={`/mental-models?id=${model.id}`}
              target="_blank"
              className="text-white font-medium hover:text-emerald-400 flex items-center gap-2"
            >
              {model.name}
              {isFavorite && <span className="text-yellow-400">⭐</span>}
            </Link>
          </div>
        </div>
        {model.description && (
          <p className="text-gray-400 text-xs mb-2 line-clamp-2">{model.description}</p>
        )}

        {/* Linked contents */}
        {model.linked_contents && model.linked_contents.length > 0 ? (
          <div className="border-t border-gray-700 pt-2 mt-2">
            <p className="text-xs text-gray-500 mb-1">Aplicado a:</p>
            <div className="space-y-1">
              {model.linked_contents.slice(0, 2).map((content: any) => (
                <button
                  key={content.id}
                  onClick={() => handleContentClick(content.id)}
                  className="flex items-center gap-2 p-1 bg-gray-900/50 rounded hover:bg-gray-800 transition-colors w-full text-left"
                >
                  <span className="text-xs">{getContentTypeIcon(content.type)}</span>
                  <span className="text-gray-300 text-xs flex-1 truncate">{content.title || 'Sin título'}</span>
                </button>
              ))}
              {model.linked_contents.length > 2 && (
                <span className="text-xs text-emerald-400">
                  +{model.linked_contents.length - 2} más
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-xs mt-2 border-t border-gray-700 pt-2">
            Sin contenidos aplicados
          </p>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Modelos Mentales</h2>
          <Link href="/mental-models" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Favoritos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((model: any) => renderModelCard(model, true))}
            </div>
          </div>
        )}

        {/* Active mental models (non-favorites) */}
        {nonFavoriteActive.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">🧠 Activos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nonFavoriteActive.map((model: any) => renderModelCard(model, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && nonFavoriteActive.length === 0 && (
          <p className="text-gray-500 text-center py-8">No hay modelos mentales activos</p>
        )}
      </div>
    );
  };

  // Render areas panel
  const renderAreasPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    // Separate favorites from active
    const favorites = objectSummary.favorites ?? [];
    const favoriteIds = new Set(favorites.map((a: any) => a.id));
    const nonFavoriteActive = (objectSummary.active ?? []).filter((a: any) => !favoriteIds.has(a.id));

    const renderAreaCard = (area: any, isFavorite: boolean = false) => (
      <Link
        key={area.id}
        href={`/areas/${area.id}`}
        className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-700/50 transition-colors"
        style={{ borderLeft: `4px solid ${area.color || '#6366f1'}` }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{area.icon || '📋'}</span>
          <div className="flex-1">
            <h3 className="text-white font-medium flex items-center gap-2">
              {area.name}
              {isFavorite && <span className="text-yellow-400">⭐</span>}
            </h3>
            {area.description && (
              <p className="text-gray-400 text-xs line-clamp-1">{area.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
          <span>🎯 {area.objectives_count || 0} objetivos</span>
          <span>📁 {area.projects_count || 0} proyectos</span>
          <span>✅ {area.habits_count || 0} habitos</span>
        </div>
      </Link>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Areas de Responsabilidad</h2>
          <Link href="/areas" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Favorites section */}
        {favorites.length > 0 && (
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Favoritos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((area: any) => renderAreaCard(area, true))}
            </div>
          </div>
        )}

        {/* Active areas (non-favorites) */}
        {nonFavoriteActive.length > 0 && (
          <div>
            <h3 className="text-white font-medium mb-3">📋 Activas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nonFavoriteActive.map((area: any) => renderAreaCard(area, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && nonFavoriteActive.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay areas de responsabilidad activas</p>
            <Link
              href="/areas"
              target="_blank"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              + Crear Area
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render habits panel
  const renderHabitsPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    const stats = (objectSummary as any).stats || { total_active: 0, completed_today: 0, completion_rate: 0 };

    // Separate favorites from active
    const favorites = objectSummary.favorites ?? [];
    const favoriteIds = new Set(favorites.map((h: any) => h.id));
    const nonFavoriteActive = (objectSummary.active ?? []).filter((h: any) => !favoriteIds.has(h.id));

    const renderHabitCard = (habit: any, isFavorite: boolean = false) => (
      <Link
        key={habit.id}
        href={`/habits/${habit.id}`}
        className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors"
      >
        <span className={`text-xl ${habit.completed_today ? 'opacity-50' : ''}`}>
          {habit.completed_today ? '✅' : habit.icon || '⭕'}
        </span>
        <div className="flex-1">
          <p className={`text-sm flex items-center gap-2 ${habit.completed_today ? 'text-gray-500 line-through' : 'text-white'}`}>
            {habit.name}
            {isFavorite && <span className="text-yellow-400">⭐</span>}
          </p>
          <p className="text-xs text-gray-500">
            {habit.frequency_type === 'daily' ? 'Diario' :
             habit.frequency_type === 'weekly' ? 'Semanal' : 'Personalizado'}
          </p>
        </div>
        {habit.completed_today ? (
          <span className="text-xs text-emerald-400 px-2 py-1 bg-emerald-900/30 rounded">
            Completado
          </span>
        ) : (
          <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-900/30 rounded">
            Pendiente
          </span>
        )}
      </Link>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Habitos</h2>
          <Link href="/habits" target="_blank" className="text-emerald-400 hover:text-emerald-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-emerald-900/30 rounded-xl p-4 text-center border border-emerald-800/30">
            <div className="text-3xl font-bold text-emerald-400">{stats.total_active}</div>
            <div className="text-xs text-gray-400">Habitos Activos</div>
          </div>
          <div className="bg-emerald-900/30 rounded-xl p-4 text-center border border-emerald-800/30">
            <div className="text-3xl font-bold text-emerald-400">{stats.completed_today}</div>
            <div className="text-xs text-gray-400">Completados Hoy</div>
          </div>
          <div className="bg-emerald-900/30 rounded-xl p-4 text-center border border-emerald-800/30">
            <div className="text-3xl font-bold text-emerald-400">{stats.completion_rate}%</div>
            <div className="text-xs text-gray-400">Tasa de Hoy</div>
          </div>
        </div>

        {/* Today's progress bar */}
        {stats.total_active > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">Progreso de Hoy</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-700 rounded-full h-4">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all"
                  style={{ width: `${stats.completion_rate}%` }}
                />
              </div>
              <span className="text-emerald-400 font-bold">
                {stats.completed_today}/{stats.total_active}
              </span>
            </div>
          </div>
        )}

        {/* Favorite habits first */}
        {favorites.length > 0 && (
          <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="text-yellow-400">⭐</span> Favoritos
            </h3>
            <div className="space-y-2">
              {favorites.map((habit: any) => renderHabitCard(habit, true))}
            </div>
          </div>
        )}

        {/* Active habits (non-favorites) */}
        {nonFavoriteActive.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">✅ Habitos de Hoy</h3>
            <div className="space-y-2">
              {nonFavoriteActive.map((habit: any) => renderHabitCard(habit, false))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {favorites.length === 0 && nonFavoriteActive.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay habitos activos</p>
            <Link
              href="/habits"
              target="_blank"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              + Crear Habito
            </Link>
          </div>
        )}
      </div>
    );
  };

  // Render daily journal insights panel
  const renderDailyJournalPanel = () => {
    if (loadingJournalInsights) {
      return <div className="text-gray-400 text-center py-8">Cargando estadisticas...</div>;
    }

    if (!journalInsights) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No hay datos de diario disponibles</p>
          <Link
            href="/daily-journal"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Ir a Mi Diario
          </Link>
        </div>
      );
    }

    const ins = journalInsights;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📓</span> Mi Diario - Estadisticas
          </h2>
          <Link
            href="/daily-journal"
            className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1"
          >
            Ver diario completo →
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{ins.total_journals}</div>
            <div className="text-xs text-gray-400">Entradas ({ins.period_days}d)</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{ins.average_rating || '-'}/5</div>
            <div className="text-xs text-gray-400">Promedio</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{ins.completion_rate}%</div>
            <div className="text-xs text-gray-400">Completacion</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{ins.big_rock_completion_rate}%</div>
            <div className="text-xs text-gray-400">Big Rocks</div>
          </div>
        </div>

        {/* Routines */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h3 className="text-white font-medium mb-3">Rutinas</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Matutina</span>
                <span className="text-white text-sm">{ins.morning_routine_rate}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${ins.morning_routine_rate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Nocturna</span>
                <span className="text-white text-sm">{ins.evening_routine_rate}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${ins.evening_routine_rate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Best/Worst Days */}
        {(ins.best_day_of_week || ins.worst_day_of_week) && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">Patrones de la Semana</h3>
            <div className="grid grid-cols-2 gap-4">
              {ins.best_day_of_week && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌟</span>
                  <div>
                    <div className="text-green-400 font-medium">{ins.best_day_of_week}</div>
                    <div className="text-xs text-gray-400">Mejor dia</div>
                  </div>
                </div>
              )}
              {ins.worst_day_of_week && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">😔</span>
                  <div>
                    <div className="text-red-400 font-medium">{ins.worst_day_of_week}</div>
                    <div className="text-xs text-gray-400">Dia dificil</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wins & Gratitudes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <span>🏆</span> {ins.total_wins} Logros
            </h3>
            {ins.top_wins_themes?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ins.top_wins_themes.slice(0, 5).map((theme: any, idx: number) => (
                  <span key={idx} className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                    {theme.word}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <span>🙏</span> {ins.total_gratitudes} Gratitudes
            </h3>
            {ins.top_gratitude_themes?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ins.top_gratitude_themes.slice(0, 5).map((theme: any, idx: number) => (
                  <span key={idx} className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded">
                    {theme.word}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent entries */}
        {journalHistory.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">Ultimas Entradas</h3>
            <div className="space-y-2">
              {journalHistory.slice(0, 5).map((entry: any) => (
                <Link
                  key={entry.id}
                  href={`/daily-journal?date=${entry.date}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">{new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    {entry.day_word && <span className="text-white text-sm">{entry.day_word}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.day_rating && (
                      <span className={`text-sm font-medium ${
                        entry.day_rating >= 4 ? 'text-green-400' :
                        entry.day_rating >= 3 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {entry.day_rating}/5
                      </span>
                    )}
                    {entry.is_evening_completed && <span className="text-green-400 text-xs">✓</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render object-specific panel
  const renderObjectPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    // Special handling for specific panels
    if (selectedCategory === 'notes') {
      return renderNotesPanel();
    }
    if (selectedCategory === 'objectives') {
      return renderObjectivesPanel();
    }
    if (selectedCategory === 'projects') {
      return renderProjectsPanel();
    }
    if (selectedCategory === 'mental_models') {
      return renderMentalModelsPanel();
    }
    if (selectedCategory === 'areas') {
      return renderAreasPanel();
    }
    if (selectedCategory === 'habits') {
      return renderHabitsPanel();
    }

    const typeLabels: Record<string, { title: string; href: string }> = {
      contents: { title: 'Contenidos', href: '/explore' },
      objectives: { title: 'Objetivos', href: '/objectives' },
      projects: { title: 'Proyectos', href: '/projects' },
      mental_models: { title: 'Modelos Mentales', href: '/mental-models' },
      notes: { title: 'Notas', href: '/notes' },
      tags: { title: 'Tags', href: '/tags' },
      areas: { title: 'Areas de Responsabilidad', href: '/areas' },
      habits: { title: 'Habitos', href: '/habits' },
    };

    // Use selectedCategory instead of objectSummary.type to ensure correct title
    const info = typeLabels[selectedCategory] || typeLabels[objectSummary.type] || { title: 'Items', href: '#' };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">{info.title}</h2>
          <Link
            href={info.href}
            target="_blank"
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Ver todo →
          </Link>
        </div>

        {/* Active/Pinned/Favorites section - NOT shown for contents */}
        {selectedCategory !== 'contents' && ((objectSummary.active?.length ?? 0) > 0 || (objectSummary.pinned?.length ?? 0) > 0 || (objectSummary.favorites?.length ?? 0) > 0) && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">
              {(objectSummary.favorites?.length ?? 0) > 0 ? '⭐ Favoritos' :
               (objectSummary.pinned?.length ?? 0) > 0 ? '📌 Fijados' :
               '✅ Activos'}
            </h3>
            <div className="space-y-2">
              {(objectSummary.active || objectSummary.pinned || objectSummary.favorites || []).slice(0, 5).map((item: any) => (
                <Link
                  key={item.id}
                  href={getItemUrl(selectedCategory, item)}
                  target="_blank"
                  className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
                >
                  <span className="text-lg">{item.icon || item.color ? '●' : '📄'}</span>
                  <p className="text-white text-sm flex-1 truncate">
                    {item.title || item.name || item.tag || 'Sin titulo'}
                  </p>
                  {item.progress !== undefined && (
                    <span className="text-xs text-gray-400">{item.progress}%</span>
                  )}
                  {item.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === 'active' ? 'bg-green-600/20 text-green-400' :
                      item.status === 'completed' ? 'bg-blue-600/20 text-blue-400' :
                      'bg-gray-600/20 text-gray-400'
                    }`}>
                      {item.status}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent section */}
        {objectSummary.recent && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">🕐 Recientes</h3>
            <div className="space-y-2">
              {objectSummary.recent.length > 0 ? (
                objectSummary.recent.slice(0, selectedCategory === 'contents' ? 10 : 8).map((item: any) => (
                  selectedCategory === 'contents' ? (
                    <button
                      key={item.id}
                      onClick={() => handleContentClick(item.id)}
      
                      className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer w-full text-left"
                    >
                      <span className="text-lg">
                        {item.type === 'youtube' || item.type === 'video' ? '🎬' : item.type === 'tiktok' ? '📱' : item.type === 'twitter' ? '🐦' : item.type === 'note' ? '📝' : '📄'}
                      </span>
                      <p className="text-white text-sm flex-1 truncate">
                        {item.title || 'Sin titulo'}
                      </p>
                    </button>
                  ) : (
                    <Link
                      key={item.id}
                      href={getItemUrl(selectedCategory, item)}
                      target="_blank"
                      className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <span className="text-lg">
                        {item.icon || '📄'}
                      </span>
                      <p className="text-white text-sm flex-1 truncate">
                        {item.title || item.name || item.tag || 'Sin titulo'}
                      </p>
                    </Link>
                  )
                ))
              ) : (
                <p className="text-gray-500 text-sm">No hay elementos recientes</p>
              )}
            </div>
          </div>
        )}

        {/* Tags special case */}
        {objectSummary.items && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">🏷️ Tags definidos</h3>
            <div className="flex flex-wrap gap-2">
              {objectSummary.items.map((tag: any) => (
                <Link
                  key={tag.id}
                  href={`/explore?tag=${encodeURIComponent(tag.tag)}`}
                  target="_blank"
                  className="px-3 py-1 rounded-full text-sm text-white hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ backgroundColor: tag.color || '#6366f1' }}
                >
                  {tag.tag}
                </Link>
              ))}
              {objectSummary.items.length === 0 && (
                <p className="text-gray-500 text-sm">No hay tags definidos</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2">
            {/* Quick Note Button - Amber gradient most intense */}
            <Link
              href="/notes?new=true"
              target="_blank"
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 font-medium shadow-md"
              title="Quick Note"
            >
              📝 Quick Note
            </Link>
            {/* Full Note Button - Amber gradient second */}
            <Link
              href="/notes/new"
              target="_blank"
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 font-medium shadow-md"
              title="Full Note"
            >
              📄 Full Note
            </Link>
            {/* Quick Actions Dropdown - Amber gradient third */}
            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="bg-amber-400 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 font-medium shadow-md"
              >
                + Crear ▾
              </button>
              {showQuickActions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl z-20 py-1 border border-gray-700">
                    <button
                      onClick={() => { setShowUrlModal(true); setShowQuickActions(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      🔗 Guardar URL
                    </button>
                    <Link
                      href="/notes?new=true"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📝 Quick Note
                    </Link>
                    <Link
                      href="/notes/new"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📄 Full Note
                    </Link>
                    <Link
                      href="/objectives?create=true"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      🎯 Nuevo Objetivo
                    </Link>
                    <Link
                      href="/projects?create=true"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📁 Nuevo Proyecto
                    </Link>
                    <Link
                      href="/mental-models?create=true"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      🧠 Nuevo M. Mental
                    </Link>
                    <Link
                      href="/tags?create=true"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      🏷️ Nuevo Tag
                    </Link>
                    <div className="border-t border-gray-700 my-1" />
                    <Link
                      href="/areas"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📋 Nueva Area
                    </Link>
                    <Link
                      href="/habits"
                      target="_blank"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      ✅ Nuevo Habito
                    </Link>
                  </div>
                </>
              )}
            </div>
            {/* Chat Button - Amber gradient lightest */}
            <Link
              href="/chat"
              className="bg-amber-300 hover:bg-amber-400 text-amber-900 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 font-medium shadow-md"
            >
              💬 Chat
            </Link>
            <button
              onClick={() => { setHasFetched(false); fetchSummary(); }}
              className="text-gray-400 hover:text-white p-2"
              title={lastRefresh ? `Ultimo: ${lastRefresh.toLocaleTimeString()}` : 'Refrescar'}
            >
              🔄
            </button>
          </div>
        </div>
      </header>

      {/* KPI Bar - Drag & Drop enabled with dynamic gradient based on position */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-7 gap-2">
          {kpiOrder.map((key, index) => {
            const kpi = kpiCards.find(k => k.key === key);
            if (!kpi) return null;
            // Dynamic color based on position (0=darkest, 6=lightest)
            const positionColors = ['bg-blue-900', 'bg-blue-800', 'bg-blue-700', 'bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'];
            const bgColor = positionColors[index] || 'bg-blue-500';
            return (
              <button
                key={kpi.key}
                draggable
                onDragStart={() => handleKpiDragStart(kpi.key)}
                onDragOver={(e) => handleKpiDragOver(e, kpi.key)}
                onDrop={() => handleKpiDrop(kpi.key)}
                onDragEnd={handleKpiDragEnd}
                onClick={() => setSelectedCategory(kpi.key as SidebarCategory)}
                className={`${bgColor} hover:opacity-90 rounded-xl p-4 transition-all cursor-grab active:cursor-grabbing text-left ${
                  selectedCategory === kpi.key ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
                } ${draggedKpi === kpi.key ? 'opacity-50 scale-95' : ''} ${dragOverKpi === kpi.key ? 'ring-2 ring-amber-400' : ''}`}
              >
                <div className="text-2xl mb-1">{kpi.icon}</div>
                <div className="text-2xl font-bold text-white">{kpi.value}</div>
                <div className="text-xs text-white/80">{kpi.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className={`flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-64'}`}>
            <div className="bg-gray-900/50 rounded-xl p-2 sticky top-20">
              {/* Toggle button */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors mb-2"
                title={sidebarCollapsed ? 'Expandir menu' : 'Colapsar menu'}
              >
                <span className="text-lg">{sidebarCollapsed ? '→' : '←'}</span>
              </button>

              {/* Vista General button - First */}
              <button
                onClick={() => setSelectedCategory('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-4 ${sidebarCollapsed ? 'justify-center' : ''} ${
                  selectedCategory === 'overview'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                title={sidebarCollapsed ? 'Vista General' : undefined}
              >
                <span>🏠</span>
                {!sidebarCollapsed && <span className="text-sm font-medium">Vista General</span>}
              </button>

              {sidebarSections.map((section) => (
                <div key={section.title} className="mb-4">
                  {!sidebarCollapsed && (
                    <h3 className="text-xs font-semibold text-gray-500 mb-2 tracking-wider px-2">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isSelected = item.selectable && selectedCategory === item.key;

                      if (item.href && !item.selectable) {
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            target="_blank"
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <span>{item.icon}</span>
                            {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={item.key}
                          onClick={() => setSelectedCategory(item.key as SidebarCategory)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }`}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <span>{item.icon}</span>
                          {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 min-w-0">
            <div className="bg-gray-900/30 rounded-xl p-6">
              {selectedCategory === 'overview'
                ? renderOverviewPanel()
                : selectedCategory === 'daily-journal'
                  ? renderDailyJournalPanel()
                  : renderObjectPanel()}
            </div>
          </main>
        </div>
      </div>

      {/* URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Guardar URL</h2>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUrlModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUrl}
                disabled={savingUrl || !urlInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {savingUrl ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Detail Modal */}
      <ContentDetailModal
        content={selectedContent}
        isOpen={showContentModal}
        onClose={() => {
          setShowContentModal(false);
          setSelectedContent(null);
        }}
        onUpdate={(updated) => {
          setSelectedContent(updated);
        }}
      />

      {/* Quick View Popup */}
      <QuickViewPopup
        item={quickViewItem}
        type={quickViewType}
        isOpen={!!quickViewItem}
        onClose={closeQuickView}
        position={quickViewPosition}
        onOpenFull={(quickViewType === 'content' || quickViewType === 'full_note') ? () => {
          closeQuickView();
          handleContentClick(quickViewItem?.id);
        } : undefined}
      />
    </div>
  );
}
