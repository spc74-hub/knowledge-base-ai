'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import {
    useAreas,
    useCreateArea,
    useUpdateArea,
    useDeleteArea,
    AREAS_KEYS,
    type Area
} from '@/hooks/use-areas';
import Link from 'next/link';
import { ICON_CATEGORIES, ICON_CATEGORY_NAMES } from '@/lib/icons';

const STATUS_CONFIG = {
    active: { label: 'Activa', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    archived: { label: 'Archivada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
};

const AREA_COLORS = [
    // Row 1: Primary colors
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    // Row 2: Warm colors
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#facc15', '#fbbf24',
    // Row 3: Cool/Nature colors
    '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    // Row 4: Blues & Neutrals
    '#3b82f6', '#2563eb', '#4f46e5', '#6b7280', '#374151', '#1f2937',
];

export default function AreasPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, loading: authLoading } = useAuth();

    // Status filter
    const [statusFilter, setStatusFilter] = useState<string>('active');

    // React Query hooks
    const { data: areas = [], isLoading } = useAreas({ statusFilter });
    const createAreaMutation = useCreateArea();
    const updateAreaMutation = useUpdateArea();
    const deleteAreaMutation = useDeleteArea();

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIcon, setFormIcon] = useState('📋');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formStatus, setFormStatus] = useState('active');
    const [iconCategory, setIconCategory] = useState('Personal');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const resetForm = () => {
        setFormName('');
        setFormDescription('');
        setFormIcon('📋');
        setFormColor('#6366f1');
        setFormStatus('active');
        setIconCategory('Personal');
    };

    const handleCreate = async () => {
        if (!formName.trim()) return;

        try {
            await createAreaMutation.mutateAsync({
                name: formName.trim(),
                description: formDescription.trim() || undefined,
                icon: formIcon,
                color: formColor,
                status: formStatus,
            });

            setShowCreateModal(false);
            resetForm();
        } catch (error) {
            console.error('Error creating area:', error);
        }
    };

    const handleEdit = async () => {
        if (!selectedArea || !formName.trim()) return;

        try {
            await updateAreaMutation.mutateAsync({
                id: selectedArea.id,
                name: formName.trim(),
                description: formDescription.trim() || undefined,
                icon: formIcon,
                color: formColor,
                status: formStatus,
            });

            setShowEditModal(false);
            setSelectedArea(null);
            resetForm();
        } catch (error) {
            console.error('Error updating area:', error);
        }
    };

    const handleDelete = async (area: Area) => {
        if (!confirm(`¿Eliminar el area "${area.name}"? Los elementos vinculados no se eliminaran.`)) return;

        try {
            await deleteAreaMutation.mutateAsync(area.id);
        } catch (error) {
            console.error('Error deleting area:', error);
        }
    };

    const openEditModal = (area: Area) => {
        setSelectedArea(area);
        setFormName(area.name);
        setFormDescription(area.description || '');
        setFormIcon(area.icon);
        setFormColor(area.color);
        setFormStatus(area.status);
        setShowEditModal(true);
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                ← Dashboard
                            </Link>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Areas de Responsabilidad</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                            >
                                <option value="all">Todas</option>
                                <option value="active">Activas</option>
                                <option value="paused">Pausadas</option>
                                <option value="archived">Archivadas</option>
                            </select>
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowCreateModal(true);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                + Nueva Area
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {areas.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No tienes areas de responsabilidad
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Las areas te ayudan a organizar tus objetivos, proyectos y habitos por ambitos de tu vida.
                        </p>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Crear primera area
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {areas.map((area) => (
                            <div
                                key={area.id}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Color bar */}
                                <div className="h-2" style={{ backgroundColor: area.color }}></div>

                                <div className="p-5">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{area.icon}</span>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">{area.name}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[area.status as keyof typeof STATUS_CONFIG]?.color}`}>
                                                    {STATUS_CONFIG[area.status as keyof typeof STATUS_CONFIG]?.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openEditModal(area)}
                                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(area)}
                                                className="p-1.5 text-gray-400 hover:text-red-600"
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {area.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                            {area.description}
                                        </p>
                                    )}

                                    {/* Stats */}
                                    {area.stats && (
                                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                                <div className="font-semibold text-gray-900 dark:text-white">{area.stats.objectives}</div>
                                                <div className="text-gray-500 dark:text-gray-400">Objetivos</div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                                <div className="font-semibold text-gray-900 dark:text-white">{area.stats.projects}</div>
                                                <div className="text-gray-500 dark:text-gray-400">Proyectos</div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                                <div className="font-semibold text-gray-900 dark:text-white">{area.stats.habits}</div>
                                                <div className="text-gray-500 dark:text-gray-400">Habitos</div>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                                <div className="font-semibold text-gray-900 dark:text-white">{area.stats.sub_areas}</div>
                                                <div className="text-gray-500 dark:text-gray-400">Sub-areas</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* View details button */}
                                    <Link
                                        href={`/areas/${area.id}`}
                                        className="mt-4 block w-full text-center py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                    >
                                        Ver detalles →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                {showCreateModal ? 'Nueva Area' : 'Editar Area'}
                            </h2>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="Ej: Familia, Salud, Finanzas..."
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripcion
                                    </label>
                                    <textarea
                                        value={formDescription}
                                        onChange={(e) => setFormDescription(e.target.value)}
                                        placeholder="Que significa esta area para ti..."
                                        rows={3}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                {/* Icon selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Icono
                                    </label>
                                    {/* Category tabs */}
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {ICON_CATEGORY_NAMES.map((category) => (
                                            <button
                                                key={category}
                                                onClick={() => setIconCategory(category)}
                                                className={`px-2 py-1 text-xs rounded ${iconCategory === category ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Icons grid */}
                                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-32 overflow-y-auto">
                                        {ICON_CATEGORIES[iconCategory]?.map((icon) => (
                                            <button
                                                key={icon}
                                                onClick={() => setFormIcon(icon)}
                                                className={`text-2xl p-2 rounded-lg transition-all ${formIcon === icon ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-500 scale-110' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Seleccionado: {formIcon}
                                    </div>
                                </div>

                                {/* Color selector */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Color
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {AREA_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setFormColor(color)}
                                                className={`w-8 h-8 rounded-full ${formColor === color ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={formStatus}
                                        onChange={(e) => setFormStatus(e.target.value)}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="active">Activa</option>
                                        <option value="paused">Pausada</option>
                                        <option value="archived">Archivada</option>
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setShowEditModal(false);
                                        setSelectedArea(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={showCreateModal ? handleCreate : handleEdit}
                                    disabled={(showCreateModal ? createAreaMutation.isPending : updateAreaMutation.isPending) || !formName.trim()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {(showCreateModal ? createAreaMutation.isPending : updateAreaMutation.isPending) ? 'Guardando...' : showCreateModal ? 'Crear' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
