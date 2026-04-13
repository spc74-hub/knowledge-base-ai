'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Hardcoded API URL - always use HTTPS in production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ImportResult {
    url: string;
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

interface ImportStatus {
    queued: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
}

interface QueueResponse {
    queued: number;
    duplicates: number;
    invalid: number;
    details: { url: string; status: string; error?: string }[];
}

type ImportMode = 'normal' | 'queue' | 'csv' | 'files' | 'google-drive';

interface FileUploadResult {
    filename: string;
    success: boolean;
    content_id?: string;
    title?: string;
    error?: string;
}

interface FileUploadResponse {
    total: number;
    successful: number;
    failed: number;
    results: FileUploadResult[];
}

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    isFolder: boolean;
    isSupported: boolean;
    fileType: string;
    webViewLink?: string;
    modifiedTime?: string;
}

interface DriveImportResult {
    file_id: string;
    file_name: string;
    success: boolean;
    content_id?: string;
    error?: string;
}

export default function ImportPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [urls, setUrls] = useState('');
    const [tags, setTags] = useState('');
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [results, setResults] = useState<ImportResponse | null>(null);
    const [queueResults, setQueueResults] = useState<QueueResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showOnlyFailed, setShowOnlyFailed] = useState(false);
    const [importMode, setImportMode] = useState<ImportMode>('normal');
    const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);
    const [fileResults, setFileResults] = useState<FileUploadResponse | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Google Drive state
    const [driveConnected, setDriveConnected] = useState(false);
    const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
    const [driveLoading, setDriveLoading] = useState(false);
    const [driveCurrentFolder, setDriveCurrentFolder] = useState<string | null>(null);
    const [driveFolderPath, setDriveFolderPath] = useState<{id: string; name: string}[]>([]);
    const [driveSelectedFiles, setDriveSelectedFiles] = useState<Set<string>>(new Set());
    const [driveImportResults, setDriveImportResults] = useState<DriveImportResult[] | null>(null);
    const [driveNextPageToken, setDriveNextPageToken] = useState<string | null>(null);
    const [driveSearchQuery, setDriveSearchQuery] = useState('');
    const [driveOrderBy, setDriveOrderBy] = useState('modifiedTime desc');
    const [driveFileTypeFilter, setDriveFileTypeFilter] = useState<string>('all');

    const getAuthHeaders = useCallback(async () => {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
            throw new Error('No session');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`,
        };
    }, []);

    const fetchImportStatus = useCallback(async () => {
        try {
            setLoadingStatus(true);
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/content/import-status`, {
                headers,
            });
            if (response.ok) {
                const data = await response.json();
                setImportStatus(data);
            }
        } catch (err) {
            console.error('Error fetching import status:', err);
        } finally {
            setLoadingStatus(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchImportStatus();
            // Refresh status every 30 seconds
            const interval = setInterval(fetchImportStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [user, fetchImportStatus]);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResults(null);
        setQueueResults(null);
        setImporting(true);

        const urlList = urls
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urlList.length === 0) {
            setError('Por favor, introduce al menos una URL');
            setImporting(false);
            return;
        }

        try {
            const headers = await getAuthHeaders();

            if (importMode === 'queue') {
                // Queue mode - instant save, background processing
                setProgress(`Encolando ${urlList.length} URLs...`);
                const response = await fetch(`${API_URL}/api/v1/content/queue-urls`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        urls: urlList,
                        tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error al encolar URLs');
                }

                const data: QueueResponse = await response.json();
                setQueueResults(data);
                setProgress(null);

                if (data.queued > 0) {
                    setUrls('');
                    setTags('');
                }
                fetchImportStatus();
            } else {
                // Normal mode - process immediately
                setProgress(`Procesando ${urlList.length} URLs...`);
                const response = await fetch(`${API_URL}/api/v1/content/bulk-import`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        urls: urlList,
                        tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en la importacion');
                }

                const data: ImportResponse = await response.json();
                setResults(data);
                setProgress(null);

                if (data.failed === 0) {
                    setUrls('');
                    setTags('');
                }
                fetchImportStatus();
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error en la importacion';
            setError(errorMessage);
            setProgress(null);
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setError(null);
        setResults(null);
        setQueueResults(null);
        setFileResults(null);
        setImporting(true);
        setProgress(`Subiendo ${files.length} archivo(s)...`);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            if (tags.trim()) {
                formData.append('tags', tags);
            }

            const response = await fetch(`${API_URL}/api/v1/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al subir archivos');
            }

            const data: FileUploadResponse = await response.json();
            setFileResults(data);
            setProgress(null);
            fetchImportStatus();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error al subir archivos';
            setError(errorMessage);
            setProgress(null);
        } finally {
            setImporting(false);
            if (docInputRef.current) {
                docInputRef.current.value = '';
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    // Google Drive functions
    const checkDriveConnection = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/google-drive/auth/status`, { headers });
            if (response.ok) {
                const data = await response.json();
                setDriveConnected(data.connected);
                if (data.connected) {
                    loadDriveFiles();
                }
            }
        } catch (err) {
            console.error('Error checking Drive connection:', err);
        }
    }, [getAuthHeaders]);

    const connectToDrive = async () => {
        console.log('connectToDrive called');
        setError(null);
        try {
            console.log('Getting auth headers...');
            const headers = await getAuthHeaders();
            console.log('Auth headers obtained, calling API...');
            const response = await fetch(`${API_URL}/api/v1/google-drive/auth/url`, { headers });
            console.log('API response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Auth URL received, redirecting...');
                window.location.href = data.auth_url;
            } else {
                const errorData = await response.json();
                console.error('API error:', errorData);
                setError(errorData.detail || 'Error al obtener URL de autorizacion');
            }
        } catch (err) {
            console.error('Error getting auth URL:', err);
            setError(`Error al conectar con Google Drive: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
    };

    const disconnectDrive = async () => {
        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_URL}/api/v1/google-drive/auth/disconnect`, {
                method: 'POST',
                headers
            });
            setDriveConnected(false);
            setDriveFiles([]);
            setDriveSelectedFiles(new Set());
            setDriveCurrentFolder(null);
            setDriveFolderPath([]);
            setDriveNextPageToken(null);
        } catch (err) {
            console.error('Error disconnecting:', err);
        }
    };

    const loadDriveFiles = useCallback(async (
        folderId?: string | null,
        pageToken?: string | null,
        searchQuery?: string,
        orderBy?: string
    ) => {
        setDriveLoading(true);
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (folderId) params.append('folder_id', folderId);
            if (pageToken) params.append('page_token', pageToken);
            if (searchQuery) params.append('search', searchQuery);
            if (orderBy) params.append('order_by', orderBy);

            const url = `${API_URL}/api/v1/google-drive/files${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetch(url, { headers });
            if (response.ok) {
                const data = await response.json();
                // If loading more (pageToken exists), append to existing files
                if (pageToken) {
                    setDriveFiles(prev => [...prev, ...data.files]);
                } else {
                    setDriveFiles(data.files);
                    setDriveFolderPath(data.folderPath || []);
                    if (!searchQuery) {
                        setDriveCurrentFolder(folderId || null);
                    }
                }
                setDriveNextPageToken(data.nextPageToken || null);
            } else if (response.status === 401) {
                setDriveConnected(false);
            }
        } catch (err) {
            console.error('Error loading files:', err);
        } finally {
            setDriveLoading(false);
        }
    }, [getAuthHeaders]);

    const handleDriveFileClick = (file: DriveFile) => {
        if (file.isFolder) {
            setDriveSearchQuery('');
            loadDriveFiles(file.id, null, '', driveOrderBy);
        } else if (file.isSupported) {
            const newSelected = new Set(driveSelectedFiles);
            if (newSelected.has(file.id)) {
                newSelected.delete(file.id);
            } else {
                newSelected.add(file.id);
            }
            setDriveSelectedFiles(newSelected);
        }
    };

    // Filter files by type
    const filterFileByType = (file: DriveFile): boolean => {
        if (file.isFolder) return true; // Always show folders
        if (driveFileTypeFilter === 'all') return true;

        const mime = file.mimeType;
        switch (driveFileTypeFilter) {
            case 'pdf':
                return mime.includes('pdf');
            case 'doc':
                return mime.includes('document') || mime.includes('msword') || mime.includes('wordprocessing');
            case 'sheet':
                return mime.includes('spreadsheet') || mime.includes('excel');
            case 'slides':
                return mime.includes('presentation') || mime.includes('powerpoint');
            case 'email':
                return mime === 'message/rfc822';
            case 'audio':
                return mime.startsWith('audio/');
            case 'text':
                return mime.includes('text/') || mime.includes('markdown');
            default:
                return true;
        }
    };

    const filteredDriveFiles = driveFiles.filter(filterFileByType);

    const selectAllDriveFiles = () => {
        const supportedFiles = filteredDriveFiles.filter(f => f.isSupported && !f.isFolder);
        if (driveSelectedFiles.size === supportedFiles.length) {
            setDriveSelectedFiles(new Set());
        } else {
            setDriveSelectedFiles(new Set(supportedFiles.map(f => f.id)));
        }
    };

    const importSelectedDriveFiles = async () => {
        if (driveSelectedFiles.size === 0) return;

        setImporting(true);
        setDriveImportResults(null);
        setProgress(`Importando ${driveSelectedFiles.size} archivos...`);

        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/v1/google-drive/import`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    file_ids: Array.from(driveSelectedFiles),
                    tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                })
            });

            if (response.ok) {
                const data = await response.json();
                setDriveImportResults(data.results);
                setDriveSelectedFiles(new Set());
                fetchImportStatus();
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Error al importar archivos');
            }
        } catch (err) {
            console.error('Error importing files:', err);
            setError('Error al importar archivos');
        } finally {
            setImporting(false);
            setProgress(null);
        }
    };

    // Check for Google Drive callback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('source') === 'google-drive') {
            setImportMode('google-drive');
            if (params.get('connected') === 'true') {
                checkDriveConnection();
            } else if (params.get('error')) {
                setError(`Error de Google Drive: ${params.get('error')}`);
            }
            // Clean URL
            window.history.replaceState({}, '', '/import');
        }
    }, [checkDriveConnection]);

    // Check Drive connection when mode changes
    useEffect(() => {
        if (importMode === 'google-drive' && user) {
            checkDriveConnection();
        }
    }, [importMode, user, checkDriveConnection]);

    const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setResults(null);
        setQueueResults(null);
        setImporting(true);
        setProgress('Procesando archivo CSV...');

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/api/v1/content/import-csv`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al importar CSV');
            }

            const data: QueueResponse = await response.json();
            setQueueResults(data);
            setProgress(null);
            fetchImportStatus();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Error al importar CSV';
            setError(errorMessage);
            setProgress(null);
        } finally {
            setImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const urlCount = urls.split('\n').filter(u => u.trim()).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                            ← Volver
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importar URLs</h1>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Import Status Panel */}
                {importStatus && (importStatus.queued > 0 || importStatus.pending > 0 || importStatus.processing > 0) && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Estado del procesamiento</h2>
                            <button
                                onClick={fetchImportStatus}
                                disabled={loadingStatus}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                                {loadingStatus ? 'Actualizando...' : 'Actualizar'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-center">
                                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{importStatus.queued}</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-400">En cola</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{importStatus.pending}</p>
                                <p className="text-xs text-blue-700 dark:text-blue-400">Pendientes</p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
                                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{importStatus.processing}</p>
                                <p className="text-xs text-purple-700 dark:text-purple-400">Procesando</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">{importStatus.completed}</p>
                                <p className="text-xs text-green-700 dark:text-green-400">Completados</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-center">
                                <p className="text-xl font-bold text-red-600 dark:text-red-400">{importStatus.failed}</p>
                                <p className="text-xs text-red-700 dark:text-red-400">Fallidos</p>
                            </div>
                        </div>
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            El procesamiento en segundo plano se ejecuta cada 15 minutos (50 items por ciclo).
                        </p>
                    </div>
                )}

                {/* Import Form */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Importacion masiva de URLs</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Importa URLs de forma masiva. Puedes pegar URLs directamente o subir un archivo CSV.
                        </p>
                    </div>

                    {/* Import Mode Selector */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Modo de importacion
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <button
                                type="button"
                                onClick={() => setImportMode('normal')}
                                className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                    importMode === 'normal'
                                        ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="block font-medium">Normal</span>
                                <span className="block text-xs opacity-75">Hasta 100 URLs</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportMode('queue')}
                                className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                    importMode === 'queue'
                                        ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="block font-medium">Cola masiva</span>
                                <span className="block text-xs opacity-75">+1000 URLs</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportMode('csv')}
                                className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                    importMode === 'csv'
                                        ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="block font-medium">Archivo CSV</span>
                                <span className="block text-xs opacity-75">Con tags</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportMode('files')}
                                className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                    importMode === 'files'
                                        ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="block font-medium">Documentos</span>
                                <span className="block text-xs opacity-75">PDF, Word, Email</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setImportMode('google-drive')}
                                className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                                    importMode === 'google-drive'
                                        ? 'border-blue-500 dark:border-blue-400 bg-blue-500 dark:bg-blue-600 text-white'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="block font-medium">Google Drive</span>
                                <span className="block text-xs opacity-75">Docs, PDF, Email</span>
                            </button>
                        </div>
                    </div>

                    {/* Mode descriptions */}
                    {importMode === 'queue' && (
                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                <strong>Modo Cola:</strong> Las URLs se guardan instantaneamente y se procesan en segundo plano.
                                Ideal para importaciones masivas (+1000 URLs). El contenido se obtendra y clasificara automaticamente
                                cada 15 minutos.
                            </p>
                        </div>
                    )}

                    {importMode === 'csv' && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Formato CSV:</strong> El archivo debe tener columnas <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">url</code> y opcionalmente <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">tags</code>.
                                Los tags se separan por comas dentro de comillas.
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                Ejemplo: <code>url,tags</code> → <code>https://example.com,&quot;tag1,tag2&quot;</code>
                            </p>
                        </div>
                    )}

                    {importMode === 'files' && (
                        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <p className="text-sm text-purple-800 dark:text-purple-300">
                                <strong>Documentos:</strong> Sube archivos PDF, Word (.docx) o emails (.eml).
                                El contenido se extraera automaticamente y se procesara en segundo plano.
                            </p>
                            <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                                Tamano maximo: 50MB por archivo
                            </p>
                        </div>
                    )}

                    {importMode === 'google-drive' && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Google Drive:</strong> Conecta tu cuenta de Google para importar documentos.
                                Se extrae solo el texto - el archivo original permanece en Drive.
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                Soporta: Google Docs, Sheets, Slides, PDF, Word, Excel, PowerPoint, Email (.eml), Audio (m4a, mp3, wav) y archivos de texto
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {importMode === 'google-drive' ? (
                        /* Google Drive Browser */
                        <div className="space-y-4">
                            {!driveConnected ? (
                                <div className="text-center py-8">
                                    <div className="text-6xl mb-4">📁</div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        Conectar con Google Drive
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Autoriza el acceso para ver y seleccionar tus documentos
                                    </p>
                                    <button
                                        onClick={connectToDrive}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm6.804 16.25H5.196L1.5 9.75l3.696-6.5h13.608l3.696 6.5-3.696 6.5z"/>
                                        </svg>
                                        Conectar Google Drive
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Drive Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-600 dark:text-green-400">●</span>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Conectado</span>
                                            <button
                                                onClick={disconnectDrive}
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline ml-2"
                                            >
                                                Desconectar
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => loadDriveFiles(
                                                driveSearchQuery ? null : driveCurrentFolder,
                                                null,
                                                driveSearchQuery || '',
                                                driveOrderBy
                                            )}
                                            disabled={driveLoading}
                                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                                        >
                                            {driveLoading ? 'Cargando...' : 'Actualizar'}
                                        </button>
                                    </div>

                                    {/* Breadcrumb navigation */}
                                    <div className="flex items-center gap-1 text-sm flex-wrap">
                                        <button
                                            onClick={() => {
                                                setDriveSearchQuery('');
                                                loadDriveFiles(null, null, '', driveOrderBy);
                                            }}
                                            className="text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            Mi Drive
                                        </button>
                                        {driveFolderPath.map((folder) => (
                                            <span key={folder.id} className="flex items-center gap-1">
                                                <span className="text-gray-400">/</span>
                                                <button
                                                    onClick={() => {
                                                        setDriveSearchQuery('');
                                                        loadDriveFiles(folder.id, null, '', driveOrderBy);
                                                    }}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {folder.name}
                                                </button>
                                            </span>
                                        ))}
                                    </div>

                                    {/* Search and sort controls */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={driveSearchQuery}
                                                    onChange={(e) => setDriveSearchQuery(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && driveSearchQuery.trim()) {
                                                            loadDriveFiles(null, null, driveSearchQuery.trim(), driveOrderBy);
                                                        }
                                                    }}
                                                    placeholder="Buscar en todo Drive..."
                                                    className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                                {driveSearchQuery && (
                                                    <button
                                                        onClick={() => {
                                                            setDriveSearchQuery('');
                                                            loadDriveFiles(driveCurrentFolder, null, '', driveOrderBy);
                                                        }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    if (driveSearchQuery.trim()) {
                                                        loadDriveFiles(null, null, driveSearchQuery.trim(), driveOrderBy);
                                                    }
                                                }}
                                                disabled={!driveSearchQuery.trim() || driveLoading}
                                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Buscar
                                            </button>
                                            <select
                                                value={driveOrderBy}
                                                onChange={(e) => {
                                                    setDriveOrderBy(e.target.value);
                                                    loadDriveFiles(
                                                        driveSearchQuery ? null : driveCurrentFolder,
                                                        null,
                                                        driveSearchQuery || '',
                                                        e.target.value
                                                    );
                                                }}
                                                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="modifiedTime desc">Recientes primero</option>
                                                <option value="modifiedTime">Antiguos primero</option>
                                                <option value="name">Nombre A-Z</option>
                                                <option value="name desc">Nombre Z-A</option>
                                                <option value="createdTime desc">Creacion reciente</option>
                                            </select>
                                            <select
                                                value={driveFileTypeFilter}
                                                onChange={(e) => setDriveFileTypeFilter(e.target.value)}
                                                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="all">Todos los tipos</option>
                                                <option value="pdf">📕 PDF</option>
                                                <option value="doc">📄 Word/Docs</option>
                                                <option value="sheet">📊 Excel/Sheets</option>
                                                <option value="slides">📽️ PowerPoint/Slides</option>
                                                <option value="email">📧 Email</option>
                                                <option value="audio">🎵 Audio</option>
                                                <option value="text">📃 Texto</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Search and filter indicators */}
                                    {(driveSearchQuery || driveFileTypeFilter !== 'all') && (
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            {driveSearchQuery && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                                                    <span>Busqueda: <strong>{driveSearchQuery}</strong></span>
                                                    <button
                                                        onClick={() => {
                                                            setDriveSearchQuery('');
                                                            loadDriveFiles(driveCurrentFolder, null, '', driveOrderBy);
                                                        }}
                                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                            {driveFileTypeFilter !== 'all' && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg">
                                                    <span>Tipo: <strong>
                                                        {driveFileTypeFilter === 'pdf' && '📕 PDF'}
                                                        {driveFileTypeFilter === 'doc' && '📄 Word/Docs'}
                                                        {driveFileTypeFilter === 'sheet' && '📊 Excel/Sheets'}
                                                        {driveFileTypeFilter === 'slides' && '📽️ Slides'}
                                                        {driveFileTypeFilter === 'email' && '📧 Email'}
                                                        {driveFileTypeFilter === 'audio' && '🎵 Audio'}
                                                        {driveFileTypeFilter === 'text' && '📃 Texto'}
                                                    </strong></span>
                                                    <button
                                                        onClick={() => setDriveFileTypeFilter('all')}
                                                        className="text-purple-600 dark:text-purple-400 hover:underline"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* File list */}
                                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                                        {driveLoading ? (
                                            <div className="p-8 text-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                                <p className="text-sm text-gray-500 mt-2">Cargando archivos...</p>
                                            </div>
                                        ) : filteredDriveFiles.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">
                                                {driveFileTypeFilter !== 'all'
                                                    ? 'No hay archivos de este tipo en esta carpeta'
                                                    : 'Esta carpeta esta vacia'}
                                            </div>
                                        ) : (
                                            <div className="max-h-80 overflow-y-auto">
                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={driveSelectedFiles.size > 0 && driveSelectedFiles.size === filteredDriveFiles.filter(f => f.isSupported && !f.isFolder).length}
                                                                    onChange={selectAllDriveFiles}
                                                                    className="rounded border-gray-300"
                                                                />
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                                Nombre
                                                            </th>
                                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                                Tipo
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                                        {filteredDriveFiles.map(file => (
                                                            <tr
                                                                key={file.id}
                                                                onClick={() => handleDriveFileClick(file)}
                                                                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                                                    driveSelectedFiles.has(file.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                                                } ${!file.isSupported && !file.isFolder ? 'opacity-50' : ''}`}
                                                            >
                                                                <td className="px-4 py-2">
                                                                    {!file.isFolder && (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={driveSelectedFiles.has(file.id)}
                                                                            onChange={() => {}}
                                                                            disabled={!file.isSupported}
                                                                            className="rounded border-gray-300"
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 flex items-center gap-2">
                                                                    <span className="text-xl">
                                                                        {file.isFolder ? '📁' :
                                                                         file.mimeType.includes('document') ? '📄' :
                                                                         file.mimeType.includes('spreadsheet') ? '📊' :
                                                                         file.mimeType.includes('presentation') ? '📽️' :
                                                                         file.mimeType.includes('pdf') ? '📕' :
                                                                         file.mimeType === 'message/rfc822' ? '📧' :
                                                                         file.mimeType.startsWith('audio/') ? '🎵' : '📃'}
                                                                    </span>
                                                                    <span className="text-sm text-gray-900 dark:text-white truncate max-w-xs">
                                                                        {file.name}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                                                    {file.fileType}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {/* Load more button */}
                                                {driveNextPageToken && (
                                                    <div className="mt-4 flex justify-center">
                                                        <button
                                                            onClick={() => loadDriveFiles(
                                                                driveSearchQuery ? null : driveCurrentFolder,
                                                                driveNextPageToken,
                                                                driveSearchQuery || '',
                                                                driveOrderBy
                                                            )}
                                                            disabled={driveLoading}
                                                            className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-300 dark:border-blue-600 disabled:opacity-50"
                                                        >
                                                            {driveLoading ? 'Cargando...' : 'Cargar más archivos'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Selection info and import button */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {driveSelectedFiles.size} archivo(s) seleccionado(s)
                                        </span>
                                        <button
                                            onClick={importSelectedDriveFiles}
                                            disabled={driveSelectedFiles.size === 0 || importing}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {importing ? 'Importando...' : 'Importar seleccionados'}
                                        </button>
                                    </div>

                                    {/* Tags input */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Tags (opcional, separados por coma)
                                        </label>
                                        <input
                                            type="text"
                                            value={tags}
                                            onChange={(e) => setTags(e.target.value)}
                                            placeholder="trabajo, investigacion, referencia"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            disabled={importing}
                                        />
                                    </div>

                                    {/* Drive Import Results */}
                                    {driveImportResults && (
                                        <div className="mt-4">
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                                Resultados de importacion
                                            </h4>
                                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 text-sm">
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                                        {driveImportResults.map((result, idx) => (
                                                            <tr key={idx} className={result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
                                                                <td className="px-4 py-2">
                                                                    {result.success ? '✓' : '✗'}
                                                                </td>
                                                                <td className="px-4 py-2">{result.file_name}</td>
                                                                <td className="px-4 py-2 text-gray-500">
                                                                    {result.success ? 'Importado' : result.error}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : importMode === 'files' ? (
                        /* Document Upload */
                        <div className="space-y-4">
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                    isDragging
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-300 dark:border-gray-600'
                                }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.doc,.eml"
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                    ref={docInputRef}
                                    className="hidden"
                                    id="doc-upload"
                                    multiple
                                    disabled={importing}
                                />
                                <label
                                    htmlFor="doc-upload"
                                    className={`cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="text-4xl mb-2">📕📘📧</div>
                                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                                        {importing ? 'Subiendo...' : isDragging ? 'Suelta los archivos aqui' : 'Arrastra documentos o haz clic para seleccionar'}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        PDF, Word (.docx, .doc), Email (.eml)
                                    </p>
                                    <span className="inline-block px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg">
                                        Seleccionar archivos
                                    </span>
                                </label>
                            </div>

                            {/* Tags input for files */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tags (opcional, separados por coma)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="trabajo, investigacion, referencia"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    disabled={importing}
                                />
                            </div>
                        </div>
                    ) : importMode === 'csv' ? (
                        /* CSV Upload */
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    ref={fileInputRef}
                                    className="hidden"
                                    id="csv-upload"
                                    disabled={importing}
                                />
                                <label
                                    htmlFor="csv-upload"
                                    className={`cursor-pointer ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="text-4xl mb-2">📄</div>
                                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                                        {importing ? 'Procesando...' : 'Arrastra un archivo CSV o haz clic para seleccionar'}
                                    </p>
                                    <span className="inline-block px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg">
                                        Seleccionar archivo
                                    </span>
                                </label>
                            </div>
                            <a
                                href="/import_template.csv"
                                download
                                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Descargar plantilla CSV de ejemplo
                            </a>
                        </div>
                    ) : (
                        /* URL Text Input */
                        <form onSubmit={handleImport}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    URLs (una por linea)
                                </label>
                                <textarea
                                    value={urls}
                                    onChange={(e) => setUrls(e.target.value)}
                                    placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://youtube.com/watch?v=..."
                                    rows={10}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    disabled={importing}
                                />
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {urlCount} URLs detectadas
                                    {importMode === 'normal' && urlCount > 100 && (
                                        <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                                            (considera usar modo Cola para +100 URLs)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tags (opcional, separados por coma)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="trabajo, investigacion, referencia"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    disabled={importing}
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="submit"
                                    disabled={importing || !urls.trim()}
                                    className="px-6 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {importing
                                        ? 'Procesando...'
                                        : importMode === 'queue'
                                            ? 'Encolar URLs'
                                            : 'Importar URLs'
                                    }
                                </button>
                                <Link
                                    href="/dashboard"
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    Cancelar
                                </Link>
                            </div>
                        </form>
                    )}

                    {/* Progress */}
                    {progress && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                <span className="text-blue-800 dark:text-blue-400">{progress}</span>
                            </div>
                        </div>
                    )}

                    {/* Queue Results */}
                    {queueResults && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">URLs encoladas</h3>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{queueResults.queued}</p>
                                    <p className="text-sm text-green-700 dark:text-green-400">Encoladas</p>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{queueResults.duplicates}</p>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">Duplicadas</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{queueResults.invalid}</p>
                                    <p className="text-sm text-red-700 dark:text-red-400">Invalidas</p>
                                </div>
                            </div>
                            {queueResults.queued > 0 && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Las URLs se procesaran automaticamente en segundo plano. Puedes ver el progreso en el panel de estado.
                                </p>
                            )}

                            {/* Show invalid/error URLs with details */}
                            {queueResults.details && queueResults.details.filter(d => d.status === 'error' || d.status === 'invalid').length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                                        URLs con errores ({queueResults.details.filter(d => d.status === 'error' || d.status === 'invalid').length}):
                                    </h4>
                                    <div className="max-h-48 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-red-50 dark:bg-red-900/30 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-1 text-left text-red-700 dark:text-red-400">URL</th>
                                                    <th className="px-2 py-1 text-left text-red-700 dark:text-red-400">Error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-red-100 dark:divide-red-900">
                                                {queueResults.details
                                                    .filter(d => d.status === 'error' || d.status === 'invalid')
                                                    .slice(0, 50)
                                                    .map((detail, idx) => (
                                                        <tr key={idx} className="bg-red-50/50 dark:bg-red-900/10">
                                                            <td className="px-2 py-1 font-mono text-red-600 dark:text-red-400 break-all max-w-xs">
                                                                {detail.url.length > 50 ? detail.url.substring(0, 50) + '...' : detail.url}
                                                            </td>
                                                            <td className="px-2 py-1 text-red-700 dark:text-red-300">
                                                                {detail.error || 'Error desconocido'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                        {queueResults.details.filter(d => d.status === 'error' || d.status === 'invalid').length > 50 && (
                                            <p className="px-2 py-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/30">
                                                ... y {queueResults.details.filter(d => d.status === 'error' || d.status === 'invalid').length - 50} mas
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* File Upload Results */}
                    {fileResults && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Archivos importados</h3>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{fileResults.total}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fileResults.successful}</p>
                                    <p className="text-sm text-green-700 dark:text-green-400">Exitosos</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{fileResults.failed}</p>
                                    <p className="text-sm text-red-700 dark:text-red-400">Fallidos</p>
                                </div>
                            </div>

                            {/* File results list */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Archivo
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                        {fileResults.results.map((result, idx) => (
                                            <tr key={idx} className={result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {result.success ? (
                                                        <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                                                    ) : (
                                                        <span className="text-red-600 dark:text-red-400 text-lg">✗</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-mono break-all text-gray-900 dark:text-gray-100">
                                                        {result.filename}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {result.success ? (
                                                        <span className="text-sm text-green-700 dark:text-green-400">
                                                            {result.title || 'Importado correctamente'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-red-700 dark:text-red-400">{result.error}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {fileResults.successful > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        Los archivos se procesaran automaticamente en segundo plano.
                                    </p>
                                    <Link
                                        href="/dashboard"
                                        className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200"
                                    >
                                        Ver contenidos importados →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Normal Import Results */}
                    {results && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Resultados</h3>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{results.total}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{results.successful}</p>
                                    <p className="text-sm text-green-700 dark:text-green-400">Exitosas</p>
                                </div>
                                <div
                                    className={`p-4 rounded-lg text-center cursor-pointer transition-colors ${
                                        showOnlyFailed
                                            ? 'bg-red-200 dark:bg-red-800/40 ring-2 ring-red-500'
                                            : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                                    }`}
                                    onClick={() => setShowOnlyFailed(!showOnlyFailed)}
                                    title="Clic para filtrar solo fallidas"
                                >
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failed}</p>
                                    <p className="text-sm text-red-700 dark:text-red-400">
                                        Fallidas {showOnlyFailed && '(filtrado)'}
                                    </p>
                                </div>
                            </div>

                            {/* Filter toggle */}
                            {results.failed > 0 && (
                                <div className="mb-4 flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showOnlyFailed}
                                            onChange={(e) => setShowOnlyFailed(e.target.checked)}
                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        Mostrar solo URLs fallidas ({results.failed})
                                    </label>
                                    {showOnlyFailed && results.failed > 0 && (
                                        <button
                                            onClick={() => {
                                                const failedUrls = results.results
                                                    .filter(r => !r.success)
                                                    .map(r => r.url)
                                                    .join('\n');
                                                setUrls(failedUrls);
                                                setResults(null);
                                                setShowOnlyFailed(false);
                                            }}
                                            className="text-sm px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                                        >
                                            Reintentar fallidas
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Detailed results */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                URL
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                        {results.results
                                            .filter(result => !showOnlyFailed || !result.success)
                                            .map((result, idx) => (
                                            <tr key={idx} className={result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {result.success ? (
                                                        <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                                                    ) : (
                                                        <span className="text-red-600 dark:text-red-400 text-lg">✗</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <a
                                                        href={result.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-mono break-all text-blue-600 dark:text-blue-400 hover:underline"
                                                        title={result.url}
                                                    >
                                                        {result.url.length > 60
                                                            ? result.url.substring(0, 60) + '...'
                                                            : result.url}
                                                    </a>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {result.success ? (
                                                        <span className="text-sm text-green-700 dark:text-green-400">Importado correctamente</span>
                                                    ) : (
                                                        <span className="text-sm text-red-700 dark:text-red-400">{result.error}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex gap-4 flex-wrap">
                                {results.successful > 0 && (
                                    <Link
                                        href="/dashboard"
                                        className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200"
                                    >
                                        Ver contenidos importados →
                                    </Link>
                                )}
                                {results.failed > 0 && (
                                    <button
                                        onClick={() => {
                                            const failedUrls = results.results
                                                .filter(r => !r.success)
                                                .map(r => r.url)
                                                .join('\n');
                                            navigator.clipboard.writeText(failedUrls);
                                            alert(`${results.failed} URLs copiadas al portapapeles`);
                                        }}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    >
                                        Copiar URLs fallidas
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
