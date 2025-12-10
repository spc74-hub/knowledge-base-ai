'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface MentalModel {
    id: string;
    name: string;
    slug: string;
    description?: string;
    notes?: string;
    icon: string;
    color: string;
    is_favorite?: boolean;
    content_count?: number;
}

interface Area {
    id: string;
    name: string;
    description?: string;
    icon: string;
    color: string;
    status: string;
    stats?: {
        objectives: number;
        projects: number;
        contents: number;
        habits: number;
    };
}

interface Objective {
    id: string;
    title: string;
    description?: string;
    icon: string;
    color: string;
    horizon: string;
    status: string;
    progress: number;
    target_date?: string;
    is_favorite?: boolean;
}

interface Project {
    id: string;
    name: string;
    description?: string;
    icon: string;
    color: string;
    status: string;
    deadline?: string;
    is_favorite?: boolean;
    content_count?: number;
}

type TabType = 'mental_models' | 'areas' | 'objectives' | 'projects';

const TABS: { key: TabType; label: string; icon: string }[] = [
    { key: 'mental_models', label: 'M. Mentales', icon: '🧠' },
    { key: 'areas', label: 'Áreas', icon: '📋' },
    { key: 'objectives', label: 'Objetivos', icon: '🎯' },
    { key: 'projects', label: 'Proyectos', icon: '📁' },
];

const HORIZONS = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' },
    { value: 'lifetime', label: 'Vida' },
];

const STATUSES = [
    { value: 'active', label: 'Activo', color: 'bg-green-500' },
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
    { value: 'completed', label: 'Completado', color: 'bg-blue-500' },
    { value: 'on_hold', label: 'En pausa', color: 'bg-gray-500' },
    { value: 'archived', label: 'Archivado', color: 'bg-red-500' },
];

export default function MobileDashboardPage() {
    const [activeTab, setActiveTab] = useState<TabType>('mental_models');
    const [isDark, setIsDark] = useState(false);
    const [loading, setLoading] = useState(true);

    // Data states
    const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [objectives, setObjectives] = useState<Objective[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MentalModel | Area | Objective | Project | null>(null);
    const [viewingItem, setViewingItem] = useState<MentalModel | Area | Objective | Project | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        title: '',
        description: '',
        icon: '📌',
        color: '#6366f1',
        horizon: 'monthly',
        status: 'active',
        target_date: '',
        deadline: '',
        notes: '',
    });

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

    // Fetch data based on active tab
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = {
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            let endpoint = '';
            switch (activeTab) {
                case 'mental_models':
                    endpoint = '/api/v1/mental-models';
                    break;
                case 'areas':
                    endpoint = '/api/v1/areas';
                    break;
                case 'objectives':
                    endpoint = '/api/v1/objectives';
                    break;
                case 'projects':
                    endpoint = '/api/v1/projects';
                    break;
            }

            const response = await fetch(`${API_URL}${endpoint}`, { headers });
            if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data) ? data : (data.items || data.data || data.models || data.objectives || []);

                switch (activeTab) {
                    case 'mental_models':
                        setMentalModels(items);
                        break;
                    case 'areas':
                        setAreas(items);
                        break;
                    case 'objectives':
                        setObjectives(items);
                        break;
                    case 'projects':
                        setProjects(items);
                        break;
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Create item
    const handleCreate = async () => {
        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            let endpoint = '';
            let body: Record<string, unknown> = {};

            switch (activeTab) {
                case 'mental_models':
                    endpoint = '/api/v1/mental-models';
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        notes: formData.notes,
                    };
                    break;
                case 'areas':
                    endpoint = '/api/v1/areas';
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                    };
                    break;
                case 'objectives':
                    endpoint = '/api/v1/objectives';
                    body = {
                        title: formData.title || formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        horizon: formData.horizon,
                        status: formData.status,
                        target_date: formData.target_date || null,
                    };
                    break;
                case 'projects':
                    endpoint = '/api/v1/projects';
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        status: formData.status,
                        deadline: formData.deadline || null,
                    };
                    break;
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (response.ok) {
                setShowCreateModal(false);
                resetForm();
                fetchData();
            }
        } catch (error) {
            console.error('Error creating item:', error);
        }
    };

    // Update item
    const handleUpdate = async () => {
        if (!editingItem) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            let endpoint = '';
            let body: Record<string, unknown> = {};

            switch (activeTab) {
                case 'mental_models':
                    endpoint = `/api/v1/mental-models/${editingItem.id}`;
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        notes: formData.notes,
                    };
                    break;
                case 'areas':
                    endpoint = `/api/v1/areas/${editingItem.id}`;
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                    };
                    break;
                case 'objectives':
                    endpoint = `/api/v1/objectives/${editingItem.id}`;
                    body = {
                        title: formData.title || formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        horizon: formData.horizon,
                        status: formData.status,
                        target_date: formData.target_date || null,
                    };
                    break;
                case 'projects':
                    endpoint = `/api/v1/projects/${editingItem.id}`;
                    body = {
                        name: formData.name,
                        description: formData.description,
                        icon: formData.icon,
                        color: formData.color,
                        status: formData.status,
                        deadline: formData.deadline || null,
                    };
                    break;
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });

            if (response.ok) {
                setShowEditModal(false);
                setEditingItem(null);
                resetForm();
                fetchData();
            }
        } catch (error) {
            console.error('Error updating item:', error);
        }
    };

    // Delete item
    const handleDelete = async (item: MentalModel | Area | Objective | Project) => {
        if (!confirm('¿Eliminar este elemento?')) return;

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) return;

            const headers = {
                'Authorization': `Bearer ${session.data.session.access_token}`,
            };

            let endpoint = '';
            switch (activeTab) {
                case 'mental_models':
                    endpoint = `/api/v1/mental-models/${item.id}`;
                    break;
                case 'areas':
                    endpoint = `/api/v1/areas/${item.id}`;
                    break;
                case 'objectives':
                    endpoint = `/api/v1/objectives/${item.id}`;
                    break;
                case 'projects':
                    endpoint = `/api/v1/projects/${item.id}`;
                    break;
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'DELETE',
                headers,
            });

            if (response.ok) {
                setShowDetailModal(false);
                setViewingItem(null);
                fetchData();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            title: '',
            description: '',
            icon: '📌',
            color: '#6366f1',
            horizon: 'monthly',
            status: 'active',
            target_date: '',
            deadline: '',
            notes: '',
        });
    };

    const openEditModal = (item: MentalModel | Area | Objective | Project) => {
        setEditingItem(item);
        setFormData({
            name: (item as Area | Project | MentalModel).name || '',
            title: (item as Objective).title || '',
            description: item.description || '',
            icon: item.icon || '📌',
            color: item.color || '#6366f1',
            horizon: (item as Objective).horizon || 'monthly',
            status: (item as Objective | Project).status || 'active',
            target_date: (item as Objective).target_date || '',
            deadline: (item as Project).deadline?.split('T')[0] || '',
            notes: (item as MentalModel).notes || '',
        });
        setShowEditModal(true);
    };

    const openDetailModal = (item: MentalModel | Area | Objective | Project) => {
        setViewingItem(item);
        setShowDetailModal(true);
    };

    const getItems = () => {
        switch (activeTab) {
            case 'mental_models': return mentalModels;
            case 'areas': return areas;
            case 'objectives': return objectives;
            case 'projects': return projects;
            default: return [];
        }
    };

    const getItemName = (item: MentalModel | Area | Objective | Project) => {
        if ('title' in item && item.title) return item.title;
        if ('name' in item) return item.name;
        return '';
    };

    const cardClass = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100';
    const textClass = isDark ? 'text-gray-200' : 'text-gray-800';
    const mutedTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = isDark
        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                            activeTab === tab.key
                                ? 'bg-blue-500 text-white'
                                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Create button */}
            <button
                onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                }}
                className="w-full py-3 rounded-xl bg-blue-500/80 text-white font-medium flex items-center justify-center gap-2"
            >
                <span className="text-lg">+</span>
                <span>Crear {TABS.find(t => t.key === activeTab)?.label.slice(0, -1) || 'elemento'}</span>
            </button>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : getItems().length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-5xl mb-4">{TABS.find(t => t.key === activeTab)?.icon}</div>
                    <p className={mutedTextClass}>No hay elementos</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {getItems().map((item) => (
                        <div
                            key={item.id}
                            onClick={() => openDetailModal(item)}
                            className={`rounded-xl p-4 shadow-sm border ${cardClass} cursor-pointer active:scale-[0.98] transition-transform`}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                    style={{ backgroundColor: item.color + '30' }}
                                >
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-medium ${textClass} truncate`}>
                                        {getItemName(item)}
                                    </h3>
                                    {item.description && (
                                        <p className={`text-sm ${mutedTextClass} line-clamp-2 mt-1`}>
                                            {item.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {(item as Objective).horizon && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                                {HORIZONS.find(h => h.value === (item as Objective).horizon)?.label}
                                            </span>
                                        )}
                                        {((item as Objective | Project).status && activeTab !== 'mental_models' && activeTab !== 'areas') && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                STATUSES.find(s => s.value === (item as Objective | Project).status)?.color
                                            } text-white`}>
                                                {STATUSES.find(s => s.value === (item as Objective | Project).status)?.label}
                                            </span>
                                        )}
                                        {(item as Objective).progress !== undefined && (item as Objective).progress > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                                {(item as Objective).progress}%
                                            </span>
                                        )}
                                        {(item as Area).stats && (
                                            <span className={`text-xs ${mutedTextClass}`}>
                                                {(item as Area).stats?.objectives || 0} obj · {(item as Area).stats?.projects || 0} proy
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {(item as MentalModel | Objective | Project).is_favorite && (
                                    <span className="text-amber-500">★</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '85vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold text-lg ${textClass}`}>
                                Crear {TABS.find(t => t.key === activeTab)?.label.slice(0, -1)}
                            </h3>
                            <button onClick={() => setShowCreateModal(false)} className={mutedTextClass}>✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Name/Title */}
                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>
                                    {activeTab === 'objectives' ? 'Título' : 'Nombre'}
                                </label>
                                <input
                                    type="text"
                                    value={activeTab === 'objectives' ? formData.title : formData.name}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        [activeTab === 'objectives' ? 'title' : 'name']: e.target.value
                                    })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    placeholder={activeTab === 'objectives' ? 'Título del objetivo' : 'Nombre'}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    rows={3}
                                    placeholder="Descripción (opcional)"
                                />
                            </div>

                            {/* Icon & Color */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Icono</label>
                                    <input
                                        type="text"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass} text-center text-2xl`}
                                        maxLength={4}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Color</label>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full mt-1 h-10 rounded-lg border cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Objectives specific fields */}
                            {activeTab === 'objectives' && (
                                <>
                                    <div>
                                        <label className={`text-sm font-medium ${mutedTextClass}`}>Horizonte</label>
                                        <select
                                            value={formData.horizon}
                                            onChange={(e) => setFormData({ ...formData, horizon: e.target.value })}
                                            className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        >
                                            {HORIZONS.map(h => (
                                                <option key={h.value} value={h.value}>{h.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`text-sm font-medium ${mutedTextClass}`}>Fecha objetivo</label>
                                        <input
                                            type="date"
                                            value={formData.target_date}
                                            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                                            className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Projects specific fields */}
                            {activeTab === 'projects' && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Fecha límite</label>
                                    <input
                                        type="date"
                                        value={formData.deadline}
                                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    />
                                </div>
                            )}

                            {/* Status for objectives and projects */}
                            {(activeTab === 'objectives' || activeTab === 'projects') && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    >
                                        {STATUSES.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Mental model notes */}
                            {activeTab === 'mental_models' && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Notas</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        rows={3}
                                        placeholder="Notas personales sobre este modelo mental"
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleCreate}
                                disabled={!(formData.name || formData.title)}
                                className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '85vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`font-semibold text-lg ${textClass}`}>
                                Editar {TABS.find(t => t.key === activeTab)?.label.slice(0, -1)}
                            </h3>
                            <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className={mutedTextClass}>✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Same fields as create */}
                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>
                                    {activeTab === 'objectives' ? 'Título' : 'Nombre'}
                                </label>
                                <input
                                    type="text"
                                    value={activeTab === 'objectives' ? formData.title : formData.name}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        [activeTab === 'objectives' ? 'title' : 'name']: e.target.value
                                    })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                />
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${mutedTextClass}`}>Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    rows={3}
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Icono</label>
                                    <input
                                        type="text"
                                        value={formData.icon}
                                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass} text-center text-2xl`}
                                        maxLength={4}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Color</label>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full mt-1 h-10 rounded-lg border cursor-pointer"
                                    />
                                </div>
                            </div>

                            {activeTab === 'objectives' && (
                                <>
                                    <div>
                                        <label className={`text-sm font-medium ${mutedTextClass}`}>Horizonte</label>
                                        <select
                                            value={formData.horizon}
                                            onChange={(e) => setFormData({ ...formData, horizon: e.target.value })}
                                            className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        >
                                            {HORIZONS.map(h => (
                                                <option key={h.value} value={h.value}>{h.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`text-sm font-medium ${mutedTextClass}`}>Fecha objetivo</label>
                                        <input
                                            type="date"
                                            value={formData.target_date}
                                            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                                            className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        />
                                    </div>
                                </>
                            )}

                            {activeTab === 'projects' && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Fecha límite</label>
                                    <input
                                        type="date"
                                        value={formData.deadline}
                                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    />
                                </div>
                            )}

                            {(activeTab === 'objectives' || activeTab === 'projects') && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Estado</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                    >
                                        {STATUSES.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activeTab === 'mental_models' && (
                                <div>
                                    <label className={`text-sm font-medium ${mutedTextClass}`}>Notas</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className={`w-full mt-1 px-3 py-2 rounded-lg border ${inputClass}`}
                                        rows={3}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handleUpdate}
                                className="w-full py-3 rounded-xl bg-blue-500 text-white font-medium"
                            >
                                Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && viewingItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div
                        className={`w-full rounded-t-2xl p-4 animate-slide-up ${isDark ? 'bg-gray-800' : 'bg-white'}`}
                        style={{ maxHeight: '80vh', overflowY: 'auto' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                                    style={{ backgroundColor: viewingItem.color + '30' }}
                                >
                                    {viewingItem.icon}
                                </div>
                                <h3 className={`font-semibold text-lg ${textClass}`}>
                                    {getItemName(viewingItem)}
                                </h3>
                            </div>
                            <button onClick={() => { setShowDetailModal(false); setViewingItem(null); }} className={mutedTextClass}>✕</button>
                        </div>

                        {viewingItem.description && (
                            <p className={`${mutedTextClass} mb-4`}>{viewingItem.description}</p>
                        )}

                        {/* Additional details */}
                        <div className="space-y-2 mb-6">
                            {(viewingItem as Objective).horizon && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Horizonte:</span>
                                    <span className={textClass}>{HORIZONS.find(h => h.value === (viewingItem as Objective).horizon)?.label}</span>
                                </div>
                            )}
                            {(viewingItem as Objective | Project).status && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Estado:</span>
                                    <span className={textClass}>{STATUSES.find(s => s.value === (viewingItem as Objective | Project).status)?.label}</span>
                                </div>
                            )}
                            {(viewingItem as Objective).progress !== undefined && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Progreso:</span>
                                    <span className={textClass}>{(viewingItem as Objective).progress}%</span>
                                </div>
                            )}
                            {(viewingItem as Objective).target_date && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Fecha objetivo:</span>
                                    <span className={textClass}>{new Date((viewingItem as Objective).target_date!).toLocaleDateString('es-ES')}</span>
                                </div>
                            )}
                            {(viewingItem as Project).deadline && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Fecha límite:</span>
                                    <span className={textClass}>{new Date((viewingItem as Project).deadline!).toLocaleDateString('es-ES')}</span>
                                </div>
                            )}
                            {(viewingItem as Area).stats && (
                                <>
                                    <div className="flex justify-between">
                                        <span className={mutedTextClass}>Objetivos:</span>
                                        <span className={textClass}>{(viewingItem as Area).stats?.objectives || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={mutedTextClass}>Proyectos:</span>
                                        <span className={textClass}>{(viewingItem as Area).stats?.projects || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={mutedTextClass}>Hábitos:</span>
                                        <span className={textClass}>{(viewingItem as Area).stats?.habits || 0}</span>
                                    </div>
                                </>
                            )}
                            {(viewingItem as MentalModel).content_count !== undefined && (
                                <div className="flex justify-between">
                                    <span className={mutedTextClass}>Contenidos:</span>
                                    <span className={textClass}>{(viewingItem as MentalModel).content_count}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    setShowDetailModal(false);
                                    openEditModal(viewingItem);
                                }}
                                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
                                    isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                                <span>✏️</span>
                                Editar
                            </button>
                            <button
                                onClick={() => handleDelete(viewingItem)}
                                className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-red-500/20 text-red-500"
                            >
                                <span>🗑️</span>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
