'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ContentDetailModal, ContentDetail } from '@/components/content-detail-modal';
import { QuickViewPopup } from '@/components/quick-view-popup';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

type SidebarCategory = 'overview' | 'contents' | 'objectives' | 'projects' | 'mental_models' | 'notes' | 'full_notes' | 'tags';

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

  // Quick View Popup state
  const [quickViewItem, setQuickViewItem] = useState<any>(null);
  const [quickViewType, setQuickViewType] = useState<'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag'>('content');
  const [quickViewPosition, setQuickViewPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  // Handle quick view on item click
  const handleQuickView = (item: any, type: 'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag', event?: React.MouseEvent) => {
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
    if (!user || objectType === 'overview') {
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

  useEffect(() => {
    if (user && !authLoading && !hasFetched) {
      fetchSummary();
      setHasFetched(true);
    }
  }, [user, authLoading, hasFetched, fetchSummary]);

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
    { key: 'notes', label: 'Quick Notes', value: kpis?.notes.total || 0, icon: '📝', href: '/journal', color: 'bg-blue-500' },
    { key: 'full_notes', label: 'Notes+', value: kpis?.full_notes?.total || 0, icon: '📄', href: '/explore?types=note', color: 'bg-indigo-500' },
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
      title: 'OBJETOS',
      items: [
        { key: 'contents', label: 'Contenidos', icon: '📄', selectable: true },
        { key: 'objectives', label: 'Objetivos', icon: '🎯', selectable: true },
        { key: 'projects', label: 'Proyectos', icon: '📁', selectable: true },
        { key: 'mental_models', label: 'Modelos Mentales', icon: '🧠', selectable: true },
        { key: 'notes', label: 'Quick Notes', icon: '📝', selectable: true },
        { key: 'full_notes', label: 'Notes+', icon: '📄', selectable: true },
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
                <button
                  key={note.id}
                  onClick={(e) => handleQuickView(note, 'note', e)}
                  className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg hover:bg-gray-800/50 transition-colors w-full text-left"
                >
                  <span className="text-lg">{note.is_pinned ? '📌' : '📝'}</span>
                  <p className="text-white text-sm flex-1 truncate">{note.title}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No hay notas</p>
          )}
        </div>
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
          <h2 className="text-xl text-white font-semibold">Diario y Notas</h2>
          <Link
            href="/journal"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {noteTypes.map((noteType: any) => {
              const count = stats.by_type?.[noteType.value] || 0;
              // Apple Notes go to Explorer, other types go to Journal
              const href = noteType.value === 'apple_notes'
                ? '/explore?types=apple_notes'
                : `/journal?type=${noteType.value}`;
              return (
                <Link
                  key={noteType.value}
                  href={href}
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
            href="/notes/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            📄 Nota completa
          </Link>
          <Link
            href="/journal?new=true&type=reflection"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            💭 Nueva reflexión
          </Link>
          <Link
            href="/journal?new=true&type=idea"
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            💡 Nueva idea
          </Link>
          <Link
            href="/journal?new=true&type=question"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            ❓ Nueva pregunta
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

  // Render projects panel with linked contents
  const renderProjectsPanel = () => {
    if (loadingObject) {
      return <div className="text-gray-400 text-center py-8">Cargando...</div>;
    }

    if (!objectSummary) return null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Proyectos</h2>
          <Link href="/projects" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Active projects with linked contents */}
        {(objectSummary.active?.length ?? 0) > 0 && (
          <div className="space-y-4">
            {(objectSummary.active ?? []).map((project: any) => (
              <div key={project.id} className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{project.icon || '📁'}</span>
                  <div className="flex-1">
                    <Link
                      href={`/projects?id=${project.id}`}
                      target="_blank"
                      className="text-white font-medium hover:text-indigo-400"
                    >
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="text-gray-400 text-sm line-clamp-1">{project.description}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-400">
                    activo
                  </span>
                </div>

                {/* Linked contents */}
                {project.linked_contents && project.linked_contents.length > 0 ? (
                  <div className="border-t border-gray-700 pt-3 mt-2">
                    <p className="text-xs text-gray-500 mb-2">Contenidos vinculados:</p>
                    <div className="space-y-1">
                      {project.linked_contents.slice(0, 3).map((content: any) => (
                        <button
                          key={content.id}
                          onClick={() => handleContentClick(content.id)}
                          className="flex items-center gap-2 p-1.5 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors w-full text-left"
                        >
                          <span className="text-sm">{getContentTypeIcon(content.type)}</span>
                          <span className="text-gray-300 text-sm flex-1 truncate">{content.title || 'Sin título'}</span>
                        </button>
                      ))}
                      {project.linked_contents.length > 3 && (
                        <Link
                          href={`/projects?id=${project.id}`}
                          target="_blank"
                          className="text-xs text-indigo-400 hover:text-indigo-300 pl-2"
                        >
                          +{project.linked_contents.length - 3} más →
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs mt-2 border-t border-gray-700 pt-2">
                    Sin contenidos vinculados
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {(objectSummary.active?.length ?? 0) === 0 && (
          <p className="text-gray-500 text-center py-8">No hay proyectos activos</p>
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

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl text-white font-semibold">Modelos Mentales</h2>
          <Link href="/mental-models" target="_blank" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Ver todo →
          </Link>
        </div>

        {/* Active mental models with linked contents */}
        {(objectSummary.active?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(objectSummary.active ?? []).map((model: any) => (
              <div key={model.id} className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{model.icon || '🧠'}</span>
                  <div className="flex-1">
                    <Link
                      href={`/mental-models?id=${model.id}`}
                      target="_blank"
                      className="text-white font-medium hover:text-emerald-400"
                    >
                      {model.name}
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
            ))}
          </div>
        )}

        {(objectSummary.active?.length ?? 0) === 0 && (
          <p className="text-gray-500 text-center py-8">No hay modelos mentales activos</p>
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
    if (selectedCategory === 'projects') {
      return renderProjectsPanel();
    }
    if (selectedCategory === 'mental_models') {
      return renderMentalModelsPanel();
    }

    const typeLabels: Record<string, { title: string; href: string }> = {
      contents: { title: 'Contenidos', href: '/explore' },
      objectives: { title: 'Objetivos', href: '/objectives' },
      projects: { title: 'Proyectos', href: '/projects' },
      mental_models: { title: 'Modelos Mentales', href: '/mental-models' },
      notes: { title: 'Quick Notes', href: '/journal' },
      full_notes: { title: 'Notes+', href: '/explore?types=note' },
      tags: { title: 'Tags', href: '/tags' },
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
            {/* Direct Note Buttons */}
            <Link
              href="/journal?new=true"
              target="_blank"
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
              title="Nota rápida"
            >
              📝 Quick
            </Link>
            <Link
              href="/notes/new"
              target="_blank"
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
              title="Nota completa"
            >
              📄 Note+
            </Link>
            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
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
                      href="/journal?new=true"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📝 Nueva Nota Rápida
                    </Link>
                    <Link
                      href="/notes/new"
                      onClick={() => setShowQuickActions(false)}
                      className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                      📄 Nueva Nota Completa
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
                  </div>
                </>
              )}
            </div>
            <Link
              href="/chat"
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
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

      {/* KPI Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <button
              key={kpi.key}
              onClick={() => setSelectedCategory(kpi.key as SidebarCategory)}
              className={`${kpi.color} hover:opacity-90 rounded-xl p-4 transition-all cursor-pointer text-left ${
                selectedCategory === kpi.key ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-950' : ''
              }`}
            >
              <div className="text-2xl mb-1">{kpi.icon}</div>
              <div className="text-2xl font-bold text-white">{kpi.value}</div>
              <div className="text-xs text-white/80">{kpi.label}</div>
            </button>
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
                            target="_blank"
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
        onOpenFull={quickViewType === 'content' ? () => {
          closeQuickView();
          handleContentClick(quickViewItem?.id);
        } : undefined}
      />
    </div>
  );
}
