'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';

import EditorToolbar from './EditorToolbar';
import BacklinkModal from './BacklinkModal';
import { Backlink } from './BacklinkExtension';

interface NoteEditorProps {
    initialContent?: string;
    placeholder?: string;
    currentNoteId?: string;
    onChange?: (content: string, html: string) => void;
    disabled?: boolean;
}

export default function NoteEditor({
    initialContent = '',
    placeholder = 'Escribe tu nota aqui...',
    currentNoteId,
    onChange,
    disabled = false
}: NoteEditorProps) {
    const [showBacklinkModal, setShowBacklinkModal] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6],
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            Underline,
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'border-collapse border border-gray-300 my-4',
                },
            }),
            TableRow,
            TableCell.configure({
                HTMLAttributes: {
                    class: 'border border-gray-300 p-2 min-w-[100px]',
                },
            }),
            TableHeader.configure({
                HTMLAttributes: {
                    class: 'border border-gray-300 p-2 bg-gray-100 font-bold',
                },
            }),
            TaskList.configure({
                HTMLAttributes: {
                    class: 'not-prose pl-2',
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: 'flex items-start gap-2 my-1',
                },
            }),
            Highlight.configure({
                multicolor: true,
            }),
            TextStyle,
            Color,
            Link.configure({
                openOnClick: true,
                HTMLAttributes: {
                    class: 'text-blue-600 underline hover:text-blue-800',
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Subscript,
            Superscript,
            Backlink,
        ],
        content: initialContent,
        immediatelyRender: false,
        editable: !disabled,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[300px] p-4',
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

    useEffect(() => {
        if (editor) {
            editor.setEditable(!disabled);
        }
    }, [editor, disabled]);

    const handleBacklinkSelect = useCallback((note: { id: string; title: string }) => {
        if (editor) {
            editor
                .chain()
                .focus()
                .insertContent(`[[${note.title}]]`)
                .setBacklink({ noteId: note.id, noteTitle: note.title })
                .run();
        }
        setShowBacklinkModal(false);
    }, [editor]);

    const handleInsertBacklink = useCallback(() => {
        setShowBacklinkModal(true);
    }, []);

    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            <EditorToolbar
                editor={editor}
                onInsertBacklink={handleInsertBacklink}
            />
            <div className="relative">
                <EditorContent editor={editor} />
            </div>

            <BacklinkModal
                isOpen={showBacklinkModal}
                onClose={() => setShowBacklinkModal(false)}
                onSelect={handleBacklinkSelect}
                currentNoteId={currentNoteId}
            />

            {/* Editor styles */}
            <style jsx global>{`
                .ProseMirror {
                    min-height: 300px;
                }

                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #adb5bd;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }

                /* Headers */
                .ProseMirror h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 1.5rem 0 1rem 0;
                    line-height: 1.2;
                }

                .ProseMirror h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 1.25rem 0 0.75rem 0;
                    line-height: 1.3;
                }

                .ProseMirror h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 1rem 0 0.5rem 0;
                    line-height: 1.4;
                }

                .ProseMirror h4 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    margin: 1rem 0 0.5rem 0;
                }

                /* Bullet List */
                .ProseMirror ul:not([data-type="taskList"]) {
                    list-style-type: disc;
                    padding-left: 1.5rem;
                    margin: 0.75rem 0;
                }

                .ProseMirror ul:not([data-type="taskList"]) li {
                    margin: 0.25rem 0;
                }

                .ProseMirror ul:not([data-type="taskList"]) ul {
                    list-style-type: circle;
                }

                .ProseMirror ul:not([data-type="taskList"]) ul ul {
                    list-style-type: square;
                }

                /* Ordered List */
                .ProseMirror ol {
                    list-style-type: decimal;
                    padding-left: 1.5rem;
                    margin: 0.75rem 0;
                }

                .ProseMirror ol li {
                    margin: 0.25rem 0;
                }

                .ProseMirror ol ol {
                    list-style-type: lower-alpha;
                }

                .ProseMirror ol ol ol {
                    list-style-type: lower-roman;
                }

                /* Paragraphs */
                .ProseMirror p {
                    margin: 0.5rem 0;
                }

                .ProseMirror table {
                    border-collapse: collapse;
                    margin: 1rem 0;
                    overflow: hidden;
                    table-layout: fixed;
                    width: 100%;
                }

                .ProseMirror table td,
                .ProseMirror table th {
                    border: 1px solid #d1d5db;
                    box-sizing: border-box;
                    min-width: 1em;
                    padding: 0.5rem;
                    position: relative;
                    vertical-align: top;
                }

                .ProseMirror table th {
                    background-color: #f3f4f6;
                    font-weight: bold;
                }

                .ProseMirror table .selectedCell:after {
                    background: rgba(59, 130, 246, 0.1);
                    content: "";
                    left: 0;
                    right: 0;
                    top: 0;
                    bottom: 0;
                    pointer-events: none;
                    position: absolute;
                    z-index: 2;
                }

                .ProseMirror ul[data-type="taskList"] {
                    list-style: none;
                    padding: 0;
                }

                .ProseMirror ul[data-type="taskList"] li {
                    display: flex;
                    align-items: flex-start;
                }

                .ProseMirror ul[data-type="taskList"] li > label {
                    flex: 0 0 auto;
                    margin-right: 0.5rem;
                    user-select: none;
                }

                .ProseMirror ul[data-type="taskList"] li > div {
                    flex: 1 1 auto;
                }

                .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
                    text-decoration: line-through;
                    color: #9ca3af;
                }

                .ProseMirror blockquote {
                    border-left: 3px solid #d1d5db;
                    margin: 1rem 0;
                    padding-left: 1rem;
                    color: #6b7280;
                }

                .ProseMirror pre {
                    background: #1f2937;
                    border-radius: 0.5rem;
                    color: #f9fafb;
                    font-family: 'JetBrains Mono', monospace;
                    padding: 1rem;
                    margin: 1rem 0;
                }

                .ProseMirror code {
                    background-color: #f3f4f6;
                    border-radius: 0.25rem;
                    color: #ef4444;
                    font-size: 0.875rem;
                    padding: 0.25rem 0.5rem;
                }

                .ProseMirror pre code {
                    background: none;
                    color: inherit;
                    font-size: 0.875rem;
                    padding: 0;
                }

                .ProseMirror hr {
                    border: none;
                    border-top: 2px solid #e5e7eb;
                    margin: 2rem 0;
                }

                .ProseMirror mark {
                    border-radius: 0.25rem;
                    padding: 0.125rem 0;
                }

                .ProseMirror a {
                    color: #2563eb;
                    cursor: pointer;
                    text-decoration: underline;
                }

                .ProseMirror a:hover {
                    color: #1d4ed8;
                }

                .ProseMirror .backlink {
                    background-color: #dbeafe;
                    color: #1e40af;
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.25rem;
                    cursor: pointer;
                }

                .ProseMirror .backlink:hover {
                    background-color: #bfdbfe;
                }
            `}</style>
        </div>
    );
}
