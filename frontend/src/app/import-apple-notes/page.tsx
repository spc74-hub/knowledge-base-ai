'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface AppleNotesFolder {
    id: string;
    name: string;
    note_count: number;
}

interface AppleNote {
    id: string;
    name: string;
    folder: string;
    creation_date?: string;
    modification_date?: string;
}

interface ImportResult {
    note_id: string;
    note_name: string;
    success: boolean;
    content_id?: string;
    error?: string;
}

interface ImportResponse {
    total: number;
    successful: number;
    failed: number;
    results: ImportResult[];
}

type ImportMode = 'folders' | 'notes' | 'all';

export default function ImportAppleNotesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // Data state
    const [folders, setFolders] = useState<AppleNotesFolder[]>([]);
    const [allNotes, setAllNotes] = useState<AppleNote[]>([]);
    const [notesInFolder, setNotesInFolder] = useState<AppleNote[]>([]);

    // Selection state
    const [importMode, setImportMode] = useState<ImportMode>('folders');
    const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
    const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
    const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

    // UI state
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [importing, setImporting] = useState(false);
    const [tags, setTags] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<ImportResponse | null>(null);
    const [progress, setProgress] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchFolders();
        }
    }, [user]);

    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('No session');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    };

    const fetchFolders = async () => {
        setLoadingFolders(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch('http://localhost:8000/api/v1/apple-notes/folders', {
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al obtener carpetas');
            }

            const data = await response.json();
            setFolders(data.folders);

        } catch (err: any) {
            setError(err.message || 'Error al conectar con Apple Notes');
        } finally {
            setLoadingFolders(false);
        }
    };

    const fetchAllNotes = async () => {
        if (allNotes.length > 0) return; // Already loaded

        setLoadingNotes(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch('http://localhost:8000/api/v1/apple-notes/notes', {
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al obtener notas');
            }

            const data = await response.json();
            setAllNotes(data.notes);

        } catch (err: any) {
            setError(err.message || 'Error al obtener notas');
        } finally {
            setLoadingNotes(false);
        }
    };

    const fetchNotesInFolder = async (folderName: string) => {
        setLoadingNotes(true);
        setError(null);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(
                `http://localhost:8000/api/v1/apple-notes/notes/${encodeURIComponent(folderName)}`,
                { headers }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al obtener notas');
            }

            const data = await response.json();
            setNotesInFolder(data.notes);
            setExpandedFolder(folderName);

        } catch (err: any) {
            setError(err.message || 'Error al obtener notas de la carpeta');
        } finally {
            setLoadingNotes(false);
        }
    };

    const toggleFolderSelection = (folderName: string) => {
        const newSelection = new Set(selectedFolders);
        if (newSelection.has(folderName)) {
            newSelection.delete(folderName);
        } else {
            newSelection.add(folderName);
        }
        setSelectedFolders(newSelection);
    };

    const toggleNoteSelection = (noteId: string) => {
        const newSelection = new Set(selectedNotes);
        if (newSelection.has(noteId)) {
            newSelection.delete(noteId);
        } else {
            newSelection.add(noteId);
        }
        setSelectedNotes(newSelection);
    };

    const selectAllNotesInFolder = (folderName: string) => {
        const folderNotes = allNotes.filter(n => n.folder === folderName);
        const newSelection = new Set(selectedNotes);
        folderNotes.forEach(n => newSelection.add(n.id));
        setSelectedNotes(newSelection);
    };

    const deselectAllNotesInFolder = (folderName: string) => {
        const folderNotes = allNotes.filter(n => n.folder === folderName);
        const folderNoteIds = new Set(folderNotes.map(n => n.id));
        const newSelection = new Set([...selectedNotes].filter(id => !folderNoteIds.has(id)));
        setSelectedNotes(newSelection);
    };

    const handleImport = async () => {
        setError(null);
        setResults(null);
        setImporting(true);

        try {
            const headers = await getAuthHeaders();
            const tagsList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

            let endpoint: string;
            let body: any;

            if (importMode === 'all') {
                endpoint = 'http://localhost:8000/api/v1/apple-notes/import-all';
                body = { tags: tagsList };
                setProgress('Importando todas las notas...');
            } else if (importMode === 'folders' && selectedFolders.size > 0) {
                // Import folders one by one
                const allResults: ImportResult[] = [];
                let totalSuccessful = 0;
                let totalFailed = 0;

                for (const folderName of selectedFolders) {
                    setProgress(`Importando carpeta: ${folderName}...`);

                    const response = await fetch('http://localhost:8000/api/v1/apple-notes/import-folder', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ folder_name: folderName, tags: tagsList }),
                    });

                    if (response.ok) {
                        const data: ImportResponse = await response.json();
                        allResults.push(...data.results);
                        totalSuccessful += data.successful;
                        totalFailed += data.failed;
                    }
                }

                setResults({
                    total: allResults.length,
                    successful: totalSuccessful,
                    failed: totalFailed,
                    results: allResults,
                });
                setProgress(null);
                setImporting(false);
                return;

            } else if (importMode === 'notes' && selectedNotes.size > 0) {
                endpoint = 'http://localhost:8000/api/v1/apple-notes/import';
                body = { note_ids: Array.from(selectedNotes), tags: tagsList };
                setProgress(`Importando ${selectedNotes.size} notas seleccionadas...`);
            } else {
                setError('Selecciona al menos una carpeta o nota para importar');
                setImporting(false);
                return;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en la importacion');
            }

            const data: ImportResponse = await response.json();
            setResults(data);
            setProgress(null);

            // Clear selections if successful
            if (data.failed === 0) {
                setSelectedFolders(new Set());
                setSelectedNotes(new Set());
            }

        } catch (err: any) {
            setError(err.message || 'Error en la importacion');
            setProgress(null);
        } finally {
            setImporting(false);
        }
    };

    const handleModeChange = (mode: ImportMode) => {
        setImportMode(mode);
        setSelectedFolders(new Set());
        setSelectedNotes(new Set());
        setExpandedFolder(null);

        if (mode === 'notes' && allNotes.length === 0) {
            fetchAllNotes();
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const totalNotes = folders.reduce((sum, f) => sum + f.note_count, 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                            ← Volver
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importar desde Apple Notes</h1>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    {/* Info section */}
                    <div className="mb-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            Importa notas desde Apple Notes. Puedes seleccionar carpetas completas,
                            notas individuales o importar todo tu contenido.
                        </p>
                        {loadingFolders ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Cargando carpetas...</p>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Encontradas {folders.length} carpetas con {totalNotes} notas en total
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Import mode selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Modo de importacion
                        </label>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleModeChange('folders')}
                                className={`px-4 py-2 rounded-lg border ${
                                    importMode === 'folders'
                                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                Por Carpetas
                            </button>
                            <button
                                onClick={() => handleModeChange('notes')}
                                className={`px-4 py-2 rounded-lg border ${
                                    importMode === 'notes'
                                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                Por Notas
                            </button>
                            <button
                                onClick={() => handleModeChange('all')}
                                className={`px-4 py-2 rounded-lg border ${
                                    importMode === 'all'
                                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                Importar Todo
                            </button>
                        </div>
                    </div>

                    {/* Folders mode */}
                    {importMode === 'folders' && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Selecciona carpetas ({selectedFolders.size} seleccionadas)
                            </label>
                            {loadingFolders ? (
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
                                    Cargando carpetas...
                                </div>
                            ) : (
                                <div className="border dark:border-gray-600 rounded-lg divide-y dark:divide-gray-600 max-h-96 overflow-y-auto">
                                    {folders.map((folder) => (
                                        <div key={folder.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFolders.has(folder.name)}
                                                    onChange={() => toggleFolderSelection(folder.name)}
                                                    className="h-4 w-4 text-gray-900 dark:text-gray-100 rounded"
                                                />
                                                <span className="flex-1 font-medium dark:text-gray-200">{folder.name}</span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    {folder.note_count} notas
                                                </span>
                                            </label>
                                            {selectedFolders.has(folder.name) && (
                                                <button
                                                    onClick={() => fetchNotesInFolder(folder.name)}
                                                    className="ml-7 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    Ver notas
                                                </button>
                                            )}
                                            {expandedFolder === folder.name && (
                                                <div className="ml-7 mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                                                    {loadingNotes ? (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando notas...</p>
                                                    ) : (
                                                        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                                            {notesInFolder.map((note) => (
                                                                <li key={note.id} className="truncate">
                                                                    • {note.name}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes mode */}
                    {importMode === 'notes' && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Selecciona notas ({selectedNotes.size} seleccionadas)
                            </label>
                            {loadingNotes ? (
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-400"></div>
                                    Cargando notas...
                                </div>
                            ) : (
                                <div className="border dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto">
                                    {/* Group notes by folder */}
                                    {folders.map((folder) => {
                                        const folderNotes = allNotes.filter(n => n.folder === folder.name);
                                        if (folderNotes.length === 0) return null;

                                        const allSelected = folderNotes.every(n => selectedNotes.has(n.id));
                                        const someSelected = folderNotes.some(n => selectedNotes.has(n.id));

                                        return (
                                            <div key={folder.id} className="border-b dark:border-gray-600 last:border-b-0">
                                                <div className="p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
                                                    <span className="font-medium dark:text-gray-200">{folder.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {folderNotes.filter(n => selectedNotes.has(n.id)).length}/{folderNotes.length}
                                                        </span>
                                                        <button
                                                            onClick={() =>
                                                                allSelected
                                                                    ? deselectAllNotesInFolder(folder.name)
                                                                    : selectAllNotesInFolder(folder.name)
                                                            }
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                        >
                                                            {allSelected ? 'Deseleccionar' : 'Seleccionar'} todas
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="divide-y dark:divide-gray-600">
                                                    {folderNotes.map((note) => (
                                                        <label
                                                            key={note.id}
                                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedNotes.has(note.id)}
                                                                onChange={() => toggleNoteSelection(note.id)}
                                                                className="h-4 w-4 text-gray-900 dark:text-gray-100 rounded"
                                                            />
                                                            <span className="flex-1 truncate dark:text-gray-300">{note.name}</span>
                                                            {note.modification_date && (
                                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                                    {note.modification_date.split(' ')[0]}
                                                                </span>
                                                            )}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* All mode */}
                    {importMode === 'all' && (
                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-yellow-800 dark:text-yellow-400">
                                <strong>Atencion:</strong> Esto importara todas las {totalNotes} notas
                                de todas las carpetas. El proceso puede tardar varios minutos.
                            </p>
                        </div>
                    )}

                    {/* Tags */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tags adicionales (opcional, separados por coma)
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="personal, ideas, proyectos"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            disabled={importing}
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Se añadira automaticamente un tag con el nombre de la carpeta de origen.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleImport}
                            disabled={importing || (importMode === 'folders' && selectedFolders.size === 0) || (importMode === 'notes' && selectedNotes.size === 0)}
                            className="px-6 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {importing ? 'Importando...' : 'Importar Notas'}
                        </button>
                        <Link
                            href="/dashboard"
                            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                        >
                            Cancelar
                        </Link>
                    </div>

                    {/* Progress */}
                    {progress && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                <span className="text-blue-800 dark:text-blue-400">{progress}</span>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {results && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 dark:text-white">Resultados</h3>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{results.total}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">Total</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{results.successful}</p>
                                    <p className="text-sm text-green-700 dark:text-green-400">Exitosas</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failed}</p>
                                    <p className="text-sm text-red-700 dark:text-red-400">Fallidas</p>
                                </div>
                            </div>

                            {/* Detailed results */}
                            <div className="border dark:border-gray-600 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                                Nota
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                        {results.results.map((result, idx) => (
                                            <tr key={idx} className={result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {result.success ? (
                                                        <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                                                    ) : (
                                                        <span className="text-red-600 dark:text-red-400 text-lg">✗</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm truncate block max-w-xs dark:text-gray-300">
                                                        {result.note_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {result.success ? (
                                                        <span className="text-sm text-green-700 dark:text-green-400">Importada correctamente</span>
                                                    ) : (
                                                        <span className="text-sm text-red-700 dark:text-red-400">{result.error}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {results.successful > 0 && (
                                <div className="mt-4">
                                    <Link
                                        href="/dashboard"
                                        className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                                    >
                                        Ver notas importadas →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
