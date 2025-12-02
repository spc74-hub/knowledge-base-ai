'use client';

import { Editor } from '@tiptap/react';
import { useCallback, useState } from 'react';

interface EditorToolbarProps {
    editor: Editor | null;
    onInsertBacklink?: () => void;
}

const colors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
];

const highlightColors = [
    '#ffeb3b', '#ffc107', '#ff9800', '#8bc34a', '#4caf50', '#00bcd4', '#03a9f4', '#e91e63', '#9c27b0', '#673ab7',
];

export default function EditorToolbar({ editor, onInsertBacklink }: EditorToolbarProps) {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const setLink = useCallback(() => {
        if (!editor) return;
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        setLinkUrl('');
        setShowLinkInput(false);
    }, [editor, linkUrl]);

    if (!editor) return null;

    const ToolbarButton = ({
        onClick,
        isActive = false,
        disabled = false,
        children,
        title
    }: {
        onClick: () => void;
        isActive?: boolean;
        disabled?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                isActive ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'
            }`}
        >
            {children}
        </button>
    );

    const Divider = () => <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />;

    return (
        <div className="border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-2 flex flex-wrap items-center gap-1">
            {/* Text Style Group */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Negrita (Ctrl+B)"
            >
                <span className="font-bold text-sm">B</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Cursiva (Ctrl+I)"
            >
                <span className="italic text-sm">I</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Subrayado (Ctrl+U)"
            >
                <span className="underline text-sm">U</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Tachado"
            >
                <span className="line-through text-sm">S</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                isActive={editor.isActive('subscript')}
                title="Subindice"
            >
                <span className="text-sm">X<sub>2</sub></span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                isActive={editor.isActive('superscript')}
                title="Superindice"
            >
                <span className="text-sm">X<sup>2</sup></span>
            </ToolbarButton>

            <Divider />

            {/* Headings Group */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Titulo 1"
            >
                <span className="text-sm font-bold">H1</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Titulo 2"
            >
                <span className="text-sm font-bold">H2</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Titulo 3"
            >
                <span className="text-sm font-bold">H3</span>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setParagraph().run()}
                isActive={editor.isActive('paragraph')}
                title="Parrafo normal"
            >
                <span className="text-sm">P</span>
            </ToolbarButton>

            <Divider />

            {/* Lists Group */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Lista con viñetas"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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
                title="Lista de tareas (checkbox)"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="5" height="5" rx="1" />
                    <path d="M4.5 6.5l1 1 2-2" strokeWidth="1.5" />
                    <rect x="3" y="10" width="5" height="5" rx="1" />
                    <rect x="3" y="16" width="5" height="5" rx="1" />
                    <line x1="11" y1="6.5" x2="21" y2="6.5" />
                    <line x1="11" y1="12.5" x2="21" y2="12.5" />
                    <line x1="11" y1="18.5" x2="21" y2="18.5" />
                </svg>
            </ToolbarButton>

            <Divider />

            {/* Alignment Group */}
            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                title="Alinear izquierda"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                </svg>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                title="Centrar"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                </svg>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                title="Alinear derecha"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                </svg>
            </ToolbarButton>

            <Divider />

            {/* Color Picker */}
            <div className="relative">
                <ToolbarButton
                    onClick={() => {
                        setShowColorPicker(!showColorPicker);
                        setShowHighlightPicker(false);
                    }}
                    title="Color de texto"
                >
                    <span className="text-sm font-bold" style={{ color: editor.getAttributes('textStyle').color || '#000' }}>A</span>
                    <div
                        className="w-4 h-1 mt-0.5"
                        style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }}
                    />
                </ToolbarButton>
                {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg z-50 grid grid-cols-6 gap-2" style={{ minWidth: '200px' }}>
                        {colors.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    editor.chain().focus().setColor(color).run();
                                    setShowColorPicker(false);
                                }}
                                className="w-7 h-7 rounded-md border-2 border-gray-200 dark:border-gray-600 hover:scale-110 hover:border-gray-400 transition-all"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                editor.chain().focus().unsetColor().run();
                                setShowColorPicker(false);
                            }}
                            className="col-span-6 mt-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            Quitar color
                        </button>
                    </div>
                )}
            </div>

            {/* Highlight Picker */}
            <div className="relative">
                <ToolbarButton
                    onClick={() => {
                        setShowHighlightPicker(!showHighlightPicker);
                        setShowColorPicker(false);
                    }}
                    isActive={editor.isActive('highlight')}
                    title="Resaltar texto"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.414 2.586a2 2 0 010 2.828L7.828 15l-4.95 1.414a1 1 0 01-1.292-1.292L3 10.172 12.586 .586a2 2 0 012.828 0l2 2zM4 16l.707-.707 1.586 1.586L4 18v-2z" />
                    </svg>
                </ToolbarButton>
                {showHighlightPicker && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg z-50 grid grid-cols-5 gap-2" style={{ minWidth: '180px' }}>
                        {highlightColors.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    editor.chain().focus().toggleHighlight({ color }).run();
                                    setShowHighlightPicker(false);
                                }}
                                className="w-7 h-7 rounded-md border-2 border-gray-200 dark:border-gray-600 hover:scale-110 hover:border-gray-400 transition-all"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                editor.chain().focus().unsetHighlight().run();
                                setShowHighlightPicker(false);
                            }}
                            className="col-span-5 mt-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                            Quitar resaltado
                        </button>
                    </div>
                )}
            </div>

            <Divider />

            {/* Quote and Code */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Cita"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive('code')}
                title="Codigo inline"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title="Bloque de codigo"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </ToolbarButton>

            <Divider />

            {/* Link */}
            <div className="relative">
                <ToolbarButton
                    onClick={() => {
                        if (editor.isActive('link')) {
                            editor.chain().focus().unsetLink().run();
                        } else {
                            setShowLinkInput(!showLinkInput);
                        }
                    }}
                    isActive={editor.isActive('link')}
                    title="Enlace"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </ToolbarButton>
                {showLinkInput && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg z-50 flex gap-2">
                        <input
                            type="text"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="px-2 py-1 border dark:border-gray-600 rounded text-sm w-48 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setLink();
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={setLink}
                            className="px-2 py-1 bg-gray-900 dark:bg-gray-600 text-white rounded text-sm hover:bg-gray-800 dark:hover:bg-gray-500"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>

            {/* Backlink */}
            {onInsertBacklink && (
                <ToolbarButton
                    onClick={onInsertBacklink}
                    title="Enlace a otra nota [[]]"
                >
                    <span className="text-sm font-mono">[[</span>
                </ToolbarButton>
            )}

            <Divider />

            {/* Table */}
            <ToolbarButton
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="Insertar tabla"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M3 3h18v18H3V3z" />
                </svg>
            </ToolbarButton>

            {editor.isActive('table') && (
                <>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        title="Agregar columna"
                    >
                        <span className="text-xs">+Col</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        title="Agregar fila"
                    >
                        <span className="text-xs">+Fila</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                        title="Eliminar columna"
                    >
                        <span className="text-xs text-red-500">-Col</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteRow().run()}
                        title="Eliminar fila"
                    >
                        <span className="text-xs text-red-500">-Fila</span>
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        title="Eliminar tabla"
                    >
                        <span className="text-xs text-red-500">Borrar</span>
                    </ToolbarButton>
                </>
            )}

            <Divider />

            {/* Horizontal Rule */}
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Linea horizontal"
            >
                <span className="text-sm">—</span>
            </ToolbarButton>

            {/* Undo/Redo */}
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Deshacer (Ctrl+Z)"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Rehacer (Ctrl+Y)"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
            </ToolbarButton>
        </div>
    );
}
