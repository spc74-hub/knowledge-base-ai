'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

export default function ImportPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [urls, setUrls] = useState('');
    const [tags, setTags] = useState('');
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [results, setResults] = useState<ImportResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResults(null);
        setImporting(true);

        // Parse URLs (one per line, filter empty lines)
        const urlList = urls
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urlList.length === 0) {
            setError('Por favor, introduce al menos una URL');
            setImporting(false);
            return;
        }

        setProgress(`Procesando ${urlList.length} URLs...`);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const response = await fetch(`${API_URL}/api/v1/content/bulk-import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
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

            // Clear form if all successful
            if (data.failed === 0) {
                setUrls('');
                setTags('');
            }

        } catch (err: any) {
            setError(err.message || 'Error en la importacion');
            setProgress(null);
        } finally {
            setImporting(false);
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
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Importacion masiva de URLs</h2>
                        <p className="text-gray-600 dark:text-gray-300">
                            Pega multiples URLs (una por linea) para importarlas todas a la vez.
                            Cada URL sera procesada automaticamente: se extraera el contenido,
                            se clasificara y se generara un resumen.
                        </p>
                    </div>

                    <form onSubmit={handleImport}>
                        {error && (
                            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

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
                                {urls.split('\n').filter(u => u.trim()).length} URLs detectadas
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
                                {importing ? 'Importando...' : 'Importar URLs'}
                            </button>
                            <Link
                                href="/dashboard"
                                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                Cancelar
                            </Link>
                        </div>
                    </form>

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
                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failed}</p>
                                    <p className="text-sm text-red-700 dark:text-red-400">Fallidas</p>
                                </div>
                            </div>

                            {/* Detailed results */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
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
                                                    <span className="text-sm font-mono break-all text-gray-900 dark:text-white">
                                                        {result.url.length > 60
                                                            ? result.url.substring(0, 60) + '...'
                                                            : result.url}
                                                    </span>
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

                            {results.successful > 0 && (
                                <div className="mt-4">
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
                </div>
            </main>
        </div>
    );
}
