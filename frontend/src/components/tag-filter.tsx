'use client';

import { useState } from 'react';

interface InheritedTag {
    tag: string;
    color: string;
}

interface TagFilterProps {
    userTags: string[];
    inheritedTags: InheritedTag[];
    selectedUserTags: string[];
    selectedInheritedTags: string[];
    onUserTagsChange: (tags: string[]) => void;
    onInheritedTagsChange: (tags: string[]) => void;
    compact?: boolean;
}

export function TagFilter({
    userTags,
    inheritedTags,
    selectedUserTags,
    selectedInheritedTags,
    onUserTagsChange,
    onInheritedTagsChange,
    compact = false,
}: TagFilterProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleUserTag = (tag: string) => {
        if (selectedUserTags.includes(tag)) {
            onUserTagsChange(selectedUserTags.filter((t) => t !== tag));
        } else {
            onUserTagsChange([...selectedUserTags, tag]);
        }
    };

    const toggleInheritedTag = (tag: string) => {
        if (selectedInheritedTags.includes(tag)) {
            onInheritedTagsChange(selectedInheritedTags.filter((t) => t !== tag));
        } else {
            onInheritedTagsChange([...selectedInheritedTags, tag]);
        }
    };

    const hasAnyTags = userTags.length > 0 || inheritedTags.length > 0;
    const hasSelectedTags = selectedUserTags.length > 0 || selectedInheritedTags.length > 0;

    if (!hasAnyTags) {
        return null;
    }

    const clearAll = () => {
        onUserTagsChange([]);
        onInheritedTagsChange([]);
    };

    if (compact) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Tags
                        {hasSelectedTags && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded">
                                {selectedUserTags.length + selectedInheritedTags.length}
                            </span>
                        )}
                    </button>
                    {hasSelectedTags && (
                        <button
                            onClick={clearAll}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                {isExpanded && (
                    <div className="space-y-3 pl-4">
                        {userTags.length > 0 && (
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Manuales</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {userTags.map((tag) => (
                                        <button
                                            key={`user-${tag}`}
                                            onClick={() => toggleUserTag(tag)}
                                            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                                                selectedUserTags.includes(tag)
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {inheritedTags.length > 0 && (
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Heredados</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {inheritedTags.map(({ tag, color }) => (
                                        <button
                                            key={`inherited-${tag}`}
                                            onClick={() => toggleInheritedTag(tag)}
                                            style={{
                                                backgroundColor: selectedInheritedTags.includes(tag) ? color : undefined,
                                                borderColor: color,
                                            }}
                                            className={`px-2 py-0.5 rounded-full text-xs transition-colors border ${
                                                selectedInheritedTags.includes(tag)
                                                    ? 'text-white'
                                                    : 'bg-transparent text-gray-700 dark:text-gray-300 hover:opacity-80'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Filtrar por Tags</h4>
                {hasSelectedTags && (
                    <button
                        onClick={clearAll}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                        Limpiar todos
                    </button>
                )}
            </div>

            {userTags.length > 0 && (
                <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tags manuales</div>
                    <div className="flex flex-wrap gap-2">
                        {userTags.map((tag) => (
                            <button
                                key={`user-${tag}`}
                                onClick={() => toggleUserTag(tag)}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedUserTags.includes(tag)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {inheritedTags.length > 0 && (
                <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tags heredados</div>
                    <div className="flex flex-wrap gap-2">
                        {inheritedTags.map(({ tag, color }) => (
                            <button
                                key={`inherited-${tag}`}
                                onClick={() => toggleInheritedTag(tag)}
                                style={{
                                    backgroundColor: selectedInheritedTags.includes(tag) ? color : undefined,
                                    borderColor: color,
                                }}
                                className={`px-3 py-1 rounded-full text-sm transition-colors border-2 ${
                                    selectedInheritedTags.includes(tag)
                                        ? 'text-white'
                                        : 'bg-transparent text-gray-700 dark:text-gray-300 hover:opacity-80'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
