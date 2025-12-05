'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface DashboardSummary {
  kpis: {
    contents: { total: number; pending: number; failed: number };
    objectives: { active: number; total: number };
    projects: { active: number; total: number };
    mental_models: { active: number };
    notes: { total: number };
    tags: { total: number };
    folders: { total: number };
    usage: { cost_30d: number };
  };
  recent: {
    contents: any[];
    objectives: any[];
    projects: any[];
    mental_models: any[];
    notes: any[];
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

type SidebarCategory = 'overview' | 'contents' | 'objectives' | 'projects' | 'mental_models' | 'notes' | 'tags';

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
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [objectSummary, setObjectSummary] = useState<ObjectSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SidebarCategory>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingObject, setLoadingObject] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // URL Modal state
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

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
    if (!user || objectType === 'overview') {
      setObjectSummary(null);
      return;
    }
    setLoadingObject(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/dashboard/objects/${objectType}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setObjectSummary(data);
      }
    } catch (error) {
      console.error('Error fetching object summary:', error);
    } finally {
      setLoadingObject(false);
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchSummary();
    }
  }, [user, authLoading, fetchSummary]);

  useEffect(() => {
    fetchObjectSummary(selectedCategory);
  }, [selectedCategory, fetchObjectSummary]);

  // Save URL
  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return;
    setSavingUrl(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/content/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ source_url: urlInput.trim() }),
      });
      if (response.ok) {
        setUrlInput('');
        setShowUrlModal(false);
        fetchSummary(); // Refresh
      }
    } catch (error) {
      console.error('Error saving URL:', error);
    } finally {
      setSavingUrl(false);
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

  // KPI Cards data
  const kpiCards = [
    { key: 'contents', label: 'Contenidos', value: kpis?.contents.total || 0, icon: '📄', href: '/explore', color: 'bg-blue-600' },
    { key: 'objectives', label: 'Objetivos', value: kpis?.objectives.active || 0, icon: '🎯', href: '/objectives', color: 'bg-purple-600' },
    { key: 'projects', label: 'Proyectos', value: kpis?.projects.active || 0, icon: '📁', href: '/projects', color: 'bg-green-600' },
    { key: 'mental_models', label: 'M. Mentales', value: kpis?.mental_models.active || 0, icon: '🧠', href: '/mental-models', color: 'bg-pink-600' },
    { key: 'notes', label: 'Notas', value: kpis?.notes.total || 0, icon: '📝', href: '/notes', color: 'bg-yellow-600' },
    { key: 'tags', label: 'Tags', value: kpis?.tags.total || 0, icon: '🏷️', href: '/tags', color: 'bg-orange-600' },
  ];

  // Sidebar navigation
  const sidebarSections: SidebarSection[] = [
    {
      title: 'NAVEGAR',
      items: [
        { key: 'explore', label: 'Explorar', icon: '🔍', href: '/explore' },
        { key: 'taxonomy', label: 'Taxonomia', icon: '🌿', href: '/taxonomy' },
        { key: 'knowledge-graph', label: 'Knowledge Graph', icon: '🕸️', href: '/knowledge-graph' },
        { key: 'chat', label: 'Chat IA', icon: '💬', href: '/chat' },
      ],
    },
    {
      title: 'OBJETOS',
      items: [
        { key: 'contents', label: 'Contenidos', icon: '📄', selectable: true },
        { key: 'objectives', label: 'Objetivos', icon: '🎯', selectable: true },
        { key: 'projects', label: 'Proyectos', icon: '📁', selectable: true },
        { key: 'mental_models', label: 'Modelos Mentales', icon: '🧠', selectable: true },
        { key: 'notes', label: 'Diario', icon: '📝', selectable: true },
        { key: 'tags', label: 'Tags', icon: '🏷️', selectable: true },
      ],
    },
    {
      title: 'ADMINISTRACION',
      items: [
        { key: 'import', label: 'Importar URLs', icon: '📥', href: '/import' },
        { key: 'apple-notes', label: 'Apple Notes', icon: '🍎', href: '/apple-notes' },
        { key: 'quick-save', label: 'Quick Save', icon: '⚡', href: '/quick-save' },
        {
          key: 'processing',
          label: `Cola (${kpis?.contents.pending || 0} pend, ${kpis?.contents.failed || 0} fall)`,
          icon: '⚙️',
          href: '/processing'
        },
        { key: 'usage', label: `Uso API ($${kpis?.usage.cost_30d || 0})`, icon: '📊', href: '/usage' },
      ],
    },
  ];

  // Render overview panel (default)
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

    return (
      <div className="space-y-6">
        {/* Objectives */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              🎯 Objetivos Activos
            </h3>
            <Link href="/objectives" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
              Ver todo →
            </Link>
          </div>
          {summary.recent.objectives.length > 0 ? (
            <div className="space-y-2">
              {summary.recent.objectives.filter(o => o.status === 'active').slice(0, 3).map((obj) => (
                <div key={obj.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay objetivos activos</p>
          )}
        </div>

        {/* Projects */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              📁 Proyectos Activos
            </h3>
            <Link href="/projects" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
              Ver todo →
            </Link>
          </div>
          {summary.recent.projects.filter(p => p.status === 'active').length > 0 ? (
            <div className="space-y-2">
              {summary.recent.projects.filter(p => p.status === 'active').slice(0, 3).map((proj) => (
                <div key={proj.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-lg">{proj.icon || '📁'}</span>
                  <p className="text-white text-sm flex-1 truncate">{proj.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
                    activo
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay proyectos activos</p>
          )}
        </div>

        {/* Mental Models */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              🧠 Modelos Mentales
            </h3>
            <Link href="/mental-models" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
              Ver todo →
            </Link>
          </div>
          {summary.recent.mental_models.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.recent.mental_models.slice(0, 5).map((mm) => (
                <span
                  key={mm.id}
                  className="px-2 py-1 rounded-lg text-sm text-white"
                  style={{ backgroundColor: mm.color || '#8b5cf6' }}
                >
                  {mm.icon} {mm.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay modelos mentales activos</p>
          )}
        </div>

        {/* Recent Contents */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              📄 Contenidos Recientes
            </h3>
            <Link href="/explore" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
              Ver todo →
            </Link>
          </div>
          {summary.recent.contents.length > 0 ? (
            <div className="space-y-2">
              {summary.recent.contents.slice(0, 5).map((content) => (
                <div key={content.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-lg">
                    {content.content_type === 'video' ? '🎬' :
                     content.content_type === 'article' ? '📰' : '📄'}
                  </span>
                  <p className="text-white text-sm flex-1 truncate">{content.title || 'Sin titulo'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay contenidos</p>
          )}
        </div>

        {/* Notes */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              📝 Notas Recientes
            </h3>
            <Link href="/notes" target="_blank" className="text-sm text-indigo-400 hover:text-indigo-300">
              Ver todo →
            </Link>
          </div>
          {summary.recent.notes.length > 0 ? (
            <div className="space-y-2">
              {summary.recent.notes.slice(0, 3).map((note) => (
                <div key={note.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-lg">{note.is_pinned ? '📌' : '📝'}</span>
                  <p className="text-white text-sm flex-1 truncate">{note.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay notas</p>
          )}
        </div>
      </div>
    );
  };

  // Render object-specific panel
  const renderObjectPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    const typeLabels: Record<string, { title: string; href: string }> = {
      contents: { title: 'Contenidos', href: '/explore' },
      objectives: { title: 'Objetivos', href: '/objectives' },
      projects: { title: 'Proyectos', href: '/projects' },
      mental_models: { title: 'Modelos Mentales', href: '/mental-models' },
      notes: { title: 'Notas', href: '/notes' },
      tags: { title: 'Tags', href: '/tags' },
    };

    const info = typeLabels[objectSummary.type] || { title: 'Items', href: '#' };

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

        {/* Active/Pinned section */}
        {(objectSummary.active || objectSummary.pinned || objectSummary.favorites) && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">
              {objectSummary.favorites ? '⭐ Favoritos' :
               objectSummary.pinned ? '📌 Fijados' :
               '✅ Activos'}
            </h3>
            <div className="space-y-2">
              {(objectSummary.active || objectSummary.pinned || objectSummary.favorites || []).slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
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
                </div>
              ))}
              {(objectSummary.active || objectSummary.pinned || objectSummary.favorites || []).length === 0 && (
                <p className="text-gray-500 text-sm">No hay elementos</p>
              )}
            </div>
          </div>
        )}

        {/* Recent section */}
        {objectSummary.recent && (
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">🕐 Recientes</h3>
            <div className="space-y-2">
              {objectSummary.recent.slice(0, 8).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                  <span className="text-lg">{item.icon || '📄'}</span>
                  <p className="text-white text-sm flex-1 truncate">
                    {item.title || item.name || item.tag || 'Sin titulo'}
                  </p>
                </div>
              ))}
              {objectSummary.recent.length === 0 && (
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
                <span
                  key={tag.id}
                  className="px-3 py-1 rounded-full text-sm text-white"
                  style={{ backgroundColor: tag.color || '#6366f1' }}
                >
                  {tag.tag}
                </span>
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUrlModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              + URL
            </button>
            <Link
              href="/notes/new"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              + Nota
            </Link>
            <Link
              href="/chat"
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              💬 Chat
            </Link>
            <button
              onClick={fetchSummary}
              className="text-gray-400 hover:text-white p-2"
              title={lastRefresh ? `Ultimo: ${lastRefresh.toLocaleTimeString()}` : 'Refrescar'}
            >
              🔄
            </button>
          </div>
        </div>
      </header>

      {/* KPI Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <Link
              key={kpi.key}
              href={kpi.href}
              target="_blank"
              className={`${kpi.color} hover:opacity-90 rounded-xl p-4 transition-all cursor-pointer`}
            >
              <div className="text-2xl mb-1">{kpi.icon}</div>
              <div className="text-2xl font-bold text-white">{kpi.value}</div>
              <div className="text-xs text-white/80">{kpi.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-gray-900/50 rounded-xl p-4 sticky top-20">
              {sidebarSections.map((section) => (
                <div key={section.title} className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 mb-2 tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isSelected = item.selectable && selectedCategory === item.key;

                      if (item.href && !item.selectable) {
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                          >
                            <span>{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={item.key}
                          onClick={() => setSelectedCategory(item.key as SidebarCategory)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span className="text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Overview button */}
              <button
                onClick={() => setSelectedCategory('overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mt-4 ${
                  selectedCategory === 'overview'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>🏠</span>
                <span className="text-sm">Vista General</span>
              </button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 min-w-0">
            <div className="bg-gray-900/30 rounded-xl p-6">
              {selectedCategory === 'overview' ? renderOverviewPanel() : renderObjectPanel()}
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
    </div>
  );
}
