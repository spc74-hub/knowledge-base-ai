'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QuickViewPopupProps {
    item: any;
    type: 'content' | 'objective' | 'project' | 'mental_model' | 'note' | 'tag';
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
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Delay to allow animation
            setTimeout(() => setShowContent(true), 50);
        } else {
            setShowContent(false);
        }
    }, [isOpen]);

    if (!isOpen || !item) return null;

    const getIcon = () => {
        switch (type) {
            case 'content':
                return TYPE_ICONS[item.type] || TYPE_ICONS.default;
            case 'objective':
                return item.icon || '🎯';
            case 'project':
                return item.icon || '📁';
            case 'mental_model':
                return item.icon || '🧠';
            case 'note':
                return NOTE_TYPE_ICONS[item.note_type] || '📝';
            case 'tag':
                return '🏷️';
            default:
                return '📄';
        }
    };

    const getTitle = () => {
        return item.title || item.name || item.tag || 'Sin título';
    };

    const getSubtitle = () => {
        switch (type) {
            case 'content':
                return item.type?.toUpperCase() || 'CONTENIDO';
            case 'objective':
                return `${item.progress || 0}% completado`;
            case 'project':
                return item.status === 'active' ? 'Activo' : item.status;
            case 'mental_model':
                return item.is_active ? 'Activo' : 'Inactivo';
            case 'note':
                return item.note_type?.charAt(0).toUpperCase() + item.note_type?.slice(1);
            case 'tag':
                return `${item.category || 'Tag'}`;
            default:
                return '';
        }
    };

    const getDetailUrl = () => {
        switch (type) {
            case 'content':
                return `/content/${item.id}`;
            case 'objective':
                return `/objectives?id=${item.id}`;
            case 'project':
                return `/projects?id=${item.id}`;
            case 'mental_model':
                return `/mental-models?id=${item.id}`;
            case 'note':
                return `/journal?note=${item.id}`;
            case 'tag':
                return `/explore?tag=${encodeURIComponent(item.tag)}`;
            default:
                return '#';
        }
    };

    const renderContent = () => {
        switch (type) {
            case 'content':
                return (
                    <>
                        {item.summary && (
                            <p className="text-gray-300 text-sm line-clamp-3 mb-3">
                                {item.summary}
                            </p>
                        )}
                        {item.iab_tier1 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                    {item.iab_tier1}
                                </span>
                            </div>
                        )}
                        {item.user_tags && item.user_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {item.user_tags.slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
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
                                        width: `${item.progress || 0}%`,
                                        backgroundColor: item.color || '#8b5cf6'
                                    }}
                                />
                            </div>
                        </div>
                        {item.horizon && (
                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                {item.horizon}
                            </span>
                        )}
                    </>
                );

            case 'project':
                return (
                    <>
                        {item.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {item.description}
                            </p>
                        )}
                        <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: item.color || '#6366f1' }}
                        >
                            {item.status === 'active' ? 'Activo' : item.status}
                        </span>
                    </>
                );

            case 'mental_model':
                return (
                    <>
                        {item.description && (
                            <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                                {item.description}
                            </p>
                        )}
                    </>
                );

            case 'note':
                return (
                    <>
                        {item.content && (
                            <p className="text-gray-300 text-sm line-clamp-3 mb-2">
                                {item.content}
                            </p>
                        )}
                        {item.is_pinned && (
                            <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded">
                                📌 Fijada
                            </span>
                        )}
                    </>
                );

            case 'tag':
                return (
                    <>
                        <div
                            className="w-8 h-8 rounded-full mb-2"
                            style={{ backgroundColor: item.color || '#6366f1' }}
                        />
                        {item.category && (
                            <span className="text-xs text-gray-400">
                                Categoría: {item.category}
                            </span>
                        )}
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
                    {type === 'content' && onOpenFull ? (
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
                        href={getDetailUrl()}
                        target="_blank"
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors"
                        title="Abrir en nueva pestaña"
                    >
                        ↗
                    </Link>
                </div>

                {/* URL for content */}
                {type === 'content' && item.url && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 truncate block"
                        >
                            {item.url}
                        </a>
                    </div>
                )}

                {/* Timestamp */}
                {item.created_at && (
                    <p className="text-xs text-gray-500 mt-2">
                        {new Date(item.created_at).toLocaleDateString('es-ES', {
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
