import { Mark, mergeAttributes } from '@tiptap/core';

export interface BacklinkOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        backlink: {
            setBacklink: (attributes: { noteId: string; noteTitle: string }) => ReturnType;
            unsetBacklink: () => ReturnType;
        };
    }
}

export const Backlink = Mark.create<BacklinkOptions>({
    name: 'backlink',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            noteId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-note-id'),
                renderHTML: (attributes) => {
                    if (!attributes.noteId) {
                        return {};
                    }
                    return {
                        'data-note-id': attributes.noteId,
                    };
                },
            },
            noteTitle: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-note-title'),
                renderHTML: (attributes) => {
                    if (!attributes.noteTitle) {
                        return {};
                    }
                    return {
                        'data-note-title': attributes.noteTitle,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-backlink]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-backlink': '',
                class: 'backlink bg-blue-100 text-blue-800 px-1 rounded cursor-pointer hover:bg-blue-200',
            }),
            0,
        ];
    },

    addCommands() {
        return {
            setBacklink:
                (attributes) =>
                ({ commands }) => {
                    return commands.setMark(this.name, attributes);
                },
            unsetBacklink:
                () =>
                ({ commands }) => {
                    return commands.unsetMark(this.name);
                },
        };
    },
});

export default Backlink;
