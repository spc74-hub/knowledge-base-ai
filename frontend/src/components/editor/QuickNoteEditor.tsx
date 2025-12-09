'use client';

import { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

interface QuickNoteEditorProps {
    initialContent?: string;
    placeholder?: string;
    onChange?: (text: string, html: string) => void;
    minHeight?: string;
    autoFocus?: boolean;
}

const highlightColors = ['#ffeb3b', '#4caf50', '#03a9f4', '#e91e63', '#ff9800'];
const textColors = ['#000000', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'];

export default function QuickNoteEditor({
    initialContent = '',
    placeholder = 'Escribe tu nota aqui...',
    onChange,
    minHeight = '150px',
    autoFocus = true
}: QuickNoteEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({ placeholder }),
            TaskList.configure({
                HTMLAttributes: { class: 'not-prose pl-2' },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: { class: 'flex items-start gap-2 my-1' },
            }),
            Highlight.configure({ multicolor: true }),
            TextStyle,
            Color,
        ],
        content: initialContent,
        immediatelyRender: false,
        autofocus: autoFocus ? 'end' : false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none p-3',
                style: `min-height: ${minHeight}`,
            },
        },
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getText(), editor.getHTML());
            }
        },
    });

    useEffect(() => {
        if (editor && initialContent && editor.isEmpty) {
            editor.commands.setContent(initialContent);
        }
    }, [editor, initialContent]);

    const ToolbarButton = useCallback(({
        onClick,
        isActive = false,
        children,
        title
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${
                isActive ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'
            }`}
        >
            {children}
        </button>
    ), []);

    if (!editor) return null;

    return (
        <div className="border dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            {/* Compact Toolbar */}
            <div className="border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {/* Bold, Italic */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="Negrita"
                >
                    <span className="font-bold text-xs">B</span>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="Cursiva"
                >
                    <span className="italic text-xs">I</span>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="Tachado"
                >
                    <span className="line-through text-xs">S</span>
                </ToolbarButton>

                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Headers */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                    title="Titulo 1"
                >
                    <span className="text-xs font-bold">H1</span>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Titulo 2"
                >
                    <span className="text-xs font-bold">H2</span>
                </ToolbarButton>

                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Lists */}
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                    title="Lista"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="4" cy="6" r="2" />
                        <circle cx="4" cy="12" r="2" />
                        <circle cx="4" cy="18" r="2" />
                        <rect x="8" y="5" width="14" height="2" rx="1" />
                        <rect x="8" y="11" width="14" height="2" rx="1" />
                        <rect x="8" y="17" width="14" height="2" rx="1" />
                    </svg>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                    title="Lista numerada"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <text x="2" y="8" fontSize="7" fontWeight="bold">1</text>
                        <text x="2" y="14" fontSize="7" fontWeight="bold">2</text>
                        <text x="2" y="20" fontSize="7" fontWeight="bold">3</text>
                        <rect x="10" y="5" width="12" height="2" rx="1" />
                        <rect x="10" y="11" width="12" height="2" rx="1" />
                        <rect x="10" y="17" width="12" height="2" rx="1" />
                    </svg>
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    isActive={editor.isActive('taskList')}
                    title="Checkbox"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="6" height="6" rx="1" />
                        <path d="M4.5 7l1.5 1.5 2.5-2.5" strokeWidth="1.5" />
                        <line x1="12" y1="7" x2="21" y2="7" />
                        <rect x="3" y="14" width="6" height="6" rx="1" />
                        <line x1="12" y1="17" x2="21" y2="17" />
                    </svg>
                </ToolbarButton>

                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Quick highlight colors */}
                <div className="flex items-center gap-0.5">
                    {highlightColors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                            className="w-4 h-4 rounded border border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title="Resaltar"
                        />
                    ))}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().unsetHighlight().run()}
                        className="w-4 h-4 rounded border border-gray-300 dark:border-gray-500 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                        title="Quitar resaltado"
                    >
                        x
                    </button>
                </div>

                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />

                {/* Text colors */}
                <div className="flex items-center gap-0.5">
                    {textColors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => editor.chain().focus().setColor(color).run()}
                            className="w-4 h-4 rounded hover:scale-110 transition-transform flex items-center justify-center"
                            title="Color de texto"
                        >
                            <span className="font-bold text-xs" style={{ color }}>A</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} className="quick-note-editor" />

            {/* Editor styles */}
            <style jsx global>{`
                .quick-note-editor .ProseMirror {
                    min-height: ${minHeight};
                    color: #111827;
                }
                .dark .quick-note-editor .ProseMirror {
                    color: #f3f4f6;
                }
                .quick-note-editor .ProseMirror p.is-editor-empty:first-child::before {
                    color: #9ca3af;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .dark .quick-note-editor .ProseMirror p.is-editor-empty:first-child::before {
                    color: #6b7280;
                }
                .quick-note-editor .ProseMirror h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0.75rem 0 0.5rem 0;
                }
                .quick-note-editor .ProseMirror h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0.5rem 0 0.375rem 0;
                }
                .quick-note-editor .ProseMirror h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin: 0.5rem 0 0.25rem 0;
                }
                .quick-note-editor .ProseMirror ul:not([data-type="taskList"]) {
                    list-style-type: disc;
                    padding-left: 1.25rem;
                    margin: 0.5rem 0;
                }
                .quick-note-editor .ProseMirror ol {
                    list-style-type: decimal;
                    padding-left: 1.25rem;
                    margin: 0.5rem 0;
                }
                .quick-note-editor .ProseMirror ul[data-type="taskList"] {
                    list-style: none;
                    padding: 0;
                }
                .quick-note-editor .ProseMirror ul[data-type="taskList"] li {
                    display: flex;
                    align-items: flex-start;
                }
                .quick-note-editor .ProseMirror ul[data-type="taskList"] li > label {
                    flex: 0 0 auto;
                    margin-right: 0.5rem;
                    user-select: none;
                }
                .quick-note-editor .ProseMirror ul[data-type="taskList"] li > div {
                    flex: 1 1 auto;
                }
                .quick-note-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
                    text-decoration: line-through;
                    color: #9ca3af;
                }
                .quick-note-editor .ProseMirror p {
                    margin: 0.25rem 0;
                }
                .quick-note-editor .ProseMirror mark {
                    border-radius: 0.125rem;
                    padding: 0 0.125rem;
                }
            `}</style>
        </div>
    );
}
