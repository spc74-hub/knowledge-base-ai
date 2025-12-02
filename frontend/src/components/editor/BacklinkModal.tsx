'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Note {
    id: string;
    title: string;
}

interface BacklinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (note: Note) => void;
    currentNoteId?: string;
}

export default function BacklinkModal({ isOpen, onClose, onSelect, currentNoteId }: BacklinkModalProps) {
    const [search, setSearch] = useState('');
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const fetchNotes = useCallback(async (query: string) => {
        setLoading(true);
        try {
            let queryBuilder = supabase
                .from('contents')
                .select('id, title')
                .eq('type', 'note')
                .order('updated_at', { ascending: false })
                .limit(10);

            if (currentNoteId) {
                queryBuilder = queryBuilder.neq('id', currentNoteId);
            }

            if (query) {
                queryBuilder = queryBuilder.ilike('title', `%${query}%`);
            }

            const { data, error } = await queryBuilder;

            if (error) throw error;
            setNotes(data || []);
            setSelectedIndex(0);
        } catch (err) {
            console.error('Error fetching notes:', err);
            setNotes([]);
        } finally {
            setLoading(false);
        }
    }, [currentNoteId]);

    useEffect(() => {
        if (isOpen) {
            fetchNotes('');
            setSearch('');
        }
    }, [isOpen, fetchNotes]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) {
                fetchNotes(search);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [search, isOpen, fetchNotes]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, notes.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (notes[selectedIndex]) {
                    onSelect(notes[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [isOpen, notes, selectedIndex, onSelect, onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono">[[</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar nota..."
                            className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        <span className="text-gray-500 font-mono">]]</span>
                    </div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">
                            Buscando...
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No se encontraron notas
                        </div>
                    ) : (
                        <ul>
                            {notes.map((note, index) => (
                                <li key={note.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(note)}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-2 ${
                                            index === selectedIndex ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <span className="text-gray-400">📝</span>
                                        <span className="truncate">{note.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
                    <span>↑↓ navegar</span>
                    <span>Enter seleccionar</span>
                    <span>Esc cerrar</span>
                </div>
            </div>
        </div>
    );
}
