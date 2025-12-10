'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface QuickViewPopupProps {
    item: any;
    type: 'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag' | 'habit' | 'area' | 'quick_note' | 'full_note';
    isOpen: boolean;
    onClose: () => void;
    onOpenFull?: () => void; // Opens the full detail modal
    position?: { x: number; y: number };
}

const TYPE_ICONS: Record<string, string> = {
    youtube: '🎬',
    video: '🎬',
    tiktok: '📱',
    twitter: '🐦',
    note: '📝',
    apple_notes: '🍎',
    pdf: '📕',
    docx: '📄',
    web: '🌐',
    default: '📄',
};

const NOTE_TYPE_ICONS: Record<string, string> = {
    reflection: '💭',
    idea: '💡',
    question: '❓',
    connection: '🔗',
    journal: '📓',
};

export function QuickViewPopup({
    item,
    type,
    isOpen,
    onClose,
    onOpenFull,
    position
}: QuickViewPopupProps) {
    const { token } = useAuth();
    const [showContent, setShowContent] = useState(false);
    const [richData, setRichData] = useState<any>(null);
    const [loadingRich, setLoadingRich] = useState(false);

    const getAuthHeaders = useCallback(() => {
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, [token]);

    // Fetch rich data when popup opens
    useEffect(() => {
        if (isOpen && item?.id) {
            // Delay to allow animation
            setTimeout(() => setShowContent(true), 50);

            // Fetch rich data based on type
            const fetchRichData = async () => {
                setLoadingRich(true);
                try {
                    let endpoint = '';
                    switch (type) {
                        case 'content':
                            endpoint = `/api/v1/content/${item.id}`;
                            break;
                        case 'objective':
                            endpoint = `/api/v1/objectives/${item.id}`;
                            break;
                        case 'project':
                            endpoint = `/api/v1/projects/${item.id}`;
                            break;
                        case 'mental_model':
                            endpoint = `/api/v1/mental-models/${item.id}`;
                            break;
                        case 'habit':
                            endpoint = `/api/v1/habits/${item.id}`;
                            break;
                        case 'area':
                            endpoint = `/api/v1/areas/${item.id}`;
                            break;
                        case 'quick_note':
                            endpoint = `/api/v1/standalone-notes/${item.id}`;
                            break;
                        case 'full_note':
                            endpoint = `/api/v1/content/${item.id}`;
                            break;
                        case 'note':
                            // Check if it's a standalone note or content note
                            if (item.source === 'system' || item.is_standalone) {
                                endpoint = `/api/v1/standalone-notes/${item.id}`;
                            } else {
                                endpoint = `/api/v1/content/${item.id}`;
                            }
                            break;
                        default:
                            setLoadingRich(false);
                            return;
                    }

                    const response = await fetch(`${API_URL}${endpoint}`, {
                        headers: getAuthHeaders(),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setRichData(data);
                    }
                } catch (error) {
                    console.error('Error fetching rich data:', error);
                } finally {
                    setLoadingRich(false);
                }
            };

            fetchRichData();
        } else {
            setShowContent(false);
            setRichData(null);
        }
    }, [isOpen, item?.id, type, getAuthHeaders]);

    if (!isOpen || !item) return null;

    // Use rich data if available, fallback to basic item data
    const displayData = richData || item;

    const getIcon = () => {
        switch (type) {
            case 'content':
            case 'full_note':
                return TYPE_ICONS[displayData.type] || TYPE_ICONS.default;
            case 'objective':
                return displayData.icon || '🎯';
            case 'project':
                return displayData.icon || '📁';
            case 'mental_model':
                return displayData.icon || '🧠';
            case 'note':
                return NOTE_TYPE_ICONS[displayData.note_type] || '📝';
            case 'quick_note':
                return displayData.is_pinned ? '📌' : '📝';
            case 'tag':
                return '🏷️';
            case 'habit':
                return displayData.icon || '✅';
            case 'area':
                return displayData.icon || '📋';
            default:
                return '📄';
        }
    };

    const getTitle = () => {
        return displayData.title || displayData.name || displayData.tag || 'Sin título';
    };

    const getSubtitle = () => {
        switch (type) {
            case 'content':
            case 'full_note':
                return displayData.type?.toUpperCase() || 'CONTENIDO';
            case 'objective':
                return `${displayData.progress || 0}% completado`;
            case 'project':
                return displayData.status === 'active' ? 'Activo' : displayData.status;
            case 'mental_model':
                return displayData.is_active ? 'Activo' : 'Inactivo';
            case 'note':
                return displayData.note_type?.charAt(0).toUpperCase() + displayData.note_type?.slice(1);
            case 'quick_note':
                return displayData.category ? displayData.category.charAt(0).toUpperCase() + displayData.category.slice(1) : 'Quick Note';
            case 'tag':
                return `${displayData.category || 'Tag'}`;
            case 'habit':
                return displayData.frequency_type === 'daily' ? 'Diario' :
                       displayData.frequency_type === 'weekly' ? 'Semanal' : 'Personalizado';
            case 'area':
                return displayData.is_active ? 'Activa' : 'Inactiva';
            default:
                return '';
        }
    };

    const getDetailUrl = () => {
        switch (type) {
            case 'content':
                return `/content/${displayData.id}`;
            case 'objective':
                return `/objectives?id=${displayData.id}`;
            case 'project':
                return `/projects?id=${displayData.id}`;
            case 'mental_model':
                return `/mental-models?id=${displayData.id}`;
            case 'note':
                return `/journal?note=${displayData.id}`;
            case 'quick_note':
                return displayData.source === 'system' ? `/system-notes/${displayData.id}` : `/notes/${displayData.id}`;
            case 'full_note':
                return `/content/${displayData.id}`;
            case 'tag':
                return `/explore?tag=${encodeURIComponent(displayData.tag)}`;
            case 'habit':
                return `/habits/${displayData.id}`;
            case 'area':
                return `/areas/${displayData.id}`;
            default:
                return '#';
        }
    };

    const renderContent = () => {
        if (loadingRich) {
            return (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
                </div>
            );
        }

        switch (type) {
            case 'content':
            case 'full_note':
                return (
                    <>
                        {displayData.summary && (
                            <p className="text-gray-300 text-sm line-clamp-3 mb-3">
                                {displayData.summary}
                            </p>
                        )}
                        {displayData.iab_tier1 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                    {displayData.iab_tier1}
                                </span>
                            </div>
                        )}
                        {displayData.user_tags && displayData.user_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {displayData.user_tags.slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* Linked notes for rich data */}
                        {richData?.linked_notes && richData.linked_notes.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">Notas vinculadas:</p>
                                <div className="space-y-1">
                                    {richData.linked_notes.slice(0, 2).map((note: any) => (
                                        <div key={note.id} className="text-xs text-gray-400 truncate">
                                            📝 {note.title}
                                        </div>
                                    ))}
                                    {richData.linked_notes.length > 2 && (
                                        <span className="text-xs text-indigo-400">+{richData.linked_notes.length - 2} más</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                );

            case 'objective':
                return (
                    <>
                        <div className="mb-3">
                            <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                        width: `${displayData.progress || 0}%`,
                                        backgroundColor: displayData.color || '#8b5cf6'
                                    }}
                                />
                            </div>
                        </div>
                        {displayData.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {displayData.description}
                            </p>
                        )}
                        {displayData.horizon && (
                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded mr-2">
                                {displayData.horizon}
                            </span>
                        )}
                        {displayData.target_date && (
                            <span className="text-xs text-gray-500">
                                Meta: {new Date(displayData.target_date).toLocaleDateString('es-ES')}
                            </span>
                        )}
                        {/* Linked contents */}
                        {richData?.linked_contents && richData.linked_contents.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">📄 {richData.linked_contents.length} contenido(s)</p>
                            </div>
                        )}
                    </>
                );

            case 'project':
                return (
                    <>
                        {displayData.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {displayData.description}
                            </p>
                        )}
                        <span
                            className="text-xs px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: displayData.color || '#6366f1' }}
                        >
                            {displayData.status === 'active' ? 'Activo' : displayData.status}
                        </span>
                        {displayData.area_name && (
                            <span className="text-xs text-gray-500 ml-2">📋 {displayData.area_name}</span>
                        )}
                        {/* Linked contents */}
                        {richData?.linked_contents && richData.linked_contents.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">📄 {richData.linked_contents.length} contenido(s)</p>
                            </div>
                        )}
                    </>
                );

            case 'mental_model':
                return (
                    <>
                        {displayData.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {displayData.description}
                            </p>
                        )}
                        {/* Linked contents */}
                        {richData?.linked_contents && richData.linked_contents.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">Aplicado a {richData.linked_contents.length} contenido(s)</p>
                            </div>
                        )}
                    </>
                );

            case 'note':
            case 'quick_note':
                return (
                    <>
                        {displayData.content && (
                            <p className="text-gray-300 text-sm line-clamp-3 mb-2">
                                {displayData.content}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-1">
                            {displayData.is_pinned && (
                                <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded">
                                    📌 Fijada
                                </span>
                            )}
                            {displayData.category && (
                                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                    {displayData.category}
                                </span>
                            )}
                        </div>
                        {/* Linked content for notes */}
                        {richData?.content_id && richData.content_title && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">Vinculada a:</p>
                                <div className="text-xs text-indigo-400 truncate">
                                    📄 {richData.content_title}
                                </div>
                            </div>
                        )}
                    </>
                );

            case 'tag':
                return (
                    <>
                        <div
                            className="w-8 h-8 rounded-full mb-2"
                            style={{ backgroundColor: displayData.color || '#6366f1' }}
                        />
                        {displayData.category && (
                            <span className="text-xs text-gray-400">
                                Categoría: {displayData.category}
                            </span>
                        )}
                    </>
                );

            case 'habit':
                return (
                    <>
                        {displayData.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {displayData.description}
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                                displayData.is_active ? 'bg-emerald-600/30 text-emerald-300' : 'bg-gray-700 text-gray-400'
                            }`}>
                                {displayData.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                            {displayData.current_streak > 0 && (
                                <span className="text-xs bg-amber-600/30 text-amber-300 px-2 py-0.5 rounded">
                                    🔥 {displayData.current_streak} días
                                </span>
                            )}
                        </div>
                        {/* Today's status */}
                        {richData?.completed_today !== undefined && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                                <span className={`text-xs ${richData.completed_today ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                    {richData.completed_today ? '✅ Completado hoy' : '⏳ Pendiente hoy'}
                                </span>
                            </div>
                        )}
                        {/* Area link */}
                        {displayData.area_name && (
                            <div className="text-xs text-gray-500 mt-1">
                                📋 {displayData.area_name}
                            </div>
                        )}
                    </>
                );

            case 'area':
                return (
                    <>
                        {displayData.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {displayData.description}
                            </p>
                        )}
                        <div
                            className="w-full h-1 rounded mb-3"
                            style={{ backgroundColor: displayData.color || '#6366f1' }}
                        />
                        {/* Stats */}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            {(richData?.objectives_count !== undefined || displayData.objectives_count !== undefined) && (
                                <span>🎯 {richData?.objectives_count || displayData.objectives_count || 0} objetivos</span>
                            )}
                            {(richData?.projects_count !== undefined || displayData.projects_count !== undefined) && (
                                <span>📁 {richData?.projects_count || displayData.projects_count || 0} proyectos</span>
                            )}
                            {(richData?.habits_count !== undefined || displayData.habits_count !== undefined) && (
                                <span>✅ {richData?.habits_count || displayData.habits_count || 0} hábitos</span>
                            )}
                        </div>
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* Popup */}
            <div
                className={`fixed z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 w-80 max-w-[90vw] transition-all duration-200 ${
                    showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{
                    top: position?.y ?? '50%',
                    left: position?.x ?? '50%',
                    transform: position ? 'translate(-50%, -10px)' : 'translate(-50%, -50%)',
                }}
            >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{getIcon()}</span>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{getTitle()}</h3>
                        <p className="text-xs text-gray-400">{getSubtitle()}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 text-lg"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="mb-4">
                    {renderContent()}
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t border-gray-700 pt-3">
                    {(type === 'content' || type === 'full_note') && onOpenFull ? (
                        <button
                            onClick={onOpenFull}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                        >
                            Ver detalle
                        </button>
                    ) : (
                        <Link
                            href={getDetailUrl()}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-2 rounded-lg transition-colors text-center"
                        >
                            Abrir
                        </Link>
                    )}
                    <Link
                        href={(type === 'content' || type === 'full_note') ? '/explore' : getDetailUrl()}
                        target="_blank"
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors"
                        title={(type === 'content' || type === 'full_note') ? 'Ir a Explorer' : 'Abrir en nueva pestaña'}
                    >
                        ↗
                    </Link>
                </div>

                {/* URL for content */}
                {(type === 'content' || type === 'full_note') && displayData.url && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <a
                            href={displayData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 truncate block"
                        >
                            {displayData.url}
                        </a>
                    </div>
                )}

                {/* Timestamp */}
                {displayData.created_at && (
                    <p className="text-xs text-gray-500 mt-2">
                        {new Date(displayData.created_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </p>
                )}
            </div>
        </>
    );
}
